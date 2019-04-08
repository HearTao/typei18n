import * as ts from 'typescript'
import {
  RecordTypeDescriptor,
  TypeDescriptorKind,
  ArgType,
  ArgKind
} from './types'
import { isParamArgType } from './utils'

export function genRecordType(
  merged: RecordTypeDescriptor
): ts.TypeLiteralNode {
  return ts.createTypeLiteralNode(
    Object.entries(merged.value).map(([key, value]) => {
      switch (value.kind) {
        case TypeDescriptorKind.string:
          return ts.createPropertySignature(
            undefined,
            key,
            undefined,
            ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
            undefined
          )
        case TypeDescriptorKind.call:
          return ts.createPropertySignature(
            undefined,
            key,
            undefined,
            ts.createFunctionTypeNode(
              undefined,
              [
                ts.createParameter(
                  undefined,
                  undefined,
                  undefined,
                  'options',
                  undefined,
                  ts.createTypeLiteralNode(
                    value.body
                      .filter(isParamArgType)
                      .sort()
                      .map(arg =>
                        ts.createPropertySignature(
                          undefined,
                          arg.name,
                          undefined,
                          ts.createUnionTypeNode([
                            ts.createKeywordTypeNode(
                              ts.SyntaxKind.StringKeyword
                            ),
                            ts.createKeywordTypeNode(
                              ts.SyntaxKind.NumberKeyword
                            )
                          ]),
                          undefined
                        )
                      )
                  )
                )
              ],
              ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword)
            ),
            undefined
          )
        case TypeDescriptorKind.record:
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

export function genLanguageType(lang: string[]) {
  return ts.createTypeAliasDeclaration(
    undefined,
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.createIdentifier('Language'),
    undefined,
    ts.createUnionTypeNode(
      lang.map(l => ts.createLiteralTypeNode(ts.createStringLiteral(l)))
    )
  )
}

export function genResourceType(name: string, type: ts.TypeNode) {
  return ts.createTypeAliasDeclaration(
    undefined,
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    name,
    undefined,
    type
  )
}

export function genFuncCall(body: ArgType[]): ts.ArrowFunction {
  return ts.createArrowFunction(
    undefined,
    undefined,
    [
      ts.createParameter(
        undefined,
        undefined,
        undefined,
        'options',
        undefined,
        ts.createTypeLiteralNode(
          body
            .filter(isParamArgType)
            .sort()
            .map(x =>
              ts.createPropertySignature(
                undefined,
                x.name,
                undefined,
                ts.createUnionTypeNode([
                  ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
                  ts.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword)
                ]),
                undefined
              )
            )
        )
      )
    ],
    undefined,
    undefined,
    ts.createCall(
      ts.createPropertyAccess(
        ts.createArrayLiteral(
          body.map(x =>
            isParamArgType(x)
              ? ts.createPropertyAccess(
                  ts.createIdentifier('options'),
                  ts.createIdentifier(x.name)
                )
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

export function genRecordLiteral(
  node: RecordTypeDescriptor
): ts.ObjectLiteralExpression {
  return ts.createObjectLiteral(
    Object.entries(node.value).map(([key, value]) => {
      switch (value.kind) {
        case TypeDescriptorKind.string:
          return ts.createPropertyAssignment(key, ts.createLiteral(value.value))
        case TypeDescriptorKind.record:
          return ts.createPropertyAssignment(key, genRecordLiteral(value))
        case TypeDescriptorKind.call:
          return ts.createPropertyAssignment(key, genFuncCall(value.body))
        default:
          throw new Error('unknown')
      }
    }),
    true
  )
}

export function genResource(
  type: ts.Identifier,
  typeNodes: ReadonlyArray<[string, RecordTypeDescriptor]>
) {
  return ts.createParen(
    ts.createAsExpression(
      ts.createObjectLiteral(
        typeNodes.map(([file, node]) =>
          ts.createPropertyAssignment(
            ts.createStringLiteral(file),
            genRecordLiteral(node)
          )
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

export function genResourceExport(
  type: ts.Identifier,
  typeNodes: ReadonlyArray<[string, RecordTypeDescriptor]>
): ts.ExportAssignment {
  return ts.createExportAssignment(
    undefined,
    undefined,
    undefined,
    genResource(type, typeNodes)
  )
}

export function genProvider() {
  return ts.createClassDeclaration(
    undefined,
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.createIdentifier('i18nProvider'),
    [
      ts.createTypeParameterDeclaration(
        ts.createIdentifier('K'),
        ts.createTypeOperatorNode(
          ts.SyntaxKind.KeyOfKeyword,
          ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)
        ),
        undefined
      ),
      ts.createTypeParameterDeclaration(
        ts.createIdentifier('U'),
        undefined,
        undefined
      )
    ],
    undefined,
    [
      ts.createConstructor(
        undefined,
        undefined,
        [
          ts.createParameter(
            undefined,
            [ts.createModifier(ts.SyntaxKind.PrivateKeyword)],
            undefined,
            ts.createIdentifier('maps'),
            undefined,
            ts.createTypeReferenceNode(ts.createIdentifier('Record'), [
              ts.createTypeReferenceNode(ts.createIdentifier('K'), undefined),
              ts.createTypeReferenceNode(ts.createIdentifier('U'), undefined)
            ]),
            undefined
          ),
          ts.createParameter(
            undefined,
            [ts.createModifier(ts.SyntaxKind.PublicKeyword)],
            undefined,
            ts.createIdentifier('lang'),
            undefined,
            ts.createTypeReferenceNode(ts.createIdentifier('K'), undefined),
            undefined
          )
        ],
        ts.createBlock([], true)
      ),
      ts.createGetAccessor(
        undefined,
        [ts.createModifier(ts.SyntaxKind.PublicKeyword)],
        ts.createIdentifier('t'),
        [],
        undefined,
        ts.createBlock(
          [
            ts.createReturn(
              ts.createElementAccess(
                ts.createPropertyAccess(
                  ts.createThis(),
                  ts.createIdentifier('maps')
                ),
                ts.createPropertyAccess(
                  ts.createThis(),
                  ts.createIdentifier('lang')
                )
              )
            )
          ],
          true
        )
      )
    ]
  )
}

export function genProviderExport(
  type: ts.Identifier,
  typeNodes: ReadonlyArray<[string, RecordTypeDescriptor]>,
  lang: string
) {
  return [
    ts.createVariableStatement(
      undefined,
      ts.createVariableDeclarationList(
        [
          ts.createVariableDeclaration(
            ts.createIdentifier('provider'),
            undefined,
            ts.createNew(ts.createIdentifier('i18nProvider'), undefined, [
              genResource(type, typeNodes),
              ts.createStringLiteral(lang)
            ])
          )
        ],
        ts.NodeFlags.Const
      )
    ),
    ts.createExportAssignment(
      undefined,
      undefined,
      undefined,
      ts.createIdentifier('provider')
    )
  ]
}

const argsReg = /{{\s([a-zA-Z0-9]*)\s}}/g
export function matchCallBody(str: string): ArgType[] | null {
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

    match = argsReg.exec(str)
  } while (match)

  if (result.length) {
    if (lastIndex < str.length) {
      result.push({
        kind: ArgKind.literal,
        value: str.substring(lastIndex)
      })
    }
    return result
  }
  return null
}
