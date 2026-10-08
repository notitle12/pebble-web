import sanitizeHtml from "sanitize-html";
import {richContentHtml} from "./rich-content.ts";
import type {EditorBlock} from "./post-editor-model.ts";

type ImageBlock=Pick<EditorBlock,"type"|"content">;
export function bodyImageId(src:string):string|null {
  try {
    const url=new URL(src);
    if(!["http:","https:"].includes(url.protocol))return null;
    return /^\/api\/v1\/posts\/[1-9]\d{0,18}\/images\/([1-9]\d{0,18})\/content$/.exec(url.pathname)?.[1]??null;
  } catch {return null;}
}
export function selectableRepresentativeImage(src:string):boolean {
  return /^https:\/\/pebble\.local\.invalid\/images\/[\w-]+$/.test(src)||bodyImageId(src)!==null;
}
/** Inspect rendered images, never strings inside code, comments, or unsafe HTML. */
export function postImageSources(blocks:readonly ImageBlock[]):string[] {
  const sources:string[]=[];
  for(const block of blocks){
    if(!["HTML","MARKDOWN","TEXT"].includes(block.type))continue;
    const html=richContentHtml(block.content,block.type as "HTML"|"MARKDOWN"|"TEXT");
    sanitizeHtml(html,{transformTags:{img:(tagName,attribs)=>{if(attribs.src&&selectableRepresentativeImage(attribs.src))sources.push(attribs.src);return {tagName,attribs};}}});
  }
  return [...new Set(sources)];
}
export function representativeImageSrc(blocks:readonly ImageBlock[],explicit?:string|null):string|null {
  const sources=postImageSources(blocks);
  return explicit&&sources.includes(explicit)?explicit:sources[0]??null;
}
