import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compareProjectRows,
  nextSalesSchedule,
  todayInKorea,
} from "../lib/project-schedule";
import type { ApplyhomeDetails, Listing, Project } from "../lib/types";

function details(schedule: Record<string, string>): ApplyhomeDetails {
  return {
    source_notices: [{ schedule }],
  } as ApplyhomeDetails;
}

function row(name: string, nextDate?: string, jobs = 0, announcedAt?: string) {
  return {
    project: {
      name,
      next_schedule: nextDate ? { date: nextDate, label: "계약 시작" } : null,
      applyhome_summary: announcedAt ? { announced_at: announcedAt } : null,
    } as Project,
    jobs: Array.from({ length: jobs }, () => ({}) as Listing),
  };
}

test("next sales schedule uses the next Korean-calendar milestone, including today's end date", () => {
  assert.equal(todayInKorea(new Date("2026-09-29T15:30:00Z")), "2026-09-30");
  assert.deepEqual(
    nextSalesSchedule(
      details({
        RCRIT_PBLANC_DE: "2026-09-10",
        RCEPT_BGNDE: "2026-09-29",
        RCEPT_ENDDE: "2026-09-30",
        CNTRCT_CNCLS_BGNDE: "2026-10-15",
      }),
      "2026-09-30",
    ),
    { date: "2026-09-30", label: "청약 접수 종료" },
  );
  assert.equal(
    nextSalesSchedule(
      details({ CNTRCT_CNCLS_BGNDE: "2026-02-30" }),
      "2026-09-30",
    ),
    null,
  );
});

test("recommended sort prioritizes actual jobs even without an official schedule", () => {
  const withJobs = row("공고 전 현장", undefined, 1);
  const scheduled = row("일정 임박 현장", "2026-10-01");
  assert.deepEqual(
    [scheduled, withJobs].sort((a, b) =>
      compareProjectRows(a, b, "recommended"),
    ),
    [withJobs, scheduled],
  );
  assert.deepEqual(
    [scheduled, withJobs].sort((a, b) => compareProjectRows(a, b, "schedule")),
    [scheduled, withJobs],
  );
});

test("recommended and schedule sorts differ when no site has a job listing", () => {
  const soon = row("곧 분양", "2026-10-01", 0, "2026-08-01");
  const recentlyAnnounced = row("최근 공고", "2026-10-07", 0, "2026-09-29");
  assert.deepEqual(
    [soon, recentlyAnnounced]
      .sort((a, b) => compareProjectRows(a, b, "recommended"))
      .map((item) => item.project.name),
    ["최근 공고", "곧 분양"],
  );
  assert.deepEqual(
    [soon, recentlyAnnounced]
      .sort((a, b) => compareProjectRows(a, b, "schedule"))
      .map((item) => item.project.name),
    ["곧 분양", "최근 공고"],
  );
});

test("schedule sort puts upcoming dates first, then recent announcements, then unscheduled sites", () => {
  const rows = [
    row("날짜 없음"),
    row("지난 공고", undefined, 0, "2026-09-01"),
    row("다음 주", "2026-10-07"),
    row("내일", "2026-10-01"),
  ];
  assert.deepEqual(
    rows
      .sort((a, b) => compareProjectRows(a, b, "schedule"))
      .map((item) => item.project.name),
    ["내일", "다음 주", "지난 공고", "날짜 없음"],
  );
});

test("listing sort puts more jobs first and breaks ties by the next sales date", () => {
  const rows = [
    row("공고 없음", "2026-09-30"),
    row("2건 늦은 일정", "2026-10-07", 2),
    row("3건", "2026-11-01", 3),
    row("2건 가까운 일정", "2026-10-01", 2),
  ];
  assert.deepEqual(
    rows
      .sort((a, b) => compareProjectRows(a, b, "listings"))
      .map((item) => item.project.name),
    ["3건", "2건 가까운 일정", "2건 늦은 일정", "공고 없음"],
  );
});
