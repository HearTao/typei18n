export type YamlNode = string | number | { [v: string]: YamlNode }

export enum ArgKind {
  literal = 'literal',
  param = 'param'
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

export const enum TypeDescriptorKind {
  string = 'String',
  call = 'Function',
  record = 'Record'
}

export interface StringTypeDescriptor {
  kind: TypeDescriptorKind.string
  value: string
}

export interface CallTypeDescriptor {
  kind: TypeDescriptorKind.call
  body: ArgType[]
}

export interface RecordTypeDescriptor {
  kind: TypeDescriptorKind.record
  value: Record<string, TypeDescriptor>
}

export interface MissingRecordTypeDescriptor extends RecordTypeDescriptor {
  missing: true
}

export type TypeDescriptor =
  | StringTypeDescriptor
  | CallTypeDescriptor
  | RecordTypeDescriptor
  | MissingRecordTypeDescriptor

export enum Target {
  resource = 'resource',
  provider = 'provider',
  type = 'type'
}

export interface Context {
  errors: Set<string>
  paths: string[]
  missing: Map<string, { missing: Set<string>, exists: Set<string> }>
  unkind: Set<string>
  unargs: Set<string>
}

export interface NamedValue<T = string> {
  name: string
  value: T
}
