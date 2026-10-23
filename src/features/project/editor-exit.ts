import type {OwnProject} from "./api/member-projects.ts";
import {validId} from "../../lib/list-query.ts";
export function projectEditorExitHref(project:Pick<OwnProject,"id"|"visibilityStatus"|"isBlocked">|null):string {
  if(!project||!validId(project.id))return "/me/projects";
  return `/projects/${project.id}${project.visibilityStatus==="PUBLIC"&&!project.isBlocked?"":"/view"}`;
}
