import type { ArchitectureSide } from "./api/post-list";

export function architectureZoom(current:number, delta:number, minimum=.4) {
  return Math.max(minimum, Math.min(3, Math.round(current * Math.exp(-Math.max(-100,Math.min(100,delta)) * .003) * 100) / 100));
}
export function nearestArchitectureSide(rect:{left:number;right:number;top:number;bottom:number}, x:number, y:number):ArchitectureSide {
  const distances=[Math.abs(y-rect.top),Math.abs(rect.right-x),Math.abs(rect.bottom-y),Math.abs(x-rect.left)];
  return (["TOP","RIGHT","BOTTOM","LEFT"] as const)[distances.indexOf(Math.min(...distances))];
}
