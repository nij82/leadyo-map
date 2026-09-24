import { z } from "zod";
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^0[0-9-]{8,14}$/, "전화번호를 확인해 주세요.");
export const kakaoSchema = z
  .string()
  .trim()
  .refine((v) => {
    if (!v) return true;
    try {
      const u = new URL(v);
      return (
        u.protocol === "https:" &&
        u.hostname === "open.kakao.com" &&
        !u.username &&
        !u.password &&
        /^\/o\/[a-zA-Z0-9]+\/?$/.test(u.pathname) &&
        !u.search &&
        !u.hash
      );
    } catch {
      return false;
    }
  }, "카카오 오픈채팅 주소를 입력해 주세요.");
export const listingSchema = z.object({
  project_id: z.string().uuid(),
  organization: z.string().trim().min(1).max(100),
  workplace: z.string().trim().min(1).max(200),
  rates: z
    .array(
      z.object({
        role: z.enum(["member", "leader", "director", "team"]),
        amount: z.number().positive().max(100000).nullable(),
      }),
    )
    .min(1)
    .max(4)
    .refine(
      (a) => new Set(a.map((r) => r.role)).size === a.length,
      "모집 대상이 중복되었습니다.",
    )
    .refine(
      (a) =>
        !(
          a.some((r) => r.role === "team") &&
          a.some((r) => r.role === "member" || r.role === "leader")
        ),
      "팀 전체와 개인별 금액은 구분해 입력하세요.",
    ),
  payment: z.string().trim().min(1).max(300),
  trigger_condition: z.string().trim().min(1).max(300),
  clawback: z.string().trim().min(1).max(300),
  support: z.string().trim().max(1000),
  phone: phoneSchema,
  kakao_url: kakaoSchema,
  phone_consent: z.literal(true),
});
export const profileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  organization: z.string().trim().min(1).max(100),
  phone: phoneSchema,
  consent: z.literal(true),
});
