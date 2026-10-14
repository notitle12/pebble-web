import {PostBody} from '@/features/post/components/post-body';
import {PROJECT_SECTIONS,type ProjectDocument} from '../project-document';
export function ProjectDocumentView({document}:{document:ProjectDocument}){
 return <>{(document.teamSize||document.role)&&<dl className="project-document-overview">{document.teamSize&&<><dt>인원</dt><dd>{document.teamSize}명</dd></>}{document.role&&<><dt>나의 역할</dt><dd>{document.role}</dd></>}</dl>}{PROJECT_SECTIONS.map(({key,label})=>{const blocks=document.sections.find(section=>section.key===key)?.blocks??[];const visible=blocks.some(block=>!['TEXT','HTML','MARKDOWN'].includes(block.type)||block.content.replace(/<[^>]+>/g,'').replace(/&nbsp;/g,'').trim()||/<img\b|data-pebble-type/i.test(block.content));return visible?<section key={key} className="project-document-section"><h2>{label}</h2><PostBody blocks={blocks}/></section>:null;})}</>;
}
