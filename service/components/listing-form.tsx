"use client";
import { useState } from "react";
import { ActionForm } from "./action-form";
import { saveListing } from "@/app/actions";
import { roleLabels, type Listing, type Project, type Rate } from "@/lib/types";
export function ListingForm({
  projects,
  listing,
  organization,
  phone,
}: {
  projects: Project[];
  listing?: Listing;
  organization: string;
  phone: string;
}) {
  const [rates, setRates] = useState<Rate[]>(
    listing?.rates || [{ role: "member", amount: null }],
  );
  function update(role: Rate["role"], amount: number | null) {
    setRates((v) => v.map((r) => (r.role === role ? { role, amount } : r)));
  }
  return (
    <ActionForm
      action={saveListing}
      submit={listing ? "변경사항 저장" : "공고 즉시 게시"}
      disabled={!projects.length}
    >
      <input type="hidden" name="id" value={listing?.id || ""} />
      <input type="hidden" name="rates" value={JSON.stringify(rates)} />
      <label>
        모집할 현장
        <select name="project_id" required defaultValue={listing?.project_id}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        조직명
        <input
          name="organization"
          required
          maxLength={100}
          defaultValue={listing?.organization || organization}
        />
      </label>
      <div>
        <h3>모집 대상별 1계약당 RT</h3>
        <p className="muted">
          금액은 만 원 단위입니다. 팀장·팀원 금액은 팀 합계로 함께 표시됩니다.
        </p>
        {Object.entries(roleLabels).map(([key, label]) => {
          const role = key as Rate["role"],
            r = rates.find((x) => x.role === role);
          return (
            <div className="rate-input" key={role}>
              <label className="check">
                <input
                  type="checkbox"
                  checked={!!r}
                  onChange={(e) =>
                    setRates((v) =>
                      e.target.checked
                        ? [
                            ...v.filter((x) =>
                              role === "team"
                                ? !["leader", "member"].includes(x.role)
                                : ["leader", "member"].includes(role)
                                  ? x.role !== "team"
                                  : true,
                            ),
                            { role, amount: null },
                          ]
                        : v.filter((x) => x.role !== role),
                    )
                  }
                />
                {label}
              </label>
              {r && (
                <>
                  <select
                    aria-label={label + " 금액 공개 방식"}
                    value={r.amount === null ? "private" : "fixed"}
                    onChange={(e) =>
                      update(role, e.target.value === "private" ? null : 0)
                    }
                  >
                    <option value="private">협의</option>
                    <option value="fixed">금액 공개</option>
                  </select>
                  {r.amount !== null && (
                    <input
                      aria-label={label + " 금액"}
                      type="number"
                      min="0.1"
                      max="100000"
                      step="0.1"
                      required
                      value={r.amount || ""}
                      onChange={(e) => update(role, Number(e.target.value))}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      {[
        ["workplace", "실제 근무지"],
        ["trigger_condition", "지급 발생조건"],
        ["payment", "지급시점"],
        ["clawback", "해약·환수 조건"],
      ].map(([key, label]) => (
        <label key={key}>
          {label}
          <input
            name={key}
            required
            maxLength={300}
            defaultValue={(listing?.[key as keyof Listing] as string) || ""}
          />
        </label>
      ))}
      <label>
        지원 조건·안내 (선택)
        <textarea
          name="support"
          maxLength={1000}
          defaultValue={listing?.support}
        />
      </label>
      <label>
        전화문의 번호
        <input
          name="phone"
          type="tel"
          required
          defaultValue={listing?.phone || phone}
        />
      </label>
      <label>
        카카오 오픈채팅 주소 (선택)
        <input
          name="kakao_url"
          type="url"
          placeholder="https://open.kakao.com/o/…"
          defaultValue={listing?.kakao_url || ""}
        />
      </label>
      <label className="check">
        <input type="checkbox" name="phone_consent" required />
        <span>이 공고의 전화번호를 비회원에게도 공개하는 데 동의합니다.</span>
      </label>
    </ActionForm>
  );
}
