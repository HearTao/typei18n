import * as yaml from 'yaml'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'
import * as prettier from 'prettier'
import * as prettierConfig from './prettier.json'

import { YamlNode, RecordTypeDescriptor, Target, Context } from './types'
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
  genRecordLiteral
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
  typeNodes: [string, RecordTypeDescriptor][],
  lazy: boolean,
  defaultLang: string
) {
  switch (target) {
    case Target.resource:
      return [genResourceExport(typeAlias.name, typeNodes)]
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

export function gen(filenames: string[], target?: Target): string
export function gen(
  filenames: string[],
  target: Target | undefined,
  lazy: true,
  defaultLanguage: string
): [string, [string, string][]]
export function gen(
  filenames: string[],
  target: Target = Target.resource,
  lazy?: boolean,
  defaultLanguage?: string
): [string, [string, string][]] | string {
  const context: Context = { errors: [], paths: [] }

  const files = filenames.map(
    file =>
      [path.basename(file, '.yaml'), fs.readFileSync(file).toString()] as [
        string,
        string
      ]
  )
  const typeNodes = files
    .map(([f, x]) => [f, yaml.parse(x) as YamlNode])
    .map(
      ([f, x]) => [f, toTypeNode(x, context)] as [string, RecordTypeDescriptor]
    )

  const merged = typeNodes.reduce<RecordTypeDescriptor>(
    (prev, [_, next]) => merge(prev, next, context),
    createMissingRecordTypeDescriptor()
  )

  if (context.errors.length) {
    throw new Error(context.errors.join('\n'))
  }

  const rootType = 'RootType'
  const langs = files.map(first)
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

  const others = lazy
    ? typeNodes
        .filter(x => x[0] !== defaultLang)
        .map(
          ([file, node]) =>
            [
              file,
              print([
                ts.createExportAssignment(
                  undefined,
                  undefined,
                  undefined,
                  genRecordLiteral(node)
                )
              ])
            ] as [string, string]
        )
    : []

  const code = prettier.format(
    print([languageType, resourceType, ...exportDefault]),
    prettierConfig as prettier.Options
  )
  return lazy ? ([code, others] as [string, [string, string][]]) : code
}
