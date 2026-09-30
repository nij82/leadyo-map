import assert from "node:assert/strict";
import test from "node:test";
import { ImportReviewHold, runImportBatch } from "../lib/import-batch";

test("a held project does not stop later verified projects", async () => {
  const result = await runImportBatch(
    [{ name: "인접 블록" }, { name: "검증 현장" }],
    0,
    async (row) => {
      if (row.name === "인접 블록")
        throw new ImportReviewHold("동일성 확인 필요");
      return "inserted";
    },
  );
  assert.equal(result.inserted, 1);
  assert.equal(result.held.length, 1);
  assert.equal(result.done, true);
});
test("a request processes at most 20 projects and exposes its continuation", async () => {
  const rows = Array.from({ length: 21 }, (_, i) => ({ name: String(i) }));
  const result = await runImportBatch(rows, 0, async () => "inserted");
  assert.equal(result.inserted, 20);
  assert.equal(result.nextIndex, 20);
  assert.equal(result.done, false);
  const last = await runImportBatch(
    rows,
    result.nextIndex,
    async () => "inserted",
  );
  assert.equal(last.inserted, 1);
  assert.equal(last.done, true);
});
test("a system failure preserves the failed row for resumption", async () => {
  const rows = [
    { name: "저장 완료" },
    { name: "연결 실패" },
    { name: "다음 현장" },
  ];
  const result = await runImportBatch(rows, 0, async (row) => {
    if (row.name === "연결 실패") throw new Error("DB 연결 실패");
    return "inserted";
  });
  assert.equal(result.inserted, 1);
  assert.equal(result.nextIndex, 1);
  assert.equal(result.done, false);
  assert.equal(result.held.length, 0);
  const resumed = await runImportBatch(
    rows,
    result.nextIndex,
    async () => "inserted",
  );
  assert.equal(resumed.inserted, 2);
  assert.equal(resumed.done, true);
});
