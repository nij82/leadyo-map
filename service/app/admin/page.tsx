import { identity } from "@/lib/supabase/server";
import { State } from "@/components/shell";
import { ActionForm } from "@/components/action-form";
import { operatorAction, saveProject } from "@/app/actions";
import type { Project } from "@/lib/types";
export default async function Admin() {
  const { client, admin } = await identity();
  if (!client || !admin)
    return (
      <main id="main" className="content">
        <State title="운영 권한이 필요합니다">
          <p>운영자로 지정된 계정으로 로그인해 주세요.</p>
        </State>
      </main>
    );
  const [j, p, m, r, a] = await Promise.all([
    client
      .from("listings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    client.from("projects").select("*").order("name").limit(1000),
    client.rpc("admin_members"),
    client.from("site_requests").select("*").eq("status", "pending"),
    client
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if ([j, p, m, r, a].some((x) => x.error))
    throw new Error("Admin data unavailable");
  return (
    <main id="main" className="content">
      <h1>운영관리</h1>
      <nav className="tabs">
        <a href="#listings">공고 관리</a>
        <a href="#projects">현장정보</a>
        <a href="#members">모집공고자</a>
        <a href="#audit">운영 기록</a>
      </nav>
      <section id="listings">
        <h2>전체 공고</h2>
        {!j.data?.length && <p className="notice">등록된 공고가 없습니다.</p>}
        {j.data?.map((job) => (
          <details className="panel" key={job.id}>
            <summary>
              {p.data?.find((x) => x.id === job.project_id)?.name} ·{" "}
              {job.organization} · {job.moderation}
            </summary>
            <ActionForm action={operatorAction} submit="공고 상태 변경">
              <input type="hidden" name="id" value={job.id} />
              <input type="hidden" name="kind" value="listing" />
              <label>
                처리
                <select name="decision">
                  <option value="hidden">숨김</option>
                  <option value="visible">게시</option>
                  <option value="deleted">삭제</option>
                </select>
              </label>
              <label>
                처리 사유
                <input name="reason" required maxLength={1000} />
              </label>
              <p>삭제 시 공개 목록에서 제거됩니다. 운영 기록은 남습니다.</p>
            </ActionForm>
          </details>
        ))}
      </section>
      <section id="projects">
        <h2>현장정보 관리</h2>
        <ProjectForm />
        {p.data?.map((project) => (
          <details className="panel" key={project.id}>
            <summary>
              {project.name} · {project.published ? "공개" : "비공개"}
            </summary>
            <ProjectForm project={project} />
          </details>
        ))}
        <h3>현장 등록 요청</h3>
        {r.data?.length ? (
          r.data.map((request) => (
            <div className="panel" key={request.id}>
              <strong>{request.name}</strong>
              <p>{request.address}</p>
              <p>현장 확인 후 위 등록 폼에서 추가하세요.</p>
            </div>
          ))
        ) : (
          <p>대기 중인 요청이 없습니다.</p>
        )}
      </section>
      <section id="members">
        <h2>모집공고자 관리</h2>
        {m.data?.map(
          (member: {
            id: string;
            name: string;
            organization: string;
            status: string;
            role: string;
          }) => (
            <details className="panel" key={member.id}>
              <summary>
                {member.name} · {member.organization} ·{" "}
                {member.status === "active" ? "정상" : "정지"}
              </summary>
              {member.role !== "admin" && (
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
                    value={member.status === "active" ? "suspended" : "active"}
                  />
                  <label>
                    처리 사유
                    <input name="reason" required maxLength={1000} />
                  </label>
                </ActionForm>
              )}
            </details>
          ),
        )}
      </section>
      <section id="audit">
        <h2>최근 운영 기록</h2>
        {a.data?.length ? (
          a.data.map((log) => (
            <div className="audit-row" key={log.id}>
              <strong>{log.action}</strong>
              <span>{log.reason}</span>
              <time>
                {new Date(log.created_at).toLocaleString("ko-KR", {
                  timeZone: "Asia/Seoul",
                })}
              </time>
            </div>
          ))
        ) : (
          <p>운영 기록이 없습니다.</p>
        )}
      </section>
    </main>
  );
}
function ProjectForm({ project: p }: { project?: Project }) {
  return (
    <details className="panel" open={!!p}>
      <summary>{p ? "정보 수정" : "새 아파트 현장 등록"}</summary>
      <ActionForm action={saveProject} submit="현장정보 저장">
        <input type="hidden" name="id" value={p?.id || ""} />
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
        <label className="check">
          <input
            type="checkbox"
            name="published"
            defaultChecked={p?.published ?? false}
          />
          공개 — 주소·좌표와 아파트 분양 현장 여부를 확인했습니다.
        </label>
      </ActionForm>
    </details>
  );
}
