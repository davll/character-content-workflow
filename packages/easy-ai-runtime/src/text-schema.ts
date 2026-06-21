import { z, type ZodType } from 'zod';

type JsonSchema = Record<string, unknown>;

const MAX_OBJECT_DEPTH = 5;
const MAX_TOTAL_PROPERTIES = 100;
const MAX_TOTAL_STRING_LENGTH = 15_000;
const MAX_TOTAL_ENUM_VALUES = 500;
const MAX_LARGE_ENUM_STRING_LENGTH = 7_500;
const LARGE_ENUM_VALUE_THRESHOLD = 250;

const ALWAYS_UNSUPPORTED_KEYWORDS = new Set([
  'allOf',
  'not',
  'dependentRequired',
  'dependentSchemas',
  'if',
  'then',
  'else',
]);

const TYPE_SPECIFIC_UNSUPPORTED_KEYWORDS = new Set([
  'minLength',
  'maxLength',
  'pattern',
  'format',
  'minimum',
  'maximum',
  'multipleOf',
  'patternProperties',
  'minItems',
  'maxItems',
]);

const SUPPORTED_TYPES = new Set([
  'string',
  'number',
  'boolean',
  'integer',
  'object',
  'array',
  'null',
]);

interface ValidationState {
  errors: string[];
  totalProperties: number;
  totalStringLength: number;
  totalEnumValues: number;
}

export function validateStrictJsonSchema<TSchema extends ZodType>(schema: TSchema): TSchema {
  const jsonSchema = z.toJSONSchema(schema) as JsonSchema;
  delete jsonSchema.$schema;

  const state: ValidationState = {
    errors: [],
    totalProperties: 0,
    totalStringLength: 0,
    totalEnumValues: 0,
  };

  if (!isObjectSchema(jsonSchema)) {
    state.errors.push('schema: root schema must be an object schema');
  }
  if (Array.isArray(jsonSchema.anyOf)) {
    state.errors.push('schema: root schema must not use anyOf');
  }

  validateSchemaNode(jsonSchema, 'schema', 1, state);

  if (state.totalProperties > MAX_TOTAL_PROPERTIES) {
    state.errors.push(`schema: total object properties must be <= ${MAX_TOTAL_PROPERTIES}; received ${state.totalProperties}`);
  }
  if (state.totalStringLength > MAX_TOTAL_STRING_LENGTH) {
    state.errors.push(`schema: total string literal length must be <= ${MAX_TOTAL_STRING_LENGTH}; received ${state.totalStringLength}`);
  }
  if (state.totalEnumValues > MAX_TOTAL_ENUM_VALUES) {
    state.errors.push(`schema: total enum values must be <= ${MAX_TOTAL_ENUM_VALUES}; received ${state.totalEnumValues}`);
  }

  if (state.errors.length > 0) {
    throw new Error(`Schema is not valid for strict structured outputs:\n${state.errors.map((error) => `- ${error}`).join('\n')}`);
  }

  return schema;
}

// Backwards-compatible alias for the original TODO spelling. Prefer validateStrictJsonSchema.
export const validateStrictJsonShema = validateStrictJsonSchema;

function validateSchemaNode(schema: unknown, path: string, objectDepth: number, state: ValidationState): void {
  if (Array.isArray(schema)) {
    schema.forEach((item, index) => validateSchemaNode(item, `${path}[${index}]`, objectDepth, state));
    return;
  }

  if (!isPlainObject(schema)) {
    return;
  }

  validateUnsupportedKeywords(schema, path, state);
  validateSupportedType(schema, path, state);
  validateEnum(schema, path, state);

  if (isObjectSchema(schema)) {
    validateObjectSchema(schema, path, objectDepth, state);
  }

  for (const [key, value] of Object.entries(schema)) {
    if (key === 'properties' && isPlainObject(value)) {
      for (const [propertyName, propertySchema] of Object.entries(value)) {
        validateSchemaNode(propertySchema, `${path}.properties.${propertyName}`, objectDepth + 1, state);
      }
      continue;
    }

    if (key === '$defs' && isPlainObject(value)) {
      for (const [definitionName, definitionSchema] of Object.entries(value)) {
        state.totalStringLength += definitionName.length;
        validateSchemaNode(definitionSchema, `${path}.$defs.${definitionName}`, 1, state);
      }
      continue;
    }

    if (key === 'anyOf' && Array.isArray(value)) {
      value.forEach((item, index) => validateSchemaNode(item, `${path}.anyOf[${index}]`, objectDepth, state));
      continue;
    }

    if (key === 'items') {
      validateSchemaNode(value, `${path}.items`, objectDepth, state);
      continue;
    }

  }
}

function validateObjectSchema(schema: JsonSchema, path: string, objectDepth: number, state: ValidationState): void {
  if (objectDepth > MAX_OBJECT_DEPTH) {
    state.errors.push(`${path}: object nesting depth must be <= ${MAX_OBJECT_DEPTH}`);
  }

  if (schema.additionalProperties !== false) {
    state.errors.push(`${path}: object schemas must set additionalProperties to false`);
  }

  if (!isPlainObject(schema.properties)) {
    return;
  }

  const propertyNames = Object.keys(schema.properties);
  const required = Array.isArray(schema.required) ? schema.required.filter((item): item is string => typeof item === 'string') : [];
  const requiredSet = new Set(required);

  state.totalProperties += propertyNames.length;
  for (const propertyName of propertyNames) {
    state.totalStringLength += propertyName.length;
    if (!requiredSet.has(propertyName)) {
      state.errors.push(`${path}: property "${propertyName}" must be listed in required`);
    }
  }

  for (const requiredName of required) {
    if (!Object.hasOwn(schema.properties, requiredName)) {
      state.errors.push(`${path}: required property "${requiredName}" is not defined in properties`);
    }
  }
}

function validateUnsupportedKeywords(schema: JsonSchema, path: string, state: ValidationState): void {
  for (const key of Object.keys(schema)) {
    if (ALWAYS_UNSUPPORTED_KEYWORDS.has(key) || TYPE_SPECIFIC_UNSUPPORTED_KEYWORDS.has(key)) {
      state.errors.push(`${path}: keyword "${key}" is not supported by strict structured outputs`);
    }
  }
}

function validateSupportedType(schema: JsonSchema, path: string, state: ValidationState): void {
  if (typeof schema.$ref === 'string' || Array.isArray(schema.anyOf) || Array.isArray(schema.enum) || Object.hasOwn(schema, 'const')) {
    return;
  }

  const types = Array.isArray(schema.type) ? schema.type : typeof schema.type === 'string' ? [schema.type] : [];
  if (types.length === 0) {
    state.errors.push(`${path}: schema nodes must specify a supported type, anyOf, enum, const, or $ref`);
    return;
  }

  for (const type of types) {
    if (!SUPPORTED_TYPES.has(type)) {
      state.errors.push(`${path}: type "${type}" is not supported by strict structured outputs`);
    }
  }
}

function validateEnum(schema: JsonSchema, path: string, state: ValidationState): void {
  if (Object.hasOwn(schema, 'const')) {
    addStringLength(schema.const, state);
  }

  if (!Array.isArray(schema.enum)) {
    return;
  }

  state.totalEnumValues += schema.enum.length;

  let enumStringLength = 0;
  for (const value of schema.enum) {
    const length = stringLiteralLength(value);
    state.totalStringLength += length;
    enumStringLength += length;
  }

  if (schema.enum.length > LARGE_ENUM_VALUE_THRESHOLD && enumStringLength > MAX_LARGE_ENUM_STRING_LENGTH) {
    state.errors.push(`${path}: enum string literal length must be <= ${MAX_LARGE_ENUM_STRING_LENGTH} when enum has more than ${LARGE_ENUM_VALUE_THRESHOLD} values`);
  }
}

function isObjectSchema(schema: JsonSchema): boolean {
  return hasType(schema, 'object');
}

function hasType(schema: JsonSchema, type: string): boolean {
  return schema.type === type || (Array.isArray(schema.type) && schema.type.includes(type));
}

function addStringLength(value: unknown, state: ValidationState): void {
  state.totalStringLength += stringLiteralLength(value);
}

function stringLiteralLength(value: unknown): number {
  return typeof value === 'string' ? value.length : 0;
}

function isPlainObject(value: unknown): value is JsonSchema {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
