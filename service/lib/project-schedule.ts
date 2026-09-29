import type {
  ApplyhomeDetails,
  ApplyhomeSummary,
  Listing,
  Project,
  ProjectSchedule,
  SupplyEvent,
  SupplyStage,
  SupplyStatus,
} from "./types";
import { scheduleLabels } from "./applyhome";

const salesDateKeys = [
  "RCRIT_PBLANC_DE",
  "RCEPT_BGNDE",
  "SUBSCRPT_RCEPT_BGNDE",
  "SPSPLY_RCEPT_BGNDE",
  "GNRL_RCEPT_BGNDE",
  "GNRL_RNK1_CRSPAREA_RCPTDE",
  "GNRL_RNK1_ETC_AREA_RCPTDE",
  "GNRL_RNK1_ETC_GG_RCPTDE",
  "GNRL_RNK2_CRSPAREA_RCPTDE",
  "GNRL_RNK2_ETC_AREA_RCPTDE",
  "GNRL_RNK2_ETC_GG_RCPTDE",
  "RCEPT_ENDDE",
  "SUBSCRPT_RCEPT_ENDDE",
  "SPSPLY_RCEPT_ENDDE",
  "GNRL_RCEPT_ENDDE",
  "GNRL_RNK1_CRSPAREA_ENDDE",
  "GNRL_RNK1_ETC_AREA_ENDDE",
  "GNRL_RNK1_ETC_GG_ENDDE",
  "GNRL_RNK2_CRSPAREA_ENDDE",
  "GNRL_RNK2_ETC_AREA_ENDDE",
  "GNRL_RNK2_ETC_GG_ENDDE",
  "CNTRCT_CNCLS_BGNDE",
  "CNTRCT_CNCLS_ENDDE",
] as const;

function isoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  )
    return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

const receptionRanges = [
  ["RCEPT_BGNDE", "RCEPT_ENDDE"],
  ["SUBSCRPT_RCEPT_BGNDE", "SUBSCRPT_RCEPT_ENDDE"],
  ["SPSPLY_RCEPT_BGNDE", "SPSPLY_RCEPT_ENDDE"],
  ["GNRL_RCEPT_BGNDE", "GNRL_RCEPT_ENDDE"],
  ["GNRL_RNK1_CRSPAREA_RCPTDE", "GNRL_RNK1_CRSPAREA_ENDDE"],
  ["GNRL_RNK1_ETC_AREA_RCPTDE", "GNRL_RNK1_ETC_AREA_ENDDE"],
  ["GNRL_RNK1_ETC_GG_RCPTDE", "GNRL_RNK1_ETC_GG_ENDDE"],
  ["GNRL_RNK2_CRSPAREA_RCPTDE", "GNRL_RNK2_CRSPAREA_ENDDE"],
  ["GNRL_RNK2_ETC_AREA_RCPTDE", "GNRL_RNK2_ETC_AREA_ENDDE"],
  ["GNRL_RNK2_ETC_GG_RCPTDE", "GNRL_RNK2_ETC_GG_ENDDE"],
] as const;

export const supplyStageOptions: { value: SupplyStage; label: string }[] = [
  { value: "selling", label: "분양중" },
  { value: "subscription", label: "청약중" },
  { value: "planned", label: "분양계획" },
  { value: "move_in", label: "입주예정" },
];

export const supplyEventOptions: { value: SupplyEvent; label: string }[] = [
  { value: "no_rank", label: "무순위" },
  { value: "notice", label: "모집공고" },
  { value: "special", label: "특별공급" },
  { value: "subscription", label: "청약 접수" },
  { value: "first_rank", label: "1순위 청약" },
  { value: "second_rank", label: "2순위 청약" },
  { value: "winner", label: "당첨자 발표" },
  { value: "contract", label: "계약기간" },
  { value: "open_supply", label: "임의공급" },
  { value: "resupply", label: "재공급" },
];

export function classifySupplyStatus(
  details: ApplyhomeDetails | null | undefined,
  summary: ApplyhomeSummary | null | undefined,
  today: string,
): SupplyStatus {
  const stages = new Set<SupplyStage>();
  const events = new Set<SupplyEvent>();
  const moveIn = summary?.planned_move_in_month?.replace(/\D/g, "");
  if (moveIn?.length === 6 && moveIn >= today.slice(0, 7).replace("-", ""))
    stages.add("move_in");
  const summaryAnnounced = isoDate(summary?.announced_at);
  if (summaryAnnounced && summaryAnnounced > today) stages.add("planned");
  if (summaryAnnounced && summaryAnnounced >= today) events.add("notice");

  for (const notice of details?.source_notices || []) {
    const schedule = notice.schedule || {};
    const announced = isoDate(notice.announced_at || schedule.RCRIT_PBLANC_DE);
    const futureDate = (key: string) => {
      const date = isoDate(schedule[key]);
      return !!date && date >= today;
    };
    const upcoming = Object.values(schedule).some((value) => {
      const date = isoDate(value);
      return !!date && date >= today;
    });
    if (announced && announced > today) stages.add("planned");
    if (announced && announced >= today) events.add("notice");
    if (announced && announced <= today && upcoming) stages.add("selling");
    if (
      receptionRanges.some(([startKey, endKey]) => {
        const start = isoDate(schedule[startKey]);
        const end = isoDate(schedule[endKey]);
        return !!start && !!end && start <= today && end >= today;
      })
    )
      stages.add("subscription");
    if (!upcoming) continue;
    if (notice.category === "APT 무순위 공고") events.add("no_rank");
    if (notice.category === "APT 임의공급 공고") events.add("open_supply");
    if (notice.category === "APT 불법행위 재공급 공고") events.add("resupply");
    if (futureDate("SPSPLY_RCEPT_BGNDE") || futureDate("SPSPLY_RCEPT_ENDDE"))
      events.add("special");
    if (
      [
        "RCEPT_BGNDE",
        "RCEPT_ENDDE",
        "SUBSCRPT_RCEPT_BGNDE",
        "SUBSCRPT_RCEPT_ENDDE",
        "GNRL_RCEPT_BGNDE",
        "GNRL_RCEPT_ENDDE",
      ].some(futureDate)
    )
      events.add("subscription");
    if (
      Object.keys(schedule).some(
        (key) => key.startsWith("GNRL_RNK1_") && futureDate(key),
      )
    )
      events.add("first_rank");
    if (
      Object.keys(schedule).some(
        (key) => key.startsWith("GNRL_RNK2_") && futureDate(key),
      )
    )
      events.add("second_rank");
    if (futureDate("PRZWNER_PRESNATN_DE")) events.add("winner");
    if (futureDate("CNTRCT_CNCLS_BGNDE") || futureDate("CNTRCT_CNCLS_ENDDE"))
      events.add("contract");
  }
  return { stages: [...stages], events: [...events] };
}

export function matchesSupplyStatus(
  project: Project,
  stages: SupplyStage[],
  events: SupplyEvent[],
): boolean {
  const status = project.supply_status;
  return (
    (!stages.length ||
      stages.some((stage) => status?.stages.includes(stage))) &&
    (!events.length || events.some((event) => status?.events.includes(event)))
  );
}

export function todayInKorea(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}

export function nextSalesSchedule(
  details: ApplyhomeDetails | null | undefined,
  today: string,
): ProjectSchedule | null {
  if (!details) return null;
  let next: ProjectSchedule | null = null;
  for (const notice of details.source_notices || []) {
    for (const key of salesDateKeys) {
      const date = isoDate(notice.schedule?.[key]);
      if (date && date >= today && (!next || date < next.date))
        next = { date, label: scheduleLabels[key] };
    }
  }
  return next;
}

type ProjectRow = { project: Project; jobs: Listing[] };
export type ProjectSort = "recommended" | "schedule" | "listings";

export function compareProjectRows(
  a: ProjectRow,
  b: ProjectRow,
  sort: ProjectSort,
): number {
  const aAnnounced = isoDate(a.project.applyhome_summary?.announced_at);
  const bAnnounced = isoDate(b.project.applyhome_summary?.announced_at);
  const announcedOrder =
    aAnnounced === bAnnounced
      ? 0
      : aAnnounced && bAnnounced
        ? bAnnounced.localeCompare(aAnnounced)
        : aAnnounced
          ? -1
          : 1;
  if (
    sort === "recommended" &&
    Boolean(a.jobs.length) !== Boolean(b.jobs.length)
  )
    return a.jobs.length ? -1 : 1;
  if (sort === "recommended" && announcedOrder) return announcedOrder;
  if (sort === "listings" && a.jobs.length !== b.jobs.length)
    return b.jobs.length - a.jobs.length;
  const aDate = a.project.next_schedule?.date;
  const bDate = b.project.next_schedule?.date;
  if (Boolean(aDate) !== Boolean(bDate)) return aDate ? -1 : 1;
  if (aDate && bDate && aDate !== bDate) return aDate < bDate ? -1 : 1;
  if (announcedOrder) return announcedOrder;
  return a.project.name.localeCompare(b.project.name, "ko-KR");
}
