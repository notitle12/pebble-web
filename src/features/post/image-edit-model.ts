export type CropOperation = { type: "crop"; x: number; y: number; width: number; height: number };
export type MosaicOperation = { type: "mosaic"; x: number; y: number; width: number; height: number; blockSize: number };
export type TextOperation = { type: "text"; text: string; x: number; y: number; fontSize: number; color: string };
export type PenPoint = { x: number; y: number };
export type PenOperation = { type: "pen"; points: PenPoint[]; color: string; width: number };
export type ImageEditOperation = CropOperation | MosaicOperation | TextOperation | PenOperation;

export type PixelSize = { width: number; height: number };

export function safeBitmapSize(width: number, height: number): boolean {
  return Number.isSafeInteger(width) && Number.isSafeInteger(height)
    && width > 0 && height > 0 && width <= 8000 && height <= 8000
    && width * height <= 20_000_000;
}

export function clampCropRect(startX: number, startY: number, endX: number, endY: number, image: PixelSize): CropOperation | null {
  const left = Math.max(0, Math.min(image.width, Math.floor(Math.min(startX, endX))));
  const top = Math.max(0, Math.min(image.height, Math.floor(Math.min(startY, endY))));
  const right = Math.max(0, Math.min(image.width, Math.ceil(Math.max(startX, endX))));
  const bottom = Math.max(0, Math.min(image.height, Math.ceil(Math.max(startY, endY))));
  if (right - left < 2 || bottom - top < 2) return null;
  return { type: "crop", x: left, y: top, width: right - left, height: bottom - top };
}

export function dimensionsAfterCrop(size: PixelSize, operation: CropOperation): PixelSize {
  return { width: Math.min(size.width, operation.width), height: Math.min(size.height, operation.height) };
}

export function createMosaicOperation(rect: CropOperation, blockSize: number): MosaicOperation {
  return { ...rect, type: "mosaic", blockSize: Math.max(4, Math.min(48, Math.round(blockSize))) };
}

export function createTextOperation(text: string, x: number, y: number, size: PixelSize, fontSize: number, color: string): TextOperation | null {
  const safeText = text.trim().slice(0, 500);
  if (!safeText) return null;
  const safeColor = /^#[\da-f]{6}$/i.test(color) ? color.toLowerCase() : "#ffffff";
  return {
    type: "text", text: safeText,
    x: Math.max(0, Math.min(size.width, Math.round(x))),
    y: Math.max(0, Math.min(size.height, Math.round(y))),
    fontSize: Math.max(16, Math.min(160, Math.round(fontSize))), color: safeColor,
  };
}

export function createPenOperation(points: PenPoint[], size: PixelSize, width: number, color: string): PenOperation | null {
  if (!points.length) return null;
  const safePoints = points.slice(0, 5000).map(point => ({
    x: Math.max(0, Math.min(size.width, Math.round(point.x))),
    y: Math.max(0, Math.min(size.height, Math.round(point.y))),
  }));
  const safeColor = /^#[\da-f]{6}$/i.test(color) ? color.toLowerCase() : "#ffffff";
  return { type: "pen", points: safePoints, color: safeColor, width: Math.max(1, Math.min(128, Math.round(width))) };
}


export type CropHandle = 'n'|'s'|'e'|'w'|'nw'|'ne'|'sw'|'se'|'move';
export const fullImageCrop = (size:PixelSize):CropOperation => ({type:'crop',x:0,y:0,width:size.width,height:size.height});
export const hasCropChanges = (rect:CropOperation|null,size:PixelSize) => !!rect&&(rect.x!==0||rect.y!==0||rect.width!==size.width||rect.height!==size.height);
/** Keep the opposite edge fixed and never flip or escape the source bitmap. */
export function adjustCrop(rect:CropOperation,handle:CropHandle,dx:number,dy:number,size:PixelSize):CropOperation {
 if(!Number.isFinite(dx)||!Number.isFinite(dy))return rect;
 const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,Math.round(n)));
 if(handle==='move')return {...rect,x:clamp(rect.x+dx,0,size.width-rect.width),y:clamp(rect.y+dy,0,size.height-rect.height)};
 let left=rect.x,top=rect.y,right=rect.x+rect.width,bottom=rect.y+rect.height;
 const minWidth=Math.min(2,size.width),minHeight=Math.min(2,size.height);
 if(handle.includes('w'))left=clamp(left+dx,0,right-minWidth);
 if(handle.includes('e'))right=clamp(right+dx,left+minWidth,size.width);
 if(handle.includes('n'))top=clamp(top+dy,0,bottom-minHeight);
 if(handle.includes('s'))bottom=clamp(bottom+dy,top+minHeight,size.height);
 return {type:'crop',x:left,y:top,width:right-left,height:bottom-top};
}
