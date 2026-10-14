'use client';
import {useCallback,useRef,useState} from 'react';
import type {ArchitectureSpec} from '@/features/post/api/post-list';
import {newDatabaseSchema,parseDatabaseSchema,type DatabaseSchema} from '@/features/post/database-schema';
import type {EditorBlock} from '@/features/post/post-editor-model';
import {ArchitectureEditor} from '@/features/post/components/architecture-editor';
import {DatabaseSchemaEditor} from '@/features/post/components/database-schema-editor';
import {RichBodyEditor,type RichBodyEditorProps} from '@/features/post/components/rich-body-editor';
type Props=Pick<RichBodyEditorProps,'uploadImage'|'imagePreviews'|'disabled'|'toolbarHost'|'toolbarActive'|'onActivate'>&{kind:'ARCHITECTURE'|'DATABASE';blocks:EditorBlock[];onChangeBlocks:(blocks:EditorBlock[])=>void};
const emptyArchitecture=():ArchitectureSpec=>({schemaVersion:1,groups:[],nodes:[{id:'client',type:'CLIENT',label:'클라이언트',icon:'CLIENT',position:{x:56,y:80}}],edges:[]});
export function ProjectDiagramSection({kind,blocks,onChangeBlocks,...editorProps}:Props){
 const type=kind==='DATABASE'?'DB_SCHEMA':'ARCHITECTURE',diagram=blocks.find(block=>block.type===type),latest=useRef({blocks,onChangeBlocks});latest.current={blocks,onChangeBlocks};
 const [initial]=useState(()=>diagram?JSON.parse(diagram.content):kind==='DATABASE'?newDatabaseSchema():emptyArchitecture());
 const [schema,setSchema]=useState<DatabaseSchema>(initial),[notesOpen,setNotesOpen]=useState(false);
 const save=useCallback((spec:ArchitectureSpec|DatabaseSchema,valid:boolean)=>{
  const {blocks,onChangeBlocks}=latest.current,existing=blocks.find(block=>block.type===type),content=JSON.stringify(spec);
  if(!existing&&kind==='ARCHITECTURE'&&content===JSON.stringify(initial))return;
  if(existing?.content===content&&existing.valid===valid)return;
  const next:EditorBlock={key:existing?.key??`project-${type}`,type,content,language:null,title:null,alignment:'LEFT',valid};
  onChangeBlocks(existing?blocks.map(block=>block===existing?next:block):[next,...blocks]);
 },[initial,kind,type]);
 const architectureChange=useCallback((spec:ArchitectureSpec,valid:boolean)=>save(spec,valid),[save]);
 const notes=blocks.filter(block=>block!==diagram);
 return <div>{kind==='ARCHITECTURE'?<ArchitectureEditor initialValue={initial} embedded onDraftChange={architectureChange}/>:<DatabaseSchemaEditor value={schema} onChange={next=>{setSchema(next);let valid=true;try{parseDatabaseSchema(next);}catch{valid=false;}save(next,valid);}}/>}
 <details open={notesOpen} onToggle={event=>setNotesOpen(event.currentTarget.open)}><summary style={{cursor:'pointer',padding:'16px 0',fontSize:13}}>설명·이미지 추가</summary><RichBodyEditor {...editorProps} toolbarMode="inline" allowRepresentativeImage={false} blocks={notes} onActivate={()=>{setNotesOpen(true);editorProps.onActivate?.();}} onChangeBlocks={next=>{const current=latest.current.blocks,main=current.find(block=>block.type===type);latest.current.onChangeBlocks(main?[main,...next]:next);}}/></details></div>;
}
