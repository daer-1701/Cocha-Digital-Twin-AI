// Minimal JSON Schema check for the subset FastAPI emits in packages/shared/openapi.json.
import { readFileSync } from "node:fs";

export const openapi = JSON.parse(
  readFileSync(new URL("../../../../packages/shared/openapi.json", import.meta.url), "utf8"),
);

function resolve(schema) {
  if (!schema.$ref) return schema;
  const name = schema.$ref.replace("#/components/schemas/", "");
  const target = openapi.components.schemas[name];
  if (!target) throw new Error(`Unknown schema reference ${schema.$ref}`);
  return target;
}

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

export function validate(input, value, path = "$") {
  const schema = resolve(input);
  const errors = [];
  if (schema.anyOf) {
    const results = schema.anyOf.map((option) => validate(option, value, path));
    if (results.some((result) => result.length === 0)) return [];
    const sameType = schema.anyOf.findIndex((option) => {
      const type = resolve(option).type;
      return type === typeOf(value) || (type === "number" && typeOf(value) === "integer");
    });
    return sameType >= 0 ? results[sameType] : [`${path}: matches no anyOf option`];
  }
  if ("const" in schema && value !== schema.const) errors.push(`${path}: expected ${schema.const}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: not in enum`);
  if (schema.type) {
    const actual = typeOf(value);
    const matches = actual === schema.type || (schema.type === "number" && actual === "integer");
    if (!matches) return [...errors, `${path}: expected ${schema.type}, got ${actual}`];
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: < minimum`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path}: > maximum`);
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum)
      errors.push(`${path}: <= exclusiveMinimum`);
  }
  if (schema.format === "date-time" && Number.isNaN(Date.parse(value)))
    errors.push(`${path}: invalid date-time`);
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems)
      errors.push(`${path}: too few items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems)
      errors.push(`${path}: too many items`);
    value.forEach((item, index) => {
      const itemSchema = schema.prefixItems?.[index] ?? schema.items;
      if (itemSchema) errors.push(...validate(itemSchema, item, `${path}[${index}]`));
    });
  }
  if (typeOf(value) === "object") {
    for (const key of schema.required ?? [])
      if (!(key in value)) errors.push(`${path}.${key}: required`);
    for (const [key, item] of Object.entries(value)) {
      const property = schema.properties?.[key];
      if (property) errors.push(...validate(property, item, `${path}.${key}`));
      else if (schema.additionalProperties === false)
        errors.push(`${path}.${key}: not allowed`);
    }
  }
  return errors;
}

export function responseSchema(path, status) {
  const operation = openapi.paths[path]?.get;
  return operation?.responses?.[String(status)]?.content?.["application/json"]?.schema;
}
