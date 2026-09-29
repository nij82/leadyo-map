import assert from "node:assert/strict";
import test from "node:test";
import { formatRtReference, type RtReference } from "../lib/rt-reference";

const reference: RtReference = {
  projectId: "project",
  productType: "officetel",
  role: "team",
  amounts: [480, 440],
  sourcePosts: 1,
  checkedAt: "2026-09-29",
  supports: [],
};

test("RT 참고 금액은 타입별 최소~최대를 표시한다", () => {
  assert.equal(formatRtReference(reference), "440~480만 원");
  assert.equal(formatRtReference({ ...reference, amounts: [880] }), "880만 원");
});
