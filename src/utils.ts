import {
  TypeNode,
  StringTypeNode,
  TypeNodeKind,
  CallTypeNode,
  RecordTypeNode,
  ArgType,
  ParamArg,
  ArgKind
} from './types'

export function isStringType(v: TypeNode): v is StringTypeNode {
  return v.kind === TypeNodeKind.string
}

export function isCallType(v: TypeNode): v is CallTypeNode {
  return v.kind === TypeNodeKind.call
}

export function isRecordType(v: TypeNode): v is RecordTypeNode {
  return v.kind === TypeNodeKind.record
}

export function arrayEq<T>(a: T[], b: T[], cb: (a: T) => string): boolean {
  if (a.length !== b.length) return false
  const set = new Set<string>(a.map(x => cb(x)))
  return b.every(x => set.has(cb(x)))
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
