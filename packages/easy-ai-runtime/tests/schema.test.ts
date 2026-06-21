import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { validateStrictJsonSchema, validateStrictJsonShema } from '../src/text-schema.ts';

test('validateStrictJsonSchema returns the same schema when it matches strict structured output rules', () => {
  const schema = z.object({
    ok: z.boolean(),
    count: z.number(),
    tag: z.enum(['a', 'b']),
    nested: z.object({
      label: z.string().nullable(),
    }),
    items: z.array(z.object({
      value: z.string(),
    })),
  });

  assert.equal(validateStrictJsonSchema(schema), schema);
});

test('validateStrictJsonShema remains available as a typo-compatible alias', () => {
  const schema = z.object({ ok: z.boolean() });

  assert.equal(validateStrictJsonShema(schema), schema);
});

test('validateStrictJsonSchema rejects non-object root schemas', () => {
  assert.throws(
    () => validateStrictJsonSchema(z.array(z.object({ name: z.string() }))),
    /root schema must be an object schema/,
  );
});

test('validateStrictJsonSchema rejects top-level anyOf schemas', () => {
  assert.throws(
    () => validateStrictJsonSchema(z.union([
      z.object({ kind: z.literal('a') }),
      z.object({ kind: z.literal('b') }),
    ])),
    /root schema must not use anyOf/,
  );
});

test('validateStrictJsonSchema rejects optional object properties', () => {
  assert.throws(
    () => validateStrictJsonSchema(z.object({
      requiredValue: z.string(),
      optionalValue: z.string().optional(),
    })),
    /property "optionalValue" must be listed in required/,
  );
});

test('validateStrictJsonSchema rejects unsupported JSON schema keywords', () => {
  assert.throws(
    () => validateStrictJsonSchema(z.object({
      name: z.string().min(1),
    })),
    /keyword "minLength" is not supported/,
  );

  assert.throws(
    () => validateStrictJsonSchema(z.object({
      item: z.intersection(
        z.object({ left: z.string() }),
        z.object({ right: z.string() }),
      ),
    })),
    /keyword "allOf" is not supported/,
  );
});

test('validateStrictJsonSchema rejects untyped schemas', () => {
  assert.throws(
    () => validateStrictJsonSchema(z.object({
      value: z.any(),
    })),
    /schema nodes must specify a supported type/,
  );
});

test('validateStrictJsonSchema enforces object nesting and total property limits', () => {
  assert.throws(
    () => validateStrictJsonSchema(z.object({
      level2: z.object({
        level3: z.object({
          level4: z.object({
            level5: z.object({
              level6: z.object({
                value: z.string(),
              }),
            }),
          }),
        }),
      }),
    })),
    /object nesting depth must be <= 5/,
  );

  const properties: Record<string, z.ZodString> = {};
  for (let i = 0; i < 101; i += 1) {
    properties[`p${i}`] = z.string();
  }

  assert.throws(
    () => validateStrictJsonSchema(z.object(properties)),
    /total object properties must be <= 100/,
  );
});
