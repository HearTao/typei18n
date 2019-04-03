import { TypeNode, StringTypeNode, TypeNodeKind, CallTypeNode, RecordTypeNode } from "./types";

export function isStringType(v: TypeNode): v is StringTypeNode {
  return v.kind === TypeNodeKind.string
}

export function isCallType(v: TypeNode): v is CallTypeNode {
  return v.kind === TypeNodeKind.call
}

export function isRecordType(v: TypeNode): v is RecordTypeNode {
  return v.kind === TypeNodeKind.record
}

export function arrayEq<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false
  const set = new Set<T>(a)
  return b.every(x => set.has(x))
}
