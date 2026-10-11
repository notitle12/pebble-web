import {updateDbColumn,type DatabaseSchema,type DbReference} from './database-schema.ts';
export type DbRelationShape={many:boolean;targetRequired:boolean;sourceRequired:boolean};
export const databaseRelationShapes:DbRelationShape[]=[false,true].flatMap(many=>[true,false].flatMap(targetRequired=>[true,false].map(sourceRequired=>({many,targetRequired,sourceRequired}))));
export function relationShapeLabel(shape:DbRelationShape){return `${shape.targetRequired?'1':'0..1'} → ${shape.many?(shape.sourceRequired?'1..N':'0..N'):(shape.sourceRequired?'1':'0..1')}`;}
/** The first selected endpoint is always the referenced (maximum one) side. */
export function connectDbColumns(schema:DatabaseSchema,one:DbReference,foreign:DbReference,shape:DbRelationShape,notation:'IE'|'CHEN'){
 const targetTable=schema.tables.find(t=>t.id===one.tableId),target=targetTable?.columns.find(c=>c.id===one.columnId),sourceTable=schema.tables.find(t=>t.id===foreign.tableId),source=sourceTable?.columns.find(c=>c.id===foreign.columnId);
 if(!target||!(target.unique||target.primaryKey&&targetTable!.columns.filter(c=>c.primaryKey).length===1))throw new Error('처음에는 1쪽의 단일 PK 또는 UNIQUE 컬럼을 선택해 주세요.');
 if(!source||one.tableId===foreign.tableId&&one.columnId===foreign.columnId)throw new Error('다른 컬럼을 연결 대상으로 선택해 주세요.');
 if(source.primaryKey&&!shape.targetRequired)throw new Error('PK 컬럼은 선택 참조로 연결할 수 없어요. 필수 참조 모양을 선택해 주세요.');
 if(source.primaryKey&&sourceTable!.columns.filter(c=>c.primaryKey).length===1&&shape.many)throw new Error('단일 PK는 중복될 수 없어 1:N의 N쪽으로 연결할 수 없어요. 다른 컬럼이나 1:1 모양을 선택해 주세요.');
 return updateDbColumn(schema,foreign.tableId,foreign.columnId,{unique:!shape.many,nullable:!shape.targetRequired,reference:{tableId:one.tableId,columnId:one.columnId,notation,sourceRequired:shape.sourceRequired}});
}
