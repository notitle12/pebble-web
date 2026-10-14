/** ERD and specifications edit this one document; references use stable IDs. */
export type DbNotation = 'IE'|'BARKER'|'CHEN';
export type DbReference = {tableId:string;columnId:string;notation?:DbNotation;sourceRequired?:boolean};
export type DbColumn = {id:string;name:string;dataType:string;nullable:boolean;primaryKey:boolean;unique:boolean;description:string;reference:DbReference|null};
export type DbTable = {id:string;name:string;description:string;position:{x:number;y:number};columns:DbColumn[]};
export type DatabaseSchema = {schemaVersion:1;display:'BOTH'|'ERD'|'SPEC';tables:DbTable[]};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v:Record<string,unknown>,allowed:string[])=>Object.keys(v).every(k=>allowed.includes(k));
const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-z][a-z0-9-]{0,39}$/.test(v);
const text=(v:unknown,max:number,required=false):v is string=>typeof v==='string'&&Array.from(v).length<=max&&(!required||!!v.trim())&&!Array.from(v).some(c=>{const n=c.codePointAt(0)!;return n===0||(n>=0xd800&&n<=0xdfff);});
function fail():never{throw new Error('DB 설계의 테이블명·컬럼명·자료형, 중복 이름과 키 참조를 확인해 주세요. PK는 NULL을 허용하지 않으며 참조 대상은 PK 또는 UNIQUE여야 합니다.');}
export function parseDatabaseSchema(value:unknown):DatabaseSchema{
 if(!object(value)||!keys(value,['schemaVersion','display','tables'])||value.schemaVersion!==1||!['BOTH','ERD','SPEC'].includes(String(value.display))||!Array.isArray(value.tables)||!value.tables.length||value.tables.length>20)fail();
 const tableIds=new Set<string>(),tableNames=new Set<string>();
 for(const t of value.tables){
  if(!object(t)||!keys(t,['id','name','description','position','columns'])||!id(t.id)||!text(t.name,100,true)||!text(t.description,500)||!object(t.position)||!keys(t.position,['x','y'])||![t.position.x,t.position.y].every(n=>typeof n==='number'&&Number.isInteger(n)&&n>=0&&n<=6000)||!Array.isArray(t.columns)||!t.columns.length||t.columns.length>50)fail();
  const name=t.name.trim().toLowerCase();if(tableIds.has(t.id)||tableNames.has(name))fail();tableIds.add(t.id);tableNames.add(name);
  const ids=new Set<string>(),names=new Set<string>();
  for(const c of t.columns){
   if(!object(c)||!keys(c,['id','name','dataType','nullable','primaryKey','unique','description','reference'])||!id(c.id)||!text(c.name,100,true)||!text(c.dataType,100,true)||!text(c.description,500)||typeof c.nullable!=='boolean'||typeof c.primaryKey!=='boolean'||typeof c.unique!=='boolean'||(c.primaryKey&&c.nullable)||!(c.reference===null||object(c.reference)&&keys(c.reference,['tableId','columnId','notation','sourceRequired'])&&id(c.reference.tableId)&&id(c.reference.columnId)&&(c.reference.notation===undefined||['IE','BARKER','CHEN'].includes(String(c.reference.notation)))&&(c.reference.sourceRequired===undefined||typeof c.reference.sourceRequired==='boolean')))fail();
   const n=c.name.trim().toLowerCase();if(ids.has(c.id)||names.has(n))fail();ids.add(c.id);names.add(n);
  }
 }
 const schema=value as DatabaseSchema;
 for(const t of schema.tables)for(const c of t.columns)if(c.reference){const targetTable=schema.tables.find(t=>t.id===c.reference!.tableId);const target=targetTable?.columns.find(k=>k.id===c.reference!.columnId);if(!target||(!target.unique&&!(target.primaryKey&&targetTable!.columns.filter(k=>k.primaryKey).length===1))||(t.id===c.reference.tableId&&c.id===c.reference.columnId))fail();}
 if(Array.from(JSON.stringify(schema)).length>50000)throw new Error('DB 설계는 최대 50,000자까지 저장할 수 있어요.');
 return schema;
}
const freshId=()=>`n-${globalThis.crypto.randomUUID()}`;
export const newDbColumn=():DbColumn=>({id:freshId(),name:'',dataType:'',nullable:true,primaryKey:false,unique:false,description:'',reference:null});
export function newDbTable(index=0):DbTable{return {id:freshId(),name:'',description:'',position:{x:32+(index%3)*340,y:32+Math.floor(index/3)*300},columns:[newDbColumn()]};}
export const newDatabaseSchema=():DatabaseSchema=>({schemaVersion:1,display:'BOTH',tables:[newDbTable()]});
export function updateDbColumn(schema:DatabaseSchema,tableId:string,columnId:string,patch:Partial<DbColumn>):DatabaseSchema{
 const next={...schema,tables:schema.tables.map(t=>t.id!==tableId?t:{...t,columns:t.columns.map(c=>c.id!==columnId?c:{...c,...patch,...(patch.primaryKey?{nullable:false}:{})})})};
 return {...next,tables:next.tables.map(t=>({...t,columns:t.columns.map(c=>{
  if(!c.reference)return c;
  const targetTable=next.tables.find(k=>k.id===c.reference!.tableId),target=targetTable?.columns.find(k=>k.id===c.reference!.columnId);
  return target&&(target.unique||target.primaryKey&&targetTable!.columns.filter(k=>k.primaryKey).length===1)?c:{...c,reference:null};
 })}))};
}
function clearReferences(schema:DatabaseSchema,tableId:string,columnId?:string):DatabaseSchema{return {...schema,tables:schema.tables.map(t=>({...t,columns:t.columns.map(c=>c.reference?.tableId===tableId&&(!columnId||c.reference.columnId===columnId)?{...c,reference:null}:c)}))};}
export function removeDbTable(schema:DatabaseSchema,id:string):DatabaseSchema{return clearReferences({...schema,tables:schema.tables.filter(t=>t.id!==id)},id);}
export function removeDbColumn(schema:DatabaseSchema,tableId:string,columnId:string):DatabaseSchema{return clearReferences({...schema,tables:schema.tables.map(t=>t.id!==tableId?t:{...t,columns:t.columns.filter(c=>c.id!==columnId)})},tableId,columnId);}
export function schemaTableSpec(schema:DatabaseSchema,t:DbTable){return {schemaVersion:1 as const,tableName:t.name,description:t.description,columns:t.columns.map(c=>{const target=schema.tables.find(t=>t.id===c.reference?.tableId);const column=target?.columns.find(k=>k.id===c.reference?.columnId);return {name:c.name,dataType:c.dataType,nullable:c.nullable,primaryKey:c.primaryKey,foreignKey:target&&column?`${target.name}.${column.name}`:null,description:c.description};})};}

export function relationCardinality(table:DbTable,column:DbColumn){
 return {many:!(column.unique||column.primaryKey&&table.columns.filter(c=>c.primaryKey).length===1),sourceRequired:column.reference?.sourceRequired??false,targetRequired:!column.nullable,notation:column.reference?.notation??'IE'};
}
