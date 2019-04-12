import * as ts from 'typescript'

import { YamlNode, RecordTypeDescriptor, Target, Context, NamedValue } from './types'
import {
  isStringType,
  isCallType,
  arrayEq,
  isRecordType,
  isParamArgType,
  first,
  getCurrentPath,
  inPathContext,
  isMissingRecordTypeDescriptor
} from './utils'
import {
  genRecordType,
  genResourceExport,
  genProvider,
  genProviderExport,
  matchCallBody,
  genResourceType,
  genLanguageType,
  genRecordLiteral,
  genProviderExportDeclaration,
  genProviderDeclaration
} from './helper'
import {
  createMissingRecordTypeDescriptor,
  createStringTypeDescriptor,
  createCallTypeDescriptor,
  createRecordTypeDescriptor
} from './factory'

import i18n from './locales'

function toTypeNode(node: YamlNode, context: Context): RecordTypeDescriptor {
  const record = createRecordTypeDescriptor({})

  Object.entries(node).forEach(([key, value]) => {
    switch (typeof value) {
      case 'number':
        value = value.toString()
      case 'string':
        const args = matchCallBody(value)
        if (!args) {
          record.value[key] = createStringTypeDescriptor(value)
        } else {
          record.value[key] = createCallTypeDescriptor(args)
        }
        break
      case 'object':
        record.value[key] = inPathContext(context, key, ctx =>
          toTypeNode(value, ctx)
        )
        break
      default:
        context.errors.push(i18n.t.errors.unexpected_value({ key, value }))
        break
    }
  })

  return record
}

function merge(
  target: RecordTypeDescriptor,
  source: RecordTypeDescriptor,
  context: Context
): RecordTypeDescriptor {
  Object.entries(target.value).forEach(([key, value]) => {
    if (!(key in source.value)) {
      context.errors.push(
        i18n.t.errors.key_missing_in_path({
          key,
          path: getCurrentPath(context)
        })
      )
      return
    }
    if (source.value[key].kind !== value.kind) {
      context.errors.push(
        i18n.t.errors.type_of_path_is_unexpected({
          path: `${getCurrentPath(context)}.${key}`,
          actually: source.value[key].kind,
          should: value.kind
        })
      )
      return
    }
  })

  Object.entries(source.value).forEach(([key, value]) => {
    if (!(key in target.value)) {
      if (isMissingRecordTypeDescriptor(target)) {
        target.value[key] = source.value[key]
      } else {
        context.errors.push(
          i18n.t.errors.key_missing_in_path({
            key,
            path: getCurrentPath(context)
          })
        )
      }
      return
    }

    const targetValue = target.value[key]
    if (isStringType(targetValue) && isStringType(value)) {
    } else if (isCallType(targetValue) && isCallType(value)) {
      const targetArgs = targetValue.body.filter(isParamArgType)
      const sourceArgs = value.body.filter(isParamArgType)

      if (!arrayEq(targetArgs, sourceArgs, x => x.name)) {
        context.errors.push(
          i18n.t.errors.args_is_different({
            path: `${getCurrentPath(context)}.${key}`,
            one: targetArgs.map(x => x.name).join(','),
            two: sourceArgs.map(x => x.name).join(',')
          })
        )
        return
      }
    } else if (isRecordType(targetValue) && isRecordType(value)) {
      inPathContext(context, key, ctx => merge(targetValue, value, ctx))
    } else {
      context.errors.push(
        i18n.t.errors.type_of_path_is_unexpected({
          path: `${getCurrentPath(context)}.${key}`,
          actually: value.kind,
          should: targetValue.kind
        })
      )
      return
    }
  })

  if (isMissingRecordTypeDescriptor(target)) {
    delete target.missing
  }

  return target
}

function print(nodes: ts.Node[]) {
  return ts
    .createPrinter()
    .printList(
      ts.ListFormat.MultiLine,
      ts.createNodeArray(nodes),
      ts.createSourceFile('', '', ts.ScriptTarget.Latest)
    )
}

function genExportDefault(
  target: Target,
  typeAlias: ts.TypeAliasDeclaration,
  typeNodes: NamedValue<RecordTypeDescriptor>[],
  lazy: boolean,
  defaultLang: string
) {
  switch (target) {
    case Target.resource:
      return [genResourceExport(typeAlias.name, typeNodes)]
    case Target.type:
      const providerDeclaration = genProviderDeclaration(lazy)
      return [
        providerDeclaration,
        ...genProviderExportDeclaration(providerDeclaration.name!)
      ]
    case Target.provider:
      const provider = genProvider(lazy)
      return [
        provider,
        ...genProviderExport(
          typeAlias.name,
          provider.name!,
          typeNodes,
          lazy,
          defaultLang
        )
      ]
  }
}

export function gen(files: NamedValue<YamlNode>[], target?: Target): string
export function gen(
  files: NamedValue<YamlNode>[],
  target: Target | undefined,
  lazy: true,
  defaultLanguage: string
): [string, [string, string][]]
export function gen(
  files: NamedValue<YamlNode>[],
  target: Target = Target.resource,
  lazy?: boolean,
  defaultLanguage?: string
): [string, [string, string][]] | string {
  const context: Context = { errors: [], paths: [] }

  const typeNodes: NamedValue<RecordTypeDescriptor>[] = files
    .map(
      ({name, value}) => ({ name, value: toTypeNode(value, context) })
    )

  const merged = typeNodes.reduce<RecordTypeDescriptor>(
    (prev, { value }) => merge(prev, value, context),
    createMissingRecordTypeDescriptor()
  )

  if (context.errors.length) {
    throw new Error(context.errors.join('\n'))
  }

  const rootType = 'RootType'
  const langs = files.map(x => x.name)
  const defaultLang = defaultLanguage || first(langs)
  const languageType = genLanguageType(langs)
  const resourceType = genResourceType(rootType, genRecordType(merged))

  const exportDefault = genExportDefault(
    target,
    resourceType,
    typeNodes,
    !!lazy,
    defaultLang
  )

  const others =
    lazy && target !== Target.type
      ? typeNodes
          .filter(x => x.name !== defaultLang)
          .map(
            ({name, value}) =>
              [
                name,
                print([
                  ts.createExportAssignment(
                    undefined,
                    undefined,
                    undefined,
                    genRecordLiteral(value)
                  )
                ])
              ] as [string, string]
          )
      : []

  const code = print([languageType, resourceType, ...exportDefault])
  return lazy ? ([code, others] as [string, [string, string][]]) : code
}
