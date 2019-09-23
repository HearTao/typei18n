export type YamlNode = string | number | { [v: string]: YamlNode }

export const enum ArgKind {
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

export const enum Target {
  resource = 'resource',
  provider = 'provider',
  type = 'type'
}

export const enum MismatchedKeyType { LHS, RHS }

export const enum ErrorType {
  UnexpectedValueType,
  NotFoundKey,
  MismatchedKind,
  MismatchedArguments
}

export type ErrorRecord =
  | { type: ErrorType.UnexpectedValueType, path: string, payload: [ string, string ] }
  | { type: ErrorType.MismatchedKind, path: string }
  | { type: ErrorType.MismatchedArguments, path: string }
  | { type: ErrorType.NotFoundKey, path: string, payload: [ MismatchedKeyType, Set<string> ] }

export interface Context {
  errors: Map<string, ErrorRecord>
  paths: string[]
}

export interface NamedValue<T = string> {
  name: string
  value: T
}
