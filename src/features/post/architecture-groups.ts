import type { ArchitectureGroup, ArchitectureSpec } from "./api/post-list.ts";

export const ARCHITECTURE_GROUP_COLORS = [
  { id: "BLUE", label: "블루", hex: "#ebf2ff", border: "#9eb1cb", dot: "#4770d6" },
  { id: "GREEN", label: "그린", hex: "#e7f4eb", border: "#85b493", dot: "#3b8254" },
  { id: "PURPLE", label: "퍼플", hex: "#f4eeff", border: "#b49fd9", dot: "#7a52b3" },
  { id: "AMBER", label: "앰버", hex: "#fef7e6", border: "#ddb76f", dot: "#a07418" },
  { id: "ROSE", label: "로즈", hex: "#ffeeee", border: "#e09d9d", dot: "#b84c4c" },
  { id: "PEACH", label: "피치", hex: "#fff3ea", border: "#e4aa7e", dot: "#b86828" },
  { id: "TEAL", label: "틸", hex: "#e6f7f7", border: "#7ec3c3", dot: "#268585" },
  { id: "INDIGO", label: "인디고", hex: "#eef0fe", border: "#9ba4df", dot: "#4d5bb5" },
  { id: "PINK", label: "핑크", hex: "#feeff8", border: "#d89ec5", dot: "#ab468e" },
  { id: "GRAY", label: "그레이", hex: "#f1f4f8", border: "#aeb9c7", dot: "#5a687a" },
] as const;

export type ArchitectureGroupColorId = (typeof ARCHITECTURE_GROUP_COLORS)[number]["id"];
export const ARCHITECTURE_GROUP_COLOR_IDS: readonly ArchitectureGroupColorId[] = ARCHITECTURE_GROUP_COLORS.map(c => c.id);

export const isArchitectureContainer = (type:string) => type === "DOCKER" || type === "CONTAINER";
export function architectureGroupPresentation(group:ArchitectureGroup) {
  const vendor:Record<string,string>={ORACLE_CLOUD:"Oracle Cloud",AWS:"AWS",CLOUDFLARE:"Cloudflare",DOCKER:"Docker"};
  const legacy=vendor[group.type];
  const category=isArchitectureContainer(group.type)?"CONTAINER":group.type==="CUSTOM"?(group.typeLabel??"GROUP"):"CLOUD";
  const detail=legacy?(group.label===legacy?legacy:[legacy,group.label].filter(Boolean).join(" / ")):group.label;
  return {category,detail};
}
export function normalizeArchitectureGroups(spec:ArchitectureSpec):ArchitectureSpec {
  return {...spec,groups:spec.groups.map(group=>{
    if(!["ORACLE_CLOUD","AWS","CLOUDFLARE","DOCKER"].includes(group.type))return group;
    return {...group,type:isArchitectureContainer(group.type)?"CONTAINER":"CLOUD",label:architectureGroupPresentation(group).detail};
  })};
}

export const architectureGroupLabel = (group:ArchitectureGroup) => { const {category,detail}=architectureGroupPresentation(group); return [category,detail].filter(Boolean).join(" · "); };

export function isDescendant(groups: ArchitectureSpec['groups'], ancestorId: string, targetId: string): boolean {
  let curr = groups.find(g => g.id === targetId)?.parentId;
  const seen = new Set<string>();
  while (curr) {
    if (curr === ancestorId) return true;
    if (seen.has(curr)) break;
    seen.add(curr);
    curr = groups.find(g => g.id === curr)?.parentId;
  }
  return false;
}

export function getAllDescendantGroupIds(groups: ArchitectureSpec['groups'], parentId: string): Set<string> {
  const result = new Set<string>();
  function collect(id: string) {
    for (const g of groups) {
      if (g.parentId === id && !result.has(g.id)) {
        result.add(g.id);
        collect(g.id);
      }
    }
  }
  collect(parentId);
  return result;
}
