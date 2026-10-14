import {mediaFileError} from "../media/model.ts";
import type {PostEditorValue} from "./post-editor-model.ts";
export const pendingImagePrefix="https://pebble.local.invalid/images/";
type UploadedImage={src:string;previewUrl:string};
type PendingImage={file:File;previewUrl:string;uploaded?:UploadedImage};
/** Files stay in this writer's memory until an explicit save; never enter localStorage. */
export function createPendingImages(createUrl:(file:File)=>string=file=>URL.createObjectURL(file),revokeUrl:(url:string)=>void=url=>URL.revokeObjectURL(url)) {
  const images=new Map<string,PendingImage>();
  function refs(value:PostEditorValue){return [...images.keys()].filter(src=>value.blocks.some(block=>block.content.includes(src)));}
  return {
    stage(file:File):UploadedImage {
      const error=mediaFileError(file);if(error)throw new Error(error);
      if(images.size>=50)throw new Error("한 번의 편집에서 이미지는 최대 50개까지 첨부할 수 있어요.");
      const src=pendingImagePrefix+crypto.randomUUID(),previewUrl=createUrl(file);images.set(src,{file,previewUrl});return {src,previewUrl};
    },
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
