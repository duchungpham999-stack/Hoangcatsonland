import { json } from '../http/response.js';

export function validate(schema, input) {
  const errors = [];

  for (const [field, rule] of Object.entries(schema)) {
    if (rule.required && !input?.[field]) errors.push(`${field} is required`);
  }

  if (errors.length > 0) throw json(400, { error: 'validation_failed', details: errors });
  return input;
}
