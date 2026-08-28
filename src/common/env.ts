/** Read an env var treating "" (a common .env artefact) as "not set". */
export function envOr(name: string): string | undefined;
export function envOr(name: string, fallback: string): string;
export function envOr(name: string, fallback?: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}
