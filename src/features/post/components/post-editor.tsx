"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseArchitectureSpec, parseTableSpec, type ArchitectureSpec, type TableSpec } from "../api/post-list";
import { ArchitectureBlock } from "./architecture-block";
import { ArchitectureEditor } from "./architecture-editor";
import { CodeBlock } from "./code-block";
import { TableBlock } from "./table-block";
import { TableSpecEditor } from "./table-spec-editor";
import { createEditorBlock, normalizePostSlug, validateEditorValue, validatePostSlug, type PostVisibility, type PostEditorValue, type EditorBlockType } from "../post-editor-model";
import {BoardPicker} from "@/features/board/components/board-picker";
import {PostProjectPicker} from "./post-project-picker";
import {PostClassification} from "./post-classification";
import type {Classification} from "../api/member-posts";
import {RichBodyEditor} from "./rich-body-editor";

export type { PostEditorValue } from "../post-editor-model";
export type PostSaveAction={kind:"temporary"}|{kind:"complete";visibility:PostVisibility;slug:string};
type ImageUpload={src:string;previewUrl:string};

const languages = ["JAVA", "JAVASCRIPT", "TYPESCRIPT", "PYTHON", "HTML", "CSS", "SQL", "JSON", "YAML", "MARKDOWN", "BASH", "SHELL"] as const;
const typeNames: Record<EditorBlockType,string> = { TEXT: "본문", HTML:"리치 본문", MARKDOWN:"Markdown", CODE: "코드", TABLE: "테이블", ARCHITECTURE: "아키텍처" };
const initial = (): PostEditorValue => ({ title: "", summary: "", categoryId:null,projectId:null,boardId:null,tagIds:[],blocks: [createEditorBlock("HTML")] });

export function PostEditor({ memberId, initialValue, onSave, busy = false, visibility = "HIDDEN", blocked = false, existingCategory, existingTags, existingPost, uploadImage, initialNotice }: { memberId:string; initialValue?: PostEditorValue; onSave: (value: PostEditorValue, action:PostSaveAction) => Promise<"server"|"local">; busy?:boolean; visibility?:PostVisibility; blocked?:boolean;existingCategory?:Classification|null;existingTags?:Classification[];existingPost?:{draft:boolean;urlKey:string;id:string};uploadImage?:(file:File,value:PostEditorValue)=>Promise<ImageUpload>;initialNotice?:string }) {
  const startingValue = useRef<PostEditorValue>(initialValue ?? initial());
  const [value, setValue] = useState<PostEditorValue>(() => startingValue.current);
  const [activeKey, setActiveKey] = useState(() => startingValue.current.blocks[0]?.key ?? "");
  const [publishRevision,setPublishRevision]=useState(0);
  const [review,setReview]=useState(false),[extrasOpen,setExtrasOpen]=useState(false),[saveMessage,setSaveMessage]=useState(initialNotice??""),[saveError,setSaveError]=useState("");
  const [targetVisibility,setTargetVisibility]=useState<PostVisibility>(visibility),[slug,setSlug]=useState(startingValue.current.slug??"");
  const initialSlugMode:"NUMERIC"|"CUSTOM"=existingPost?.draft&&startingValue.current.slug?"CUSTOM":"NUMERIC";
  const [slugMode,setSlugMode]=useState<"NUMERIC"|"CUSTOM">(initialSlugMode);
  const dialog=useRef<HTMLDialogElement>(null),dialogHeading=useRef<HTMLHeadingElement>(null),slugTouched=useRef(!!(existingPost?.draft&&startingValue.current.slug));
  const baseline = useRef(JSON.stringify({...startingValue.current,slug:initialSlugMode==="CUSTOM"?startingValue.current.slug??"":"",slugMode:initialSlugMode}));
  const dirty = JSON.stringify({...value,slug:slugMode==="CUSTOM"?slug:"",slugMode}) !== baseline.current;
  const activeBlock=value.blocks.find(block=>block.key===activeKey);
  const firstBody=value.blocks.find(block=>["TEXT","HTML","MARKDOWN"].includes(block.type));
  const errors = useMemo(() => validateEditorValue(value), [value]);
  const temporaryErrors=errors.filter(error=>error!=="제목을 입력해 주세요.");
  const normalizedSlug=normalizePostSlug(slug);
  const slugError=slugMode==="CUSTOM"&&!validatePostSlug(normalizedSlug)?"주소는 영문 소문자·숫자와 하이픈으로 된 200자 이하여야 하며 숫자만 사용할 수 없고 search는 사용할 수 없습니다.":"";
  const updateBlock = useCallback((key: string, update: (block: PostEditorValue["blocks"][number]) => PostEditorValue["blocks"][number]) => {
    setValue(current => ({ ...current, blocks: current.blocks.map(block => block.key === key ? update(block) : block) }));
  }, []);

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

  const addBlock = (type: EditorBlockType) => {
    const block = createEditorBlock(type);
    setValue(current => ({ ...current, blocks: [...current.blocks, block] }));
    setActiveKey(block.key);
  };
  const moveBlock = (index: number, direction: -1 | 1) => setValue(current => {
    const next = [...current.blocks];
    const target = index + direction;
    if (target < 0 || target >= next.length) return current;
    [next[index], next[target]] = [next[target], next[index]];
    return { ...current, blocks: next };
  });
  const leave=()=>{if((dirty||busy)&&!window.confirm("저장되지 않은 변경 사항이 있습니다. 이 페이지를 나갈까요?"))return;window.location.assign("/me/posts");};

  return <section className="post-editor writer-composer" aria-label="게시글 작성기">
    {activeBlock&&!(["TEXT","HTML","MARKDOWN"].includes(activeBlock.type))&&<div className="writer-structure-toolbar" role="toolbar" aria-label="구조 블록 도구"><button type="button" disabled={busy} onClick={()=>firstBody?setActiveKey(firstBody.key):addBlock("HTML")}>← 본문</button><span>{typeNames[activeBlock.type]}</span><button type="button" disabled={busy} onClick={()=>addBlock("HTML")}>＋ 일반 본문</button></div>}
    <header className="writer-action-bar"><button type="button" className="writer-exit" disabled={busy} onClick={leave}>나가기</button><span aria-live="polite">{busy?"저장 중…":saveMessage|| (dirty?"저장되지 않은 변경 사항":"변경 사항 없음")}</span><div><button type="button" className="secondary" disabled={busy||temporaryErrors.length>0} onClick={()=>void save({kind:"temporary"})}>{busy?"저장 중…":"임시저장"}</button><button type="button" disabled={busy||errors.length>0} onClick={()=>{setSaveMessage("");setSaveError("");setPublishRevision(n=>n+1);setReview(true);}}>완료</button></div></header>
    <label className="writer-title-field"><span className="writer-visually-hidden">제목</span><input value={value.title} maxLength={400} aria-label="제목" aria-invalid={!value.title.trim() || Array.from(value.title).length > 200} placeholder="제목을 입력하세요" onChange={event => setValue(current => ({ ...current, title: event.target.value }))} /><small>{Array.from(value.title).length}/200</small></label>
    <ol className="post-editor-block-list">{value.blocks.map((block,index)=><li key={block.key}>
      <div className={`post-editor-block-row${value.blocks.length===1?" writer-single-block":""}`}><button type="button" aria-current={activeKey===block.key?"true":undefined} onClick={()=>setActiveKey(block.key)}>{index+1}. {typeNames[block.type]}{!block.valid&&<span className="post-editor-invalid-mark"> · 입력 오류</span>}</button><div><button type="button" aria-label={`${index+1}번째 블록 위로`} disabled={index===0||busy} onClick={()=>moveBlock(index,-1)}>↑</button><button type="button" aria-label={`${index+1}번째 블록 아래로`} disabled={index===value.blocks.length-1||busy} onClick={()=>moveBlock(index,1)}>↓</button><button type="button" aria-label={`${index+1}번째 블록 삭제`} disabled={value.blocks.length<=1||busy} onClick={()=>{setValue(current=>({...current,blocks:current.blocks.filter(item=>item.key!==block.key)}));if(activeKey===block.key)setActiveKey(value.blocks.find(item=>item.key!==block.key)?.key??"");}}>삭제</button></div></div>
      <BlockFields block={block} value={value} active={activeKey===block.key} disabled={busy} uploadImage={uploadImage} updateBlock={updateBlock} addBlock={addBlock}/>
    </li>)}</ol>
    <details className="writer-add-block"><summary>본문 블록 추가</summary><div><button type="button" disabled={busy} onClick={()=>addBlock("HTML")}>일반 본문</button><button type="button" disabled={busy} onClick={()=>addBlock("CODE")}>코드</button><button type="button" disabled={busy} onClick={()=>addBlock("ARCHITECTURE")}>아키텍처</button><button type="button" disabled={busy} onClick={()=>addBlock("TABLE")}>테이블 명세</button></div></details>
    {errors.filter(error=>error!=="제목을 입력해 주세요.").length>0&&<div className="post-editor-errors" role="alert"><p>완료하기 전에 다음 항목을 확인해 주세요.</p><ul>{errors.filter(error=>error!=="제목을 입력해 주세요.").map((error,index)=><li key={`${error}-${index}`}>{error}</li>)}</ul></div>}

    <dialog ref={dialog} className="writer-publish-dialog" aria-labelledby="writer-publish-heading" onCancel={()=>setReview(false)} onClose={()=>{if(review)setReview(false);}}>
      <form method="dialog" onSubmit={event=>event.preventDefault()}><header><div><p>게시 설정</p><h2 id="writer-publish-heading" ref={dialogHeading} tabIndex={-1}>마지막으로 설정을 확인해 주세요</h2></div><button type="button" className="writer-dialog-close" aria-label="닫기" disabled={busy} onClick={()=>setReview(false)}>×</button></header>
      <div className="writer-publish-fields"><fieldset disabled={busy}><legend>공개 범위</legend><label><input type="radio" name="post-visibility" value="PUBLIC" checked={targetVisibility==="PUBLIC"} disabled={blocked} onChange={()=>setTargetVisibility("PUBLIC")}/><span><strong>공개</strong><small>누구나 내 블로그와 공개 목록에서 볼 수 있어요.</small></span></label><label><input type="radio" name="post-visibility" value="HIDDEN" checked={targetVisibility==="HIDDEN"} onChange={()=>setTargetVisibility("HIDDEN")}/><span><strong>비공개</strong><small>내 글에서 작성자만 볼 수 있어요.</small></span></label></fieldset>
        {blocked&&<p role="alert">차단된 글은 공개할 수 없습니다.</p>}
        <div className="writer-form-field"><PostClassification key={`category-${publishRevision}`} categoryLabel="주제" showTags={false} categoryId={value.categoryId??null} tagIds={value.tagIds??[]} existingCategory={existingCategory??undefined} existingTags={existingTags} onChange={patch=>setValue(current=>({...current,...patch}))}/></div>
        <div className="writer-form-field"><BoardPicker key={`board-${publishRevision}`} label="게시판" boardId={value.boardId??null} onChange={boardId=>setValue(current=>({...current,boardId}))}/></div>
        <div className="writer-form-field writer-slug-field"><span>주소</span>{existingPost&&!existingPost.draft?<><output>{existingPost.urlKey}</output><small>완료된 글 주소는 변경할 수 없습니다.</small></>:<><fieldset className="writer-address-modes" disabled={busy}><legend>게시글 주소</legend><label><input type="radio" name="post-address-mode" checked={slugMode==="NUMERIC"} onChange={()=>setSlugMode("NUMERIC")}/><span>숫자 주소 <small>글 번호를 자동으로 만듭니다.</small></span></label><label><input type="radio" name="post-address-mode" checked={slugMode==="CUSTOM"} onChange={()=>{setSlugMode("CUSTOM");slugTouched.current=true;}}/><span>직접 입력 <small>영문 주소를 정합니다.</small></span></label></fieldset>{slugMode==="CUSTOM"&&<><span className="writer-slug-prefix">/posts/</span><input value={slug} maxLength={400} aria-invalid={!!slugError} onChange={event=>{slugTouched.current=true;setSlug(event.target.value);}} placeholder="my-post-title"/><small>영문 소문자와 숫자를 하이픈으로 연결합니다. 최대 200자입니다.{normalizedSlug&&normalizedSlug!==slug?` 저장 주소: ${normalizedSlug}`:""}</small>{slugError&&<small className="writer-slug-error" role="alert">{slugError}</small>}</>}</>}</div>
        <details className="writer-extra-fields" open={extrasOpen} onToggle={event=>setExtrasOpen(event.currentTarget.open)}><summary>요약·프로젝트·기술 태그</summary><label className="writer-form-field"><span>요약</span><textarea rows={3} maxLength={1000} value={value.summary} onChange={event=>setValue(current=>({...current,summary:event.target.value}))}/><small>{Array.from(value.summary).length}/500</small></label><PostProjectPicker memberId={memberId} projectId={value.projectId??null} onChange={projectId=>setValue(current=>({...current,projectId}))}/><PostClassification key={`tags-${publishRevision}`} showCategory={false} categoryId={value.categoryId??null} tagIds={value.tagIds??[]} existingCategory={existingCategory??undefined} existingTags={existingTags} onChange={patch=>setValue(current=>({...current,...patch}))}/></details>
      </div>
      {saveError&&<p className="post-editor-errors" role="alert">{saveError}</p>}<footer><button type="button" className="secondary" disabled={busy} onClick={()=>setReview(false)}>취소</button><button type="button" disabled={busy||errors.length>0||!!slugError||(blocked&&targetVisibility==="PUBLIC")} onClick={()=>void save({kind:"complete",visibility:targetVisibility,slug})}>{busy?"저장 중…":"발행"}</button></footer>
    </form>
    </dialog>
  </section>;
}

function BlockFields({ block, value, active, disabled, uploadImage, updateBlock, addBlock }: { block: PostEditorValue["blocks"][number];value:PostEditorValue; active: boolean; disabled:boolean; uploadImage?: (file:File,value:PostEditorValue)=>Promise<ImageUpload>; updateBlock: (key: string, update: (block: PostEditorValue["blocks"][number]) => PostEditorValue["blocks"][number]) => void;addBlock:(type:EditorBlockType)=>void }) {
  const set = (patch: Partial<PostEditorValue["blocks"][number]>) => updateBlock(block.key, current => ({ ...current, ...patch }));
  const onTableChange = useCallback((spec: TableSpec | null) => updateBlock(block.key, current => spec ? ({...current,valid:true,content:JSON.stringify(spec)}) : ({...current,valid:false})), [block.key,updateBlock]);
  const onArchitectureChange = useCallback((spec: ArchitectureSpec | null) => updateBlock(block.key, current => spec ? ({...current,valid:true,content:JSON.stringify(spec)}) : ({...current,valid:false})), [block.key,updateBlock]);
  let table: TableSpec | undefined, architecture: ArchitectureSpec | undefined;
  try { if (block.type === "TABLE") table = parseTableSpec(JSON.parse(block.content)); } catch { /* Keep the mounted editor state for invalid in-progress input. */ }
  try { if (block.type === "ARCHITECTURE") architecture = parseArchitectureSpec(JSON.parse(block.content)); } catch { /* Keep the mounted editor state for invalid in-progress input. */ }
  const initialTable = useRef(table).current, initialArchitecture = useRef(architecture).current;
  return <div className="post-editor-block-fields" hidden={!active}>
    {(block.type==="HTML"||block.type==="MARKDOWN"||block.type==="TEXT")&&<RichBodyEditor content={block.content} format={block.type==="TEXT"?"TEXT":block.type} disabled={disabled} imagePreviews={block.imagePreviews} uploadImage={uploadImage?async file=>{const image=await uploadImage(file,value);updateBlock(block.key,current=>({...current,imagePreviews:{...current.imagePreviews,[image.src]:image.previewUrl}}));return image;}:undefined} onChange={(content,format)=>set({content,type:format,valid:true})} onArchitecture={()=>addBlock("ARCHITECTURE")} onCode={()=>addBlock("CODE")} onTableSpec={()=>addBlock("TABLE")}/>}
    {block.type === "CODE" && <><div className="post-editor-code-meta"><label>코드 언어<select value={block.language ?? ""} disabled={disabled} onChange={event => set({ language: event.target.value || null })}><option value="">선택하세요</option>{languages.map(language => <option key={language} value={language}>{language}</option>)}</select></label><label>코드 제목 (선택)<input value={block.title ?? ""} maxLength={100} disabled={disabled} onChange={event => set({ title: event.target.value || null })} /></label></div><label>코드 내용<textarea aria-label="코드 내용" rows={12} value={block.content} disabled={disabled} onChange={event => set({ content: event.target.value, valid: true })} /></label><div className="post-editor-preview"><CodeBlock content={block.content} language={block.language} title={block.title} /></div></>}
    {block.type === "TABLE" && <><label>블록 제목 (선택)<input value={block.title ?? ""} maxLength={100} disabled={disabled} onChange={event => set({ title: event.target.value || null })} /></label><TableSpecEditor key={block.key} initialValue={initialTable} onChange={onTableChange} embedded /><div className="post-editor-preview"><h3>미리보기</h3>{block.valid && table ? <TableBlock spec={table} title={block.title} /> : <p>테이블 입력 오류를 수정하면 미리보기가 표시됩니다.</p>}</div></>}
    {block.type === "ARCHITECTURE" && <><label>블록 제목 (선택)<input value={block.title ?? ""} maxLength={100} disabled={disabled} onChange={event => set({ title: event.target.value || null })} /></label><ArchitectureEditor key={block.key} initialValue={initialArchitecture} onChange={onArchitectureChange} embedded /><div className="post-editor-preview"><h3>미리보기</h3>{block.valid && architecture ? <ArchitectureBlock spec={architecture} title={block.title} /> : <p>구성도 입력 오류를 수정하면 미리보기가 표시됩니다.</p>}</div></>}
  </div>;
}
