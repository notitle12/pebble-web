import {apiUrl} from '../../lib/member-api.ts';
import type {ProjectEditorValue} from './project-editor-model.ts';
import type {PostEditorValue} from '../post/post-editor-model.ts';
import type {ProjectMedia} from '../media/model.ts';
export function projectImageValue(value:ProjectEditorValue):PostEditorValue{return {title:value.name,summary:value.summary,blocks:value.document.sections.flatMap(section=>section.blocks)};}
export function replaceProjectImageBlocks(value:ProjectEditorValue,imageValue:PostEditorValue):ProjectEditorValue{
 let offset=0;return {...value,document:{...value.document,sections:value.document.sections.map(section=>{const blocks=imageValue.blocks.slice(offset,offset+section.blocks.length);offset+=section.blocks.length;return {...section,blocks};})}};
}
export function projectImagePreviews(id:string,media:ProjectMedia[]){return Object.fromEntries(media.filter(item=>item.mediaRole==='BODY'&&item.url).map(item=>[apiUrl(`/projects/${id}/media/${item.id}/content`).href,item.url!]));}
