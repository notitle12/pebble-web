'use client';
import {useWriterAutosave} from '@/lib/use-writer-autosave';
import {WriterRecovery} from '@/components/writer-recovery';
import {validDraftValue} from '@/lib/writer-drafts';
import {useCallback,useEffect,useRef,useState} from 'react';
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
import {projectDraft} from '../project-drafts';
import {projectImageValue,replaceProjectImageBlocks,projectImagePreviews} from '../project-images';
import {createProjectGalleryPending} from '../project-gallery-pending';
import {projectCoverFile} from '../project-cover-file';
import {ProjectEditor} from './project-editor';
import {ProjectGalleryPicker,type GalleryChoice} from './project-gallery-picker';
import {ProjectPostOrder,type ProjectOrderPreviewState} from './project-post-order';
import {ProjectPostOrderPreview} from './project-post-order-preview';
import {projectEditorExitHref} from '../editor-exit';
import {writerReturnHref} from '@/lib/writer-navigation';
import {getMyBlogHome,type BlogHomeSettings} from '@/features/blog-home/api/blog-home';
import {selectedFeaturedIds,saveProjectFeaturedSelection,type FeaturedSelection} from '../project-featured-selection';
import {ProjectFeaturedPicker} from './project-featured-picker';
function Writer({member,id,onLogout}:{member:Member;id?:string;onLogout:(hasChanges:boolean,memberId:string)=>void}){
 const router=useRouter();
 const [project,setProject]=useState<OwnProject|null>(null),[value,setValue]=useState<ProjectEditorValue>(emptyProject),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState(''),[attempt,setAttempt]=useState(0),[cover,setCover]=useState<File|null>(null),[coverPreview,setCoverPreview]=useState(''),[coverLoading,setCoverLoading]=useState(false),[selectedImageSrc,setSelectedImageSrc]=useState<string|null>(null),[imagePreviews,setImagePreviews]=useState<Record<string,string>>({}),[coverDeleted,setCoverDeleted]=useState(false),[galleryCoverMediaId,setGalleryCoverMediaId]=useState<string|null>(null),[galleryCoverAttachmentKey,setGalleryCoverAttachmentKey]=useState<string|null>(null),[removedGalleryMediaIds,setRemovedGalleryMediaIds]=useState<string[]>([]),[galleryRevision,setGalleryRevision]=useState(0);
 const [featuredHome,setFeaturedHome]=useState<BlogHomeSettings|null>(null),[featuredSelection,setFeaturedSelection]=useState<FeaturedSelection>({featured:false,removedIds:[]}),[featuredNames,setFeaturedNames]=useState<Record<string,string>>({}),[featuredLoading,setFeaturedLoading]=useState(false),[featuredError,setFeaturedError]=useState(''),[featuredChanged,setFeaturedChanged]=useState(false);
 const featuredLoad=useRef(0),orderDirty=useRef(false),recoveredProjectId=useRef<string|undefined>(undefined);
 const [recovered,setRecovered]=useState(false),[restoredVisibility,setRestoredVisibility]=useState<ProjectVisibility|undefined>();
 const [orderBusy,setOrderBusy]=useState(false);
 const [orderPreview,setOrderPreview]=useState<ProjectOrderPreviewState>({posts:null,loading:true,error:""});
 const onOrderPreviewChange=useCallback((state:ProjectOrderPreviewState)=>setOrderPreview(state),[]);
 const selectingCover=useRef(false),saving=useRef(false),mounted=useRef(false),pending=useRef(createPendingImages()),galleryPending=useRef(createProjectGalleryPending()),dirty=useRef(false),projectRef=useRef<OwnProject|null>(null),draftSlot=useRef(id);
 const current=()=>mounted.current&&userSession.snapshot().phase==='ready'&&userSession.snapshot().member?.id===member.id;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;pending.current.dispose();galleryPending.current.clear();};},[]);
 useEffect(()=>{if(!cover){setCoverPreview('');return;}const url=URL.createObjectURL(cover);setCoverPreview(url);return()=>URL.revokeObjectURL(url);},[cover]);
 useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{if(dirty.current||orderDirty.current){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[]);
 useEffect(()=>{let live=true;setLoading(true);setError('');async function load(){try{
  let next=id?parseOwnProject(await userSession.request(`/projects/${projectId(id)}`),member.id,id):null;
  let nextValue=next?projectEditorValue(next):emptyProject();let nextCover:File|null=null;let nextCoverDeleted=false;

  if(live){projectRef.current=next;setProject(next);setValue(nextValue);setCover(nextCover);setCoverDeleted(nextCoverDeleted);setGalleryCoverMediaId(next?.galleryCoverMediaId??null);setImagePreviews(next?projectImagePreviews(next.id,next.media):{});dirty.current=false;}
 }catch(e){if(live)setError(projectWriteFailure(e));}finally{if(live)setLoading(false);}}void load();return()=>{live=false;};},[id,member.id,attempt]);
 const autosave=useWriterAutosave<ProjectEditorValue>({
  scope:{memberId:member.id,kind:'project',targetId:id},enabled:!loading,dirty:dirty.current,
  signature:JSON.stringify({value,coverDeleted,selectedImageSrc,galleryCoverMediaId,galleryCoverAttachmentKey,removedGalleryMediaIds,galleryRevision,cover:cover?[cover.name,cover.size,cover.lastModified]:null}),
  snapshot:()=>({value,images:pending.current.snapshot(projectImageValue(value)),contentId:projectRef.current?.id??recoveredProjectId.current??id,cover,coverDeleted,selectedImageSrc,galleryCoverMediaId,galleryCoverAttachmentKey,removedGalleryMediaIds,galleryAttachments:galleryPending.current.snapshot(),projectVisibility:projectRef.current?.visibilityStatus??restoredVisibility??'PUBLIC'}),
  legacy:async()=>{const draft=await projectDraft('read',member.id,id);if(!draft)return;if(!validDraftValue('project',draft.value))throw new Error('이전 프로젝트 저장본을 읽지 못했어요. 저장본은 유지했습니다.');return {value:draft.value,images:[],contentId:draft.projectId,cover:draft.cover,coverDeleted:draft.coverDeleted};},
  onRestore:record=>{
   if(!validDraftValue('project',record.value))throw new Error('프로젝트 자동저장본을 확인해 주세요.');
   const previews=pending.current.restore(record.images);
   setValue(record.value);setRestoredVisibility(record.projectVisibility??(id||record.contentId?'HIDDEN':'PUBLIC'));setCover(record.cover??null);setCoverDeleted(record.coverDeleted??false);setSelectedImageSrc(record.selectedImageSrc??null);setGalleryCoverMediaId(record.galleryCoverMediaId===undefined?projectRef.current?.galleryCoverMediaId??null:record.galleryCoverMediaId);setGalleryCoverAttachmentKey(record.galleryCoverAttachmentKey??null);setRemovedGalleryMediaIds(record.removedGalleryMediaIds??[]);galleryPending.current.restore(record.galleryAttachments??[]);setGalleryRevision(revision=>revision+1);
   setImagePreviews(before=>({...before,...previews}));setRecovered(true);dirty.current=true;setSaved('자동저장된 프로젝트를 복구했어요.');
   if(!projectRef.current)recoveredProjectId.current=record.contentId??id;
  },
 });
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
   setCover(file);setSelectedImageSrc(candidate.src);setCoverDeleted(false);setGalleryCoverMediaId(null);setGalleryCoverAttachmentKey(null);dirty.current=true;
  }catch{
   if(current())setError('대표 이미지를 설정하지 못했습니다. 다시 시도해 주세요.');
  }finally{selectingCover.current=false;if(mounted.current)setCoverLoading(false);}
 }
 function removeCover(){
  setCover(null);setCoverPreview('');setSelectedImageSrc(null);setCoverDeleted(true);dirty.current=true;
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
   if(temporary){await autosave.saveNow();if(current()){setSaved('이 브라우저에 임시저장했어요.');dirty.current=false;}return;}
   await autosave.saveNow().catch(()=>{});
   let target=projectRef.current;let resolved=value;let selectedGalleryCoverMediaId=galleryCoverMediaId;
   if(!target&&recoveredProjectId.current){target=parseOwnProject(await userSession.request(`/projects/${projectId(recoveredProjectId.current)}`),member.id,recoveredProjectId.current);projectRef.current=target;if(current())setProject(target);await autosave.saveNow().catch(()=>{});}
   if(!temporary&&featuredChanged){
    if(featuredLoading||!featuredHome)throw new Error('대표 프로젝트 설정을 먼저 불러와 주세요.');
    const latest=await getMyBlogHome(path=>userSession.request(path));
    if(!current())return;
    selectedFeaturedIds(latest,target?.id??'new',featuredSelection,visibility==='PUBLIC'&&!target?.isBlocked);
   }
   if(!temporary)buildProjectSaveBody(value,target??undefined,visibility);
   if(pending.current.has(projectImageValue(value))||galleryPending.current.values().length>0){
    if(!target){target=parseOwnProject(await userSession.request('/projects',{method:'POST',body:{name:value.name.trim()||'제목 없는 프로젝트',lifecycleStatus:'IN_PROGRESS',visibilityStatus:'HIDDEN'}}),member.id);projectRef.current=target;if(current())setProject(target);await autosave.saveNow().catch(()=>{});}
    if(galleryPending.current.values().length){
     target=parseOwnProject(await userSession.request(`/projects/${target!.id}`),member.id,target!.id);projectRef.current=target;
     const rows=[...target.media];
     for(const attachment of galleryPending.current.values()){
      if(attachment.uploadedMediaId&&rows.some(item=>item.id===attachment.uploadedMediaId)){if(attachment.key===galleryCoverAttachmentKey){selectedGalleryCoverMediaId=attachment.uploadedMediaId;setGalleryCoverMediaId(attachment.uploadedMediaId);setGalleryCoverAttachmentKey(null);}continue;}
      const order=rows.filter(item=>item.mediaRole==='SCREENSHOT').reduce((max,item)=>Math.max(max,item.displayOrder),-1)+1;
      const form=new FormData();form.append('file',attachment.file);form.append('mediaRole','SCREENSHOT');form.append('displayOrder',String(order));
      const media=parseMediaResponse(await userSession.request(`/projects/${target.id}/media`,{method:'POST',body:form}));
      galleryPending.current.markUploaded(attachment.key,media);if(attachment.key===galleryCoverAttachmentKey){selectedGalleryCoverMediaId=media.id;setGalleryCoverMediaId(media.id);setGalleryCoverAttachmentKey(null);}rows.push(media);target={...target,media:[...rows]};projectRef.current=target;if(current())setProject(target);setGalleryRevision(revision=>revision+1);
      await autosave.saveNow();
     }
    }
    const imageValue=await pending.current.resolve(projectImageValue(value),async file=>{
     const form=new FormData();form.append('file',file);form.append('mediaRole','BODY');form.append('displayOrder','0');
     const media=parseMediaResponse(await userSession.request(`/projects/${target!.id}/media`,{method:'POST',body:form}));if(!media.url)throw new Error('이미지 미리보기를 불러오지 못했어요.');
     const image={src:apiUrl(`/projects/${target!.id}/media/${media.id}/content`).href,previewUrl:media.url};if(current())setImagePreviews(before=>({...before,[image.src]:image.previewUrl}));return image;
    });resolved=replaceProjectImageBlocks(value,imageValue);if(current())setValue(resolved);
   }

   let body={...buildProjectSaveBody(resolved,target??undefined,visibility),galleryCoverMediaId};
   if(!target){target=parseOwnProject(await userSession.request('/projects',{method:'POST',body:{...body,visibilityStatus:'HIDDEN'}}),member.id);projectRef.current=target;if(current())setProject(target);await autosave.saveNow().catch(()=>{});}
   if(cover){
    const form=new FormData();form.append('file',cover);const replacement=parseMediaResponse(await userSession.request(`/projects/${target.id}/cover`,{method:'PUT',body:form}));if(selectedGalleryCoverMediaId===existingCover?.id)selectedGalleryCoverMediaId=replacement.id;
   }else if(coverDeleted&&target.media.some(item=>item.mediaRole==='THUMBNAIL')){
    await userSession.request(`/projects/${target.id}/cover`,{method:'DELETE'});
    if(selectedGalleryCoverMediaId===existingCover?.id)selectedGalleryCoverMediaId=null;
   }
   if(removedGalleryMediaIds.length){
    const latest=parseOwnProject(await userSession.request(`/projects/${target.id}`),member.id,target.id);
    for(const mediaId of removedGalleryMediaIds){
     if(latest.media.some(item=>item.id===mediaId))await userSession.request(`/projects/${target.id}/media/${mediaId}`,{method:'DELETE'});
    }
   }
   // 공개 여부는 이미지·본문 준비가 끝난 뒤 확정한다.
   body={...buildProjectSaveBody(resolved,target,visibility),galleryCoverMediaId:removedGalleryMediaIds.includes(selectedGalleryCoverMediaId??'')?null:selectedGalleryCoverMediaId};
   const next=Object.keys(body).length?parseOwnProject(await userSession.request(`/projects/${target.id}`,{method:'PATCH',body}),member.id,target.id):parseOwnProject(await userSession.request(`/projects/${target.id}`),member.id,target.id);
   if(!current())return;
   projectRef.current=next;setProject(next);setValue(projectEditorValue(next));setCover(null);setCoverDeleted(false);setSelectedImageSrc(null);setGalleryCoverMediaId(next.galleryCoverMediaId??null);setGalleryCoverAttachmentKey(null);setRemovedGalleryMediaIds([]);galleryPending.current.clear();setGalleryRevision(revision=>revision+1);setImagePreviews(projectImagePreviews(next.id,next.media));dirty.current=false;setSaved(visibility==='PUBLIC'?'프로젝트를 발행했어요.':'비공개로 발행했어요.');
   await autosave.clear().catch(()=>{});
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
  }catch(e){await autosave.saveNow().catch(()=>{});if(current())setError(projectWriteFailure(e));throw e;}finally{saving.current=false;if(mounted.current)setBusy(false);}
 }
 if(loading)return <p role="status">프로젝트를 불러오고 있어요.</p>;
 if(!autosave.ready&&!autosave.recovery.length)return <p role="status">자동저장본을 확인하고 있어요.</p>;
 if(id&&!project&&!recovered&&!autosave.recovery.length)return <section className="list-state"><h1>프로젝트를 열지 못했어요</h1><p role="alert">{error}</p><button className="button" onClick={()=>setAttempt(n=>n+1)}>다시 불러오기</button></section>;
 const existingCover=project?.media.find(item=>item.mediaRole==='THUMBNAIL');
 const galleryChoices=project?.media.filter(item=>(item.mediaRole==='SCREENSHOT'||item.mediaRole==='THUMBNAIL'&&!coverDeleted&&!cover)&&!removedGalleryMediaIds.includes(item.id))??[];
 const removeGalleryMedia=(mediaId:string)=>{
  const item=galleryChoices.find(row=>row.id===mediaId);
  if(item?.mediaRole==='THUMBNAIL'){removeCover();if(galleryCoverMediaId===mediaId)setGalleryCoverMediaId(null);return;}
  setRemovedGalleryMediaIds(before=>before.includes(mediaId)?before:[...before,mediaId]);
  const uploaded=galleryPending.current.values().find(row=>row.uploadedMediaId===mediaId);
  if(uploaded)galleryPending.current.remove(uploaded.key);
  if(uploaded)setGalleryRevision(revision=>revision+1);
  if(galleryCoverMediaId===mediaId){setGalleryCoverMediaId(null);setGalleryCoverAttachmentKey(null);}
  dirty.current=true;
 };
 const addGalleryFiles=(files:File[])=>{try{galleryPending.current.stage(files,galleryChoices.length,new Set(project?.media.filter(item=>item.mediaRole==='SCREENSHOT'||item.mediaRole==='THUMBNAIL').map(item=>item.id)??[]));setGalleryRevision(revision=>revision+1);dirty.current=true;setError('');}catch(error){setError(error instanceof Error?error.message:'이미지를 추가하지 못했어요.');}};
 const removePendingGallery=(key:string)=>{const item=galleryPending.current.values().find(row=>row.key===key);if(item?.uploadedMediaId){setRemovedGalleryMediaIds(before=>before.includes(item.uploadedMediaId!)?before:[...before,item.uploadedMediaId!]);if(galleryCoverMediaId===item.uploadedMediaId)setGalleryCoverMediaId(null);}if(galleryCoverAttachmentKey===key){setGalleryCoverMediaId(null);setGalleryCoverAttachmentKey(null);}galleryPending.current.remove(key);setGalleryRevision(revision=>revision+1);dirty.current=true;};
 const stagedGallery=galleryPending.current.values();
 const selectGallery=(mediaId:string|null,attachmentKey:string|null)=>{
  setGalleryCoverMediaId(mediaId);setGalleryCoverAttachmentKey(attachmentKey);
  setCover(null);setSelectedImageSrc(null);dirty.current=true;
 };
 const galleryItems:Omit<GalleryChoice,'selected'>[]=[
  ...(cover&&coverPreview?[{key:'body-cover',label:'본문 대표 이미지',preview:coverPreview,select:()=>{},remove:removeCover}]:[]),
  ...galleryChoices.map((item,index)=>{
   const pending=stagedGallery.find(row=>row.uploadedMediaId===item.id);
   return {key:pending?.key??item.id,label:item.altText??`이미지 ${index+1}`,preview:safeMediaUrl(item.thumbnailUrl??item.url)??pending?.previewUrl??null,
    select:()=>selectGallery(item.id,pending?.key??null),remove:()=>removeGalleryMedia(item.id)};
  }),
  ...stagedGallery.filter(item=>!item.uploadedMediaId||!galleryChoices.some(row=>row.id===item.uploadedMediaId)).map(item=>({
   key:item.key,label:item.file.name,preview:item.previewUrl,select:()=>selectGallery(null,item.key),remove:()=>removePendingGallery(item.key),
  })),
 ];
 const defaultCover=galleryItems.find(item=>item.key===(cover?'body-cover':existingCover?.id))??galleryItems[0];
 const selectedCover=galleryItems.find(item=>item.key===(galleryCoverAttachmentKey??galleryCoverMediaId))??defaultCover;
 const currentCoverPreview=safeMediaUrl(galleryChoices.find(item=>item.id===selectedCover?.key)?.url??null)??selectedCover?.preview??null;
 const galleryCoverControl=<ProjectGalleryPicker choices={galleryItems.map(item=>({...item,selected:item===selectedCover}))} disabled={busy||coverLoading} onAdd={addGalleryFiles}/>;

 return <>{!autosave.ready&&<WriterRecovery records={autosave.recovery} onRestore={autosave.restore} onFresh={autosave.fresh} error={autosave.error}/>}<div className="writer-identity"><span>{member.nickname}</span><AccountMenu member={member} logoutDisabled={busy||coverLoading||orderBusy} onLogout={()=>onLogout(dirty.current||orderDirty.current,member.id)}/></div><h1 className="writer-visually-hidden">프로젝트 작성</h1><div className="writer-status writer-visually-hidden"><Link href="/me/projects">← 내 프로젝트</Link><span>{saved}</span></div>{error&&<p role="alert">{error}</p>}{autosave.error&&<p role="alert">{autosave.error} <button type="button" onClick={()=>void autosave.saveNow().catch(()=>{})}>다시 시도</button></p>}<ProjectEditor key={autosave.restoreRevision} autosaveStatus={autosave.status} value={value} onChange={next=>{setValue(next);setError('');dirty.current=true;}} busy={busy||coverLoading} navigationBusy={orderBusy} onExit={()=>{if(orderBusy)return;if(dirty.current||orderDirty.current){if(!window.confirm("저장되지 않은 변경 사항이 있습니다. 이 페이지를 나갈까요?"))return;}router.replace(writerReturnHref(projectEditorExitHref(project)));}} relatedPostsPreviewElement={id&&project?<ProjectPostOrderPreview state={orderPreview}/>:undefined} visibility={project?.visibilityStatus??restoredVisibility??'PUBLIC'} blocked={project?.isBlocked??false} existingTechStacks={project?.techStacks} onPublishOpen={()=>void loadFeatured()} featuredElement={visibility=><ProjectFeaturedPicker home={featuredHome} selection={featuredSelection} projectId={project?.id} names={featuredNames} loading={featuredLoading} error={featuredError} disabled={busy||coverLoading} publicProject={visibility==='PUBLIC'&&!project?.isBlocked} onReload={()=>void loadFeatured()} onChange={selection=>{setFeaturedSelection(selection);setFeaturedChanged(true);dirty.current=true;}}/>} uploadImage={uploadImage} imagePreviews={imagePreviews} relatedPostsElement={id&&project?<ProjectPostOrder key={`${project.id}:${member.id}`} projectId={project.id} memberId={member.id} disabled={busy||coverLoading} onBusyChange={setOrderBusy} onPreviewChange={onOrderPreviewChange} onDirtyChange={next=>{orderDirty.current=next;}}/>:undefined} coverElement={galleryCoverControl} coverPreviewUrl={currentCoverPreview} representativeImageSrc={selectedImageSrc} onSelectRepresentativeImage={src=>void selectCandidateCover({src,previewUrl:imagePreviews[src]||src})} onTemporarySave={()=>save(project?.visibilityStatus??'HIDDEN',true)} onSave={save}/></>;
}
export function ProjectWriteScreen({id}:{id?:string}){return <WriterLogoutBoundary>{onLogout=><MemberGate profile preserveOnExpiry>{member=><Writer key={`${member.id}:${id??'new'}`} member={member} id={id} onLogout={onLogout}/>}</MemberGate>}</WriterLogoutBoundary>;}
