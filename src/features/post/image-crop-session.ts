import {fullImageCrop,hasCropChanges,type CropOperation,type ImageEditOperation,type PixelSize} from './image-edit-model.ts';

/** Reopen all edits on the session's original image, retaining the current crop. */
export function imageCropWorkspace(operations:ImageEditOperation[],source:PixelSize):{operations:ImageEditOperation[];crop:CropOperation} {
 let crop=fullImageCrop(source),width=source.width,offsetX=0,offsetY=0;
 const expanded:ImageEditOperation[]=[];
 for(const operation of operations){
  if(operation.type==='crop'){
   offsetX+=operation.x;offsetY+=operation.y;width=operation.width;
   crop={...operation,x:offsetX,y:offsetY};continue;
  }
  if(operation.type==='mosaic')expanded.push({...operation,x:operation.x+offsetX,y:operation.y+offsetY});
  else if(operation.type==='text')expanded.push({...operation,x:operation.x+offsetX,y:operation.y+offsetY,maxWidth:Math.max(1,Math.min(operation.maxWidth??width,width-operation.x))});
  else expanded.push({...operation,points:operation.points.map(point=>({x:point.x+offsetX,y:point.y+offsetY})),...(operation.erasures?{erasures:operation.erasures.map(erasure=>({...erasure,points:erasure.points.map(point=>({x:point.x+offsetX,y:point.y+offsetY}))}))}:{})});
 }
 return {operations:expanded,crop};
}

/** Replace the session crop, keeping annotations in original-image coordinates. */
export function replaceImageCrop(operations:ImageEditOperation[],crop:CropOperation,source:PixelSize):ImageEditOperation[] {
 const workspace=imageCropWorkspace(operations,source);
 return hasCropChanges(crop,source)?[...workspace.operations,{...crop}]:workspace.operations;
}

export function sameImageCrop(first:CropOperation|null,second:CropOperation|null):boolean {
 return first===second||!!first&&!!second&&first.x===second.x&&first.y===second.y&&first.width===second.width&&first.height===second.height;
}
