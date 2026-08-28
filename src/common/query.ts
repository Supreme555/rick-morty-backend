import { Transform } from 'class-transformer';

/** Query strings arrive as strings; treat "" as "not provided". */
export function emptyToUndefined() {
  return Transform(({ value }) => (value === '' ? undefined : value));
}

export function toLowerCase() {
  return Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );
}
