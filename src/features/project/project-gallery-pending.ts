import {mediaFileError,type ProjectMedia} from '../media/model.ts';

export type PendingGalleryRecord={key:string;file:Blob;name:string;type:string;lastModified:number;uploadedMediaId?:string};
type PendingGalleryItem={key:string;file:File;previewUrl:string;uploadedMediaId?:string};

export function createProjectGalleryPending(createUrl:(file:File)=>string=file=>URL.createObjectURL(file),revokeUrl:(url:string)=>void=url=>URL.revokeObjectURL(url)){
 const items=new Map<string,PendingGalleryItem>();
 const fromRecord=(record:PendingGalleryRecord):PendingGalleryItem=>{
  if(!/^[0-9a-f-]{36}$/i.test(record.key)||!(record.file instanceof Blob)||typeof record.name!=='string'||typeof record.type!=='string'||!Number.isFinite(record.lastModified)||record.uploadedMediaId!==undefined&&!/^[1-9]\d{0,18}$/.test(record.uploadedMediaId))throw new Error('복구할 프로젝트 이미지 파일을 확인해 주세요.');
  const file=new File([record.file],record.name,{type:record.type,lastModified:record.lastModified});
  const error=mediaFileError(file);if(error)throw new Error(error);
  return {key:record.key,file,previewUrl:createUrl(file),...(record.uploadedMediaId?{uploadedMediaId:record.uploadedMediaId}:{})};
 };
 return {
  stage(files:File[],existingCount=0,existingMediaIds:ReadonlySet<string>=new Set()){const errors=files.map(mediaFileError).filter((value):value is string=>!!value);if(errors.length)throw new Error(errors[0]);const stagedCount=[...items.values()].filter(item=>!item.uploadedMediaId||!existingMediaIds.has(item.uploadedMediaId)).length;if(stagedCount+existingCount+files.length>20)throw new Error('프로젝트 갤러리 이미지는 최대 20개까지 추가할 수 있어요.');const added=files.map(file=>{const item={key:crypto.randomUUID(),file,previewUrl:createUrl(file)};items.set(item.key,item);return item;});return added;},
  snapshot():PendingGalleryRecord[]{return [...items.values()].map(item=>({key:item.key,file:item.file,name:item.file.name,type:item.file.type,lastModified:item.file.lastModified,...(item.uploadedMediaId?{uploadedMediaId:item.uploadedMediaId}:{})}));},
  restore(records:PendingGalleryRecord[]){if(!Array.isArray(records)||records.length>20)throw new Error('복구할 프로젝트 이미지 수를 확인해 주세요.');const prepared=records.map(fromRecord);for(const item of items.values())revokeUrl(item.previewUrl);items.clear();for(const item of prepared)items.set(item.key,item);return [...items.values()];},
  markUploaded(key:string,media:ProjectMedia){const item=items.get(key);if(item)item.uploadedMediaId=media.id;},
  remove(key:string){const item=items.get(key);if(item)revokeUrl(item.previewUrl);items.delete(key);},
  values(){return [...items.values()];},
  clear(){for(const item of items.values())revokeUrl(item.previewUrl);items.clear();},
 };
}
