export type YamlNode = string | number | { [v: string]: YamlNode }

export enum ArgKind {
  literal = "literal",
  param = "param"
}

export interface LiteralArg {
  kind: ArgKind.literal
  value: string
}

export interface ParamArg {
  kind: ArgKind.param
  name: string
}

export type ArgType = LiteralArg | ParamArg

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
  body: ArgType[]
}

export interface RecordTypeNode {
  kind: TypeNodeKind.record
  value: Record<string, TypeNode>
}

export type TypeNode = StringTypeNode | CallTypeNode | RecordTypeNode
