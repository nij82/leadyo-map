import type { ProductType } from "./types";

export type RtReference = {
  projectId: string;
  productType: ProductType;
  role: "member" | "leader" | "director" | "team";
  amounts: number[];
  sourcePosts: number;
  checkedAt: string;
  supports: string[];
};

export function formatRtReference(reference: RtReference): string {
  const amounts = reference.amounts.filter((amount) => Number.isFinite(amount) && amount > 0);
  if (!amounts.length) return "금액 미공개";
  const minimum = Math.min(...amounts);
  const maximum = Math.max(...amounts);
  return minimum === maximum
    ? `${minimum.toLocaleString("ko-KR")}만 원`
    : `${minimum.toLocaleString("ko-KR")}~${maximum.toLocaleString("ko-KR")}만 원`;
}
