"use client";
import { useState } from "react";
import { ActionForm } from "./action-form";
import { saveListing } from "@/app/actions";
import { supportKeys, unknownSupports } from "@/lib/listing-catalog";
import {
  productLabels,
  roleLabels,
  supportLabels,
  supportStatusLabels,
  type Listing,
  type Project,
  type Rate,
  type RateOption,
  type SupportKey,
  type SupportStatus,
  type Supports,
} from "@/lib/types";

const supportDetailPlaceholders: Record<SupportKey, string> = {
  ad: "예: 광고비 50% 지원",
  db: "예: LMS 수신 DB 제공",
  daily: "예: 일비 4만 원, 주 단위 지급",
  housing: "예: 숙소비 20만 원 지원",
  meal: "예: 중식 제공",
};

export function ListingForm({
  projects,
  listing,
  preselectedProjectId,
  organization,
  phone,
}: {
  projects: Project[];
  listing?: Listing;
  preselectedProjectId?: string;
  organization: string;
  phone: string;
}) {
  const initialProject = projects.find(
    (project) => project.id === (listing?.project_id || preselectedProjectId),
  );
  const [projectQuery, setProjectQuery] = useState(initialProject?.name || "");
  const [projectId, setProjectId] = useState(initialProject?.id || "");
  const searchTerms = projectQuery
    .normalize("NFC")
    .toLocaleLowerCase("ko-KR")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const matchingProjects = searchTerms.length
    ? projects.filter((project) => {
        const text = `${project.name} ${project.address}`
          .normalize("NFC")
          .toLocaleLowerCase("ko-KR")
          .replace(/\s+/g, "");
        return searchTerms.every((term) => text.includes(term));
      })
    : [];
  const visibleProjects = matchingProjects.slice(0, 50);
  if (
    initialProject &&
    projectId === initialProject.id &&
    !visibleProjects.some((p) => p.id === initialProject.id)
  )
    visibleProjects.unshift(initialProject);
  const selectedProject = projects.find((project) => project.id === projectId);
  const [rateOptions, setRateOptions] = useState<RateOption[]>(
    listing
      ? listing.rate_options?.length
        ? listing.rate_options
        : [{ label: "", rates: listing.rates }]
      : [{ label: "", rates: [{ role: "member", amount: null }] }],
  );
  const [supports, setSupports] = useState<Supports>(
    listing?.supports || unknownSupports(),
  );

  function updateOption(
    index: number,
    update: (option: RateOption) => RateOption,
  ) {
    setRateOptions((current) =>
      current.map((option, i) => (i === index ? update(option) : option)),
    );
  }
  function toggleRate(index: number, role: Rate["role"], checked: boolean) {
    updateOption(index, (option) => ({
      ...option,
      rates: checked
        ? [
            ...option.rates.filter((rate) =>
              role === "team"
                ? !["leader", "member"].includes(rate.role)
                : ["leader", "member"].includes(role)
                  ? rate.role !== "team"
                  : true,
            ),
            { role, amount: null },
          ]
        : option.rates.filter((rate) => rate.role !== role),
    }));
  }
  function updateRate(
    index: number,
    role: Rate["role"],
    amount: number | null,
  ) {
    updateOption(index, (option) => ({
      ...option,
      rates: option.rates.map((rate) =>
        rate.role === role ? { role, amount } : rate,
      ),
    }));
  }
  function updateSupport(
    key: SupportKey,
    change: Partial<Supports[SupportKey]>,
  ) {
    setSupports((current) => ({
      ...current,
      [key]: { ...current[key], ...change },
    }));
  }

  return (
    <ActionForm
      action={saveListing}
      submit={listing ? "변경사항 저장" : "공고 즉시 게시"}
      submitDisabled={!projects.length}
    >
      <input type="hidden" name="id" value={listing?.id || ""} />
      <input
        type="hidden"
        name="rate_options"
        value={JSON.stringify(rateOptions)}
      />
      <input type="hidden" name="supports" value={JSON.stringify(supports)} />
      <div className="project-picker">
        <label htmlFor="project-search">
          <span>
            모집할 현장{" "}
            <span className="required-mark" aria-hidden="true">
              *
            </span>
          </span>
        </label>
        <input
          id="project-search"
          type="search"
          placeholder="현장명 또는 주소 검색"
          value={projectQuery}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => {
            setProjectQuery(event.target.value);
            setProjectId("");
          }}
        />
        <label className="sr-only" htmlFor="project-id">
          검색 결과에서 모집할 현장 선택
        </label>
        <select
          id="project-id"
          name="project_id"
          required
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
        >
          <option value="" disabled>
            {searchTerms.length
              ? matchingProjects.length
                ? "검색 결과에서 현장 선택"
                : "검색 결과 없음"
              : "현장명 또는 주소를 먼저 검색해 주세요"}
          </option>
          {visibleProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name} · {project.address}
            </option>
          ))}
        </select>
        <small className="muted" role="status">
          {selectedProject
            ? `선택된 현장: ${selectedProject.name}`
            : searchTerms.length
              ? matchingProjects.length
                ? `${matchingProjects.length}곳 검색됨${matchingProjects.length > 50 ? " · 처음 50곳만 표시됩니다. 검색어를 더 입력해 주세요." : ""}`
                : "일치하는 현장이 없습니다. 현장명이나 주소를 바꿔 검색해 주세요."
              : "현장명 또는 주소를 입력하면 선택할 수 있습니다."}
        </small>
      </div>
      <label>
        <span>
          모집 상품 유형{" "}
          <span className="required-mark" aria-hidden="true">
            *
          </span>
        </span>
        <select
          name="product_type"
          required
          defaultValue={listing?.product_type || ""}
        >
          <option value="" disabled>
            상품 유형 선택
          </option>
          {Object.entries(productLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <small className="muted">
          다른 상품 유형을 모집하면 공고를 따로 등록해 주세요.
        </small>
      </label>
      <label>
        <span>
          조직명{" "}
          <span className="required-mark" aria-hidden="true">
            *
          </span>
        </span>
        <input
          name="organization"
          required
          maxLength={100}
          defaultValue={listing?.organization || organization}
        />
      </label>
      <section className="form-section" aria-labelledby="rate-heading">
        <div className="section-heading">
          <div>
            <h3 id="rate-heading">
              1계약당 RT{" "}
              <span className="required-mark" aria-hidden="true">
                *
              </span>
            </h3>
            <p className="muted">
              금액은 만 원 단위입니다. 상품 타입은 선택 입력이며, 타입별 금액이
              다르면 행을 추가하세요.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setRateOptions((current) => [
                ...current,
                { label: "", rates: [{ role: "member", amount: null }] },
              ])
            }
            disabled={rateOptions.length >= 20}
          >
            RT 행 추가
          </button>
        </div>
        {rateOptions.map((option, index) => (
          <div className="rate-option" key={index}>
            <div className="rate-option-head">
              <label>
                상품 타입
                <input
                  maxLength={40}
                  placeholder="예: 39형, 45형"
                  value={option.label}
                  onChange={(event) =>
                    updateOption(index, (current) => ({
                      ...current,
                      label: event.target.value,
                    }))
                  }
                />
              </label>
              {rateOptions.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setRateOptions((current) =>
                      current.filter((_, i) => i !== index),
                    )
                  }
                >
                  RT 행 삭제
                </button>
              )}
            </div>
            <div className="rate-option-grid">
              {Object.entries(roleLabels).map(([key, label]) => {
                const role = key as Rate["role"];
                const rate = option.rates.find((item) => item.role === role);
                return (
                  <div className="rate-input" key={role}>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={!!rate}
                        onChange={(event) =>
                          toggleRate(index, role, event.target.checked)
                        }
                      />
                      {label}
                    </label>
                    {rate && (
                      <>
                        <select
                          aria-label={`${option.label || "상품 타입"} ${label} 금액 공개 방식`}
                          value={rate.amount === null ? "private" : "fixed"}
                          onChange={(event) =>
                            updateRate(
                              index,
                              role,
                              event.target.value === "private" ? null : 0,
                            )
                          }
                        >
                          <option value="private">협의</option>
                          <option value="fixed">금액 공개</option>
                        </select>
                        {rate.amount !== null && (
                          <label>
                            <span>
                              금액 (만 원){" "}
                              <span
                                className="required-mark"
                                aria-hidden="true"
                              >
                                *
                              </span>
                            </span>
                            <input
                              aria-label={`${option.label || "상품 타입"} ${label} 금액`}
                              type="number"
                              min="0.1"
                              max="100000"
                              step="0.1"
                              required
                              value={rate.amount || ""}
                              onChange={(event) =>
                                updateRate(
                                  index,
                                  role,
                                  Number(event.target.value),
                                )
                              }
                            />
                          </label>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <p className="muted">
          팀 전체 금액을 선택하면 팀장·개인 금액은 해제됩니다. 두 금액을 따로
          적으면 카드에 팀 합계를 표시합니다.
        </p>
      </section>
      {[
        ["workplace", "실제 근무지", "예: 현장 주소 또는 모델하우스 주소"],
        [
          "trigger_condition",
          "지급 발생조건",
          "예: 계약금 완납 시 / 문의 시 안내",
        ],
        ["payment", "지급시점", "예: 익월 말 / 문의 시 안내"],
        ["clawback", "해약·환수 조건", "예: 해약 시 RT 환수 / 문의 시 안내"],
      ].map(([key, label, placeholder]) => (
        <label key={key}>
          <span>
            {label}
            {key === "workplace" && (
              <>
                {" "}
                <span className="required-mark" aria-hidden="true">
                  *
                </span>
              </>
            )}
          </span>
          <input
            name={key}
            required={key === "workplace"}
            maxLength={300}
            placeholder={placeholder}
            aria-describedby={key !== "workplace" ? `${key}-help` : undefined}
            defaultValue={(listing?.[key as keyof Listing] as string) || ""}
          />
          {key !== "workplace" && (
            <small id={`${key}-help`} className="condition-help">
              도움말: 공개하지 않으려면 비워 두세요. 공고에는 ‘문의 시 안내’로
              표시됩니다.
            </small>
          )}
        </label>
      ))}
      <section className="form-section" aria-labelledby="support-heading">
        <h3 id="support-heading">지원 조건</h3>
        <p className="muted">
          확인되지 않은 조건은 미확인으로 두세요. 조건부 지원은 적용 기준을 적어
          주세요.
        </p>
        <div className="support-form-grid">
          {supportKeys.map((key) => (
            <div className="support-form-row" key={key}>
              <label>
                {supportLabels[key]}
                <select
                  value={supports[key].status}
                  onChange={(event) => {
                    const status = event.target.value as SupportStatus;
                    updateSupport(key, {
                      status,
                      detail:
                        status === "yes" || status === "conditional"
                          ? supports[key].detail
                          : "",
                    });
                  }}
                >
                  {Object.entries(supportStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {(supports[key].status === "yes" ||
                supports[key].status === "conditional") && (
                <label>
                  <span>
                    {supportLabels[key]} 세부 조건{" "}
                    {supports[key].status === "conditional" && (
                      <span className="required-mark" aria-hidden="true">
                        *
                      </span>
                    )}
                  </span>
                  <input
                    value={supports[key].detail}
                    onChange={(event) =>
                      updateSupport(key, { detail: event.target.value })
                    }
                    maxLength={300}
                    required={supports[key].status === "conditional"}
                    placeholder={supportDetailPlaceholders[key]}
                  />
                </label>
              )}
            </div>
          ))}
        </div>
      </section>
      <label>
        추가 지원 조건·안내
        <textarea
          name="support"
          maxLength={1000}
          defaultValue={listing?.support}
        />
      </label>
      <label>
        <span>
          전화문의 번호{" "}
          <span className="required-mark" aria-hidden="true">
            *
          </span>
        </span>
        <input
          name="phone"
          type="tel"
          required
          defaultValue={listing?.phone || phone}
        />
      </label>
      <label>
        카카오 오픈채팅 주소
        <input
          name="kakao_url"
          type="url"
          placeholder="https://open.kakao.com/o/…"
          defaultValue={listing?.kakao_url || ""}
        />
      </label>
      <label className="check">
        <input type="checkbox" name="phone_consent" required />
        <span>
          이 공고의 전화번호를 비회원에게도 공개하는 데 동의합니다.{" "}
          <span className="required-mark" aria-hidden="true">
            *
          </span>
        </span>
      </label>
    </ActionForm>
  );
}
