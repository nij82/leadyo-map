export class ImportReviewHold extends Error {}

export async function runImportBatch<T extends { name: string }>(
  rows: T[],
  start: number,
  apply: (row: T) => Promise<"inserted" | "skipped">,
) {
  let inserted = 0,
    skipped = 0,
    nextIndex = start;
  const held: { name: string; reason: string }[] = [];
  for (let index = start; index < Math.min(start + 20, rows.length); index++) {
    try {
      const result = await apply(rows[index]);
      if (result === "inserted") inserted++;
      else skipped++;
    } catch (error) {
      if (error instanceof ImportReviewHold) {
        held.push({ name: rows[index].name, reason: error.message });
      } else {
        return {
          inserted,
          skipped,
          held,
          nextIndex,
          done: false,
          error:
            error instanceof Error
              ? error.message
              : "저장 연결을 확인해 주세요.",
        };
      }
    }
    nextIndex = index + 1;
  }
  return {
    inserted,
    skipped,
    held,
    nextIndex,
    done: nextIndex === rows.length,
    error: null,
  };
}
