export type YamlNode = string | number | { [v: string]: YamlNode }

export enum TypeNodeKind {
  string,
  call,
  record
}

export interface StringTypeNode {
  kind: TypeNodeKind.string
  raw: string
}

export interface CallTypeNode {
  kind: TypeNodeKind.call
  raw: string,
  args: string[]
}

export interface RecordTypeNode {
  kind: TypeNodeKind.record
  value: Record<string, TypeNode>
}

export type TypeNode = StringTypeNode | CallTypeNode | RecordTypeNode
