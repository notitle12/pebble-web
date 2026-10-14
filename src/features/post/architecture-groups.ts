import type { ArchitectureGroup, ArchitectureSpec } from "./api/post-list.ts";
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
