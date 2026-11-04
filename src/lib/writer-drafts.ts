import type { PostEditorValue } from '../features/post/post-editor-model.ts';
import type { ProjectEditorValue } from '../features/project/project-editor-model.ts';
import type { PendingImageSnapshot } from '../features/post/pending-images.ts';
export type PostDraftSettings = { slugMode: 'NUMERIC' | 'CUSTOM'; visibility: 'PUBLIC' | 'HIDDEN' };
export type DraftPayload<T = PostEditorValue | ProjectEditorValue> = { value: T; images: PendingImageSnapshot[]; contentId?: string; cover?: File | null; coverDeleted?: boolean; selectedImageSrc?: string | null; projectVisibility?: 'PUBLIC' | 'HIDDEN'; settings?: PostDraftSettings };
export type DraftScope = { memberId: string; kind: 'post' | 'project'; targetId?: string };
export type WriterDraft<T = PostEditorValue | ProjectEditorValue> = DraftPayload<T> & DraftScope & { key: string; savedAt: number; revision?: string; version: 1 };
export const draftOwner = (scope: DraftScope) => JSON.stringify([scope.memberId, scope.kind]);
export const draftKey = (scope: DraftScope, session: string) => JSON.stringify([scope.memberId, scope.kind, scope.targetId ?? 'new', session]);
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export function validDraftBlocks(value: unknown): boolean {
 return Array.isArray(value) && value.every(block => object(block) && typeof block.key === 'string' && ['TEXT','HTML','MARKDOWN','CODE','TABLE','ARCHITECTURE','DB_SCHEMA'].includes(String(block.type)) && typeof block.content === 'string' && typeof block.valid === 'boolean' && (block.language==null || typeof block.language==='string') && (block.title==null || typeof block.title==='string'));
}
export function validDraftValue(kind: DraftScope['kind'], value: unknown): boolean {
 if (!object(value)) return false;
 if (kind === 'post') return typeof value.title === 'string' && typeof value.summary === 'string' && validDraftBlocks(value.blocks) && ['categoryId','projectId','boardId','slug','thumbnailImageSrc'].every(key=>value[key]==null||typeof value[key]==='string') && (value.tags===undefined||Array.isArray(value.tags)&&value.tags.every(tag=>typeof tag==='string'));
 const doc = value.document;
 return ['name','summary','description','architectureDescription','executionInstructions','startedOn','completedOn'].every(key => typeof value[key] === 'string')
  && ['IN_PROGRESS','COMPLETED'].includes(String(value.lifecycleStatus)) && Array.isArray(value.techStackIds) && value.techStackIds.every(id => typeof id === 'string')
  && Array.isArray(value.features) && value.features.every(row => object(row) && typeof row.title === 'string' && typeof row.description === 'string')
  && Array.isArray(value.links) && value.links.every(row => object(row) && typeof row.linkType === 'string' && typeof row.url === 'string' && typeof row.label === 'string')
  && object(doc) && doc.version === 1 && typeof doc.role === 'string' && (doc.teamSize===null||typeof doc.teamSize==='number') && Array.isArray(doc.sections)
  && (doc.roles===undefined||Array.isArray(doc.roles)&&doc.roles.every(role=>typeof role==='string'))
  && (doc.teamComposition===undefined||Array.isArray(doc.teamComposition)&&doc.teamComposition.every(row=>object(row)&&typeof row.role==='string'&&typeof row.count==='number'))
  && doc.sections.every(section => object(section) && ['BACKGROUND','FEATURES','ARCHITECTURE','DATABASE','OUTCOMES','RETROSPECTIVE'].includes(String(section.key)) && validDraftBlocks(section.blocks));
}
/** Drafts deliberately preserve invalid/incomplete diagrams; publishing validates separately. */
export function cleanDraftValue<T>(value: T): T {
 const strip = (blocks: PostEditorValue['blocks']) => blocks.map(({ imagePreviews: _previews, ...block }) => block);
 if (!object(value)) return value;
 if (Array.isArray(value.blocks)) return { ...value, blocks: strip(value.blocks as PostEditorValue['blocks']) } as T;
 const project = value as unknown as ProjectEditorValue;
 return { ...project, document: { ...project.document, sections: project.document.sections.map(section => ({ ...section, blocks: strip(section.blocks) })) } } as T;
}
export function matchesDraft(scope: DraftScope, record: WriterDraft): boolean {
 return record.version === 1 && record.memberId === scope.memberId && record.kind === scope.kind
  && (scope.targetId ? record.targetId === scope.targetId || record.contentId === scope.targetId : !record.targetId)
  && validDraftValue(record.kind, record.value) && Array.isArray(record.images)
  && record.images.every(image => typeof image.src === 'string' && typeof image.name === 'string' && image.file instanceof Blob);
}
/** One latest checkpoint per document; captured input time wins over delayed writes from another tab. */
export const draftDocument = (record: Pick<WriterDraft,'targetId'|'contentId'>) => record.targetId??record.contentId??'new';
export function newestDraft<T>(records: WriterDraft<T>[], incoming: WriterDraft<T>): WriterDraft<T> {
 return records.filter(record=>record.memberId===incoming.memberId&&record.kind===incoming.kind&&draftDocument(record)===draftDocument(incoming)).reduce((latest,record)=>record.savedAt>latest.savedAt?record:latest,incoming);
}
async function openDrafts(): Promise<IDBDatabase> {
 if(typeof indexedDB==='undefined')throw new Error('이 브라우저에서는 자동저장 공간을 사용할 수 없어요.');
 return new Promise((resolve,reject) => {
  let blocked=false;
  const request = indexedDB.open('pebble-writer-autosave',1);
  request.onupgradeneeded = () => { const store=request.result.createObjectStore('drafts',{keyPath:'key'}); store.createIndex('owner','owner'); };
  request.onsuccess = () => {if(blocked){request.result.close();return;}request.result.onversionchange=()=>request.result.close();resolve(request.result);};
  request.onerror = () => reject(new Error('자동저장 공간을 열지 못했어요. 브라우저 저장 공간을 확인해 주세요.'));
  request.onblocked = () => {blocked=true;reject(new Error('자동저장 공간을 열지 못했어요. 다른 작성 탭을 닫고 다시 시도해 주세요.'));};
 });
}
export const writerDraftStore = {
 async list<T>(scope: DraftScope): Promise<WriterDraft<T>[]> {
  const db=await openDrafts();
  try { return await new Promise((resolve,reject) => {
   const tx=db.transaction('drafts','readonly'),request=tx.objectStore('drafts').index('owner').getAll(draftOwner(scope));
   let records: WriterDraft[]=[];
   request.onsuccess=()=>{records=(request.result as WriterDraft[]).filter(record=>matchesDraft(scope,record)).sort((a,b)=>b.savedAt-a.savedAt).slice(0,1);};
   tx.oncomplete=()=>resolve(records as WriterDraft<T>[]);tx.onerror=tx.onabort=()=>reject(new Error('자동저장본을 읽지 못했어요. 저장된 내용을 덮어쓰지 않았습니다.'));
  }); } finally {db.close();}
 },
 async write<T>(record: WriterDraft<T>): Promise<void> {
  const db=await openDrafts();
  try {await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction('drafts','readwrite'),store=tx.objectStore('drafts'),request=store.index('owner').getAll(draftOwner(record));
   request.onsuccess=()=>{
    const records=request.result as WriterDraft<T>[];
    const newest=newestDraft(records,record);
    if(newest===record)store.put({...record,owner:draftOwner(record)});
    for(const old of records)if(draftDocument(old)===draftDocument(record)&&old.key!==newest.key)store.delete(old.key);
   };
   tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(new Error('자동저장에 실패했어요. 브라우저 저장 공간을 확인하고 작성 내용을 별도로 보관해 주세요.'));
  });} finally{db.close();}
 },
 async remove(key: string, savedAt?: number | string): Promise<void> {
  const db=await openDrafts();
  try{await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction('drafts','readwrite'),store=tx.objectStore('drafts'),request=store.get(key);
   request.onsuccess=()=>{if(request.result && (savedAt===undefined || (typeof savedAt==='string'?request.result.revision===savedAt:request.result.savedAt===savedAt)))store.delete(key);};
   tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(new Error('이전 자동저장본을 정리하지 못했어요.'));
  });}finally{db.close();}
 }
};
