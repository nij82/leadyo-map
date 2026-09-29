export type Rate = {
  role: "member" | "leader" | "director" | "team";
  amount: number | null;
};
export type ProductType = "apartment" | "officetel" | "retail";
export type RateOption = { label: string; rates: Rate[] };
export type SupportStatus = "yes" | "conditional" | "no" | "unknown";
export type SupportKey = "ad" | "db" | "daily" | "housing" | "meal";
export type SupportOption = { status: SupportStatus; detail: string };
export type Supports = Record<SupportKey, SupportOption>;
export type ProjectProductDetail = {
  units: string;
  types: string;
  price: string;
  move_in: string;
  deposit: string;
  interim: string;
};
export type ApplyhomeSummary = {
  product_type: "apartment" | "officetel";
  category: string;
  announced_at: string | null;
  notice_supply_units: number | null;
  type_count: number;
  price_min_10k_krw: number | null;
  price_max_10k_krw: number | null;
  planned_move_in_month: string | null;
  builder: string | null;
  business_entity: string | null;
};
export type ApplyhomeModel = {
  model_no: string | null;
  type: string | null;
  group: string | null;
  supply_area_m2: string | null;
  exclusive_area_m2: string | null;
  general_supply_units: number | null;
  special_supply_units: number | null;
  model_supply_units: number;
  maximum_supply_price_10k_krw: number | null;
};
export type ApplyhomeNotice = {
  source_id: string;
  announcement_id: string;
  category: string;
  name_at_announcement: string;
  address_at_announcement: string;
  announced_at: string | null;
  notice_supply_units: number | null;
  model_supply_units_sum: number;
  builder: string | null;
  business_entity: string | null;
  planned_move_in_month: string | null;
  official_notice_url: string | null;
  homepage_url: string | null;
  schedule: Record<string, string>;
  models: ApplyhomeModel[];
};
export type ApplyhomeDetails = {
  collected_at: string;
  product_type: "apartment" | "officetel";
  source_notices: ApplyhomeNotice[];
  nearby_planned_move_in: {
    name: string;
    address: string;
    planned_move_in_month: string;
    straight_line_distance_km: number;
  }[];
};
export type ProjectSchedule = { date: string; label: string };
export type SupplyStage = "selling" | "subscription" | "planned" | "move_in";
export type SupplyEvent =
  | "no_rank"
  | "notice"
  | "special"
  | "subscription"
  | "first_rank"
  | "second_rank"
  | "winner"
  | "contract"
  | "open_supply"
  | "resupply";
export type SupplyStatus = { stages: SupplyStage[]; events: SupplyEvent[] };
export type Project = {
  published: boolean;
  id: string;
  name: string;
  address: string;
  showroom_address: string | null;
  product_details: Partial<Record<ProductType, ProjectProductDetail>> | null;
  applyhome_summary?: ApplyhomeSummary | null;
  next_schedule?: ProjectSchedule | null;
  supply_status?: SupplyStatus | null;
  latitude: number;
  longitude: number;
  units: number | null;
  types: string | null;
  price: string | null;
  move_in: string | null;
  deposit: string | null;
  interim: string | null;
  builder: string | null;
};
export type Listing = {
  id: string;
  project_id: string;
  owner_id: string;
  organization: string;
  workplace: string;
  rates: Rate[];
  product_type: ProductType | null;
  rate_options: RateOption[] | null;
  supports: Supports | null;
  payment: string;
  trigger_condition: string;
  clawback: string;
  support: string;
  phone: string;
  kakao_url: string | null;
  status: "published" | "closed";
  moderation: "visible" | "hidden" | "deleted";
  created_at: string;
};
export const roleLabels = {
  member: "개인(팀원)",
  leader: "팀장",
  director: "본부장",
  team: "팀 전체",
};
export const productLabels: Record<ProductType, string> = {
  apartment: "아파트",
  officetel: "오피스텔",
  retail: "상가",
};
export const supportLabels: Record<SupportKey, string> = {
  ad: "광고비",
  db: "DB",
  daily: "일비",
  housing: "숙소",
  meal: "식사",
};
export const supportStatusLabels: Record<SupportStatus, string> = {
  yes: "지원",
  conditional: "조건부 지원",
  no: "미지원",
  unknown: "미확인",
};
