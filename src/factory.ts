import {
  StringTypeDescriptor,
  TypeDescriptorKind,
  CallTypeDescriptor,
  ArgType,
  RecordTypeDescriptor,
  TypeDescriptor,
  MissingRecordTypeDescriptor
} from './types'

export function createStringTypeDescriptor(
  value: string
): StringTypeDescriptor {
  return {
    kind: TypeDescriptorKind.string,
    value: value
  }
}

export function createCallTypeDescriptor(body: ArgType[]): CallTypeDescriptor {
  return {
    kind: TypeDescriptorKind.call,
    body: body
  }
}

export function createRecordTypeDescriptor(
  value: Record<string, TypeDescriptor>
): RecordTypeDescriptor {
  return {
    kind: TypeDescriptorKind.record,
    value
  }
}

export function createMissingRecordTypeDescriptor(): MissingRecordTypeDescriptor {
  return {
    kind: TypeDescriptorKind.record,
    missing: true,
    value: {}
  }
}
