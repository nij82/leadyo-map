import { test } from "node:test";
import assert from "node:assert/strict";
import { kakaoSchema, listingSchema } from "../lib/validation";
import { unknownSupports } from "../lib/listing-catalog";
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
    product_type: "apartment",
    workplace: "근무지",
    rate_options: [{ label: "공통", rates: [{ role: "member", amount: 650 }] }],
    supports: unknownSupports(),
    payment: "익월 말 지급",
    trigger_condition: "계약금 완납",
    clawback: "해약 시 지급액 환수",
    support: "",
    phone: "010-0000-0000",
    kakao_url: "",
    phone_consent: true,
  };
  assert.ok(listingSchema.safeParse(base).success);
  const withoutType = {
    ...base,
    rate_options: [{ label: "", rates: base.rate_options[0].rates }],
  };
  assert.ok(listingSchema.safeParse(withoutType).success);
  assert.ok(
    listingSchema.safeParse({
      ...base,
      rate_options: [withoutType.rate_options[0], base.rate_options[0]],
    }).success,
  );
  assert.equal(
    listingSchema.safeParse({
      ...base,
      rate_options: [withoutType.rate_options[0], withoutType.rate_options[0]],
    }).success,
    false,
  );
  assert.equal(
    listingSchema.safeParse({ ...base, phone_consent: false }).success,
    false,
  );
  assert.equal(
    listingSchema.safeParse({
      ...base,
      rate_options: [
        {
          label: "공통",
          rates: [
            { role: "member", amount: 650 },
            { role: "team", amount: 900 },
          ],
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    listingSchema.safeParse({ ...base, product_type: "" }).success,
    false,
  );
  for (const field of ["trigger_condition", "payment", "clawback"] as const) {
    for (const value of ["문의 시 안내", "상담 문의"])
      assert.ok(listingSchema.safeParse({ ...base, [field]: value }).success);
    const result = listingSchema.safeParse({ ...base, [field]: "  " });
    assert.ok(result.success);
    if (result.success) assert.equal(result.data[field], "문의 시 안내");
    assert.equal(
      listingSchema.safeParse({ ...base, [field]: "가".repeat(301) }).success,
      false,
    );
  }
  assert.ok(listingSchema.safeParse({ ...base, payment: "익월" }).success);
  assert.equal(
    listingSchema.safeParse({
      ...base,
      supports: {
        ...unknownSupports(),
        ad: { status: "conditional", detail: "" },
      },
    }).success,
    false,
  );
  assert.equal(
    listingSchema.safeParse({
      ...base,
      rate_options: [
        ...base.rate_options,
        { ...base.rate_options[0], label: "공통" },
      ],
    }).success,
    false,
  );
});
