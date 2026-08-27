import { Transform } from 'class-transformer';

/** Query strings arrive as strings; treat "" as "not provided". */
export function emptyToUndefined() {
  return Transform(({ value }) => (value === '' ? undefined : value));
}

/** "" -> undefined, otherwise Number(value) (NaN fails @IsInt downstream). */
export function toOptionalInt() {
  return Transform(({ value }) =>
    value === '' || value === undefined || value === null ? undefined : Number(value),
  );
}

export function toLowerCase() {
  return Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );
}
