type PageResult<T> = { data: T[] | null; error: { message: string } | null };

/** Continue until an empty page: a server may impose a lower cap than requested. */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  key: (row: T) => string,
): Promise<T[]> {
  const rows: T[] = [];
  const seen = new Set<string>();
  let offset = 0;
  for (;;) {
    const result = await page(offset, offset + 499);
    if (result.error) throw new Error(result.error.message);
    if (!result.data?.length) return rows;
    let added = 0;
    for (const row of result.data) {
      const id = key(row);
      if (!seen.has(id)) {
        seen.add(id);
        rows.push(row);
        added++;
      }
    }
    if (!added) throw new Error("History pagination did not advance. Please retry.");
    offset += result.data.length;
  }
}
