import {mediaFileError} from "../media/model.ts";
import type {PostEditorValue} from "./post-editor-model.ts";
export const pendingImagePrefix="https://pebble.local.invalid/images/";
export type PendingImageSnapshot={src:string;file:Blob;name:string;type:string;lastModified:number;uploadedSrc?:string};
type UploadedImage={src:string;previewUrl:string};
type PendingImage={file:File;previewUrl:string;uploaded?:UploadedImage};
/** Pending files can be checkpointed to IndexedDB; blob URLs are recreated on recovery. */
export function createPendingImages(createUrl:(file:File)=>string=file=>URL.createObjectURL(file),revokeUrl:(url:string)=>void=url=>URL.revokeObjectURL(url)) {
  const images=new Map<string,PendingImage>();
  function refs(value:PostEditorValue){return [...images.keys()].filter(src=>value.blocks.some(block=>block.content.includes(src)));}
  return {
    stage(file:File):UploadedImage {
      const error=mediaFileError(file);if(error)throw new Error(error);
      if(images.size>=50)throw new Error("한 번의 편집에서 이미지는 최대 50개까지 첨부할 수 있어요.");
      const src=pendingImagePrefix+crypto.randomUUID(),previewUrl=createUrl(file);images.set(src,{file,previewUrl});return {src,previewUrl};
    },
    snapshot(value:PostEditorValue):PendingImageSnapshot[]{return refs(value).map(src=>{const image=images.get(src)!;return {src,file:image.file,name:image.file.name,type:image.file.type,lastModified:image.file.lastModified,...(image.uploaded?{uploadedSrc:image.uploaded.src}:{})};});},
    restore(records:PendingImageSnapshot[]):Record<string,string>{
      if(records.length>50)throw new Error("복구할 이미지가 너무 많습니다.");
      const prepared=records.map(record=>{
        if(!record.src.startsWith(pendingImagePrefix)||!(record.file instanceof Blob))throw new Error("복구할 이미지 파일을 확인해 주세요.");
        const file=new File([record.file],record.name,{type:record.type,lastModified:record.lastModified});
        const error=mediaFileError(file);if(error)throw new Error(error);
        return {record,file};
      });
      const previews:Record<string,string>={};
      for(const {record,file} of prepared){const previewUrl=createUrl(file),old=images.get(record.src);if(old)revokeUrl(old.previewUrl);images.set(record.src,{file,previewUrl,...(record.uploadedSrc?{uploaded:{src:record.uploadedSrc,previewUrl}}:{})});previews[record.src]=previewUrl;}
      return previews;
    },
    getFile(src:string):File|undefined {return images.get(src)?.file;},
    has(value:PostEditorValue){return value.blocks.some(block=>block.content.includes(pendingImagePrefix));},
    withoutPending(value:PostEditorValue):PostEditorValue {
      return {...value,thumbnailImageSrc:null,blocks:value.blocks.map(block=>({...block,content:block.content.replace(/<img\b[^>]*https:\/\/pebble\.local\.invalid\/images\/[^>]*>/gi,"").replace(/!\[[^\]]*\]\(https:\/\/pebble\.local\.invalid\/images\/[^)]*\)/g,""),imagePreviews:undefined}))};
    },
    async resolve(value:PostEditorValue,upload:(file:File)=>Promise<UploadedImage>):Promise<PostEditorValue>{
      const replacements=new Map<string,UploadedImage>();
      for(const src of refs(value)){
        const image=images.get(src)!;
        // Reuse completed uploads after a later save step fails instead of uploading twice.
        image.uploaded??=await upload(image.file);replacements.set(src,image.uploaded);
      }
      const blocks=value.blocks.map(block=>{
        let content=block.content;const previews={...block.imagePreviews};
        for(const [src,image] of replacements){content=content.split(src).join(image.src);delete previews[src];previews[image.src]=image.previewUrl;}
        if(content.includes(pendingImagePrefix))throw new Error("임시 이미지 파일을 찾지 못했습니다. 이미지를 다시 첨부해 주세요.");
        return {...block,content,imagePreviews:previews};
      });
      return {...value,blocks,thumbnailImageSrc:value.thumbnailImageSrc?replacements.get(value.thumbnailImageSrc)?.src??value.thumbnailImageSrc:null};
    },
    dispose(){images.forEach(image=>revokeUrl(image.previewUrl));images.clear();},
  };
}
