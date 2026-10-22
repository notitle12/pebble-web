export type PinchPoint = { x: number; y: number };
export type PinchStart = { distance: number; center: PinchPoint; zoom: number; left: number; top: number; padding: number };
const center = (a: PinchPoint, b: PinchPoint) => ({ x: (a.x+b.x)/2, y: (a.y+b.y)/2 });
export function beginDiagramPinch(a: PinchPoint, b: PinchPoint, zoom: number, left: number, top: number, padding: number): PinchStart | null {
 const distance = Math.hypot(a.x-b.x,a.y-b.y);
 return distance < 2 ? null : {distance,center:center(a,b),zoom,left,top,padding};
}
export function moveDiagramPinch(start: PinchStart, a: PinchPoint, b: PinchPoint, padding: number) {
 const zoom = Math.max(.01,Math.min(3,start.zoom*Math.hypot(a.x-b.x,a.y-b.y)/start.distance));
 const current = center(a,b), ratio=zoom/start.zoom;
 return {zoom,left:Math.max(0,(start.left+start.center.x-start.padding)*ratio+padding-current.x),
  top:Math.max(0,(start.top+start.center.y-start.padding)*ratio+padding-current.y)};
}
