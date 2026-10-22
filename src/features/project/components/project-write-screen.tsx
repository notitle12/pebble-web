'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {WriterLogoutBoundary} from '@/features/auth/components/writer-logout-boundary';
import {AccountMenu} from '@/features/auth/components/account-menu';
import {MemberGate} from '@/features/auth/components/member-gate';
import {userSession,type Member} from '@/features/auth/user-session';
import {apiUrl} from '@/lib/member-api';
import {mediaFileError,parseMediaResponse,safeMediaUrl} from '@/features/media/model';
import {createPendingImages} from '@/features/post/pending-images';
import {parseOwnProject,projectId,projectWriteFailure,type OwnProject} from '../api/member-projects';
import {buildProjectSaveBody,emptyProject,projectEditorValue,type ProjectEditorValue,type ProjectVisibility} from '../project-editor-model';
import {parseProjectDocument,serializeProjectDocument} from '../project-document';
import {postImageSources} from '@/features/post/post-images';
import {projectDraft} from '../project-drafts';
import {projectImageValue,replaceProjectImageBlocks,projectImagePreviews} from '../project-images';
import {projectCoverFile} from '../project-cover-file';
import {ProjectCoverPicker} from './project-cover-picker';
import {ProjectEditor} from './project-editor';
import {ProjectPostOrder} from './project-post-order';
import {getMyBlogHome,type BlogHomeSettings} from '@/features/blog-home/api/blog-home';
import {selectedFeaturedIds,saveProjectFeaturedSelection,type FeaturedSelection} from '../project-featured-selection';
import {ProjectFeaturedPicker} from './project-featured-picker';
function Writer({member,id,onLogout}:{member:Member;id?:string;onLogout:(hasChanges:boolean,memberId:string)=>void}){
 const router=useRouter();
 const [project,setProject]=useState<OwnProject|null>(null),[value,setValue]=useState<ProjectEditorValue>(emptyProject),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState(''),[attempt,setAttempt]=useState(0),[cover,setCover]=useState<File|null>(null),[coverPreview,setCoverPreview]=useState(''),[coverLoading,setCoverLoading]=useState(false),[selectedImageSrc,setSelectedImageSrc]=useState<string|null>(null),[imagePreviews,setImagePreviews]=useState<Record<string,string>>({}),[coverDeleted,setCoverDeleted]=useState(false);
 const [featuredHome,setFeaturedHome]=useState<BlogHomeSettings|null>(null),[featuredSelection,setFeaturedSelection]=useState<FeaturedSelection>({featured:false,removedIds:[]}),[featuredNames,setFeaturedNames]=useState<Record<string,string>>({}),[featuredLoading,setFeaturedLoading]=useState(false),[featuredError,setFeaturedError]=useState(''),[featuredChanged,setFeaturedChanged]=useState(false);
 const featuredLoad=useRef(0);
 const selectingCover=useRef(false),saving=useRef(false),mounted=useRef(false),pending=useRef(createPendingImages()),dirty=useRef(false),projectRef=useRef<OwnProject|null>(null),draftSlot=useRef(id);
 const current=()=>mounted.current&&userSession.snapshot().phase==='ready'&&userSession.snapshot().member?.id===member.id;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;pending.current.dispose();};},[]);
 useEffect(()=>{if(!cover){setCoverPreview('');return;}const url=URL.createObjectURL(cover);setCoverPreview(url);return()=>URL.revokeObjectURL(url);},[cover]);
 useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{if(dirty.current){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[]);
 useEffect(()=>{let live=true;setLoading(true);setError('');async function load(){try{
  let next=id?parseOwnProject(await userSession.request(`/projects/${projectId(id)}`),member.id,id):null;
  let nextValue=next?projectEditorValue(next):emptyProject();let nextCover:File|null=null;let nextCoverDeleted=false;
  try{const draft=await projectDraft('read',member.id,id);if(!live)return;if(draft&&window.confirm('임시저장한 프로젝트를 이어서 작성할까요?')){
   const restored={...draft.value,document:parseProjectDocument(draft.value.document)};if(!draft.value||typeof restored.name!=='string'||!Array.isArray(restored.techStackIds))throw new Error('초안 형식이 올바르지 않아요.');
   if(!next&&draft.projectId)next=parseOwnProject(await userSession.request(`/projects/${projectId(draft.projectId)}`),member.id,draft.projectId);
   nextValue=restored;nextCover=draft.cover instanceof File?draft.cover:null;nextCoverDeleted=draft.coverDeleted===true;if(live)setSaved('임시저장한 내용을 복원했어요.');
  }}catch{if(live)setError('임시저장한 내용을 읽지 못했어요. 저장된 프로젝트를 열었어요.');}
  if(live){projectRef.current=next;setProject(next);setValue(nextValue);setCover(nextCover);setCoverDeleted(nextCoverDeleted);setImagePreviews(next?projectImagePreviews(next.id,next.media):{});dirty.current=false;}
 }catch(e){if(live)setError(projectWriteFailure(e));}finally{if(live)setLoading(false);}}void load();return()=>{live=false;};},[id,member.id,attempt]);
 async function uploadImage(file:File){const message=mediaFileError(file);if(message)throw new Error(message);const image=pending.current.stage(new File([await file.arrayBuffer()],file.name,{type:file.type}));setImagePreviews(before=>({...before,[image.src]:image.previewUrl}));dirty.current=true;return image;}
 async function selectCandidateCover(candidate:{src:string;previewUrl:string}){
  if(selectingCover.current||saving.current||!current())return;
  if(selectedImageSrc===candidate.src&&!coverDeleted){
   setCover(null);setCoverPreview('');setSelectedImageSrc(null);setCoverDeleted(true);dirty.current=true;
   return;
  }
  selectingCover.current=true;setCoverLoading(true);setError('');
  try{
   const file=pending.current.getFile(candidate.src)??await projectCoverFile(candidate.previewUrl);
   if(!current())return;
   setCover(file);setSelectedImageSrc(candidate.src);setCoverDeleted(false);dirty.current=true;
  }catch{
   if(current())setError('대표 이미지를 설정하지 못했습니다. 다시 시도해 주세요.');
  }finally{selectingCover.current=false;if(mounted.current)setCoverLoading(false);}
 }
 function removeCover(){
  setCover(null);setCoverPreview('');setSelectedImageSrc(null);setCoverDeleted(true);dirty.current=true;
 }
 function changeCover(file:File|null){
  if(file){
   setCover(file);setSelectedImageSrc(null);setCoverDeleted(false);dirty.current=true;
  }else{
   removeCover();
  }
 }

 async function loadFeatured(){
  if(saving.current||!current())return;
  const generation=++featuredLoad.current;
  setFeaturedLoading(true);setFeaturedError('');
  try{
   const home=await getMyBlogHome(path=>userSession.request(path));
   if(!current()||generation!==featuredLoad.current)return;
   setFeaturedHome(home);setFeaturedSelection({featured:home.featuredProjectIds.includes(projectRef.current?.id??''),removedIds:[]});setFeaturedChanged(false);
   const names=await Promise.all(home.featuredProjectIds.filter(item=>item!==projectRef.current?.id).map(async item=>{
    try{const row=parseOwnProject(await userSession.request(`/projects/${item}`),member.id,item);return [item,row.name] as const;}catch{return [item,'이름을 불러오지 못한 프로젝트'] as const;}
   }));
   if(current()&&generation===featuredLoad.current)setFeaturedNames(Object.fromEntries(names));
  }catch{if(current()&&generation===featuredLoad.current){setFeaturedHome(null);setFeaturedError('대표 프로젝트 설정을 불러오지 못했어요. 설정을 바꾸려면 다시 불러와 주세요.');}}
  finally{if(mounted.current&&generation===featuredLoad.current)setFeaturedLoading(false);}
 }

 async function save(visibility:ProjectVisibility,temporary=false){
  if(saving.current||selectingCover.current||!current())return;saving.current=true;setBusy(true);setError('');setSaved('');
  try{
   let target=projectRef.current;let resolved=value;
   if(!temporary&&featuredChanged){
    if(featuredLoading||!featuredHome)throw new Error('대표 프로젝트 설정을 먼저 불러와 주세요.');
    const latest=await getMyBlogHome(path=>userSession.request(path));
    if(!current())return;
    selectedFeaturedIds(latest,target?.id??'new',featuredSelection,visibility==='PUBLIC'&&!target?.isBlocked);
   }
   if(!temporary)buildProjectSaveBody(value,target??undefined,visibility);
   if(pending.current.has(projectImageValue(value))){
    if(!target){target=parseOwnProject(await userSession.request('/projects',{method:'POST',body:{name:value.name.trim()||'제목 없는 프로젝트',lifecycleStatus:'IN_PROGRESS',visibilityStatus:'HIDDEN'}}),member.id);projectRef.current=target;if(current())setProject(target);}
    const imageValue=await pending.current.resolve(projectImageValue(value),async file=>{
     const form=new FormData();form.append('file',file);form.append('mediaRole','BODY');form.append('displayOrder','0');
     const media=parseMediaResponse(await userSession.request(`/projects/${target!.id}/media`,{method:'POST',body:form}));if(!media.url)throw new Error('이미지 미리보기를 불러오지 못했어요.');
     const image={src:apiUrl(`/projects/${target!.id}/media/${media.id}/content`).href,previewUrl:media.url};if(current())setImagePreviews(before=>({...before,[image.src]:image.previewUrl}));return image;
    });resolved=replaceProjectImageBlocks(value,imageValue);if(current())setValue(resolved);
   }
   if(temporary){
    const draftValue={...resolved,document:parseProjectDocument(serializeProjectDocument(resolved.document))};
    await projectDraft('write',member.id,draftSlot.current,{value:draftValue,projectId:target?.id,cover,coverDeleted,savedAt:Date.now()});if(current()){setSaved('이 브라우저에 임시저장했어요.');dirty.current=false;}return;
   }
   let body=buildProjectSaveBody(resolved,target??undefined,visibility);
   if(!target){target=parseOwnProject(await userSession.request('/projects',{method:'POST',body:{...body,visibilityStatus:'HIDDEN'}}),member.id);projectRef.current=target;if(current())setProject(target);}
   if(cover){
    const form=new FormData();form.append('file',cover);await userSession.request(`/projects/${target.id}/cover`,{method:'PUT',body:form});
   }else if(coverDeleted&&existingCover){
    await userSession.request(`/projects/${target.id}/cover`,{method:'DELETE'});
   }
   // 공개 여부는 이미지·본문 준비가 끝난 뒤 확정한다.
   body=buildProjectSaveBody(resolved,target,visibility);
   const next=Object.keys(body).length?parseOwnProject(await userSession.request(`/projects/${target.id}`,{method:'PATCH',body}),member.id,target.id):parseOwnProject(await userSession.request(`/projects/${target.id}`),member.id,target.id);
   if(!current())return;
   projectRef.current=next;setProject(next);setValue(projectEditorValue(next));setCover(null);setCoverDeleted(false);setSelectedImageSrc(null);setImagePreviews(projectImagePreviews(next.id,next.media));dirty.current=false;setSaved(visibility==='PUBLIC'?'프로젝트를 발행했어요.':'비공개로 발행했어요.');
   await projectDraft('remove',member.id,draftSlot.current).catch(()=>{});draftSlot.current=next.id;
   if(featuredChanged){
    try{
     const updated=await saveProjectFeaturedSelection(next,featuredSelection,(path,options)=>userSession.request(path,options),current);
     if(!updated)return;
     setFeaturedHome(updated);
     setFeaturedChanged(false);
    }catch{
     if(!current())return;
     dirty.current=true;
     throw new Error('프로젝트는 저장됐지만 대표 프로젝트 설정을 완료하지 못했어요. 발행 창에서 설정을 확인한 뒤 다시 발행해 주세요.');
    }
   }
   if(current())router.replace(next.visibilityStatus==='PUBLIC'&&!next.isBlocked?`/projects/${next.id}`:`/projects/${next.id}/view`);
  }catch(e){if(current())setError(projectWriteFailure(e));throw e;}finally{saving.current=false;if(mounted.current)setBusy(false);}
 }
 if(loading)return <p role="status">프로젝트를 불러오고 있어요.</p>;
 if(id&&!project)return <section className="list-state"><h1>프로젝트를 열지 못했어요</h1><p role="alert">{error}</p><button className="button" onClick={()=>setAttempt(n=>n+1)}>다시 불러오기</button></section>;
 const existingCover=project?.media.find(item=>item.mediaRole==='THUMBNAIL');
 const documentBlocks=value.document.sections.flatMap(section=>section.blocks);
 const candidateSources=postImageSources(documentBlocks);
 const candidateImages:{src:string;previewUrl:string}[]=[];
 for(const src of candidateSources){
  const previewUrl=imagePreviews[src]||src;
  if(previewUrl&&!candidateImages.some(item=>item.previewUrl===previewUrl)){
   candidateImages.push({src,previewUrl});
  }
 }
 if(project?.media){
  for(const m of project.media){
   if(m.url&&m.mediaRole!=='THUMBNAIL'){
    const previewUrl=safeMediaUrl(m.url);
    if(previewUrl&&!candidateImages.some(item=>item.previewUrl===previewUrl)){
     candidateImages.push({src:m.url,previewUrl});
    }
   }
  }
 }
 const currentCoverPreview=coverDeleted?null:(coverPreview||safeMediaUrl(existingCover?.url??existingCover?.thumbnailUrl??null));
 const coverElement=<ProjectCoverPicker preview={currentCoverPreview} selected={!coverDeleted&&(!!cover||!!existingCover||!!selectedImageSrc)} selectedSrc={selectedImageSrc} disabled={busy||coverLoading} onChange={changeCover} onRemove={removeCover} candidateImages={candidateImages} onSelectCandidate={selectCandidateCover}/>;

 return <><div className="writer-identity"><span>{member.nickname}</span><AccountMenu member={member} logoutDisabled={busy||coverLoading} onLogout={()=>onLogout(dirty.current,member.id)}/></div><h1 className="writer-visually-hidden">프로젝트 작성</h1><div className="writer-status writer-visually-hidden"><Link href="/me/projects">← 내 프로젝트</Link><span>{saved}</span></div>{error&&<p role="alert">{error}</p>}<ProjectEditor value={value} onChange={next=>{setValue(next);setError('');dirty.current=true;}} busy={busy||coverLoading} visibility={project?.visibilityStatus??'PUBLIC'} blocked={project?.isBlocked??false} existingTechStacks={project?.techStacks} onPublishOpen={()=>void loadFeatured()} featuredElement={visibility=><ProjectFeaturedPicker home={featuredHome} selection={featuredSelection} projectId={project?.id} names={featuredNames} loading={featuredLoading} error={featuredError} disabled={busy||coverLoading} publicProject={visibility==='PUBLIC'&&!project?.isBlocked} onReload={()=>void loadFeatured()} onChange={selection=>{setFeaturedSelection(selection);setFeaturedChanged(true);dirty.current=true;}}/>} uploadImage={uploadImage} imagePreviews={imagePreviews} relatedPostsElement={id&&project?<ProjectPostOrder projectId={project.id} memberId={member.id} disabled={busy||coverLoading}/>:undefined} coverElement={coverElement} coverPreviewUrl={currentCoverPreview} representativeImageSrc={selectedImageSrc} onSelectRepresentativeImage={src=>void selectCandidateCover({src,previewUrl:imagePreviews[src]||src})} onTemporarySave={()=>save(project?.visibilityStatus??'HIDDEN',true)} onSave={save}/></>;
}
export function ProjectWriteScreen({id}:{id?:string}){return <WriterLogoutBoundary>{onLogout=><MemberGate profile preserveOnExpiry>{member=><Writer key={`${member.id}:${id??'new'}`} member={member} id={id} onLogout={onLogout}/>}</MemberGate>}</WriterLogoutBoundary>;}
