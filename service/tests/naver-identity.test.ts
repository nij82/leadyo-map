import { test } from "node:test";
import assert from "node:assert/strict";
import { sameNaverSite } from "../lib/naver-identity";

test("spacing aliases at the same address are an existing site", () => {
  assert.equal(
    sameNaverSite(
      {
        name: "오퍼스한강스위첸",
        address: "경기도 김포시 고촌읍 향산리 588-11번지 일원",
      },
      {
        name: "오퍼스 한강 스위첸",
        address: "경기도 김포시 고촌읍 향산리 588-11번지 일원",
      },
    ),
    true,
  );
});
test("a different phase or block is never a spacing alias", () => {
  assert.equal(
    sameNaverSite(
      { name: "호반써밋", address: "풍무 B4블록" },
      { name: "호반써밋", address: "풍무 B5블록" },
    ),
    false,
  );
  assert.equal(
    sameNaverSite(
      { name: "호반써밋 2차", address: "풍무 B4블록" },
      { name: "호반써밋 3차", address: "풍무 B4블록" },
    ),
    false,
  );
});

test("same explicit parcel tolerates extra address explanation, not another dong", () => {
  const site = {
    name: "한강 아파트",
    address: "경기도 김포시 북변동 184-1번지 일원",
  };
  assert.equal(
    sameNaverSite(site, {
      name: "한강아파트",
      address: "경기도 김포시 북변동 184-1 (정비구역)",
    }),
    true,
  );
  assert.equal(
    sameNaverSite(site, {
      name: "한강아파트",
      address: "경기도 김포시 풍무동 184-1",
    }),
    false,
  );
});
