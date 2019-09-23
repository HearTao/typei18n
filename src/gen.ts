import * as ts from 'typescript'

import { YamlNode, RecordTypeDescriptor, Target, Context, NamedValue, CallTypeDescriptor, MismatchedKeyType, ErrorType, ErrorRecord } from './types'
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

function toTypeNode(node: YamlNode, name: string, context: Context): RecordTypeDescriptor {
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
          toTypeNode(value, name, ctx)
        )
        break
      default:
        createError(context.errors, ErrorType.UnexpectedValueType, `${getCurrentPath(context)}.${key}`, [ name, value ])
        break
    }
  })

  return record
}

function createError(errors: Map<string, ErrorRecord>, type: ErrorType.UnexpectedValueType, path: string, payload: [ string, string ] ): void
function createError(errors: Map<string, ErrorRecord>, type: ErrorType.NotFoundKey, path: string, payload: [ MismatchedKeyType, string ] ): void
function createError(errors: Map<string, ErrorRecord>, type: ErrorType.MismatchedKind, path: string): void
function createError(errors: Map<string, ErrorRecord>, type: ErrorType.MismatchedArguments, path: string): void
function createError(errors: any, type: any, path: any, payload?: any): any {
  const id = [type, path].join(';')
  switch(type) {
    case ErrorType.NotFoundKey: {
      const record = errors.get(id)
      if(record) return record.payload[1].add(payload[1])
      return errors.set(id, { type, path, payload: [ payload[0], new Set([ payload[1] ])] })
    }

    case ErrorType.UnexpectedValueType:
    case ErrorType.MismatchedKind:
    case ErrorType.MismatchedArguments: {
      const record = errors.get(id)
      if(record) return
      errors.set(id, { type, path, payload })
    }
  }
}

function merge(
  target: RecordTypeDescriptor,
  source: RecordTypeDescriptor,
  name: string,
  context: Context
): RecordTypeDescriptor {
  Object.entries(target.value).forEach(([key, value]) => {
    const nodePath = `${getCurrentPath(context)}.${key}`

    if (!(key in source.value)) {
      createError(context.errors, ErrorType.NotFoundKey, nodePath, [ MismatchedKeyType.LHS, name ])
      return
    }
    if (source.value[key].kind !== value.kind) {
      createError(context.errors, ErrorType.MismatchedKind, nodePath)
      return
    }
  })

  Object.entries(source.value).forEach(([key, value]) => {
    const nodePath = `${getCurrentPath(context)}.${key}`

    if (!(key in target.value)) {
      if (isMissingRecordTypeDescriptor(target)) {
        target.value[key] = source.value[key]
      } else {
        createError(context.errors, ErrorType.NotFoundKey, nodePath, [ MismatchedKeyType.RHS, name ])
      }
      return
    }

    const targetValue = target.value[key]
    if (isStringType(targetValue) && isStringType(value)) {
    } else if (isCallType(targetValue) && isCallType(value)) {
      const targetArgs = targetValue.body.filter(isParamArgType)
      const sourceArgs = value.body.filter(isParamArgType)

      if (!arrayEq(targetArgs, sourceArgs, x => x.name)) {
        createError(context.errors, ErrorType.MismatchedArguments, nodePath)
        return
      }
    } else if (isRecordType(targetValue) && isRecordType(value)) {
      inPathContext(context, key, ctx => merge(targetValue, value, name, ctx))
    } else {
      createError(context.errors, ErrorType.MismatchedKind, nodePath)
      return
    }
  })

  if (isMissingRecordTypeDescriptor(target)) {
    delete target.missing
  }

  return target
}

function printError(error: ErrorRecord, typeNodes: NamedValue<RecordTypeDescriptor>[]): string {
  const names = new Set(typeNodes.map(({ name }) => name))

  switch(error.type) {
    case ErrorType.UnexpectedValueType: {
      return i18n.t.errors.unexpected_value({ 
        path: error.path, 
        value: String(error.payload[1]), 
        name: error.payload[0], 
        type: typeof error.payload[1] 
      })
    }

    case ErrorType.NotFoundKey: {
      const [ type, set ] = error.payload
      const missing = MismatchedKeyType.RHS === type ? [...diffArray(names, set)].join(',') : [...set].join(', ')
      return i18n.t.errors.key_missing_in_path({ path: error.path, missing: `(${missing})` })
    }

    case ErrorType.MismatchedKind: {
      const out: string[] = []
      getPathNodes(typeNodes, error.path).reduce<Map<string, string[]>>((acc, { name, value }) => {
        const { kind } = value
        const arr = acc.get(kind)
        if(!arr) acc.set(kind, [ name ])
        else arr.push(name)
        return acc
      }, new Map).forEach((names, kind) => {
        out.push(`  - ${kind} (${names.join(', ')})`)
      })
      return i18n.t.errors.type_of_path_is_unexpected({ path: error.path, types: '\n' + out.join('\n') })
    }

    case ErrorType.MismatchedArguments: {
      const out: string[] = []
    
      getPathNodes(typeNodes, error.path).reduce<Map<string, string[]>>((acc, { name, value }) => {
        const args = (<CallTypeDescriptor>value).body.filter(isParamArgType).map(x => x.name).join(', ')
        const arr = acc.get(args)
        if(!arr) acc.set(args, [ name ])
        else arr.push(name)
        return acc
      }, new Map).forEach((names, args) => {
        out.push(`  - call({ ${args} }) (${names.join(', ')})`)
      })

      return i18n.t.errors.args_is_different({ path: error.path, args: '\n' + out.join('\n') })
    }
  }
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
  const context: Context = { errors: new Map, paths: [] }

  const typeNodes: NamedValue<RecordTypeDescriptor>[] = files
    .map(
      ({name, value}) => ({ name, value: toTypeNode(value, name, context) })
    )
  
  // console.log(require('util').inspect(typeNodes, { depth: null }))

  const merged = typeNodes.reduce<RecordTypeDescriptor>(
    (prev, { name, value }) => merge(prev, value, name, context),
    createMissingRecordTypeDescriptor()
  )

  if (context.errors.size) {
    const out: string[] = []
    let index = 1
    context.errors.forEach(record => {
      const title = index + '.Error: ' + record.type
      const hr = '-'.repeat(process.stdout.columns ? process.stdout.columns - title.length : 40)
      out.push(title + hr + '\n\n' + printError(record, typeNodes))
      index++
    })
    throw new Error(
      '\n' +
      'Errors: \n\n' +
      out.join('\n\n') + 
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
