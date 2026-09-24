import { test } from "node:test";
import assert from "node:assert/strict";
import { kakaoSchema, listingSchema } from "../lib/validation";
test("Only genuine Kakao open-chat HTTPS links are accepted", () => {
  assert.ok(kakaoSchema.safeParse("https://open.kakao.com/o/testABC").success);
  for (const bad of [
    "javascript:alert(1)",
    "https://open.kakao.com.evil.com/o/abc",
    "https://evil@open.kakao.com/o/abc",
    "http://open.kakao.com/o/abc",
    "https://open.kakao.com/o/abc?redirect=evil",
  ])
    assert.equal(kakaoSchema.safeParse(bad).success, false);
});
test("Listing requires explicit phone consent and non-conflicting rate roles", () => {
  const base = {
    project_id: "44444444-4444-4444-8444-444444444444",
    organization: "팀",
    workplace: "근무지",
    rates: [{ role: "member", amount: 650 }],
    payment: "익월",
    trigger_condition: "계약",
    clawback: "환수",
    support: "",
    phone: "010-0000-0000",
    kakao_url: "",
    phone_consent: true,
  };
  assert.ok(listingSchema.safeParse(base).success);
  assert.equal(
    listingSchema.safeParse({ ...base, phone_consent: false }).success,
    false,
  );
  assert.equal(
    listingSchema.safeParse({
      ...base,
      rates: [
        { role: "member", amount: 650 },
        { role: "team", amount: 900 },
      ],
    }).success,
    false,
  );
});
