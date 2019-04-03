import * as yaml from 'yaml'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'

import { YamlNode, TypeNodeKind, RecordTypeNode, TypeNode } from './types'
import { isStringType, isCallType, arrayEq, isRecordType } from './utils';

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
        record.value[key] = {
          kind: TypeNodeKind.string,
          raw: value
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

function merge(target: RecordTypeNode, source: RecordTypeNode, errors: string[]): RecordTypeNode {
  if (target.kind !== TypeNodeKind.record || source.kind !== TypeNodeKind.record) {
    throw new Error('type node must be Record')
  }
  Object.entries(target.value).forEach(([key, value]) => {
    if (!(key in source.value)) {
      errors.push(`unexpected property: ${key} is missing in ${source.kind}`)
      return
    }
    if (source.value[key].kind !== value.kind) {
      errors.push(`unexpected type: (${key})[${target.value[key].kind}, ${value.kind}]`)
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
      if (!arrayEq(targetValue.args, value.args)) {
        errors.push(`unexpected args: (${key}) has different args: [${targetValue.args}, ${value.args}]`)
        return
      }
    } else if (isRecordType(targetValue) && isRecordType(value)) {
      merge(targetValue, value, errors)
    } else {
      errors.push(`unexpected type: (${key})[${target.value[key].kind}, ${value.kind}]`)
      return
    }
  })
  return target
}

function genRecordType(merged: RecordTypeNode): ts.TypeLiteralNode {
  return ts.createTypeLiteralNode(Object.entries(merged.value).map(([key, value]) => {
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
            value.args.map(arg => ts.createParameter(
              undefined,
              undefined,
              undefined,
              arg,
              undefined,
              ts.createUnionTypeNode([
                ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
                ts.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
              ]),
              undefined
            )),
            ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
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
  }))
}

function genAlias(name: string, type: ts.TypeNode) {
  return ts.createTypeAliasDeclaration(
    undefined,
    undefined,
    name,
    undefined,
    type
  )
}

function genRecordLiteral(node: RecordTypeNode): ts.ObjectLiteralExpression {
  return ts.createObjectLiteral(Object.entries(node.value).map(([key, value]) => {
    switch (value.kind) {
      case TypeNodeKind.string:
        return ts.createPropertyAssignment(key, ts.createLiteral(value.raw))
      case TypeNodeKind.record:
        return ts.createPropertyAssignment(key, genRecordLiteral(value))
      default:
        throw new Error('unknown')
    }
  }), true)
}

function genVarDeclaration(name: string, type: ts.Identifier, value: ts.ObjectLiteralExpression) {
  return ts.createVariableStatement(
    undefined,
    ts.createVariableDeclarationList([
      ts.createVariableDeclaration(
        name,
        ts.createTypeReferenceNode(type, undefined),
        value
      )
    ], ts.NodeFlags.Const)
  )
}

function print(typeAlias: ts.TypeAliasDeclaration, vars: ts.VariableStatement[]) {
  return ts.createPrinter().printList(ts.ListFormat.MultiLine, ts.createNodeArray(([typeAlias] as ts.Node[]).concat(vars)), ts.createSourceFile('', '', ts.ScriptTarget.Latest))
}

export function gen(input: string, output: string) {
  const files = fs.readdirSync(input).filter(x => x.endsWith('.yaml')).map(file => [path.basename(file, '.yaml'), fs.readFileSync(path.join(input, file)).toString()] as const)

  const typeNodes = files.map(([f, x]) => [f, yaml.parse(x) as YamlNode] as const).map(([f, x]) => [f, transform(x)] as const)
  const errors: string[] = []
  const merged = typeNodes.reduce((prev, [_, next]) => merge(prev, next, errors), { kind: TypeNodeKind.record, value: {} } as RecordTypeNode)
  if (errors.length) {
    throw new Error(errors.join('\n'))
  }

  const rootType = 'RootType'
  const typeAlias = genAlias(rootType, genRecordType(merged))
  const vars = typeNodes.map(([file, node]) => genVarDeclaration(file, typeAlias.name, genRecordLiteral(node)))

  const code = print(typeAlias, vars)

  const dir = path.dirname(output)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(output, code)
}
