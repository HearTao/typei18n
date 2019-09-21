import {
  TypeDescriptor,
  StringTypeDescriptor,
  TypeDescriptorKind,
  CallTypeDescriptor,
  RecordTypeDescriptor,
  ArgType,
  ParamArg,
  ArgKind,
  Context,
  MissingRecordTypeDescriptor
} from './types'

export function isStringType(v: TypeDescriptor): v is StringTypeDescriptor {
  return v.kind === TypeDescriptorKind.string
}

export function isCallType(v: TypeDescriptor): v is CallTypeDescriptor {
  return v.kind === TypeDescriptorKind.call
}

export function isRecordType(v: TypeDescriptor): v is RecordTypeDescriptor {
  return v.kind === TypeDescriptorKind.record
}

export function arrayEq<T>(a: T[], b: T[], cb: (a: T) => string): boolean {
  if (a.length !== b.length) return false
  const set = new Set<string>(a.map(x => cb(x)))
  return b.every(x => set.has(cb(x)))
}

export function diffArray<T>(a: Set<T>, b: Set<T>): Set<T> {
  const diff: Set<T> = new Set
  a.forEach(val => {
    if(b.has(val)) return
    diff.add(val)
  })
  return diff
}

export function isParamArgType(v: ArgType): v is ParamArg {
  return v.kind === ArgKind.param
}

export function first<T>(v: T[]): T {
  if (!v || !v.length) {
    throw new Error('index out of range')
  }
  return v[0]
}

export function getCurrentPath(context: Context) {
  return context.paths.length ? context.paths.join('.') : ''
}

export function inPathContext<T>(
  context: Context,
  path: string,
  cb: (ctx: Context) => T
): T {
  context.paths.push(path)
  const result = cb(context)
  const p = context.paths.pop()
  if (p !== path) {
    throw new Error(`unexpected context path: expected ${path}, actually ${p}`)
  }
  return result
}

export function isMissingRecordTypeDescriptor(
  v: RecordTypeDescriptor | MissingRecordTypeDescriptor
): v is MissingRecordTypeDescriptor {
  return 'missing' in v && v.missing
}