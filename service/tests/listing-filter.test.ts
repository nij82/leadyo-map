import { test } from "node:test";
import assert from "node:assert/strict";
import { listingRateRange, listingSupportHighlights, markerRateSummary, matchesListing, matchesProjectWithoutListing, unknownSupports } from "../lib/listing-catalog";
import type { Listing, Project } from "../lib/types";

const project = {
  id: "project-1",
  name: "두산위브더제니스 부천",
  address: "경기도 부천시 소사구 소사본동",
} as Project;
const defaults = {
  query: "",
  region: "",
  product: "" as const,
  role: "",
  supports: [] as ("ad" | "housing")[],
  includeConditional: false,
};
function listing(
  id: string,
  ad: "yes" | "no" | "conditional",
  housing: "yes" | "no",
): Listing {
  return {
    id,
    project_id: project.id,
    organization: "모집팀",
    product_type: "officetel",
    rates: [{ role: "team", amount: 480 }],
    rate_options: [{ label: "45형", rates: [{ role: "team", amount: 480 }] }],
    supports: {
      ...unknownSupports(),
      ad: { status: ad, detail: ad === "conditional" ? "월 2건 계약 시" : "" },
      housing: { status: housing, detail: "" },
    },
  } as Listing;
}

test("support filters must match the same listing, not separate organizations", () => {
  const adOnly = listing("a", "yes", "no");
  const housingOnly = listing("b", "no", "yes");
  const filters = {
    ...defaults,
    supports: ["ad", "housing"] as ("ad" | "housing")[],
  };
  assert.equal(matchesListing(project, adOnly, filters), false);
  assert.equal(matchesListing(project, housingOnly, filters), false);
  assert.equal(
    matchesListing(project, listing("c", "yes", "yes"), filters),
    true,
  );
});

test("conditional support and product filters keep unknown legacy listings out", () => {
  const conditional = listing("c", "conditional", "yes");
  const filters = {
    ...defaults,
    product: "officetel" as const,
    supports: ["ad"] as ["ad"],
  };
  assert.equal(matchesListing(project, conditional, filters), false);
  assert.equal(
    matchesListing(project, conditional, {
      ...filters,
      includeConditional: true,
    }),
    true,
  );
  assert.equal(
    matchesListing(project, conditional, { ...filters, product: "apartment" }),
    false,
  );
  assert.equal(
    matchesListing(
      project,
      { ...conditional, product_type: null, supports: null },
      { ...defaults, supports: ["ad"] },
    ),
    false,
  );
  assert.equal(
    matchesListing(project, conditional, {
      ...defaults,
      region: "경기",
      role: "team",
    }),
    true,
  );
});

test("projects without listings remain visible for site search, but not listing filters", () => {
  assert.equal(matchesProjectWithoutListing(project, defaults), true);
  assert.equal(
    matchesProjectWithoutListing(project, { ...defaults, query: "두산위브" }),
    true,
  );
  assert.equal(
    matchesProjectWithoutListing(project, { ...defaults, query: "모집팀" }),
    false,
  );
  assert.equal(
    matchesProjectWithoutListing(project, { ...defaults, supports: ["ad"] }),
    false,
  );
  assert.equal(
    matchesProjectWithoutListing(project, { ...defaults, role: "team" }),
    false,
  );
});

test("site and listing search ignores spacing differences", () => {
  const compactProject = { ...project, name: "두산위브더제니스부천" };
  const spacedQuery = { ...defaults, query: "두산 위브 더제니스 부천" };
  const compactQuery = { ...defaults, query: "두산위브더제니스부천" };
  assert.equal(matchesProjectWithoutListing(compactProject, spacedQuery), true);
  assert.equal(matchesProjectWithoutListing(project, compactQuery), true);
  assert.equal(matchesProjectWithoutListing(project, { ...defaults, query: "부천시 소사구" }), true);
  assert.equal(matchesListing(compactProject, listing("a", "yes", "no"), spacedQuery), true);
  assert.equal(matchesListing(project, listing("a", "yes", "no"), { ...defaults, query: "모 집 팀" }), true);
  assert.equal(matchesProjectWithoutListing(project, { ...defaults, query: "   " }), true);
});

test("map RT summary uses one role and never invents an unavailable amount", () => {
  const member = {
    ...listing("m", "yes", "no"),
    rate_options: [{ label: "84㎡", rates: [{ role: "member" as const, amount: 650 }] }],
  };
  const team = {
    ...listing("t", "yes", "no"),
    rate_options: [{ label: "84㎡", rates: [{ role: "team" as const, amount: 1200 }] }],
  };
  assert.equal(markerRateSummary([member, team]), "개인 RT 650만 원");
  assert.equal(markerRateSummary([{ ...member, product_type: null }]), "RT 문의 시 확인");
  assert.equal(markerRateSummary([]), "RT 미등록");
});

test("project overview shows the minimum and maximum posted RT, not an average", () => {
  const first = {
    ...listing("a", "yes", "yes"),
    rate_options: [{ label: "59형", rates: [
      { role: "member" as const, amount: 500 },
      { role: "leader" as const, amount: 700 },
    ] }],
  };
  const second = {
    ...listing("b", "yes", "no"),
    rate_options: [{ label: "84형", rates: [
      { role: "member" as const, amount: 650 },
      { role: "team" as const, amount: 1200 },
    ] }],
  };
  assert.equal(listingRateRange([first, second]), "500~1,200만 원");
  assert.equal(listingRateRange([first, second], "member"), "500~650만 원");
  assert.equal(listingRateRange([{ ...first, product_type: null }]), "문의 시 확인");
  assert.deepEqual(listingSupportHighlights([first, second]), ["광고비 2건", "숙소 1건"]);
});
