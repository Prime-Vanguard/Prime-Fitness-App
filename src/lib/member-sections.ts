export function pageSection<T extends string>(
  raw: unknown,
  allowed: readonly T[],
  fallback: T,
): T | undefined {
  return typeof raw === "string" && raw !== fallback && allowed.includes(raw as T)
    ? (raw as T)
    : undefined;
}
