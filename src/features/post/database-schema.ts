/** ERD and specifications edit this one document; references use stable IDs. */
export type DbNotation = 'IE'|'BARKER'|'CHEN';
export type DbReference = {tableId:string;columnId:string;notation?:DbNotation;sourceRequired?:boolean};
export type DbColumn = {id:string;name:string;logicalName?:string;dataType:string;nullable:boolean;primaryKey:boolean;unique:boolean;description:string;reference:DbReference|null;defaultValue?:string;autoIncrement?:boolean};
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
   if(!object(c)||!keys(c,['id','name','logicalName','dataType','nullable','primaryKey','unique','description','reference','defaultValue','autoIncrement'])||!id(c.id)||!text(c.name,100,true)||(c.logicalName!==undefined&&!text(c.logicalName,100))||!text(c.dataType,100,true)||!text(c.description,500)||typeof c.nullable!=='boolean'||typeof c.primaryKey!=='boolean'||typeof c.unique!=='boolean'||(c.primaryKey&&c.nullable)||!(c.reference===null||object(c.reference)&&keys(c.reference,['tableId','columnId','notation','sourceRequired'])&&id(c.reference.tableId)&&id(c.reference.columnId)&&(c.reference.notation===undefined||['IE','BARKER','CHEN'].includes(String(c.reference.notation)))&&(c.reference.sourceRequired===undefined||typeof c.reference.sourceRequired==='boolean'))||(c.defaultValue!==undefined&&!text(c.defaultValue,100))||(c.autoIncrement!==undefined&&typeof c.autoIncrement!=='boolean'))fail();
   const n=c.name.trim().toLowerCase();if(ids.has(c.id)||names.has(n))fail();ids.add(c.id);names.add(n);
  }
 }
 const schema=value as DatabaseSchema;
 for(const t of schema.tables)for(const c of t.columns)if(c.reference){const targetTable=schema.tables.find(t=>t.id===c.reference!.tableId);const target=targetTable?.columns.find(k=>k.id===c.reference!.columnId);if(!target||(!target.unique&&!(target.primaryKey&&targetTable!.columns.filter(k=>k.primaryKey).length===1))||(t.id===c.reference.tableId&&c.id===c.reference.columnId))fail();}
 if(Array.from(JSON.stringify(schema)).length>50000)throw new Error('DB 설계는 최대 50,000자까지 저장할 수 있어요.');
 return schema;
}
const freshId=()=>`n-${globalThis.crypto.randomUUID()}`;
export const newDbColumn=():DbColumn=>({id:freshId(),name:'',logicalName:'',dataType:'',nullable:true,primaryKey:false,unique:false,description:'',reference:null,defaultValue:'',autoIncrement:false});
export function newDbTable(index=0):DbTable{return {id:freshId(),name:'',description:'',position:{x:32+(index%3)*340,y:32+Math.floor(index/3)*300},columns:[newDbColumn()]};}
export const newDatabaseSchema=():DatabaseSchema=>({schemaVersion:1,display:'BOTH',tables:[newDbTable()]});
export function isDatabaseSchemaEmpty(schema: DatabaseSchema): boolean {
  if (!schema || schema.schemaVersion !== 1 || !Array.isArray(schema.tables)) return false;
  return schema.tables.every(table => !table.name?.trim() && !table.description?.trim() && Array.isArray(table.columns) && table.columns.every(col =>
    !col.name?.trim() && !col.dataType?.trim() && !col.logicalName?.trim() && !col.description?.trim() && !col.defaultValue?.trim()
    && !col.primaryKey && !col.unique && !col.reference && !col.autoIncrement && col.nullable !== false));
}

export function sortDbColumns(columns: DbColumn[]): DbColumn[] {
 return [...columns].sort((a, b) => {
  const scoreA = a.primaryKey ? 0 : a.reference ? 1 : 2;
  const scoreB = b.primaryKey ? 0 : b.reference ? 1 : 2;
  return scoreA - scoreB;
 });
}

export function reorderDbColumns(columns: DbColumn[], sourceId: string, targetId: string): DbColumn[] {
 if (sourceId === targetId) return columns;
 const srcIdx = columns.findIndex(c => c.id === sourceId);
 const tgtIdx = columns.findIndex(c => c.id === targetId);
 if (srcIdx < 0 || tgtIdx < 0) return columns;
 const next = [...columns];
 const [moved] = next.splice(srcIdx, 1);
 next.splice(tgtIdx, 0, moved);
 return sortDbColumns(next);
}

export function updateDbColumn(schema:DatabaseSchema,tableId:string,columnId:string,patch:Partial<DbColumn>):DatabaseSchema{
 const next={...schema,tables:schema.tables.map(t=>t.id!==tableId?t:{...t,columns:sortDbColumns(t.columns.map(c=>c.id!==columnId?c:{...c,...patch,...(patch.primaryKey?{nullable:false}:{})}))})};
 return {...next,tables:next.tables.map(t=>({...t,columns:sortDbColumns(t.columns.map(c=>{
  if(!c.reference)return c;
  const targetTable=next.tables.find(k=>k.id===c.reference!.tableId),target=targetTable?.columns.find(k=>k.id===c.reference!.columnId);
  return target&&(target.unique||target.primaryKey&&targetTable!.columns.filter(k=>k.primaryKey).length===1)?c:{...c,reference:null};
 }))}))};
}
function clearReferences(schema:DatabaseSchema,tableId:string,columnId?:string):DatabaseSchema{return {...schema,tables:schema.tables.map(t=>({...t,columns:t.columns.map(c=>c.reference?.tableId===tableId&&(!columnId||c.reference.columnId===columnId)?{...c,reference:null}:c)}))};}
export function removeDbTable(schema:DatabaseSchema,id:string):DatabaseSchema{return clearReferences({...schema,tables:schema.tables.filter(t=>t.id!==id)},id);}
/** Delete one selection atomically and clear references to every removed table. */
export function removeDbTables(schema:DatabaseSchema, ids:Iterable<string>):DatabaseSchema {
 const removed=new Set(ids);
 const tables=schema.tables.filter(t=>!removed.has(t.id));
 if (!tables.length || tables.length===schema.tables.length) return schema;
 return {...schema,tables:tables.map(t=>({...t,columns:t.columns.map(c=>c.reference && removed.has(c.reference.tableId)?{...c,reference:null}:c)}))};
}
export function removeDbColumn(schema:DatabaseSchema,tableId:string,columnId:string):DatabaseSchema{return clearReferences({...schema,tables:schema.tables.map(t=>t.id!==tableId?t:{...t,columns:t.columns.filter(c=>c.id!==columnId)})},tableId,columnId);}
export function schemaTableSpec(schema:DatabaseSchema,t:DbTable){return {schemaVersion:1 as const,tableName:t.name,description:t.description,columns:t.columns.map(c=>{const target=schema.tables.find(t=>t.id===c.reference?.tableId);const column=target?.columns.find(k=>k.id===c.reference?.columnId);return {name:c.name,logicalName:c.logicalName??'',dataType:c.dataType,nullable:c.nullable,primaryKey:c.primaryKey,foreignKey:target&&column?`${target.name}.${column.name}`:null,unique:c.unique,defaultValue:c.defaultValue??'',autoIncrement:Boolean(c.autoIncrement),description:c.description};})};}

export function relationCardinality(table:DbTable,column:DbColumn){
 return {many:!(column.unique||column.primaryKey&&table.columns.filter(c=>c.primaryKey).length===1),sourceRequired:column.reference?.sourceRequired??false,targetRequired:!column.nullable,notation:column.reference?.notation??'IE'};
}

export const COMMON_DB_TYPES = [
 'BIGINT',
 'INT',
 'VARCHAR(255)',
 'VARCHAR(100)',
 'VARCHAR(50)',
 'TEXT',
 'BOOLEAN',
 'TIMESTAMP',
 'DATETIME',
 'DATE',
 'UUID',
 'DECIMAL(10,2)',
 'JSON',
] as const;

export const DB_TABLE_COLORS = [
 '#3b82f6',
 '#8b5cf6',
 '#10b981',
 '#f59e0b',
 '#ec4899',
 '#06b6d4',
 '#6366f1',
 '#14b8a6',
] as const;

export type DbColumnPreset = 'id' | 'created_at' | 'updated_at' | 'empty';

export function newDbPresetColumn(preset: DbColumnPreset, existingColumns: DbColumn[] = []): DbColumn {
 const existingNames = new Set(existingColumns.map(c => c.name.trim().toLowerCase()));
 const uniqueName = (base: string) => {
  if (!base) return '';
  if (!existingNames.has(base.toLowerCase())) return base;
  let idx = 2;
  while (existingNames.has(`${base}_${idx}`.toLowerCase())) idx++;
  return `${base}_${idx}`;
 };
 if (preset === 'id') {
  const hasPk = existingColumns.some(c => c.primaryKey);
  return {
   id: freshId(),
   name: uniqueName('id'),
   logicalName: '식별자',
   dataType: 'BIGINT',
   nullable: false,
   primaryKey: !hasPk,
   unique: hasPk,
   description: '식별자',
   reference: null,
  };
 }
 if (preset === 'created_at') {
  return {
   id: freshId(),
   name: uniqueName('created_at'),
   logicalName: '생성일시',
   dataType: 'TIMESTAMP',
   nullable: false,
   primaryKey: false,
   unique: false,
   description: '생성 일시',
   reference: null,
  };
 }
 if (preset === 'updated_at') {
  return {
   id: freshId(),
   name: uniqueName('updated_at'),
   logicalName: '수정일시',
   dataType: 'TIMESTAMP',
   nullable: false,
   primaryKey: false,
   unique: false,
   description: '수정 일시',
   reference: null,
  };
 }
 return newDbColumn();
}

export function moveDbColumnOrder(
 schema: DatabaseSchema,
 tableId: string,
 columnId: string,
 direction: 'UP' | 'DOWN'
): DatabaseSchema {
 return {
  ...schema,
  tables: schema.tables.map(t => {
   if (t.id !== tableId) return t;
   const idx = t.columns.findIndex(c => c.id === columnId);
   if (idx < 0) return t;
   const targetIdx = direction === 'UP' ? idx - 1 : idx + 1;
   if (targetIdx < 0 || targetIdx >= t.columns.length) return t;
   const cols = [...t.columns];
   const [moved] = cols.splice(idx, 1);
   cols.splice(targetIdx, 0, moved);
   return { ...t, columns: cols };
  }),
 };
}

export function autoLayoutDbTables(schema: DatabaseSchema): DatabaseSchema {
 const count = schema.tables.length;
 if (!count) return schema;
 const cols = Math.max(1, Math.min(3, Math.ceil(Math.sqrt(count))));
 const colWidth = 490;
 const rowHeights: number[] = [];
 schema.tables.forEach((t, i) => {
  const row = Math.floor(i / cols);
  const h = 80 + t.columns.length * 34 + 64;
  rowHeights[row] = Math.max(rowHeights[row] ?? 220, h);
 });
 const rowTops: number[] = [36];
 for (let r = 1; r < rowHeights.length; r++) {
  rowTops[r] = rowTops[r - 1] + rowHeights[r - 1];
 }
 return {
  ...schema,
  tables: schema.tables.map((t, i) => {
   const col = i % cols;
   const row = Math.floor(i / cols);
   return {
    ...t,
    position: {
     x: Math.min(6000, 36 + col * colWidth),
     y: Math.min(6000, rowTops[row] ?? 36),
    },
   };
  }),
 };
}

export function getDatabaseContentBounds(
 schema: DatabaseSchema,
 sizes: Record<string, { width: number; height: number }> = {},
 cardWidth = 330
) {
 if (!schema.tables.length) {
  return { minX: 0, minY: 0, maxX: cardWidth, maxY: 200, width: cardWidth, height: 200 };
 }
 let minX = Infinity;
 let minY = Infinity;
 let maxX = -Infinity;
 let maxY = -Infinity;
 for (const t of schema.tables) {
  const w = sizes[t.id]?.width ?? cardWidth;
  const h = sizes[t.id]?.height ?? (46 + t.columns.length * 34 + 36);
  minX = Math.min(minX, t.position.x);
  minY = Math.min(minY, t.position.y);
  maxX = Math.max(maxX, t.position.x + w);
  maxY = Math.max(maxY, t.position.y + h);
 }
 return {
  minX,
  minY,
  maxX,
  maxY,
  width: Math.max(1, maxX - minX),
  height: Math.max(1, maxY - minY),
 };
}
