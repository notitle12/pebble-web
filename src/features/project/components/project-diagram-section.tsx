'use client';
import {useCallback,useRef,useState} from 'react';
import {parseArchitectureSpec,type ArchitectureSpec} from '@/features/post/api/post-list';
import {newDatabaseSchema,parseDatabaseSchema,isDatabaseSchemaEmpty,type DatabaseSchema} from '@/features/post/database-schema';
import type {EditorBlock} from '@/features/post/post-editor-model';
import {ArchitectureEditor} from '@/features/post/components/architecture-editor';
import {DatabaseSchemaEditor} from '@/features/post/components/database-schema-editor';
import {DiagramWidthFrame} from '@/features/post/components/diagram-width-frame';
import {RichBodyEditor,type RichBodyEditorProps} from '@/features/post/components/rich-body-editor';
import {isProjectArchitectureEmpty} from '../project-document';
type Props=Pick<RichBodyEditorProps,'uploadImage'|'imagePreviews'|'disabled'|'toolbarHost'|'toolbarActive'|'onActivate'>&{kind:'ARCHITECTURE'|'DATABASE';blocks:EditorBlock[];onChangeBlocks:(blocks:EditorBlock[])=>void};
const emptyArchitecture=():ArchitectureSpec=>({schemaVersion:1,groups:[],nodes:[{id:'client',type:'CLIENT',label:'클라이언트',icon:'CLIENT',position:{x:56,y:80}}],edges:[]});
export function ProjectDiagramSection({kind,blocks,onChangeBlocks,...editorProps}:Props){
 const type=kind==='DATABASE'?'DB_SCHEMA':'ARCHITECTURE',diagram=blocks.find(block=>block.type===type),latest=useRef({blocks,onChangeBlocks});latest.current={blocks,onChangeBlocks};
 const [initial]=useState(()=>diagram?JSON.parse(diagram.content):kind==='DATABASE'?newDatabaseSchema():emptyArchitecture());
 const [schema,setSchema]=useState<DatabaseSchema>(initial),[notesOpen,setNotesOpen]=useState(false),[displayWidth,setDisplayWidth]=useState<number|null>(initial.displayWidth??null);
 const currentSpec=useRef<ArchitectureSpec|DatabaseSchema>(initial);
 const currentWidth=useRef(displayWidth);
 const save=useCallback((spec:ArchitectureSpec|DatabaseSchema,valid:boolean)=>{
  const storedSpec=currentWidth.current==null?spec:{...spec,displayWidth:currentWidth.current};
  currentSpec.current=storedSpec;
  const {blocks,onChangeBlocks}=latest.current,existing=blocks.find(block=>block.type===type);
  const isEmpty=kind==='DATABASE'?isDatabaseSchemaEmpty(storedSpec as DatabaseSchema):isProjectArchitectureEmpty(storedSpec);
  if(isEmpty){
   if(existing)onChangeBlocks(blocks.filter(block=>block!==existing));
   return;
  }
  const content=JSON.stringify(storedSpec);
  if(existing?.content===content&&existing.valid===valid)return;
  const next:EditorBlock={key:existing?.key??`project-${type}`,type,content,language:null,title:null,alignment:'LEFT',valid};
  onChangeBlocks(existing?blocks.map(block=>block===existing?next:block):[next,...blocks]);
 },[kind,type]);
 const resize=(width:number)=>{currentWidth.current=width;setDisplayWidth(width);const next={...currentSpec.current,displayWidth:width};let valid=true;try{kind==='DATABASE'?parseDatabaseSchema(next as DatabaseSchema):parseArchitectureSpec(next);}catch{valid=false;}save(next,valid);};
 const architectureChange=useCallback((spec:ArchitectureSpec,valid:boolean)=>save(spec,valid),[save]);
 const notes=blocks.filter(block=>block!==diagram);
 return <div>{kind==='ARCHITECTURE'?<DiagramWidthFrame width={displayWidth} editable={!editorProps.disabled} onCommit={resize}><ArchitectureEditor initialValue={initial} embedded onDraftChange={architectureChange}/></DiagramWidthFrame>:<DiagramWidthFrame width={displayWidth} editable={!editorProps.disabled} onCommit={resize}><DatabaseSchemaEditor value={schema} onChange={next=>{setSchema(next);let valid=true;try{parseDatabaseSchema(next);}catch{valid=false;}save(next,valid);}}/></DiagramWidthFrame>}
 <details open={notesOpen} onToggle={event=>setNotesOpen(event.currentTarget.open)}><summary style={{cursor:'pointer',padding:'16px 0',fontSize:13}}>설명·이미지 추가</summary><RichBodyEditor {...editorProps} toolbarMode="inline" allowRepresentativeImage={false} blocks={notes} onActivate={()=>{setNotesOpen(true);editorProps.onActivate?.();}} onChangeBlocks={next=>{const current=latest.current.blocks,main=current.find(block=>block.type===type);latest.current.onChangeBlocks(main?[main,...next]:next);}}/></details></div>;
}
