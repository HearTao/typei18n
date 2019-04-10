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

function genFuncCall(body: ArgType[]): ts.ArrowFunction {
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

function genAsyncProperty(key: string) {
  return ts.createParen(
    ts.createArrowFunction(
      undefined,
      undefined,
      [],
      undefined,
      ts.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
      ts.createCall(
        ts.createPropertyAccess(
          ts.createCall(
            ts.createNode(ts.SyntaxKind.ImportKeyword) as ts.Expression,
            undefined,
            [ts.createStringLiteral(`./${key}`)]
          ),
          ts.createIdentifier('then')
        ),
        undefined,
        [
          ts.createArrowFunction(
            undefined,
            undefined,
            [
              ts.createParameter(
                undefined,
                undefined,
                undefined,
                ts.createIdentifier('x'),
                undefined,
                undefined,
                undefined
              )
            ],
            undefined,
            ts.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
            ts.createAsExpression(
              ts.createPropertyAccess(
                ts.createIdentifier('x'),
                ts.createIdentifier('default')
              ),
              ts.createTypeReferenceNode(
                ts.createIdentifier('RootType'),
                undefined
              )
            )
          )
        ]
      )
    )
  )
}

function genResource(
  type: ts.Identifier,
  typeNodes: ReadonlyArray<[string, RecordTypeDescriptor]>,
  lazy: boolean,
  lang: string
) {
  return ts.createParen(
    ts.createAsExpression(
      ts.createObjectLiteral(
        typeNodes.map(([file, node]) =>
          ts.createPropertyAssignment(
            ts.createStringLiteral(file),
            !lazy || lang === file
              ? genRecordLiteral(node)
              : genAsyncProperty(file)
          )
        ),
        false
      ),
      ts.createTypeReferenceNode(ts.createIdentifier('Record'), [
        ts.createTypeReferenceNode(ts.createIdentifier('Language'), undefined),
        lazy
          ? ts.createUnionTypeNode([
              ts.createTypeReferenceNode(type, undefined),
              ts.createParenthesizedType(
                ts.createFunctionTypeNode(
                  undefined,
                  [],
                  ts.createTypeReferenceNode(ts.createIdentifier('Promise'), [
                    ts.createTypeReferenceNode(type, undefined)
                  ])
                )
              )
            ])
          : ts.createTypeReferenceNode(type, undefined)
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
    genResource(type, typeNodes, false, '')
  )
}

function genSyncProvider() {
  return ts.createClassDeclaration(
    undefined,
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.createIdentifier('I18nProvider'),
    undefined,
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
              ts.createTypeReferenceNode(
                ts.createIdentifier('Language'),
                undefined
              ),
              ts.createTypeReferenceNode(
                ts.createIdentifier('RootType'),
                undefined
              )
            ]),
            undefined
          ),
          ts.createParameter(
            undefined,
            [ts.createModifier(ts.SyntaxKind.PrivateKeyword)],
            undefined,
            ts.createIdentifier('_lang'),
            undefined,
            ts.createTypeReferenceNode(
              ts.createIdentifier('Language'),
              undefined
            ),
            undefined
          )
        ],
        ts.createBlock([], true)
      ),
      ts.createGetAccessor(
        undefined,
        undefined,
        ts.createIdentifier('lang'),
        [],
        undefined,
        ts.createBlock(
          [
            ts.createReturn(
              ts.createPropertyAccess(
                ts.createThis(),
                ts.createIdentifier('_lang')
              )
            )
          ],
          true
        )
      ),
      ts.createMethod(
        undefined,
        [ts.createModifier(ts.SyntaxKind.PublicKeyword)],
        undefined,
        ts.createIdentifier('setLanguage'),
        undefined,
        undefined,
        [
          ts.createParameter(
            undefined,
            undefined,
            undefined,
            ts.createIdentifier('lang'),
            undefined,
            ts.createTypeReferenceNode(
              ts.createIdentifier('Language'),
              undefined
            ),
            undefined
          )
        ],
        undefined,
        ts.createBlock(
          [
            ts.createExpressionStatement(
              ts.createBinary(
                ts.createPropertyAccess(
                  ts.createThis(),
                  ts.createIdentifier('_lang')
                ),
                ts.createToken(ts.SyntaxKind.FirstAssignment),
                ts.createIdentifier('lang')
              )
            )
          ],
          true
        )
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

function genAsyncProvider() {
  return ts.createClassDeclaration(
    undefined,
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    ts.createIdentifier('LazyI18nProvider'),
    undefined,
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
              ts.createTypeReferenceNode(
                ts.createIdentifier('Language'),
                undefined
              ),
              ts.createUnionTypeNode([
                ts.createTypeReferenceNode(
                  ts.createIdentifier('RootType'),
                  undefined
                ),
                ts.createParenthesizedType(
                  ts.createFunctionTypeNode(
                    undefined,
                    [],
                    ts.createTypeReferenceNode(ts.createIdentifier('Promise'), [
                      ts.createTypeReferenceNode(
                        ts.createIdentifier('RootType'),
                        undefined
                      )
                    ])
                  )
                )
              ])
            ]),
            undefined
          ),
          ts.createParameter(
            undefined,
            [ts.createModifier(ts.SyntaxKind.PrivateKeyword)],
            undefined,
            ts.createIdentifier('_lang'),
            undefined,
            ts.createTypeReferenceNode(
              ts.createIdentifier('Language'),
              undefined
            ),
            undefined
          )
        ],
        ts.createBlock([], true)
      ),
      ts.createGetAccessor(
        undefined,
        undefined,
        ts.createIdentifier('lang'),
        [],
        undefined,
        ts.createBlock(
          [
            ts.createReturn(
              ts.createPropertyAccess(
                ts.createThis(),
                ts.createIdentifier('_lang')
              )
            )
          ],
          true
        )
      ),
      ts.createMethod(
        undefined,
        [ts.createModifier(ts.SyntaxKind.PublicKeyword)],
        undefined,
        ts.createIdentifier('setLanguage'),
        undefined,
        undefined,
        [
          ts.createParameter(
            undefined,
            undefined,
            undefined,
            ts.createIdentifier('lang'),
            undefined,
            ts.createTypeReferenceNode(
              ts.createIdentifier('Language'),
              undefined
            ),
            undefined
          )
        ],
        undefined,
        ts.createBlock(
          [
            ts.createVariableStatement(
              undefined,
              ts.createVariableDeclarationList(
                [
                  ts.createVariableDeclaration(
                    ts.createIdentifier('r'),
                    undefined,
                    ts.createElementAccess(
                      ts.createPropertyAccess(
                        ts.createThis(),
                        ts.createIdentifier('maps')
                      ),
                      ts.createIdentifier('lang')
                    )
                  )
                ],
                ts.NodeFlags.Const
              )
            ),
            ts.createIf(
              ts.createBinary(
                ts.createTypeOf(ts.createIdentifier('r')),
                ts.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken),
                ts.createStringLiteral('function')
              ),
              ts.createBlock(
                [
                  ts.createReturn(
                    ts.createCall(
                      ts.createPropertyAccess(
                        ts.createCall(ts.createIdentifier('r'), undefined, []),
                        ts.createIdentifier('then')
                      ),
                      undefined,
                      [
                        ts.createArrowFunction(
                          undefined,
                          undefined,
                          [
                            ts.createParameter(
                              undefined,
                              undefined,
                              undefined,
                              ts.createIdentifier('rec'),
                              undefined,
                              undefined,
                              undefined
                            )
                          ],
                          undefined,
                          ts.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                          ts.createBlock(
                            [
                              ts.createIf(
                                ts.createBinary(
                                  ts.createTypeOf(
                                    ts.createElementAccess(
                                      ts.createPropertyAccess(
                                        ts.createThis(),
                                        ts.createIdentifier('maps')
                                      ),
                                      ts.createIdentifier('lang')
                                    )
                                  ),
                                  ts.createToken(
                                    ts.SyntaxKind.EqualsEqualsEqualsToken
                                  ),
                                  ts.createStringLiteral('function')
                                ),
                                ts.createBlock(
                                  [
                                    ts.createExpressionStatement(
                                      ts.createBinary(
                                        ts.createElementAccess(
                                          ts.createPropertyAccess(
                                            ts.createThis(),
                                            ts.createIdentifier('maps')
                                          ),
                                          ts.createIdentifier('lang')
                                        ),
                                        ts.createToken(
                                          ts.SyntaxKind.FirstAssignment
                                        ),
                                        ts.createIdentifier('rec')
                                      )
                                    ),
                                    ts.createExpressionStatement(
                                      ts.createBinary(
                                        ts.createPropertyAccess(
                                          ts.createThis(),
                                          ts.createIdentifier('_lang')
                                        ),
                                        ts.createToken(
                                          ts.SyntaxKind.FirstAssignment
                                        ),
                                        ts.createIdentifier('lang')
                                      )
                                    )
                                  ],
                                  true
                                ),
                                undefined
                              )
                            ],
                            true
                          )
                        )
                      ]
                    )
                  )
                ],
                true
              ),
              ts.createBlock(
                [
                  ts.createExpressionStatement(
                    ts.createBinary(
                      ts.createPropertyAccess(
                        ts.createThis(),
                        ts.createIdentifier('_lang')
                      ),
                      ts.createToken(ts.SyntaxKind.FirstAssignment),
                      ts.createIdentifier('lang')
                    )
                  ),
                  ts.createReturn(
                    ts.createCall(
                      ts.createPropertyAccess(
                        ts.createIdentifier('Promise'),
                        ts.createIdentifier('resolve')
                      ),
                      undefined,
                      []
                    )
                  )
                ],
                true
              )
            )
          ],
          true
        )
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
              ts.createAsExpression(
                ts.createElementAccess(
                  ts.createPropertyAccess(
                    ts.createThis(),
                    ts.createIdentifier('maps')
                  ),
                  ts.createPropertyAccess(
                    ts.createThis(),
                    ts.createIdentifier('lang')
                  )
                ),
                ts.createTypeReferenceNode(
                  ts.createIdentifier('RootType'),
                  undefined
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

export function genProvider(lazy: boolean) {
  return lazy ? genAsyncProvider() : genSyncProvider()
}

export function genProviderExportDeclaration(provider: ts.Identifier) {
  return [
    ts.createVariableStatement(
      [ts.createModifier(ts.SyntaxKind.DeclareKeyword)],
      ts.createVariableDeclarationList(
        [
          ts.createVariableDeclaration(
            ts.createIdentifier('provider'),
            ts.createTypeReferenceNode(provider, undefined)
          )
        ],
        ts.NodeFlags.Const
      )
    ),
    ts.createExportAssignment(
      undefined,
      [ts.createModifier(ts.SyntaxKind.DeclareKeyword)],
      undefined,
      ts.createIdentifier('provider')
    )
  ]
}

export function genProviderExport(
  type: ts.Identifier,
  provider: ts.Identifier,
  typeNodes: ReadonlyArray<[string, RecordTypeDescriptor]>,
  lazy: boolean,
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
            ts.createNew(provider, undefined, [
              genResource(type, typeNodes, lazy, lang),
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
