"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Phone,
  MessageCircle,
  ArrowLeft,
  Search,
  Building,
  Building2,
  CalendarDays,
  House,
  Layers3,
  MapPin,
  Store,
  ChevronDown,
} from "lucide-react";
import { NaverMap } from "./naver-map";
import { formatRtReference, type RtReference } from "@/lib/rt-reference";
import {
  type Project,
  type ApplyhomeDetails,
  type Listing,
  type ProductType,
  type SupportKey,
  type SupplyEvent,
  type SupplyStage,
  productLabels,
  roleLabels,
  supportLabels,
  supportStatusLabels,
} from "@/lib/types";
import {
  formatApplyhomeDate,
  formatSupplyPrice,
  isSupplementalNotice,
  noticeCategoryLabel,
  scheduleLabels,
} from "@/lib/applyhome";
import {
  listingRateOptions,
  listingRateRange,
  listingSupportHighlights,
  listingSupports,
  matchesListing,
  matchesProjectWithoutListing,
  projectRegion,
  supportKeys,
} from "@/lib/listing-catalog";
import {
  compareProjectRows,
  matchesSupplyStatus,
  supplyEventOptions,
  supplyStageOptions,
  type ProjectSort,
} from "@/lib/project-schedule";

type FilterPanel = "region" | "product" | "role" | "supply";

function SingleChoiceFilter({
  id,
  label,
  defaultLabel,
  value,
  options,
  expanded,
  onToggle,
  onChange,
}: {
  id: Exclude<FilterPanel, "supply">;
  label: string;
  defaultLabel?: string;
  value: string;
  options: { value: string; label: string }[];
  expanded: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedLabel = options.find((option) => option.value === value)?.label;

  return (
    <div className="filter-panel-control">
      <button
        ref={triggerRef}
        type="button"
        className="filter-panel-toggle"
        aria-label={`${label}: ${selectedLabel || defaultLabel || "전체"}`}
        aria-expanded={expanded}
        aria-controls={`${id}-filters`}
        onClick={onToggle}
      >
        {selectedLabel || defaultLabel || label}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      <div
        id={`${id}-filters`}
        className="filter-panel"
        role="group"
        aria-label={`${label} 필터`}
        hidden={!expanded}
      >
        <h2>{label}</h2>
        <div className="filter-panel-options">
          <button
            type="button"
            className="filter-chip"
            aria-pressed={!value}
            onClick={() => {
              onChange("");
              triggerRef.current?.focus();
            }}
          >
            전체
          </button>
          {options.map((option) => (
            <button
              type="button"
              className="filter-chip"
              key={option.value}
              aria-pressed={value === option.value}
              onClick={() => {
                onChange(option.value);
                triggerRef.current?.focus();
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Explorer({
  projects,
  listings,
  available,
  rtReferences,
}: {
  projects: Project[];
  listings: Listing[];
  available: boolean;
  rtReferences: RtReference[];
}) {
  const filterPanelsRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const jobListScrollTop = useRef(0);
  const [query, setQuery] = useState(""),
    [role, setRole] = useState(""),
    [region, setRegion] = useState(""),
    [product, setProduct] = useState<ProductType | "">(""),
    [supportFilters, setSupportFilters] = useState<SupportKey[]>([]),
    [includeConditional, setIncludeConditional] = useState(false),
    [filtersExpanded, setFiltersExpanded] = useState(false),
    [activePanel, setActivePanel] = useState<FilterPanel | null>(null),
    [supplyStages, setSupplyStages] = useState<SupplyStage[]>([]),
    [supplyEvents, setSupplyEvents] = useState<SupplyEvent[]>([]),
    [sort, setSort] = useState<ProjectSort>("recommended"),
    [selected, setSelected] = useState<Project | null>(null),
    [selectedListingId, setSelectedListingId] = useState<string | null>(null),
    [tab, setTab] = useState("jobs"),
    [applyhomeDetails, setApplyhomeDetails] = useState<ApplyhomeDetails | null>(
      null,
    ),
    [detailsLoading, setDetailsLoading] = useState(false),
    [detailsError, setDetailsError] = useState(false);
  const filters = useMemo(
    () => ({
      query,
      role,
      region,
      product,
      supports: supportFilters,
      includeConditional,
    }),
    [query, role, region, product, supportFilters, includeConditional],
  );
  const rows = useMemo(
    () =>
      projects
        .map((project) => ({
          project,
          jobs: listings.filter((listing) =>
            matchesListing(project, listing, filters),
          ),
        }))
        .filter(
          (row) =>
            matchesSupplyStatus(row.project, supplyStages, supplyEvents) &&
            (row.jobs.length > 0 ||
              matchesProjectWithoutListing(row.project, filters)),
        ),
    [projects, listings, filters, supplyStages, supplyEvents],
  );
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => compareProjectRows(a, b, sort)),
    [rows, sort],
  );
  useEffect(() => {
    if (selected && !rows.some((row) => row.project.id === selected.id))
      setSelected(null);
  }, [rows, selected]);
  useEffect(() => {
    if (!activePanel) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!filterPanelsRef.current?.contains(event.target as Node))
        setActivePanel(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      filterPanelsRef.current
        ?.querySelector<HTMLButtonElement>(
          `[aria-controls="${activePanel}-filters"]`,
        )
        ?.focus();
      setActivePanel(null);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [activePanel]);
  useEffect(() => {
    setApplyhomeDetails(null);
    setDetailsError(false);
    if (!selected?.applyhome_summary || tab !== "property") {
      setDetailsLoading(false);
      return;
    }
    const controller = new AbortController();
    setDetailsLoading(true);
    fetch(`/api/project-details?id=${encodeURIComponent(selected.id)}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Project detail unavailable");
        return response.json() as Promise<ApplyhomeDetails | null>;
      })
      .then((details) => setApplyhomeDetails(details))
      .catch(() => {
        if (!controller.signal.aborted) setDetailsError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailsLoading(false);
      });
    return () => controller.abort();
  }, [selected?.id, selected?.applyhome_summary, tab]);
  const regions = [
    ...new Set(projects.map(projectRegion).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "ko-KR"));
  function select(p: Project) {
    setSelected(p);
    setSelectedListingId(null);
    setTab("jobs");
    setActivePanel(null);
  }
  const projectJobs = selected
    ? listings.filter((listing) => listing.project_id === selected.id)
    : [];
  const jobs = selected
    ? listings
        .filter((listing) => matchesListing(selected, listing, filters))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
    : [];
  const selectedListing = jobs.find(
    (listing) => listing.id === selectedListingId,
  );
  function openListing(id: string) {
    jobListScrollTop.current = detailRef.current?.scrollTop || 0;
    setSelectedListingId(id);
    requestAnimationFrame(() => {
      const detail = detailRef.current;
      const tabs = detail?.querySelector<HTMLElement>(".tabs");
      if (detail && tabs) detail.scrollTop = Math.max(0, tabs.offsetTop - 64);
    });
  }
  function closeListing() {
    setSelectedListingId(null);
    requestAnimationFrame(() => {
      if (detailRef.current)
        detailRef.current.scrollTop = jobListScrollTop.current;
    });
  }
  const selectedRtReferences = rtReferences.filter(
    (reference) =>
      reference.projectId === selected?.id &&
      (!product || reference.productType === product) &&
      (!role || reference.role === role),
  );
  const jobProducts = [
    ...new Set(
      jobs
        .map((job) => job.product_type)
        .filter((type): type is ProductType => !!type),
    ),
  ];
  const summaryProduct =
    product ||
    (jobProducts.length === 1 ? jobProducts[0] : "") ||
    selected?.applyhome_summary?.product_type ||
    (Object.keys(selected?.product_details || {}).length === 1
      ? (Object.keys(selected?.product_details || {})[0] as ProductType)
      : "");
  const summaryDetail = summaryProduct
    ? selected?.product_details?.[summaryProduct]
    : null;
  const sourceSummary = selected?.applyhome_summary;
  const summaryProducts = [
    ...new Set<ProductType>([
      ...(sourceSummary ? [sourceSummary.product_type] : []),
      ...(Object.keys(selected?.product_details || {}) as ProductType[]),
      ...jobProducts,
    ]),
  ];
  const visibleProductDetails = (
    Object.entries(selected?.product_details || {}) as [
      ProductType,
      NonNullable<typeof summaryDetail>,
    ][]
  ).filter(
    ([type, detail]) =>
      (!product || type === product) && Object.values(detail).some(Boolean),
  );
  const visibleProductTypes = [
    ...new Set<ProductType>([
      ...visibleProductDetails.map(([type]) => type),
      ...(sourceSummary && (!product || product === sourceSummary.product_type)
        ? [sourceSummary.product_type]
        : []),
    ]),
  ];
  const sourceNotices = applyhomeDetails?.source_notices || [];
  const primaryNotice = sourceNotices.find(
    (notice) =>
      notice.category === sourceSummary?.category &&
      notice.announced_at === sourceSummary.announced_at,
  );
  const orderedNotices = primaryNotice
    ? [
        primaryNotice,
        ...sourceNotices.filter((notice) => notice !== primaryNotice),
      ]
    : sourceNotices;
  function clearFilters() {
    setQuery("");
    setRole("");
    setRegion("");
    setProduct("");
    setSupportFilters([]);
    setIncludeConditional(false);
    setSupplyStages([]);
    setSupplyEvents([]);
  }
  return (
    <main id="main" className="explorer">
      <section className="toolbar" aria-label="현장과 구인정보 검색 조건">
        <label className="search">
          <Search size={18} />
          <input
            aria-label="현장명, 주소 또는 조직명"
            placeholder="현장명, 주소, 조직명 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="filter-selects" ref={filterPanelsRef}>
          <SingleChoiceFilter
            id="region"
            label="지역"
            defaultLabel="전국"
            value={region}
            options={regions.map((value) => ({ value, label: value }))}
            expanded={activePanel === "region"}
            onToggle={() =>
              setActivePanel((current) =>
                current === "region" ? null : "region",
              )
            }
            onChange={(value) => {
              setRegion(value);
              setActivePanel(null);
            }}
          />
          <SingleChoiceFilter
            id="product"
            label="공급유형"
            value={product}
            options={Object.entries(productLabels).map(([value, label]) => ({
              value,
              label,
            }))}
            expanded={activePanel === "product"}
            onToggle={() =>
              setActivePanel((current) =>
                current === "product" ? null : "product",
              )
            }
            onChange={(value) => {
              setProduct(value as ProductType | "");
              setActivePanel(null);
            }}
          />
          <SingleChoiceFilter
            id="role"
            label="모집대상"
            value={role}
            options={Object.entries(roleLabels).map(([value, label]) => ({
              value,
              label,
            }))}
            expanded={activePanel === "role"}
            onToggle={() =>
              setActivePanel((current) => (current === "role" ? null : "role"))
            }
            onChange={(value) => {
              setRole(value);
              setActivePanel(null);
            }}
          />
          <div className="filter-panel-control">
            <button
              type="button"
              className="filter-panel-toggle"
              aria-expanded={activePanel === "supply"}
              aria-controls="supply-filters"
              onClick={() =>
                setActivePanel((current) =>
                  current === "supply" ? null : "supply",
                )
              }
            >
              공급현황
              {supplyStages.length + supplyEvents.length
                ? ` ${supplyStages.length + supplyEvents.length}`
                : ""}
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            <div
              id="supply-filters"
              className="filter-panel"
              aria-label="공급현황 필터"
              hidden={activePanel !== "supply"}
            >
              <h2>공급현황</h2>
              <fieldset>
                <legend>공급 단계</legend>
                <div className="filter-panel-options">
                  <button
                    type="button"
                    className="filter-chip"
                    aria-pressed={!supplyStages.length}
                    onClick={() => setSupplyStages([])}
                  >
                    전체
                  </button>
                  {supplyStageOptions.map(({ value, label }) => (
                    <button
                      type="button"
                      className="filter-chip"
                      key={value}
                      aria-pressed={supplyStages.includes(value)}
                      onClick={() =>
                        setSupplyStages((current) =>
                          current.includes(value)
                            ? current.filter((item) => item !== value)
                            : [...current, value],
                        )
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>공급 일정</legend>
                <div className="filter-panel-options">
                  <button
                    type="button"
                    className="filter-chip"
                    aria-pressed={!supplyEvents.length}
                    onClick={() => setSupplyEvents([])}
                  >
                    전체
                  </button>
                  {supplyEventOptions.map(({ value, label }) => (
                    <button
                      type="button"
                      className="filter-chip"
                      key={value}
                      aria-pressed={supplyEvents.includes(value)}
                      onClick={() =>
                        setSupplyEvents((current) =>
                          current.includes(value)
                            ? current.filter((item) => item !== value)
                            : [...current, value],
                        )
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <p>
                공고에 등록된 날짜를 기준으로 분류합니다. 분양중은 공고일 이후
                남은 공급 일정이 있는 현장입니다.
              </p>
            </div>
          </div>
        </div>
        <button
          type="button"
          className="filter-toggle"
          aria-expanded={filtersExpanded}
          aria-controls="support-filters"
          onClick={() => setFiltersExpanded((value) => !value)}
        >
          지원 조건{supportFilters.length ? ` ${supportFilters.length}` : ""}
        </button>
        <div
          id="support-filters"
          className={`filter-supports${filtersExpanded ? " expanded" : ""}`}
          aria-label="지원 조건"
        >
          {supportKeys.map((key) => (
            <button
              type="button"
              key={key}
              className="filter-chip"
              aria-pressed={supportFilters.includes(key)}
              onClick={() =>
                setSupportFilters((current) =>
                  current.includes(key)
                    ? current.filter((item) => item !== key)
                    : [...current, key],
                )
              }
            >
              {supportLabels[key]}
            </button>
          ))}
          <label className="filter-conditional">
            <input
              type="checkbox"
              checked={includeConditional}
              onChange={(e) => setIncludeConditional(e.target.checked)}
            />
            조건부 지원 포함
          </label>
          <button type="button" className="filter-clear" onClick={clearFilters}>
            초기화
          </button>
        </div>
      </section>
      <div className={`map-layout${selected ? " has-detail" : ""}`}>
        <aside className="results" aria-label="검색 결과">
          <div className="list-heading">
            <h2>
              분양 현장 <b>{rows.length}</b>
            </h2>
            <select
              aria-label="현장 정렬"
              value={sort}
              onChange={(event) => setSort(event.target.value as ProjectSort)}
            >
              <option value="recommended">추천순</option>
              <option value="schedule">분양 일정순</option>
              <option value="listings">모집 공고순</option>
            </select>
          </div>
          <div id="result-list">
            {!available ? (
              <div className="state">
                <h2>현장 정보를 준비하고 있습니다</h2>
                <p>잠시 후 다시 방문해 주세요.</p>
              </div>
            ) : !rows.length ? (
              <div className="state">
                <h2>표시할 현장이 없습니다</h2>
                <p>검색 조건을 변경해 주세요.</p>
                <button type="button" onClick={clearFilters}>
                  검색 조건 초기화
                </button>
              </div>
            ) : (
              sortedRows.map(({ project: p, jobs: matchingJobs }) => {
                const productTypes = product
                  ? [product]
                  : [
                      ...new Set<ProductType>([
                        ...(p.applyhome_summary
                          ? [p.applyhome_summary.product_type]
                          : []),
                        ...(Object.keys(
                          p.product_details || {},
                        ) as ProductType[]),
                        ...matchingJobs
                          .map((job) => job.product_type)
                          .filter((type): type is ProductType => !!type),
                      ]),
                    ];
                const supports = listingSupportHighlights(matchingJobs);
                return (
                  <button
                    className="project-row"
                    key={p.id}
                    onClick={() => select(p)}
                  >
                    <span className="project-row-heading">
                      <span className="project-row-title">
                        <span className="project-row-icon" aria-hidden="true">
                          {productTypes.length > 1 ? (
                            <Layers3 />
                          ) : productTypes[0] === "apartment" ? (
                            <Building2 />
                          ) : productTypes[0] === "officetel" ? (
                            <Building />
                          ) : productTypes[0] === "retail" ? (
                            <Store />
                          ) : (
                            <MapPin />
                          )}
                        </span>
                        <strong>{p.name}</strong>
                      </span>
                      {matchingJobs.length > 0 && (
                        <span className="project-row-job-count">
                          구인 {matchingJobs.length}건
                        </span>
                      )}
                    </span>
                    <span className="project-row-address">{p.address}</span>
                    {(productTypes.length > 0 || p.next_schedule) && (
                      <span className="project-row-meta">
                        {productTypes.length > 0 && (
                          <span className="project-row-product">
                            {productTypes
                              .map((type) => productLabels[type])
                              .join(" · ")}
                          </span>
                        )}
                        {p.next_schedule && (
                          <span className="project-row-schedule">
                            <span>{p.next_schedule.label}</span>
                            <b>{formatApplyhomeDate(p.next_schedule.date)}</b>
                          </span>
                        )}
                      </span>
                    )}
                    {p.unsold_evidence?.status === "confirmed" && (
                      <span className="project-row-unsold">
                        미분양 확인 · {p.unsold_evidence.as_of.slice(0, 7).replace("-", ".")} 기준
                      </span>
                    )}
                    {matchingJobs.length > 0 && (
                      <span className="project-row-job">
                        <span>1계약당 RT</span>
                        <strong>{listingRateRange(matchingJobs, role)}</strong>
                        {supports.length > 0 && (
                          <span className="project-row-support">
                            지원 · {supports.slice(0, 2).join(" · ")}
                            {supports.length > 2 &&
                              ` 외 ${supports.length - 2}종`}
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>
        <div className="map-area">
          <NaverMap items={rows} onSelect={select} />
          {available &&
            !rows.length &&
            process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID && (
              <div className="mobile-empty">
                {available
                  ? "현재 조건에 맞는 현장이 없습니다."
                  : "현장 정보를 준비하고 있습니다."}
              </div>
            )}
        </div>
        {selected && (
          <aside className="detail" ref={detailRef}>
            <div className="detail-top">
              <button
                type="button"
                aria-label={selectedListing ? "구인정보 목록으로" : "뒤로"}
                onClick={() => {
                  if (selectedListing) closeListing();
                  else setSelected(null);
                }}
              >
                <ArrowLeft size={22} aria-hidden="true" />
              </button>
              <strong>{selected.name}</strong>
            </div>
            <section className="summary">
              <p className="eyebrow">분양 현장</p>
              <h1>{selected.name}</h1>
              <p>사업지 · {selected.address}</p>
              {summaryProducts.length > 0 && (
                <p>
                  공급유형 ·{" "}
                  {summaryProducts
                    .map((type) => productLabels[type])
                    .join(" · ")}
                </p>
              )}
              <dl>
                <dt>{summaryDetail?.price ? "분양가" : "이번 공고 최고가"}</dt>
                <dd>
                  {summaryDetail?.price ||
                    (sourceSummary?.price_max_10k_krw != null
                      ? formatSupplyPrice(sourceSummary.price_max_10k_krw)
                      : "미확인")}
                </dd>
                <dt>{summaryDetail?.units ? "규모" : "이번 공고 공급"}</dt>
                <dd>
                  {summaryDetail?.units ||
                    (sourceSummary?.notice_supply_units != null
                      ? `${sourceSummary.notice_supply_units.toLocaleString("ko-KR")}세대`
                      : "미확인")}
                </dd>
                {(summaryDetail?.move_in ||
                  sourceSummary?.planned_move_in_month) && (
                  <>
                    <dt>입주 예정</dt>
                    <dd>
                      {summaryDetail?.move_in ||
                        formatApplyhomeDate(
                          sourceSummary?.planned_move_in_month,
                        )}
                    </dd>
                  </>
                )}
              </dl>
              {selected.unsold_evidence?.status === "confirmed" && (
                <p className="unsold-evidence">
                  <strong>미분양 확인</strong>{" "}
                  · {selected.unsold_evidence.as_of.slice(0, 7).replace("-", ".")} 기준{" "}
                  <a href={selected.unsold_evidence.source_url} target="_blank" rel="noopener noreferrer">
                    {selected.unsold_evidence.provider}
                  </a>
                </p>
              )}
              {projectJobs.length > 0 && (
                <p className="summary-jobs">
                  <strong>전체 구인정보 {projectJobs.length}건</strong>
                  <span>RT {listingRateRange(projectJobs)}</span>
                </p>
              )}
            </section>
            <div className="tabs">
              <button
                aria-pressed={tab === "jobs"}
                onClick={() => {
                  setTab("jobs");
                  setSelectedListingId(null);
                }}
              >
                구인정보 {jobs.length}
              </button>
              <button
                aria-pressed={tab === "property"}
                onClick={() => {
                  setTab("property");
                  setSelectedListingId(null);
                }}
              >
                현장 상세
              </button>
            </div>
            <div
              className={`detail-body${tab === "property" ? " detail-body--property" : ""}`}
            >
              {tab === "property" ? (
                <>
                  {sourceSummary && (
                    <section className="property-section">
                      <p className="source-caption">
                        {noticeCategoryLabel(sourceSummary.category)} ·{" "}
                        {formatApplyhomeDate(sourceSummary.announced_at)} 공고
                      </p>
                      {isSupplementalNotice(sourceSummary.category) && (
                        <p className="notice-context">
                          이번 공고 공급 세대수는 단지 전체 규모와 다릅니다.
                        </p>
                      )}
                    </section>
                  )}
                  {(selected.showroom_address ||
                    selected.builder ||
                    sourceSummary?.builder ||
                    sourceSummary?.business_entity) && (
                    <section className="property-section">
                      <h2 className="property-heading">
                        <Building2 aria-hidden="true" />
                        현장 기본 정보
                      </h2>
                      <dl className="facts">
                        {selected.showroom_address && (
                          <div>
                            <dt>견본주택</dt>
                            <dd>{selected.showroom_address}</dd>
                          </div>
                        )}
                        {(selected.builder || sourceSummary?.builder) && (
                          <div>
                            <dt>시공사</dt>
                            <dd>
                              {selected.builder || sourceSummary?.builder}
                            </dd>
                          </div>
                        )}
                        {sourceSummary?.business_entity && (
                          <div>
                            <dt>사업주체</dt>
                            <dd>{sourceSummary.business_entity}</dd>
                          </div>
                        )}
                      </dl>
                    </section>
                  )}
                  {visibleProductTypes.map((type) => {
                    const detail = selected.product_details?.[type];
                    const source =
                      sourceSummary?.product_type === type
                        ? sourceSummary
                        : null;
                    const rows: [string, string | null | undefined][] = [
                      ["규모", detail?.units],
                      ["타입·면적", detail?.types],
                      ["분양가", detail?.price],
                      [
                        "이번 공고 공급",
                        source?.notice_supply_units != null
                          ? `${source.notice_supply_units.toLocaleString("ko-KR")}세대`
                          : null,
                      ],
                      [
                        "공고 주택형",
                        source?.type_count ? `${source.type_count}개` : null,
                      ],
                      [
                        "이번 공고 최고가",
                        source?.price_max_10k_krw != null
                          ? formatSupplyPrice(source.price_max_10k_krw)
                          : null,
                      ],
                      [
                        "입주·준공",
                        detail?.move_in ||
                          (source?.planned_move_in_month
                            ? formatApplyhomeDate(source.planned_move_in_month)
                            : null),
                      ],
                      ["계약금", detail?.deposit],
                      ["중도금", detail?.interim],
                    ];
                    return (
                      <section
                        className="property-section property-product"
                        key={type}
                      >
                        <h2 className="property-heading">
                          {type === "apartment" ? (
                            <House aria-hidden="true" />
                          ) : type === "officetel" ? (
                            <Building aria-hidden="true" />
                          ) : (
                            <Store aria-hidden="true" />
                          )}
                          {productLabels[type]}
                        </h2>
                        <dl className="facts">
                          {rows
                            .filter(([, value]) => Boolean(value))
                            .map(([key, value]) => (
                              <div key={key}>
                                <dt>{key}</dt>
                                <dd>{value}</dd>
                              </div>
                            ))}
                        </dl>
                        {source && isSupplementalNotice(source.category) && (
                          <p className="notice-context">
                            이번 공고 물량은 단지 전체 규모가 아닙니다.
                          </p>
                        )}
                      </section>
                    );
                  })}
                  {!visibleProductTypes.length && (
                    <p className="notice">
                      상품별 현장 상세 정보를 확인하고 있습니다. 기존 현장
                      정보는 상품 유형이 확인된 뒤 옮겨 표시합니다.
                    </p>
                  )}
                  {sourceSummary &&
                    (!product || product === sourceSummary.product_type) && (
                      <section className="applyhome-section">
                        <h2 className="property-heading">
                          <CalendarDays aria-hidden="true" />
                          주택형·분양 일정
                        </h2>
                        {detailsLoading ||
                        (!applyhomeDetails && !detailsError) ? (
                          <p className="notice">
                            공고와 주택형을 불러오는 중입니다.
                          </p>
                        ) : detailsError ? (
                          <p className="notice">
                            분양 정보를 불러오지 못했습니다. 잠시 후 다시 확인해
                            주세요.
                          </p>
                        ) : applyhomeDetails ? (
                          <>
                            {orderedNotices.map((notice, index) => {
                              const Wrapper = index === 0 ? "div" : "details";
                              return (
                                <Wrapper
                                  className="applyhome-notice"
                                  key={`${notice.source_id}-${notice.announcement_id}`}
                                >
                                  {index === 0 && (
                                    <div className="applyhome-notice__head">
                                      <span>이번 공고</span>
                                      <strong>
                                        {noticeCategoryLabel(notice.category)}
                                      </strong>
                                      <time>
                                        {formatApplyhomeDate(
                                          notice.announced_at,
                                        )}{" "}
                                        공고
                                      </time>
                                    </div>
                                  )}
                                  {index > 0 && (
                                    <summary>
                                      {noticeCategoryLabel(notice.category)} ·{" "}
                                      {formatApplyhomeDate(notice.announced_at)}
                                    </summary>
                                  )}
                                  {index > 0 && (
                                    <dl className="facts">
                                      {notice.name_at_announcement !==
                                        selected.name && (
                                        <div>
                                          <dt>공고 당시 현장명</dt>
                                          <dd>{notice.name_at_announcement}</dd>
                                        </div>
                                      )}
                                      {notice.address_at_announcement !==
                                        selected.address && (
                                        <div>
                                          <dt>공고상 사업지</dt>
                                          <dd>
                                            {notice.address_at_announcement}
                                          </dd>
                                        </div>
                                      )}
                                      <div>
                                        <dt>공고 공급</dt>
                                        <dd>
                                          {notice.notice_supply_units != null
                                            ? `${notice.notice_supply_units.toLocaleString("ko-KR")}세대`
                                            : "미확인"}
                                        </dd>
                                      </div>
                                      <div>
                                        <dt>사업주체</dt>
                                        <dd>
                                          {notice.business_entity || "미확인"}
                                        </dd>
                                      </div>
                                      <div>
                                        <dt>시공사</dt>
                                        <dd>{notice.builder || "미확인"}</dd>
                                      </div>
                                      <div>
                                        <dt>입주예정월</dt>
                                        <dd>
                                          {formatApplyhomeDate(
                                            notice.planned_move_in_month,
                                          )}
                                        </dd>
                                      </div>
                                    </dl>
                                  )}
                                  <h3 className="property-heading">
                                    <Layers3 aria-hidden="true" />
                                    주택형별 공급·분양가
                                  </h3>
                                  <div className="applyhome-models">
                                    {notice.models.map((model) => (
                                      <div
                                        className="applyhome-model"
                                        key={model.model_no}
                                      >
                                        <div className="applyhome-model__head">
                                          <div>
                                            <strong>
                                              {model.type || "타입 미표기"}
                                            </strong>
                                          </div>
                                          {model.group && (
                                            <span className="applyhome-model__group">
                                              {model.group}
                                            </span>
                                          )}
                                        </div>
                                        <dl className="applyhome-model__facts">
                                          {model.exclusive_area_m2 && (
                                            <div>
                                              <dt>전용면적</dt>
                                              <dd>
                                                {model.exclusive_area_m2}㎡
                                              </dd>
                                            </div>
                                          )}
                                          {model.supply_area_m2 && (
                                            <div>
                                              <dt>공급면적</dt>
                                              <dd>{model.supply_area_m2}㎡</dd>
                                            </div>
                                          )}
                                          <div>
                                            <dt>공급 세대</dt>
                                            <dd>
                                              {model.model_supply_units.toLocaleString(
                                                "ko-KR",
                                              )}
                                              세대
                                            </dd>
                                          </div>
                                          {model.general_supply_units !=
                                            null && (
                                            <div>
                                              <dt>일반공급</dt>
                                              <dd>
                                                {model.general_supply_units.toLocaleString(
                                                  "ko-KR",
                                                )}
                                                세대
                                              </dd>
                                            </div>
                                          )}
                                          {model.special_supply_units !=
                                            null && (
                                            <div>
                                              <dt>특별공급</dt>
                                              <dd>
                                                {model.special_supply_units.toLocaleString(
                                                  "ko-KR",
                                                )}
                                                세대
                                              </dd>
                                            </div>
                                          )}
                                        </dl>
                                        <div className="applyhome-model__price">
                                          <span>최고 분양가</span>
                                          <b>
                                            {formatSupplyPrice(
                                              model.maximum_supply_price_10k_krw,
                                            )}
                                          </b>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  {Object.keys(notice.schedule).length > 0 && (
                                    <>
                                      <h3 className="property-heading property-subsection-heading">
                                        <CalendarDays aria-hidden="true" />
                                        분양 일정
                                      </h3>
                                      <dl className="facts facts--schedule">
                                        {Object.entries(notice.schedule)
                                          .sort(([, a], [, b]) =>
                                            a.localeCompare(b),
                                          )
                                          .map(([key, value]) => (
                                            <div key={key}>
                                              <dt>
                                                {scheduleLabels[key] || key}
                                              </dt>
                                              <dd>
                                                {formatApplyhomeDate(value)}
                                              </dd>
                                            </div>
                                          ))}
                                      </dl>
                                    </>
                                  )}
                                  <div className="source-links">
                                    {notice.official_notice_url?.startsWith(
                                      "https://www.applyhome.co.kr/",
                                    ) && (
                                      <a
                                        className="source-links__notice"
                                        href={notice.official_notice_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label="공고문 보기, 새 창에서 열림"
                                      >
                                        공고문 보기
                                      </a>
                                    )}
                                    {notice.homepage_url &&
                                      /^https?:\/\//i.test(
                                        notice.homepage_url,
                                      ) && (
                                        <a
                                          className="source-links__homepage"
                                          href={notice.homepage_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          aria-label="현장 홈페이지, 새 창에서 열림"
                                        >
                                          현장 홈페이지
                                        </a>
                                      )}
                                  </div>
                                </Wrapper>
                              );
                            })}
                            {applyhomeDetails.nearby_planned_move_in.length >
                              0 && (
                              <section className="applyhome-nearby">
                                <h3 className="property-heading">
                                  <MapPin aria-hidden="true" />
                                  주변 입주 예정 현장{" "}
                                  {
                                    applyhomeDetails.nearby_planned_move_in
                                      .length
                                  }
                                  곳
                                </h3>
                                <p className="source-caption">
                                  등록된 현장 중 직선거리 3km 이내 · 일정은 공고
                                  당시 기준
                                </p>
                                <ul>
                                  {applyhomeDetails.nearby_planned_move_in.map(
                                    (nearby) => (
                                      <li
                                        key={`${nearby.name}-${nearby.address}`}
                                      >
                                        <strong>{nearby.name}</strong>
                                        <span>
                                          {formatApplyhomeDate(
                                            nearby.planned_move_in_month,
                                          )}{" "}
                                          예정 · 직선{" "}
                                          {nearby.straight_line_distance_km}km
                                        </span>
                                      </li>
                                    ),
                                  )}
                                </ul>
                              </section>
                            )}
                          </>
                        ) : (
                          <p className="notice">현장 상세 정보가 없습니다.</p>
                        )}
                      </section>
                    )}
                </>
              ) : (
                <>
                  {selectedListing ? (
                    <>
                      <button
                        type="button"
                        className="listing-back"
                        onClick={closeListing}
                      >
                        <ArrowLeft size={17} aria-hidden="true" />
                        구인정보 목록
                      </button>
                      <ListingCard listing={selectedListing} />
                    </>
                  ) : (
                    <>
                      <div className="section-heading">
                        <h2>공고별 모집 정보</h2>
                        <Link
                          className="button"
                          href={`/manage?new=1&project=${encodeURIComponent(selected.id)}`}
                        >
                          공고 등록
                        </Link>
                      </div>
                      {jobs.length > 0 && (
                        <div className="listing-list">
                          {jobs.map((job) => (
                            <ListingPreview
                              key={job.id}
                              listing={job}
                              role={role}
                              onSelect={() => openListing(job.id)}
                            />
                          ))}
                        </div>
                      )}
                      {!jobs.length && (
                        <p className="notice">
                          현재 등록된 구인정보가 없습니다.
                        </p>
                      )}
                    </>
                  )}
                  {!selectedListing &&
                    projectJobs.length === 0 &&
                    selectedRtReferences.length > 0 && (
                      <section
                        className="rt-reference"
                        aria-label="RT 참고 정보"
                      >
                        <h2>RT 참고</h2>
                        <p className="rt-reference-intro">
                          모집공고가 없는 현장의 참고 금액입니다.
                        </p>
                        {selectedRtReferences.map((reference) => (
                          <div
                            className="rt-reference-row"
                            key={`${reference.productType}-${reference.role}`}
                          >
                            <span>
                              {productLabels[reference.productType]} ·{" "}
                              {roleLabels[reference.role]}
                            </span>
                            <strong>{formatRtReference(reference)}</strong>
                          </div>
                        ))}
                        {selectedRtReferences[0].amounts.length > 1 && (
                          <p className="rt-reference-note">
                            상품 타입에 따라 금액이 다릅니다.
                          </p>
                        )}
                        {selectedRtReferences[0].supports.length > 0 && (
                          <p className="rt-reference-support">
                            지원 정보 ·{" "}
                            {selectedRtReferences[0].supports.join(" · ")}
                          </p>
                        )}
                        <p className="rt-reference-caveat">
                          실제 지급·모집 조건은 달라질 수 있습니다.
                        </p>
                      </section>
                    )}
                  {!selectedListing && (
                    <a
                      className="promotion"
                      href="https://leadyo.co.kr"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Image
                        src="/images/leadyo-template-gallery.jpg"
                        alt="분양 홈페이지 디자인 예시 이미지"
                        width={1000}
                        height={562}
                        sizes="(max-width: 640px) 100vw, 360px"
                      />
                      <span className="promotion-copy">
                        <small>리드요 서비스 안내</small>
                        <strong>현장 홈페이지·분양광고가 필요하다면</strong>
                        <span>리드요 알아보기 →</span>
                      </span>
                    </a>
                  )}
                </>
              )}
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
function ListingPreview({
  listing,
  role,
  onSelect,
}: {
  listing: Listing;
  role: string;
  onSelect: () => void;
}) {
  const supports = listingSupports(listing);
  const supportSummary = supportKeys
    .filter(
      (key) =>
        supports[key].status === "yes" ||
        supports[key].status === "conditional",
    )
    .map(
      (key) =>
        `${supportLabels[key]}${supports[key].status === "conditional" ? " 조건부" : ""}`,
    );
  return (
    <button type="button" className="listing-preview" onClick={onSelect}>
      <span className="listing-preview-heading">
        <strong>{listing.organization}</strong>
        <span className="product-badge">
          {listing.product_type
            ? productLabels[listing.product_type]
            : "공급유형 미확인"}
        </span>
      </span>
      <span className="listing-preview-rate">
        <span>1계약당 RT</span>
        <strong>{listingRateRange([listing], role)}</strong>
      </span>
      {supportSummary.length > 0 && (
        <span className="listing-preview-support">
          지원 · {supportSummary.join(" · ")}
        </span>
      )}
      <span className="listing-preview-footer">
        <time dateTime={listing.created_at}>
          {new Date(listing.created_at).toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            timeZone: "Asia/Seoul",
          })}
        </time>
        <span>자세히 보기 →</span>
      </span>
    </button>
  );
}
export function ListingCard({ listing: j }: { listing: Listing }) {
  const rateOptions = listingRateOptions(j);
  const supports = listingSupports(j);
  const hasTypedRates = !!j.product_type && !!j.rate_options?.length;
  return (
    <article className="listing">
      <div className="listing-heading">
        <h3>{j.organization}</h3>
        <span className="product-badge">
          {j.product_type ? productLabels[j.product_type] : "상품 유형 미확인"}
        </span>
      </div>
      <h4 className="listing-section-title">1계약당 지급액</h4>
      {!hasTypedRates && (
        <p className="notice">
          상품 유형과 타입별 RT 확인 전입니다. 문의 전에 모집자에게 금액을
          확인해 주세요.
        </p>
      )}
      {hasTypedRates &&
        rateOptions.map((option) => {
          const member = option.rates.find((rate) => rate.role === "member");
          const leader = option.rates.find((rate) => rate.role === "leader");
          return (
            <div className="rate-group" key={option.label}>
              {option.label && <h5>{option.label}</h5>}
              <dl className="rates">
                {option.rates.map((rate) => (
                  <div key={rate.role}>
                    <dt>{roleLabels[rate.role]}</dt>
                    <dd>
                      {rate.amount === null
                        ? "금액 협의"
                        : rate.amount.toLocaleString() + "만 원"}
                    </dd>
                  </div>
                ))}
                {member?.amount != null && leader?.amount != null && (
                  <div>
                    <dt>팀 합계</dt>
                    <dd>
                      {(member.amount + leader.amount).toLocaleString()}만 원
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          );
        })}
      <h4 className="listing-section-title listing-section-title--divider">
        지원 조건
      </h4>
      <div className="support-status-list" aria-label="지원 조건">
        {supportKeys.map((key) => (
          <div key={key}>
            <strong>{supportLabels[key]}</strong>
            <span>{supportStatusLabels[supports[key].status]}</span>
            {supports[key].detail && <small>{supports[key].detail}</small>}
          </div>
        ))}
      </div>
      <h4 className="listing-section-title listing-section-title--divider">
        근무·지급 안내
      </h4>
      <dl className="facts">
        {[
          ["지급시점", j.payment],
          ["발생조건", j.trigger_condition],
          ["해약·환수", j.clawback],
          ["근무지", j.workplace],
          ["추가 안내", j.support || "미입력"],
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
