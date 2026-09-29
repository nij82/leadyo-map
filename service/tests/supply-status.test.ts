import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifySupplyStatus,
  matchesSupplyStatus,
} from "../lib/project-schedule";
import type { ApplyhomeDetails, ApplyhomeSummary, Project } from "../lib/types";

function details(
  category: string,
  schedule: Record<string, string>,
): ApplyhomeDetails {
  return {
    source_notices: [
      { category, announced_at: schedule.RCRIT_PBLANC_DE, schedule },
    ],
  } as ApplyhomeDetails;
}

test("supply status uses official dates for active sales and application periods", () => {
  const status = classifySupplyStatus(
    details("APT 일반 분양공고", {
      RCRIT_PBLANC_DE: "2026-09-25",
      GNRL_RNK1_CRSPAREA_RCPTDE: "2026-09-30",
      GNRL_RNK1_CRSPAREA_ENDDE: "2026-09-30",
      GNRL_RNK2_CRSPAREA_RCPTDE: "2026-10-01",
      GNRL_RNK2_CRSPAREA_ENDDE: "2026-10-01",
      CNTRCT_CNCLS_BGNDE: "2026-10-10",
      CNTRCT_CNCLS_ENDDE: "2026-10-12",
    }),
    { planned_move_in_month: "2028-03" } as ApplyhomeSummary,
    "2026-09-30",
  );
  assert.deepEqual(status.stages, ["move_in", "selling", "subscription"]);
  assert.deepEqual(status.events, ["first_rank", "second_rank", "contract"]);
});

test("past notices do not masquerade as upcoming supply events", () => {
  const status = classifySupplyStatus(
    details("APT 무순위 공고", {
      RCRIT_PBLANC_DE: "2025-09-01",
      SUBSCRPT_RCEPT_BGNDE: "2025-09-05",
      SUBSCRPT_RCEPT_ENDDE: "2025-09-05",
      CNTRCT_CNCLS_ENDDE: "2025-09-20",
    }),
    null,
    "2026-09-30",
  );
  assert.deepEqual(status, { stages: [], events: [] });
});

test("planned notices and irregular supply are classified without inventing rental data", () => {
  const status = classifySupplyStatus(
    details("APT 무순위 공고", {
      RCRIT_PBLANC_DE: "2026-10-02",
      SUBSCRPT_RCEPT_BGNDE: "2026-10-07",
      SUBSCRPT_RCEPT_ENDDE: "2026-10-07",
    }),
    null,
    "2026-09-30",
  );
  assert.deepEqual(status.stages, ["planned"]);
  assert.deepEqual(status.events, ["notice", "no_rank", "subscription"]);
});

test("stage selections are OR, event selections are OR, and dimensions combine with AND", () => {
  const project = {
    supply_status: {
      stages: ["selling", "subscription"],
      events: ["first_rank", "contract"],
    },
  } as Project;
  assert.equal(matchesSupplyStatus(project, [], []), true);
  assert.equal(
    matchesSupplyStatus(project, ["planned", "selling"], ["first_rank"]),
    true,
  );
  assert.equal(
    matchesSupplyStatus(project, ["planned"], ["first_rank"]),
    false,
  );
  assert.equal(matchesSupplyStatus(project, ["selling"], ["no_rank"]), false);
});
