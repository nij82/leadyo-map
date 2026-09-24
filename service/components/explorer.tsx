"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Phone, MessageCircle, ArrowLeft, Search } from "lucide-react";
import { NaverMap } from "./naver-map";
import { type Project, type Listing, roleLabels } from "@/lib/types";
export function Explorer({
  projects,
  listings,
  available,
}: {
  projects: Project[];
  listings: Listing[];
  available: boolean;
}) {
  const [query, setQuery] = useState(""),
    [role, setRole] = useState(""),
    [selected, setSelected] = useState<Project | null>(null),
    [tab, setTab] = useState("jobs");
  const rows = useMemo(
    () =>
      projects.filter(
        (p) =>
          (p.name + p.address).includes(query) &&
          listings.some(
            (j) =>
              j.project_id === p.id &&
              (!role || j.rates.some((r) => r.role === role)),
          ),
      ),
    [projects, listings, query, role],
  );
  function select(p: Project) {
    setSelected(p);
    setTab("jobs");
  }
  const jobs = listings.filter(
    (j) =>
      j.project_id === selected?.id &&
      (!role || j.rates.some((r) => r.role === role)),
  );
  return (
    <main id="main" className="explorer">
      <section className="toolbar">
        <label className="search">
          <Search size={18} />
          <input
            aria-label="현장명 또는 주소"
            placeholder="현장명, 주소 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="모집 대상"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="">전체 모집 대상</option>
          {Object.entries(roleLabels).map(([v, t]) => (
            <option value={v} key={v}>
              {t}
            </option>
          ))}
        </select>
      </section>
      <div className="map-layout">
        <aside className="results">
          <div className="list-heading">
            <h1>
              공고가 있는 현장 <b>{rows.length}</b>
            </h1>
            <p className="muted">현장을 선택해 모집 조건을 비교하세요.</p>
          </div>
          {!available ? (
            <div className="state">
              <h2>현장 정보를 준비하고 있습니다</h2>
              <p>잠시 후 다시 방문해 주세요.</p>
            </div>
          ) : !rows.length ? (
            <div className="state">
              <h2>표시할 공고가 없습니다</h2>
              <p>검색 조건을 변경하거나 첫 공고를 등록해 주세요.</p>
              <Link href="/manage?new=1">공고 등록</Link>
            </div>
          ) : (
            rows.map((p) => (
              <button
                className="project-row"
                key={p.id}
                onClick={() => select(p)}
              >
                <strong>{p.name}</strong>
                <span>{p.address}</span>
                <small>
                  구인정보{" "}
                  {listings.filter((j) => j.project_id === p.id).length}건
                </small>
              </button>
            ))
          )}
        </aside>
        <div className="map-area">
          <NaverMap projects={rows} onSelect={select} />
          {available &&
            !rows.length &&
            process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID && (
              <div className="mobile-empty">
                {available
                  ? "현재 조건에 맞는 공고가 없습니다."
                  : "현장 정보를 준비하고 있습니다."}
              </div>
            )}
        </div>
        {selected && (
          <aside className="detail">
            <div className="detail-top">
              <button onClick={() => setSelected(null)}>
                <ArrowLeft size={17} />
                지도
              </button>
              <strong>{selected.name}</strong>
            </div>
            <section className="summary">
              <p className="eyebrow">아파트 분양 현장</p>
              <h1>{selected.name}</h1>
              <p>{selected.address}</p>
              <dl>
                <dt>분양가</dt>
                <dd>{selected.price || "미확인"}</dd>
                <dt>세대수</dt>
                <dd>{selected.units?.toLocaleString() || "미확인"}</dd>
              </dl>
            </section>
            <div className="tabs">
              <button
                aria-pressed={tab === "jobs"}
                onClick={() => setTab("jobs")}
              >
                구인정보 {jobs.length}
              </button>
              <button
                aria-pressed={tab === "property"}
                onClick={() => setTab("property")}
              >
                현장 상세
              </button>
            </div>
            <div className="detail-body">
              {tab === "property" ? (
                <dl className="facts">
                  {[
                    ["주택형", selected.types],
                    ["시공사", selected.builder],
                    ["입주예정", selected.move_in],
                    ["계약금", selected.deposit],
                    ["중도금", selected.interim],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v || "미확인"}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <>
                  <div className="section-heading">
                    <h2>공고별 모집 정보</h2>
                    <Link href="/manage?new=1">공고 등록</Link>
                  </div>
                  {jobs.map((j) => (
                    <ListingCard key={j.id} listing={j} />
                  ))}
                  <a
                    className="promotion"
                    href="https://leadyo.co.kr"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <small>리드요 서비스 안내</small>
                    <strong>현장 홈페이지·분양광고가 필요하다면</strong>
                    <span>리드요 알아보기 →</span>
                  </a>
                </>
              )}
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
export function ListingCard({ listing: j }: { listing: Listing }) {
  const member = j.rates.find((r) => r.role === "member"),
    leader = j.rates.find((r) => r.role === "leader");
  return (
    <article className="listing">
      <h3>{j.organization}</h3>
      <p className="muted">1계약당 지급액</p>
      <dl className="rates">
        {j.rates.map((r) => (
          <div key={r.role}>
            <dt>{roleLabels[r.role]}</dt>
            <dd>
              {r.amount === null
                ? "금액 협의"
                : r.amount.toLocaleString() + "만 원"}
            </dd>
          </div>
        ))}
        {member?.amount != null && leader?.amount != null && (
          <div>
            <dt>팀 합계</dt>
            <dd>{(member.amount + leader.amount).toLocaleString()}만 원</dd>
          </div>
        )}
      </dl>
      <dl className="facts">
        {[
          ["지급시점", j.payment],
          ["발생조건", j.trigger_condition],
          ["해약·환수", j.clawback],
          ["근무지", j.workplace],
          ["지원 조건", j.support || "미입력"],
        ].map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="contact">
        <a
          className="button primary"
          href={"tel:" + j.phone.replaceAll("-", "")}
        >
          <Phone size={16} />
          전화문의
        </a>
        {j.kakao_url && (
          <a
            className="button"
            href={j.kakao_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle size={16} />
            카카오톡 문의
          </a>
        )}
      </div>
    </article>
  );
}
