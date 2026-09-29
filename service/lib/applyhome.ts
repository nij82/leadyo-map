export function formatSupplyPrice(value: number | null | undefined): string {
  if (value == null) return "미확인";
  const eok = Math.floor(value / 10000),
    man = value % 10000;
  if (!eok) return `${man.toLocaleString("ko-KR")}만 원`;
  return `${eok.toLocaleString("ko-KR")}억${man ? ` ${man.toLocaleString("ko-KR")}만` : ""} 원`;
}

export function formatApplyhomeDate(value: string | null | undefined): string {
  if (!value) return "미확인";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 8)
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`;
  if (digits.length === 6)
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}`;
  return value;
}

export function noticeCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    "APT 일반 분양공고": "아파트 일반분양",
    "APT 임의공급 공고": "아파트 임의공급",
    "APT 무순위 공고": "아파트 무순위",
    "APT 불법행위 재공급 공고": "아파트 재공급",
    "오피스텔 분양공고": "오피스텔 분양",
  };
  return labels[category] || category;
}

export function isSupplementalNotice(category: string): boolean {
  return category.startsWith("APT ") && category !== "APT 일반 분양공고";
}

export const scheduleLabels: Record<string, string> = {
  RCRIT_PBLANC_DE: "모집공고일",
  RCEPT_BGNDE: "청약 접수 시작",
  RCEPT_ENDDE: "청약 접수 종료",
  SPSPLY_RCEPT_BGNDE: "특별공급 접수 시작",
  SPSPLY_RCEPT_ENDDE: "특별공급 접수 종료",
  SUBSCRPT_RCEPT_BGNDE: "청약 접수 시작",
  SUBSCRPT_RCEPT_ENDDE: "청약 접수 종료",
  GNRL_RCEPT_BGNDE: "일반공급 접수 시작",
  GNRL_RCEPT_ENDDE: "일반공급 접수 종료",
  GNRL_RNK1_CRSPAREA_RCPTDE: "1순위 해당지역 시작",
  GNRL_RNK1_CRSPAREA_ENDDE: "1순위 해당지역 종료",
  GNRL_RNK1_ETC_AREA_RCPTDE: "1순위 기타지역 시작",
  GNRL_RNK1_ETC_AREA_ENDDE: "1순위 기타지역 종료",
  GNRL_RNK1_ETC_GG_RCPTDE: "1순위 기타경기 시작",
  GNRL_RNK1_ETC_GG_ENDDE: "1순위 기타경기 종료",
  GNRL_RNK2_CRSPAREA_RCPTDE: "2순위 해당지역 시작",
  GNRL_RNK2_CRSPAREA_ENDDE: "2순위 해당지역 종료",
  GNRL_RNK2_ETC_AREA_RCPTDE: "2순위 기타지역 시작",
  GNRL_RNK2_ETC_AREA_ENDDE: "2순위 기타지역 종료",
  GNRL_RNK2_ETC_GG_RCPTDE: "2순위 기타경기 시작",
  GNRL_RNK2_ETC_GG_ENDDE: "2순위 기타경기 종료",
  PRZWNER_PRESNATN_DE: "당첨자 발표",
  CNTRCT_CNCLS_BGNDE: "계약 시작",
  CNTRCT_CNCLS_ENDDE: "계약 종료",
};
