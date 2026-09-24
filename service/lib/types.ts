export type Rate = {
  role: "member" | "leader" | "director" | "team";
  amount: number | null;
};
export type Project = {
  published: boolean;
  id: string;
  name: string;
  address: string;
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
