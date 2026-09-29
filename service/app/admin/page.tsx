import { identity } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { State } from "@/components/shell";
import { ActionForm } from "@/components/action-form";
import { ApplyhomeImport } from "@/components/applyhome-import";
import { operatorAction, resolveSiteRequest, saveProject } from "@/app/actions";
import { displayProjectName } from "@/lib/project-name";
import {
  productLabels,
  supportLabels,
  type Listing,
  type Project,
} from "@/lib/types";
import {
  listingRateOptions,
  listingSupports,
  supportKeys,
} from "@/lib/listing-catalog";

const PAGE_SIZE = 20;
const tabs = [
  ["listings", "공고 관리"],
  ["projects", "현장정보"],
  ["requests", "현장 요청"],
  ["members", "모집공고자"],
  ["audit", "운영 기록"],
] as const;
type Tab = (typeof tabs)[number][0];
type Params = { [key: string]: string | string[] | undefined };
type Member = {
  id: string;
  name: string;
  organization: string;
  status: string;
  role: string;
};
type Request = {
  id: string;
  name: string;
  address: string;
  status: string;
  created_at: string;
};
type Audit = {
  id: number;
  action: string;
  target_id: string;
  reason: string;
  created_at: string;
};

function param(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}
function href(tab: Tab, q = "", status = "", page = 1, product = "") {
  const params = new URLSearchParams({ tab });
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (product) params.set("product", product);
  if (page > 1) params.set("page", String(page));
  return `/admin?${params}`;
}
function date(value: string) {
  return new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}
function actionLabel(action: string) {
  const labels: Record<string, string> = {
    "listing:visible": "공고 게시",
    "listing:hidden": "공고 숨김",
    "listing:deleted": "공고 삭제",
    "member:active": "회원 정지 해제",
    "member:suspended": "회원 정지",
    "project:insert": "현장 등록",
    "project:update": "현장 수정",
  };
  return labels[action] || action;
}
function Pager({
  tab,
  q,
  status,
  page,
  total,
  product,
}: {
  tab: Tab;
  q: string;
  status: string;
  page: number;
  total: number;
  product: string;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages === 1) return null;
  return (
    <nav className="admin-pager" aria-label="목록 페이지">
      {page > 1 ? (
        <a className="button" href={href(tab, q, status, page - 1, product)}>
          이전
        </a>
      ) : (
        <span />
      )}
      <span>
        {page} / {pages} 페이지
      </span>
      {page < pages ? (
        <a className="button" href={href(tab, q, status, page + 1, product)}>
          다음
        </a>
      ) : (
        <span />
      )}
    </nav>
  );
}
function Filters({
  tab,
  q,
  status,
  product,
}: {
  tab: Tab;
  q: string;
  status: string;
  product: string;
}) {
  const placeholders: Record<Tab, string> = {
    listings: "조직명으로 검색",
    projects: "현장명으로 검색",
    requests: "요청한 현장명으로 검색",
    members: "담당자명으로 검색",
    audit: "처리 사유로 검색",
  };
  const options: Partial<Record<Tab, [string, string][]>> = {
    listings: [
      ["", "전체 상태"],
      ["visible", "게시"],
      ["hidden", "숨김"],
      ["deleted", "삭제"],
    ],
    projects: [
      ["", "전체 상태"],
      ["published", "공개"],
      ["unpublished", "비공개"],
    ],
    requests: [
      ["pending", "대기"],
      ["resolved", "확인 완료"],
      ["all", "전체 상태"],
    ],
    members: [
      ["", "전체 상태"],
      ["active", "정상"],
      ["suspended", "정지"],
    ],
  };
  return (
    <form className="admin-filters" action="/admin" method="get" role="search">
      <input type="hidden" name="tab" value={tab} />
      <label className="admin-search-label">
        <span className="sr-only">{placeholders[tab]}</span>
        <input
          name="q"
          type="search"
          placeholder={placeholders[tab]}
          defaultValue={q}
          maxLength={80}
        />
      </label>
      {options[tab] && (
        <label>
          <span className="sr-only">상태</span>
          <select name="status" defaultValue={status}>
            {options[tab]?.map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
      {tab === "listings" && (
        <label>
          <span className="sr-only">상품 유형</span>
          <select name="product" defaultValue={product}>
            <option value="">전체 상품</option>
            <option value="unknown">유형 미확인</option>
            {Object.entries(productLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
      <button type="submit">검색</button>
      {(q ||
        product ||
        (status && !(tab === "requests" && status === "pending"))) && (
        <a className="button" href={href(tab)}>
          초기화
        </a>
      )}
    </form>
  );
}
function Empty({ filtered, tab }: { filtered: boolean; tab: Tab }) {
  return (
    <div className="admin-empty">
      <strong>
        {filtered ? "검색 결과가 없습니다" : "아직 항목이 없습니다"}
      </strong>
      <p>
        {filtered
          ? "검색어나 상태를 바꿔 보세요."
          : "새 항목이 등록되면 여기에 표시됩니다."}
      </p>
      {filtered && <a href={href(tab)}>필터 초기화</a>}
    </div>
  );
}

export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const { client, admin } = await identity();
  if (!client || !admin)
    return (
      <main id="main" className="content">
        <State title="운영 권한이 필요합니다">
          <p>운영자로 지정된 계정으로 로그인해 주세요.</p>
        </State>
      </main>
    );

  const params = await searchParams;
  const requestedTab = param(params.tab);
  const tab: Tab = tabs.some(([value]) => value === requestedTab)
    ? (requestedTab as Tab)
    : "listings";
  const q = param(params.q).trim().replace(/[%_]/g, "").slice(0, 80);
  const allowedStatus: Record<Tab, string[]> = {
    listings: ["visible", "hidden", "deleted"],
    projects: ["published", "unpublished"],
    requests: ["pending", "resolved", "all"],
    members: ["active", "suspended"],
    audit: [],
  };
  const requestedStatus = param(params.status);
  const status = allowedStatus[tab].includes(requestedStatus)
    ? requestedStatus
    : tab === "requests"
      ? "pending"
      : "";
  const requestedProduct = param(params.product);
  const product =
    tab === "listings" &&
    (requestedProduct === "unknown" || requestedProduct in productLabels)
      ? requestedProduct
      : "";
  const rawPage = Number(param(params.page));
  const page =
    Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 10000) : 1;
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE - 1;

  let total = 0;
  let listings: Listing[] = [];
  let projects: Project[] = [];
  let requests: Request[] = [];
  let members: Member[] = [];
  let logs: Audit[] = [];
  let projectNames: Record<string, string> = {};
  let error = false;

  if (tab === "listings") {
    let query = client
      .from("listings")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });
    if (q) query = query.ilike("organization", `%${q}%`);
    if (status) query = query.eq("moderation", status);
    if (product)
      query =
        product === "unknown"
          ? query.is("product_type", null)
          : query.eq("product_type", product);
    const result = await query.range(start, end);
    error = !!result.error;
    listings = result.data || [];
    total = result.count || 0;
    const ids = [...new Set(listings.map((job) => job.project_id))];
    if (ids.length) {
      const names = await client
        .from("projects")
        .select("id,name")
        .in("id", ids);
      error ||= !!names.error;
      projectNames = Object.fromEntries(
        (names.data || []).map((p) => [p.id, displayProjectName(p.name)]),
      );
    }
  } else if (tab === "projects") {
    let query = client
      .from("projects")
      .select(
        "id,name,address,latitude,longitude,units,types,price,move_in,deposit,interim,builder,published,showroom_address,product_details",
        { count: "exact" },
      )
      .order("name");
    if (q) query = query.ilike("name", `%${q}%`);
    if (status) query = query.eq("published", status === "published");
    const result = await query.range(start, end);
    error = !!result.error;
    projects = (result.data || []).map((project) => ({
      ...project,
      name: displayProjectName(project.name),
    }));
    total = result.count || 0;
  } else if (tab === "requests") {
    let query = client
      .from("site_requests")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });
    if (q) query = query.ilike("name", `%${q}%`);
    if (status && status !== "all") query = query.eq("status", status);
    const result = await query.range(start, end);
    error = !!result.error;
    requests = result.data || [];
    total = result.count || 0;
  } else if (tab === "members") {
    let query = client
      .rpc("admin_members", {}, { count: "exact" })
      .order("name");
    if (q) query = query.ilike("name", `%${q}%`);
    if (status) query = query.eq("status", status);
    const result = await query.range(start, end);
    error = !!result.error;
    members = result.data || [];
    total = result.count || 0;
  } else {
    let query = client
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });
    if (q) query = query.ilike("reason", `%${q}%`);
    const result = await query.range(start, end);
    error = !!result.error;
    logs = result.data || [];
    total = result.count || 0;
  }
  if (error) throw new Error("Admin data unavailable");
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (page > lastPage) redirect(href(tab, q, status, lastPage, product));
  const filtered =
    !!q ||
    !!product ||
    !!(status && !(tab === "requests" && status === "pending"));
  const label = tabs.find(([value]) => value === tab)?.[1];
  return (
    <main id="main" className="content admin-page">
      <header className="admin-header">
        <h1>운영관리</h1>
        <p>모집공고, 현장정보와 회원 상태를 확인하고 관리합니다.</p>
      </header>
      <nav className="admin-nav" aria-label="운영관리 메뉴">
        {tabs.map(([value, title]) => (
          <a
            key={value}
            href={href(value)}
            aria-current={tab === value ? "page" : undefined}
          >
            {title}
          </a>
        ))}
      </nav>
      <section className="admin-section" aria-labelledby="admin-section-title">
        <div className="admin-section-head">
          <div>
            <h2 id="admin-section-title">{label}</h2>
            <p>검색 조건에 맞는 {total.toLocaleString()}건</p>
          </div>
          {tab === "projects" && (
            <a className="button" href="#new-project">
              새 현장 등록
            </a>
          )}
        </div>
        <Filters tab={tab} q={q} status={status} product={product} />
        {tab === "projects" && (
          <details className="admin-create" id="new-project">
            <summary>새 분양 현장 등록</summary>
            <ProjectForm />
          </details>
        )}
        {tab === "projects" && process.env.NODE_ENV === "development" && (
          <ApplyhomeImport />
        )}
        {tab === "listings" &&
          (listings.length ? (
            <div className="admin-list">
              {listings.map((job) => (
                <details className="admin-record" key={job.id}>
                  <summary>
                    <span className="admin-record-main">
                      <strong>
                        {projectNames[job.project_id] || "현장 미확인"}
                      </strong>
                      <span>
                        {job.organization} ·{" "}
                        {job.product_type
                          ? productLabels[job.product_type]
                          : "상품 유형 미확인"}{" "}
                        · {job.workplace}
                      </span>
                    </span>
                    <span className="admin-record-side">
                      <span className={`admin-badge ${job.moderation}`}>
                        {job.moderation === "visible"
                          ? "게시"
                          : job.moderation === "hidden"
                            ? "숨김"
                            : "삭제"}
                      </span>
                      <time>{date(job.created_at)}</time>
                    </span>
                  </summary>
                  <div className="admin-record-body">
                    <p>
                      공고 상태:{" "}
                      {job.status === "published" ? "모집 중" : "마감"}
                    </p>
                    <p>
                      RT:{" "}
                      {listingRateOptions(job)
                        .map(
                          (option) =>
                            `${option.label ? `${option.label} ` : ""}${option.rates.map((rate) => `${rate.role === "member" ? "개인" : rate.role === "leader" ? "팀장" : rate.role === "director" ? "본부장" : "팀 전체"} ${rate.amount === null ? "협의" : `${rate.amount}만 원`}`).join(" / ")}`,
                        )
                        .join(" · ")}
                    </p>
                    <p>
                      지원:{" "}
                      {supportKeys
                        .map(
                          (key) =>
                            `${supportLabels[key]} ${listingSupports(job)[key].status === "yes" ? "지원" : listingSupports(job)[key].status === "conditional" ? "조건부" : listingSupports(job)[key].status === "no" ? "미지원" : "미확인"}`,
                        )
                        .join(" · ")}
                    </p>
                    <ActionForm action={operatorAction} submit="공고 상태 변경">
                      <input type="hidden" name="id" value={job.id} />
                      <input type="hidden" name="kind" value="listing" />
                      <label>
                        처리
                        <select name="decision" defaultValue={job.moderation}>
                          <option value="visible">게시</option>
                          <option value="hidden">숨김</option>
                          <option value="deleted">삭제</option>
                        </select>
                      </label>
                      <label>
                        처리 사유
                        <input name="reason" required maxLength={1000} />
                      </label>
                      <p>
                        삭제 시 공개 목록에서 제거되며 운영 기록은 남습니다.
                      </p>
                    </ActionForm>
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <Empty filtered={filtered} tab={tab} />
          ))}
        {tab === "projects" &&
          (projects.length ? (
            <div className="admin-list">
              {projects.map((project) => (
                <details className="admin-record" key={project.id}>
                  <summary>
                    <span className="admin-record-main">
                      <strong>{project.name}</strong>
                      <span>{project.address}</span>
                    </span>
                    <span
                      className={`admin-badge ${project.published ? "visible" : "hidden"}`}
                    >
                      {project.published ? "공개" : "비공개"}
                    </span>
                  </summary>
                  <div className="admin-record-body">
                    <ProjectForm project={project} />
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <Empty filtered={filtered} tab={tab} />
          ))}
        {tab === "requests" &&
          (requests.length ? (
            <div className="admin-list">
              {requests.map((request) => (
                <details className="admin-record" key={request.id}>
                  <summary>
                    <span className="admin-record-main">
                      <strong>{request.name}</strong>
                      <span>{request.address}</span>
                    </span>
                    <span className="admin-record-side">
                      <span
                        className={`admin-badge ${request.status === "pending" ? "pending" : "visible"}`}
                      >
                        {request.status === "pending" ? "대기" : "확인 완료"}
                      </span>
                      <time>{date(request.created_at)}</time>
                    </span>
                  </summary>
                  <div className="admin-record-body">
                    <p>
                      현장 정보를 확인한 뒤{" "}
                      <a href={href("projects")}>현장정보</a>에서 등록하세요.
                    </p>
                    {request.status === "pending" && (
                      <ActionForm
                        action={resolveSiteRequest}
                        submit="확인 완료로 표시"
                      >
                        <input type="hidden" name="id" value={request.id} />
                      </ActionForm>
                    )}
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <Empty filtered={filtered} tab={tab} />
          ))}
        {tab === "members" &&
          (members.length ? (
            <div className="admin-list">
              {members.map((member) => (
                <details className="admin-record" key={member.id}>
                  <summary>
                    <span className="admin-record-main">
                      <strong>{member.name}</strong>
                      <span>{member.organization}</span>
                    </span>
                    <span className="admin-record-side">
                      <span
                        className={`admin-badge ${member.status === "active" ? "visible" : "hidden"}`}
                      >
                        {member.status === "active" ? "정상" : "정지"}
                      </span>
                      {member.role === "admin" && (
                        <span className="admin-badge">운영자</span>
                      )}
                    </span>
                  </summary>
                  <div className="admin-record-body">
                    {member.role === "admin" ? (
                      <p>운영자 계정은 이 화면에서 정지할 수 없습니다.</p>
                    ) : (
                      <ActionForm
                        action={operatorAction}
                        submit={
                          member.status === "active" ? "회원 정지" : "정지 해제"
                        }
                      >
                        <input type="hidden" name="kind" value="member" />
                        <input type="hidden" name="id" value={member.id} />
                        <input
                          type="hidden"
                          name="decision"
                          value={
                            member.status === "active" ? "suspended" : "active"
                          }
                        />
                        <label>
                          처리 사유
                          <input name="reason" required maxLength={1000} />
                        </label>
                      </ActionForm>
                    )}
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <Empty filtered={filtered} tab={tab} />
          ))}
        {tab === "audit" &&
          (logs.length ? (
            <div className="admin-list">
              {logs.map((log) => (
                <div className="admin-audit" key={log.id}>
                  <strong>{actionLabel(log.action)}</strong>
                  <span>{log.reason}</span>
                  <time>{date(log.created_at)}</time>
                </div>
              ))}
            </div>
          ) : (
            <Empty filtered={filtered} tab={tab} />
          ))}
        <Pager
          tab={tab}
          q={q}
          status={status}
          page={page}
          total={total}
          product={product}
        />
      </section>
    </main>
  );
}

function ProjectForm({ project: p }: { project?: Project }) {
  return (
    <ActionForm action={saveProject} submit="현장정보 저장">
      <input type="hidden" name="id" value={p?.id || ""} />
      <p className="muted">
        사업지와 견본주택 주소는 구분해 입력하세요. 실제 근무지는 각
        모집공고에서 입력합니다.
      </p>
      <div className="form-grid">
        {[
          ["name", "현장명"],
          ["address", "주소"],
          ["latitude", "위도"],
          ["longitude", "경도"],
          ["units", "세대수"],
          ["types", "주택형"],
          ["price", "분양가"],
          ["builder", "시공사"],
          ["move_in", "입주예정"],
          ["deposit", "계약금"],
          ["interim", "중도금"],
        ].map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              name={key}
              required={["name", "address", "latitude", "longitude"].includes(
                key,
              )}
              defaultValue={String(p?.[key as keyof Project] ?? "")}
              maxLength={300}
            />
          </label>
        ))}
      </div>
      <label>
        견본주택 주소 (선택)
        <input
          name="showroom_address"
          maxLength={300}
          defaultValue={p?.showroom_address || ""}
        />
      </label>
      <div className="project-products">
        <h3>상품별 현장 정보</h3>
        {Object.entries(productLabels).map(([type, label]) => {
          const detail =
            p?.product_details?.[type as keyof typeof productLabels];
          return (
            <details key={type} className="project-product">
              <summary>{label}</summary>
              <div className="form-grid">
                {[
                  ["units", "규모(세대·실·호실)"],
                  ["types", "타입·면적"],
                  ["price", "분양가"],
                  ["move_in", "입주·준공 예정"],
                  ["deposit", "계약금"],
                  ["interim", "중도금"],
                ].map(([key, fieldLabel]) => (
                  <label key={key}>
                    {fieldLabel}
                    <input
                      name={`${type}_${key}`}
                      maxLength={300}
                      defaultValue={detail?.[key as keyof typeof detail] || ""}
                    />
                  </label>
                ))}
              </div>
            </details>
          );
        })}
      </div>
      <label className="check">
        <input
          type="checkbox"
          name="published"
          defaultChecked={p?.published ?? false}
        />
        공개 — 주소·좌표와 분양 현장 여부를 확인했습니다.
      </label>
    </ActionForm>
  );
}
