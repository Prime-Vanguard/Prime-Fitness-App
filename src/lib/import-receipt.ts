export function importReceipt(value: unknown) {
  if (!value || typeof value !== "object")
    throw new Error("Import receipt unavailable. Retry the same batch.");
  const row = value as Record<string, unknown>;
  for (const key of ["accepted", "skipped", "chunks"])
    if (!Number.isSafeInteger(row[key]) || Number(row[key]) < 0)
      throw new Error("Import receipt is incomplete. Retry the same batch.");
  return {
    accepted: row["accepted"] as number,
    skipped: row["skipped"] as number,
    chunks: row["chunks"] as number,
  };
}
