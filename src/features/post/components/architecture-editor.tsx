"use client";
import { useEffect, useState } from "react";
import { parseArchitectureSpec, type ArchitectureSpec } from "../api/post-list";
import { ArchitectureBlock } from "./architecture-block";

const sample: ArchitectureSpec = { schemaVersion: 1, groups: [
  { id: "cloudflare", type: "CLOUDFLARE", label: "Edge" }, { id: "oracle", type: "ORACLE_CLOUD", label: "Production" }, { id: "docker", type: "DOCKER", label: "Containers", parentId: "oracle" },
], nodes: [
  { id: "browser", type: "CLIENT", label: "Browser" }, { id: "worker", type: "APP", label: "Cloudflare Worker", groupId: "cloudflare" },
  { id: "r2", type: "STORAGE", label: "R2", groupId: "cloudflare" }, { id: "spring", type: "APP", label: "Spring API", groupId: "docker" },
  { id: "postgres", type: "DATABASE", label: "PostgreSQL", groupId: "docker" }, { id: "redis", type: "CACHE", label: "Redis", groupId: "docker" },
], edges: [ { id: "browser-worker", source: "browser", target: "worker", label: "HTTPS" }, { id: "worker-api", source: "worker", target: "spring", label: "API" },
  { id: "worker-r2", source: "worker", target: "r2", label: "Media" }, { id: "api-db", source: "spring", target: "postgres" }, { id: "api-cache", source: "spring", target: "redis" } ] };
const groupTypes = ["ORACLE_CLOUD", "AWS", "CLOUDFLARE", "DOCKER"] as const;
const nodeTypes = ["CLIENT", "APP", "DATABASE", "CACHE", "STORAGE", "PROXY"] as const;
const fresh = (prefix: string, existing: string[]) => { let n = existing.length + 1; while (existing.includes(`${prefix}-${n}`)) n++; return `${prefix}-${n}`; };
export function ArchitectureEditor({ onChange, initialValue }: { onChange?: (value: ArchitectureSpec | null) => void; initialValue?: ArchitectureSpec }) {
  const [spec, setSpec] = useState<ArchitectureSpec>(() => initialValue ?? sample);
  const changeNode = (id: string, field: string, value: string) => setSpec(current => ({ ...current, nodes: current.nodes.map(node => node.id === id ? { ...node, [field]: field === "groupId" ? value || null : value } as typeof node : node) }));
  const removeNode = (id: string) => setSpec(current => ({ ...current, nodes: current.nodes.filter(node => node.id !== id), edges: current.edges.filter(edge => edge.source !== id && edge.target !== id) }));
  const addNode = () => setSpec(current => ({ ...current, nodes: [...current.nodes, { id: fresh("node", [...current.nodes.map(n => n.id), ...current.groups.map(g => g.id), ...current.edges.map(e => e.id)]), type: "APP", label: "새 구성 요소" }] }));
  const addGroup = () => setSpec(current => ({ ...current, groups: [...current.groups, { id: fresh("group", [...current.groups.map(g => g.id), ...current.nodes.map(n => n.id), ...current.edges.map(e => e.id)]), type: "AWS", label: "새 클라우드" }] }));
  const hasAvailablePair = spec.nodes.some(source => spec.nodes.some(target => source.id !== target.id && !spec.edges.some(edge => edge.source === source.id && edge.target === target.id)));
  const addEdge = () => setSpec(current => { const pair = current.nodes.flatMap(source => current.nodes.filter(target => source.id !== target.id && !current.edges.some(edge => edge.source === source.id && edge.target === target.id)).map(target => [source.id, target.id])).at(0); if (!pair) return current; return { ...current, edges: [...current.edges, { id: fresh("edge", [...current.edges.map(e => e.id), ...current.nodes.map(n => n.id), ...current.groups.map(g => g.id)]), source: pair[0], target: pair[1] }] }; });
  const updateGroup = (id: string, field: string, value: string) => setSpec(current => {
    if (field !== "type") return { ...current, groups: current.groups.map(group => group.id === id ? { ...group, [field]: field === "parentId" ? value || null : value } as typeof group : group) };
    const changing = current.groups.find(group => group.id === id);
    const groups = current.groups.map(group => group.id === id ? { ...group, type: value, parentId: null } as typeof group : group);
    if (value === "DOCKER" && changing?.type !== "DOCKER") return { ...current, groups: groups.map(group => group.parentId === id ? { ...group, parentId: null } : group) };
    return { ...current, groups };
  });
  const removeGroup = (id: string) => setSpec(current => { const deleted = new Set([id, ...current.groups.filter(g => g.parentId === id).map(g => g.id)]); return { ...current, groups: current.groups.filter(g => !deleted.has(g.id)), nodes: current.nodes.map(n => deleted.has(n.groupId ?? "") ? { ...n, groupId: null } : n) }; });
  const issues: string[] = [];
  if (spec.groups.length > 10) issues.push("그룹은 최대 10개입니다.");
  if (spec.nodes.length < 1 || spec.nodes.length > 30) issues.push("구성 요소는 1~30개여야 합니다.");
  if (spec.edges.length > 60) issues.push("연결은 최대 60개입니다.");
  const allIds = new Set<string>();
  for (const group of spec.groups) { if (!/^[a-z][a-z0-9-]{0,39}$/.test(group.id) || allIds.has(group.id)) issues.push(`그룹 “${group.id}”의 ID 형식 또는 중복을 확인해 주세요.`); allIds.add(group.id); if (!group.label.trim() || Array.from(group.label).length > 100) issues.push(`그룹 “${group.id}”의 이름은 공백일 수 없고 100자를 넘을 수 없습니다.`); if (group.parentId && (!spec.groups.some(parent => parent.id === group.parentId && parent.type !== "DOCKER" && !parent.parentId) || group.type !== "DOCKER")) issues.push(`그룹 “${group.id}”의 상위 경계는 최상위 클라우드여야 합니다.`); }
  for (const node of spec.nodes) { if (!/^[a-z][a-z0-9-]{0,39}$/.test(node.id) || allIds.has(node.id)) issues.push(`구성 요소 “${node.id}”의 ID 형식 또는 중복을 확인해 주세요.`); allIds.add(node.id); if (!node.label.trim() || Array.from(node.label).length > 100) issues.push(`구성 요소 “${node.id}”의 이름은 공백일 수 없고 100자를 넘을 수 없습니다.`); if (node.groupId && !spec.groups.some(group => group.id === node.groupId)) issues.push(`구성 요소 “${node.id}”의 경계 그룹을 확인해 주세요.`); }
  for (const edge of spec.edges) { if (!/^[a-z][a-z0-9-]{0,39}$/.test(edge.id) || allIds.has(edge.id)) issues.push(`연결 “${edge.id}”의 ID 형식 또는 중복을 확인해 주세요.`); allIds.add(edge.id); if (!spec.nodes.some(node => node.id === edge.source) || !spec.nodes.some(node => node.id === edge.target)) issues.push(`연결 “${edge.id}”의 시작/도착 요소를 확인해 주세요.`); if (edge.source === edge.target) issues.push(`연결 “${edge.id}”은 같은 요소를 시작과 도착으로 지정할 수 없습니다.`); if (edge.label && Array.from(edge.label).length > 200) issues.push(`연결 “${edge.id}”의 설명은 200자를 넘을 수 없습니다.`); if (spec.edges.some(other => other.id !== edge.id && other.source === edge.source && other.target === edge.target)) issues.push(`연결 “${edge.id}”과 같은 방향의 중복 연결이 있습니다.`); }
  if (Array.from(JSON.stringify(spec)).length > 50000) issues.push("직렬화된 내용은 50,000자를 넘을 수 없습니다.");
  try { parseArchitectureSpec(spec); } catch { if (!issues.length) issues.push("입력값을 다시 확인해 주세요."); }
  const invalid = issues.length > 0;
  useEffect(() => { onChange?.(invalid ? null : spec); }, [onChange, invalid, spec]);
  return <div className="architecture-editor-layout"><form className="architecture-editor" onSubmit={event => event.preventDefault()}>
    <div className="architecture-editor-section"><div className="architecture-editor-heading"><h2>경계 그룹 ({spec.groups.length}/10)</h2><button type="button" disabled={spec.groups.length >= 10} onClick={addGroup}>그룹 추가</button></div>
      {spec.groups.map(group => <fieldset key={group.id}><legend>{group.id}</legend><label>종류<select value={group.type} onChange={e => updateGroup(group.id, "type", e.target.value)}>{groupTypes.map(type => <option key={type}>{type}</option>)}</select></label><label>표시 이름<input value={group.label} onChange={e => updateGroup(group.id, "label", e.target.value)} /></label>{group.type === "DOCKER" && <label>클라우드 그룹<select value={group.parentId ?? ""} onChange={e => updateGroup(group.id, "parentId", e.target.value)}><option value="">최상위</option>{spec.groups.filter(g => g.id !== group.id && g.type !== "DOCKER" && !g.parentId).map(g => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label>}<button type="button" onClick={() => removeGroup(group.id)}>그룹 삭제</button></fieldset>)}</div>
    <div className="architecture-editor-section"><div className="architecture-editor-heading"><h2>구성 요소 ({spec.nodes.length}/30)</h2><button type="button" disabled={spec.nodes.length >= 30} onClick={addNode}>요소 추가</button></div>
      {spec.nodes.map(node => <fieldset key={node.id}><legend>{node.id}</legend><label>종류<select value={node.type} onChange={e => changeNode(node.id, "type", e.target.value)}>{nodeTypes.map(type => <option key={type}>{type}</option>)}</select></label><label>표시 이름<input value={node.label} onChange={e => changeNode(node.id, "label", e.target.value)} /></label><label>경계 그룹<select value={node.groupId ?? ""} onChange={e => changeNode(node.id, "groupId", e.target.value)}><option value="">없음</option>{spec.groups.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label><button type="button" disabled={spec.nodes.length <= 1} onClick={() => removeNode(node.id)}>요소 삭제</button></fieldset>)}</div>
    <div className="architecture-editor-section"><div className="architecture-editor-heading"><h2>연결 ({spec.edges.length}/60)</h2><button type="button" disabled={spec.edges.length >= 60 || !hasAvailablePair} onClick={addEdge}>연결 추가</button></div>
      {spec.edges.map(edge => <fieldset key={edge.id}><legend>{edge.id}</legend><label>시작 요소<select value={edge.source} onChange={e => setSpec(s => ({ ...s, edges: s.edges.map(x => x.id === edge.id ? { ...x, source: e.target.value } : x) }))}>{spec.nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}</select></label><label>도착 요소<select value={edge.target} onChange={e => setSpec(s => ({ ...s, edges: s.edges.map(x => x.id === edge.id ? { ...x, target: e.target.value } : x) }))}>{spec.nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}</select></label><label>연결 설명<input value={edge.label ?? ""} onChange={e => setSpec(s => ({ ...s, edges: s.edges.map(x => x.id === edge.id ? { ...x, label: e.target.value || null } : x) }))} /></label><button type="button" onClick={() => setSpec(s => ({ ...s, edges: s.edges.filter(x => x.id !== edge.id) }))}>연결 삭제</button></fieldset>)}</div>
    {invalid && <div className="architecture-editor-error" role="alert"><strong>입력을 확인해 주세요.</strong><ul>{issues.slice(0, 8).map((issue, index) => <li key={`${index}-${issue}`}>{issue}</li>)}</ul></div>}
    <p className="architecture-editor-note">개발용 미리보기입니다. 게시글 편집기 연결과 저장 기능은 아직 제공하지 않습니다.</p>
  </form><section className="architecture-live-preview" aria-label="아키텍처 미리보기"><h2>미리보기</h2>{invalid ? <p>입력 오류를 수정하면 다이어그램이 표시됩니다.</p> : <ArchitectureBlock spec={spec} title={null} />}</section></div>;
}
