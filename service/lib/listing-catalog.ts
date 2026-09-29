import type {
  Listing,
  ProductType,
  Project,
  RateOption,
  SupportKey,
  Supports,
} from "./types";
import { supportLabels } from "./types";

export const supportKeys: SupportKey[] = [
  "ad",
  "db",
  "daily",
  "housing",
  "meal",
];

export function unknownSupports(): Supports {
  return {
    ad: { status: "unknown", detail: "" },
    db: { status: "unknown", detail: "" },
    daily: { status: "unknown", detail: "" },
    housing: { status: "unknown", detail: "" },
    meal: { status: "unknown", detail: "" },
  };
}

export function listingRateOptions(listing: Listing): RateOption[] {
  return listing.rate_options?.length
    ? listing.rate_options
    : [{ label: "상품·타입 미확인", rates: listing.rates }];
}

export function listingSupports(listing: Listing): Supports {
  return listing.supports || unknownSupports();
}

export function markerRateSummary(listings: Listing[]): string {
  if (!listings.length) return "RT 미등록";
  const rates = listings
    .filter((listing) => listing.product_type && listing.rate_options?.length)
    .flatMap((listing) => listing.rate_options!.flatMap((option) => option.rates));
  const roles = [
    ["member", "개인"],
    ["leader", "팀장"],
    ["director", "본부장"],
    ["team", "팀 전체"],
  ] as const;
  for (const [role, label] of roles) {
    const matching = rates.filter((rate) => rate.role === role);
    if (!matching.length) continue;
    const amounts = matching
      .map((rate) => rate.amount)
      .filter((amount): amount is number => amount !== null);
    if (!amounts.length) return `${label} RT 협의`;
    const minimum = Math.min(...amounts);
    const maximum = Math.max(...amounts);
    const amount =
      minimum === maximum
        ? minimum.toLocaleString("ko-KR")
        : `${minimum.toLocaleString("ko-KR")}~${maximum.toLocaleString("ko-KR")}`;
    return `${label} RT ${amount}만 원`;
  }
  return "RT 문의 시 확인";
}

export function listingRateRange(listings: Listing[], role = ""): string {
  const rates = listings
    .filter((listing) => listing.product_type && listing.rate_options?.length)
    .flatMap((listing) => listing.rate_options!.flatMap((option) => option.rates))
    .filter((rate) => !role || rate.role === role);
  const amounts = rates
    .map((rate) => rate.amount)
    .filter((amount): amount is number => amount !== null);
  if (!amounts.length) return rates.length ? "협의" : "문의 시 확인";
  const minimum = Math.min(...amounts);
  const maximum = Math.max(...amounts);
  return minimum === maximum
    ? `${minimum.toLocaleString("ko-KR")}만 원`
    : `${minimum.toLocaleString("ko-KR")}~${maximum.toLocaleString("ko-KR")}만 원`;
}

export function listingSupportHighlights(listings: Listing[]): string[] {
  return supportKeys.flatMap((key) => {
    const supported = listings.filter(
      (listing) => listingSupports(listing)[key].status === "yes",
    ).length;
    if (supported) return [`${supportLabels[key]} ${supported}건`];
    const conditional = listings.filter(
      (listing) => listingSupports(listing)[key].status === "conditional",
    ).length;
    return conditional ? [`${supportLabels[key]} 조건부 ${conditional}건`] : [];
  });
}

export type ListingFilters = {
  query: string;
  region: string;
  product: ProductType | "";
  role: string;
  supports: SupportKey[];
  includeConditional: boolean;
};

const regionAliases: Record<string, string> = {
  서울특별시: "서울",
  서울시: "서울",
  경기도: "경기",
  인천광역시: "인천",
  부산광역시: "부산",
  대구광역시: "대구",
  대전광역시: "대전",
  광주광역시: "광주",
  울산광역시: "울산",
  세종특별자치시: "세종",
  강원특별자치도: "강원",
  충청북도: "충북",
  충청남도: "충남",
  전북특별자치도: "전북",
  전라북도: "전북",
  전라남도: "전남",
  경상북도: "경북",
  경상남도: "경남",
  제주특별자치도: "제주",
};

export function projectRegion(project: Project): string {
  const first = project.address.trim().split(/\s+/)[0] || "";
  return regionAliases[first] || first;
}

function normalizeSearchText(value: string): string {
  return value.normalize("NFC").replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
}

export function matchesProjectWithoutListing(
  project: Project,
  filters: ListingFilters,
): boolean {
  if (filters.role || filters.supports.length) return false;
  const q = normalizeSearchText(filters.query);
  if (
    q &&
    !normalizeSearchText(`${project.name} ${project.address}`).includes(q)
  )
    return false;
  if (filters.region && projectRegion(project) !== filters.region) return false;
  if (filters.product && !project.product_details?.[filters.product]) return false;
  return true;
}

export function matchesListing(
  project: Project,
  listing: Listing,
  filters: ListingFilters,
): boolean {
  if (listing.project_id !== project.id) return false;
  const q = normalizeSearchText(filters.query);
  if (
    q &&
    !normalizeSearchText(`${project.name} ${project.address} ${listing.organization}`).includes(q)
  )
    return false;
  if (filters.region && projectRegion(project) !== filters.region) return false;
  if (filters.product && listing.product_type !== filters.product) return false;
  if (
    filters.role &&
    !listingRateOptions(listing).some((option) =>
      option.rates.some((rate) => rate.role === filters.role),
    )
  )
    return false;
  const supports = listingSupports(listing);
  return filters.supports.every((key) => {
    const status = supports[key].status;
    return (
      status === "yes" ||
      (filters.includeConditional && status === "conditional")
    );
  });
}
