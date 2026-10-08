"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createEditorBlock, normalizePostSlug, validateEditorValue, validatePostSlug, type PostVisibility, type PostEditorValue, type EditorBlockType } from "../post-editor-model";
import {BoardPicker} from "@/features/board/components/board-picker";
import {PostProjectPicker} from "./post-project-picker";
import {PostClassification} from "./post-classification";
import type {Classification} from "../api/member-posts";
import {RichBodyEditor} from "./rich-body-editor";

export type { PostEditorValue } from "../post-editor-model";
export type PostSaveAction={kind:"temporary"}|{kind:"complete";visibility:PostVisibility;slug:string};
type ImageUpload={src:string;previewUrl:string};

const initial = (): PostEditorValue => ({ title: "", summary: "", categoryId:null,projectId:null,boardId:null,tagIds:[],blocks: [createEditorBlock("HTML")] });

export function PostEditor({ memberId, initialValue, onSave, busy = false, visibility = "HIDDEN", blocked = false, existingCategory, existingTags, existingPost, uploadImage, initialNotice }: { memberId:string; initialValue?: PostEditorValue; onSave: (value: PostEditorValue, action:PostSaveAction) => Promise<"server"|"local">; busy?:boolean; visibility?:PostVisibility; blocked?:boolean;existingCategory?:Classification|null;existingTags?:Classification[];existingPost?:{draft:boolean;urlKey:string;id:string};uploadImage?:(file:File,value:PostEditorValue)=>Promise<ImageUpload>;initialNotice?:string }) {
  const startingValue = useRef<PostEditorValue>(initialValue ?? initial());
  const [value, setValue] = useState<PostEditorValue>(() => startingValue.current);
  const [publishRevision,setPublishRevision]=useState(0);
  const [review,setReview]=useState(false),[extrasOpen,setExtrasOpen]=useState(false),[saveMessage,setSaveMessage]=useState(initialNotice??""),[saveError,setSaveError]=useState("");
  const [targetVisibility,setTargetVisibility]=useState<PostVisibility>(visibility),[slug,setSlug]=useState(startingValue.current.slug??"");
  const initialSlugMode:"NUMERIC"|"CUSTOM"=existingPost?.draft&&startingValue.current.slug?"CUSTOM":"NUMERIC";
  const [slugMode,setSlugMode]=useState<"NUMERIC"|"CUSTOM">(initialSlugMode);
  const dialog=useRef<HTMLDialogElement>(null),dialogHeading=useRef<HTMLHeadingElement>(null),slugTouched=useRef(!!(existingPost?.draft&&startingValue.current.slug));
  const baseline = useRef(JSON.stringify({...startingValue.current,slug:initialSlugMode==="CUSTOM"?startingValue.current.slug??"":"",slugMode:initialSlugMode}));
  const dirty = JSON.stringify({...value,slug:slugMode==="CUSTOM"?slug:"",slugMode}) !== baseline.current;
  const errors = useMemo(() => validateEditorValue(value), [value]);
  const temporaryErrors=errors.filter(error=>error!=="제목을 입력해 주세요.");
  const normalizedSlug=normalizePostSlug(slug);
  const slugError=slugMode==="CUSTOM"&&!validatePostSlug(normalizedSlug)?"주소는 영문 소문자·숫자와 하이픈으로 된 200자 이하여야 하며 숫자만 사용할 수 없고 search는 사용할 수 없습니다.":"";
  const imagePreviews = useMemo(() => Object.assign({}, ...value.blocks.map(block => block.imagePreviews ?? {})), [value.blocks]);
  const updateDocument = useCallback((blocks: PostEditorValue["blocks"]) => setValue(current => ({ ...current, blocks })), []);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(()=>{const node=dialog.current;if(!node)return;if(review&&!node.open){node.showModal();dialogHeading.current?.focus();}else if(!review&&node.open)node.close();},[review]);
  useEffect(()=>{if(!slugTouched.current)setSlug(normalizePostSlug(value.title));},[value.title]);

  const save = async (action:PostSaveAction) => {
    if ((action.kind==="complete"?errors:temporaryErrors).length || busy) return;
    setSaveError("");
    try {
      if(action.kind==="complete"&&slugError){setSaveError(slugError);return;}
      const saveAction=action.kind==="complete"?{...action,slug:slugMode==="CUSTOM"?normalizedSlug:""}:action;
      const saveTarget=await onSave({ ...value, slug:action.kind==="complete"?(slugMode==="CUSTOM"?normalizedSlug:""):slug, blocks: value.blocks.map(block => ({ ...block })) },saveAction);
      baseline.current = action.kind==="temporary"&&saveTarget==="server"?JSON.stringify({...value,slug:initialSlugMode==="CUSTOM"?startingValue.current.slug??"":"",slugMode:initialSlugMode}):JSON.stringify({...value,slug:slugMode==="CUSTOM"?slug:"",slugMode});
      setSaveMessage(action.kind==="temporary"?(saveTarget==="local"?"이 브라우저에 임시 저장했습니다.":"서버에 임시 저장했습니다."):"완료했습니다.");
      if(action.kind==="complete")setReview(false);
    } catch(error) { setSaveError(error instanceof Error?error.message:"저장하지 못했습니다."); }
  };

  const leave=()=>{if((dirty||busy)&&!window.confirm("저장되지 않은 변경 사항이 있습니다. 이 페이지를 나갈까요?"))return;window.location.assign("/me/posts");};

  return <section className="post-editor writer-composer" aria-label="게시글 작성기">
    <header className="writer-action-bar"><button type="button" className="writer-exit" disabled={busy} onClick={leave}>나가기</button><span aria-live="polite">{busy?"저장 중…":saveMessage|| (dirty?"저장되지 않은 변경 사항":"변경 사항 없음")}</span><div><button type="button" className="secondary" disabled={busy||temporaryErrors.length>0} onClick={()=>void save({kind:"temporary"})}>{busy?"저장 중…":"임시저장"}</button><button type="button" disabled={busy||errors.length>0} onClick={()=>{setSaveMessage("");setSaveError("");setPublishRevision(n=>n+1);setReview(true);}}>완료</button></div></header>
    <label className="writer-title-field"><span className="writer-visually-hidden">제목</span><input value={value.title} maxLength={400} aria-label="제목" aria-invalid={!value.title.trim() || Array.from(value.title).length > 200} placeholder="제목을 입력하세요" onChange={event => setValue(current => ({ ...current, title: event.target.value }))} /><small>{Array.from(value.title).length}/200</small></label>
    <RichBodyEditor blocks={value.blocks} onChangeBlocks={updateDocument} disabled={busy} imagePreviews={imagePreviews} uploadImage={uploadImage ? async file => {
      const image = await uploadImage(file, value);
      setValue(current => ({ ...current, blocks: current.blocks.map(block => ({ ...block, imagePreviews: { ...block.imagePreviews, [image.src]: image.previewUrl } })) }));
      return image;
    } : undefined}/>
    <div className="writer-tag-input"><PostClassification disabled={busy} key={`tags-${publishRevision}`} showCategory={false} categoryId={value.categoryId??null} tagIds={value.tagIds??[]} existingCategory={existingCategory??undefined} existingTags={existingTags} onChange={patch=>setValue(current=>({...current,...patch}))}/></div>
    {errors.filter(error=>error!=="제목을 입력해 주세요.").length>0&&<div className="post-editor-errors" role="alert"><p>완료하기 전에 다음 항목을 확인해 주세요.</p><ul>{errors.filter(error=>error!=="제목을 입력해 주세요.").map((error,index)=><li key={`${error}-${index}`}>{error}</li>)}</ul></div>}

    <dialog ref={dialog} className="writer-publish-dialog" aria-labelledby="writer-publish-heading" onCancel={()=>setReview(false)} onClose={()=>{if(review)setReview(false);}}>
      <form method="dialog" onSubmit={event=>event.preventDefault()}><header><div><p>게시 설정</p><h2 id="writer-publish-heading" ref={dialogHeading} tabIndex={-1}>마지막으로 설정을 확인해 주세요</h2></div><button type="button" className="writer-dialog-close" aria-label="닫기" disabled={busy} onClick={()=>setReview(false)}>×</button></header>
      <div className="writer-publish-fields"><fieldset disabled={busy}><legend>공개 범위</legend><label><input type="radio" name="post-visibility" value="PUBLIC" checked={targetVisibility==="PUBLIC"} disabled={blocked} onChange={()=>setTargetVisibility("PUBLIC")}/><span><strong>공개</strong><small>누구나 내 블로그와 공개 목록에서 볼 수 있어요.</small></span></label><label><input type="radio" name="post-visibility" value="HIDDEN" checked={targetVisibility==="HIDDEN"} onChange={()=>setTargetVisibility("HIDDEN")}/><span><strong>비공개</strong><small>내 글에서 작성자만 볼 수 있어요.</small></span></label></fieldset>
        {blocked&&<p role="alert">차단된 글은 공개할 수 없습니다.</p>}
        <div className="writer-form-field"><PostClassification key={`category-${publishRevision}`} categoryLabel="주제" showTags={false} categoryId={value.categoryId??null} tagIds={value.tagIds??[]} existingCategory={existingCategory??undefined} existingTags={existingTags} onChange={patch=>setValue(current=>({...current,...patch}))}/></div>
        <div className="writer-form-field"><BoardPicker key={`board-${publishRevision}`} label="게시판" boardId={value.boardId??null} onChange={boardId=>setValue(current=>({...current,boardId}))}/></div>
        <div className="writer-form-field writer-slug-field"><span>주소</span>{existingPost&&!existingPost.draft?<><output>{existingPost.urlKey}</output><small>완료된 글 주소는 변경할 수 없습니다.</small></>:<><fieldset className="writer-address-modes" disabled={busy}><legend>게시글 주소</legend><label><input type="radio" name="post-address-mode" checked={slugMode==="NUMERIC"} onChange={()=>setSlugMode("NUMERIC")}/><span>숫자 주소 <small>글 번호를 자동으로 만듭니다.</small></span></label><label><input type="radio" name="post-address-mode" checked={slugMode==="CUSTOM"} onChange={()=>{setSlugMode("CUSTOM");slugTouched.current=true;}}/><span>직접 입력 <small>영문 주소를 정합니다.</small></span></label></fieldset>{slugMode==="CUSTOM"&&<><span className="writer-slug-prefix">/posts/</span><input value={slug} maxLength={400} aria-invalid={!!slugError} onChange={event=>{slugTouched.current=true;setSlug(event.target.value);}} placeholder="my-post-title"/><small>영문 소문자와 숫자를 하이픈으로 연결합니다. 최대 200자입니다.{normalizedSlug&&normalizedSlug!==slug?` 저장 주소: ${normalizedSlug}`:""}</small>{slugError&&<small className="writer-slug-error" role="alert">{slugError}</small>}</>}</>}</div>
        <details className="writer-extra-fields" open={extrasOpen} onToggle={event=>setExtrasOpen(event.currentTarget.open)}><summary>프로젝트</summary><PostProjectPicker memberId={memberId} projectId={value.projectId??null} onChange={projectId=>setValue(current=>({...current,projectId}))}/></details>
      </div>
      {saveError&&<p className="post-editor-errors" role="alert">{saveError}</p>}<footer><button type="button" className="secondary" disabled={busy} onClick={()=>setReview(false)}>취소</button><button type="button" disabled={busy||errors.length>0||!!slugError||(blocked&&targetVisibility==="PUBLIC")} onClick={()=>void save({kind:"complete",visibility:targetVisibility,slug})}>{busy?"저장 중…":"발행"}</button></footer>
    </form>
    </dialog>
  </section>;
}
