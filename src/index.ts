import * as yaml from 'yaml'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'

import {
  YamlNode,
  TypeNodeKind,
  RecordTypeNode,
  ArgType,
  ArgKind
} from './types'
import {
  isStringType,
  isCallType,
  arrayEq,
  isRecordType,
  isParamArgType
} from './utils'

const callRegex = /{{\s([a-zA-Z0-9]*)\s}}/g

function matchCallBody(reg: RegExp, str: string): ArgType[] | null {
  let result: ArgType[] = []
  let match: RegExpExecArray | null = null
  let lastIndex = 0

  do {
    if (match) {
      const [full, text] = match
      const idx = match.index
      if (idx > lastIndex) {
        result.push({
          kind: ArgKind.literal,
          value: str.substring(lastIndex, idx)
        })
      }
      result.push({
        kind: ArgKind.param,
        name: text
      })
      lastIndex = idx + full.length
    }

    match = reg.exec(str)
  } while (match)

  if (result.length && lastIndex < str.length) {
    result.push({
      kind: ArgKind.literal,
      value: str.substring(lastIndex)
    })
    return result
  }
  return null
}

function toTypeNode(node: YamlNode, errors: string[]): RecordTypeNode {
  const record: RecordTypeNode = {
    kind: TypeNodeKind.record,
    value: {}
  }

  Object.entries(node).forEach(([key, value]) => {
    switch (typeof value) {
      case 'number':
        value = value.toString()
      case 'string':
        const args = matchCallBody(callRegex, value)
        if (!args) {
          record.value[key] = {
            kind: TypeNodeKind.string,
            raw: value
          }
        } else {
          record.value[key] = {
            kind: TypeNodeKind.call,
            raw: value,
            body: args
          }
        }
        break
      case 'object':
        record.value[key] = toTypeNode(value, errors)
        break
      default:
        errors.push(`unexpected value: [${key}, ${value}]`)
        break
    }
  })

  return record
}

function transform(v: YamlNode): RecordTypeNode {
  const errors: string[] = []
  const node = toTypeNode(v, errors)
  if (errors.length) {
    throw new Error(errors.join('\n'))
  }
  return node
}

function merge(
  target: RecordTypeNode,
  source: RecordTypeNode,
  errors: string[]
): RecordTypeNode {
  if (
    target.kind !== TypeNodeKind.record ||
    source.kind !== TypeNodeKind.record
  ) {
    throw new Error('type node must be Record')
  }
  Object.entries(target.value).forEach(([key, value]) => {
    if (!(key in source.value)) {
      errors.push(`unexpected property: ${key} is missing in ${source.kind}`)
      return
    }
    if (source.value[key].kind !== value.kind) {
      errors.push(
        `unexpected type: (${key})[${target.value[key].kind}, ${value.kind}]`
      )
      return
    }
  })

  Object.entries(source.value).forEach(([key, value]) => {
    if (!(key in target.value)) {
      target.value[key] = value
      return
    }

    const targetValue = target.value[key]
    if (isStringType(targetValue) && isStringType(value)) {
    } else if (isCallType(targetValue) && isCallType(value)) {
      if (
        !arrayEq(
          targetValue.body.filter(isParamArgType),
          value.body.filter(isParamArgType),
          x => x.name
        )
      ) {
        errors.push(
          `unexpected args: (${key}) has different args: [${
            targetValue.body
          }, ${value.body}]`
        )
        return
      }
    } else if (isRecordType(targetValue) && isRecordType(value)) {
      merge(targetValue, value, errors)
    } else {
      errors.push(
        `unexpected type: (${key})[${target.value[key].kind}, ${value.kind}]`
      )
      return
    }
  })
  return target
}

function genRecordType(merged: RecordTypeNode): ts.TypeLiteralNode {
  return ts.createTypeLiteralNode(
    Object.entries(merged.value).map(([key, value]) => {
      switch (value.kind) {
        case TypeNodeKind.string:
          return ts.createPropertySignature(
            undefined,
            key,
            undefined,
            ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
            undefined
          )
        case TypeNodeKind.call:
          return ts.createPropertySignature(
            undefined,
            key,
            undefined,
            ts.createFunctionTypeNode(
              undefined,
              value.body
                .filter(isParamArgType)
                .sort()
                .map(arg =>
                  ts.createParameter(
                    undefined,
                    undefined,
                    undefined,
                    arg.name,
                    undefined,
                    ts.createUnionTypeNode([
                      ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
                      ts.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword)
                    ]),
                    undefined
                  )
                ),
              ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword)
            ),
            undefined
          )
        case TypeNodeKind.record:
          return ts.createPropertySignature(
            undefined,
            key,
            undefined,
            genRecordType(value),
            undefined
          )
      }
    })
  )
}

function genAlias(name: string, type: ts.TypeNode) {
  return ts.createTypeAliasDeclaration(
    undefined,
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    name,
    undefined,
    type
  )
}

function genFuncCall(body: ArgType[]): ts.ArrowFunction {
  return ts.createArrowFunction(
    undefined,
    undefined,
    body
      .filter(isParamArgType)
      .sort()
      .map(x =>
        ts.createParameter(
          undefined,
          undefined,
          undefined,
          x.name,
          undefined,
          ts.createUnionTypeNode([
            ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
            ts.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword)
          ]),
          undefined
        )
      ),
    undefined,
    undefined,
    ts.createCall(
      ts.createPropertyAccess(
        ts.createArrayLiteral(
          body.map(x =>
            isParamArgType(x)
              ? ts.createIdentifier(x.name)
              : ts.createStringLiteral(x.value)
          ),
          false
        ),
        ts.createIdentifier('join')
      ),
      undefined,
      [ts.createStringLiteral('')]
    )
  )
}

function genRecordLiteral(node: RecordTypeNode): ts.ObjectLiteralExpression {
  return ts.createObjectLiteral(
    Object.entries(node.value).map(([key, value]) => {
      switch (value.kind) {
        case TypeNodeKind.string:
          return ts.createPropertyAssignment(key, ts.createLiteral(value.raw))
        case TypeNodeKind.record:
          return ts.createPropertyAssignment(key, genRecordLiteral(value))
        case TypeNodeKind.call:
          return ts.createPropertyAssignment(key, genFuncCall(value.body))
        default:
          throw new Error('unknown')
      }
    }),
    true
  )
}

function genExportDefault(
  type: ts.Identifier,
  typeNodes: ReadonlyArray<[string, RecordTypeNode]>
): ts.ExportAssignment {
  return ts.createExportAssignment(
    undefined,
    undefined,
    undefined,
    ts.createAsExpression(
      ts.createObjectLiteral(
        typeNodes.map(([file, node]) =>
          ts.createPropertyAssignment(file, genRecordLiteral(node))
        ),
        false
      ),
      ts.createTypeReferenceNode(ts.createIdentifier('Record'), [
        ts.createUnionTypeNode(
          typeNodes.map(([file]) =>
            ts.createLiteralTypeNode(ts.createStringLiteral(file))
          )
        ),
        ts.createTypeReferenceNode(type, undefined)
      ])
    )
  )
}

function print(
  typeAlias: ts.TypeAliasDeclaration,
  exportDefault: ts.ExportAssignment
) {
  return ts
    .createPrinter()
    .printList(
      ts.ListFormat.MultiLine,
      ts.createNodeArray(([typeAlias] as ts.Node[]).concat([exportDefault])),
      ts.createSourceFile('', '', ts.ScriptTarget.Latest)
    )
}

export function gen(filenames: string[]) {
  const files = filenames.map(
    file =>
      [path.basename(file, '.yaml'), fs.readFileSync(file).toString()] as [
        string,
        string
      ]
  )
  const typeNodes = files
    .map(([f, x]) => [f, yaml.parse(x) as YamlNode])
    .map(([f, x]) => [f, transform(x)] as [string, RecordTypeNode])
  const errors: string[] = []
  const merged = typeNodes.reduce(
    (prev, [_, next]) => merge(prev, next, errors),
    { kind: TypeNodeKind.record, value: {} } as RecordTypeNode
  )
  if (errors.length) {
    throw new Error(errors.join('\n'))
  }

  const rootType = 'RootType'
  const typeAlias = genAlias(rootType, genRecordType(merged))
  const exportDefault = genExportDefault(typeAlias.name, typeNodes)

  const code = print(typeAlias, exportDefault)
  return code
}
