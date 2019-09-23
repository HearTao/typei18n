import * as ts from 'typescript'

import { YamlNode, RecordTypeDescriptor, Target, Context, NamedValue, CallTypeDescriptor } from './types'
import {
  isStringType,
  isCallType,
  arrayEq,
  isRecordType,
  isParamArgType,
  first,
  getCurrentPath,
  inPathContext,
  isMissingRecordTypeDescriptor,
  diffArray,
  getPathNodes
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
        context.errors.add(i18n.t.errors.unexpected_value({ key, value }))
        break
    }
  })

  return record
}

function merge(
  target: RecordTypeDescriptor,
  source: RecordTypeDescriptor,
  name: string,
  context: Context
): RecordTypeDescriptor {
  Object.entries(target.value).forEach(([key, value]) => {
    if (!(key in source.value)) {
      const miss = context.missing.get(`${getCurrentPath(context)}.${key}`)
      if(undefined === miss) {
        context.missing.set(`${getCurrentPath(context)}.${key}`, { exists: new Set, missing: new Set([ name ]) })
      } else {
        miss.missing.add(name)
      }
      return
    }
    if (source.value[key].kind !== value.kind) {
      context.unkind.add(`${getCurrentPath(context)}.${key}`)
      return
    }
  })

  Object.entries(source.value).forEach(([key, value]) => {
    if (!(key in target.value)) {
      if (isMissingRecordTypeDescriptor(target)) {
        target.value[key] = source.value[key]
      } else {
        const miss = context.missing.get(`${getCurrentPath(context)}.${key}`)
        if(undefined === miss) {
          context.missing.set(`${getCurrentPath(context)}.${key}`, { exists: new Set([ name ]), missing: new Set })
        } else {
          miss.exists.add(name)
        }
      }
      return
    }

    const targetValue = target.value[key]
    if (isStringType(targetValue) && isStringType(value)) {
    } else if (isCallType(targetValue) && isCallType(value)) {
      const targetArgs = targetValue.body.filter(isParamArgType)
      const sourceArgs = value.body.filter(isParamArgType)

      if (!arrayEq(targetArgs, sourceArgs, x => x.name)) {
        context.unargs.add(`${getCurrentPath(context)}.${key}`)
        return
      }
    } else if (isRecordType(targetValue) && isRecordType(value)) {
      inPathContext(context, key, ctx => merge(targetValue, value, name, ctx))
    } else {
      context.unkind.add(`${getCurrentPath(context)}.${key}`)
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
  const context: Context = { errors: new Set, paths: [], missing: new Map, unkind: new Set, unargs: new Set }

  const names = new Set(files.map(({ name }) => name))
  const typeNodes: NamedValue<RecordTypeDescriptor>[] = files
    .map(
      ({name, value}) => ({ name, value: toTypeNode(value, context) })
    )
  
  // console.log(require('util').inspect(typeNodes, { depth: null }))

  const merged = typeNodes.reduce<RecordTypeDescriptor>(
    (prev, { name, value }) => merge(prev, value, name, context),
    createMissingRecordTypeDescriptor()
  )

  if(context.missing.size) {
    context.missing.forEach(({ missing, exists }, path) => {
      const miss = exists.size ? [...diffArray(names, exists)].join(',') : [...missing].join(',')
      context.errors.add(
        i18n.t.errors.key_missing_in_path({
          path,
          missing: miss
        })
      )
    })
  }

  if(context.unargs.size) {
    context.unargs.forEach((_, path) => {
      const out: string[] = []
      
      getPathNodes(typeNodes, path).reduce<Map<string, string[]>>((acc, { name, value }) => {
        const args = (<CallTypeDescriptor>value).body.filter(isParamArgType).map(x => x.name).join(', ')
        const arr = acc.get(args)
        if(!arr) acc.set(args, [ name ])
        else arr.push(name)
        return acc
      }, new Map).forEach((names, args) => {
        out.push(`    - call({ ${args} }) (${names.join(', ')})`)
      })

      context.errors.add(
        i18n.t.errors.args_is_different({
          path,
          args: '\n' + out.join('\n')
        })
      )
    })
  }

  if(context.unkind.size) {
    context.unkind.forEach((_, path) => {
      const out: string[] = []
      
      getPathNodes(typeNodes, path).reduce<Map<string, string[]>>((acc, { name, value }) => {
        const { kind } = value
        const arr = acc.get(kind)
        if(!arr) acc.set(kind, [ name ])
        else arr.push(name)
        return acc
      }, new Map).forEach((names, kind) => {
        out.push(`    - ${kind} (${names.join(', ')})`)
      })

      context.errors.add(
        i18n.t.errors.type_of_path_is_unexpected({
          path,
          types: '\n' + out.join('\n')
        })
      )
    })
  }

  
  if (context.errors.size) {
    throw new Error('\n' +
      'Errors: \n\n' +
      [...context.errors].map((msg, idx) => `${idx + 1}. ${msg}`).join('\n\n') + 
      '\n'
    )
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
