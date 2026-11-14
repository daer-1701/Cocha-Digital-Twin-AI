/** Bound public page links before forwarding them to the API. */
export function pageOffset(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^\d{1,7}$/.test(value)) return 0;
  return Math.min(Number(value), 1_000_000);
}
