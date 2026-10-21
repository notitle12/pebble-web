import {newDbColumn,updateDbColumn,type DatabaseSchema,type DbColumn,type DbReference,type DbTable} from './database-schema.ts';
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

export function isReferencableDbColumn(schema: DatabaseSchema, ref: DbReference): boolean {
 const table = schema.tables.find(t => t.id === ref.tableId);
 const col = table?.columns.find(c => c.id === ref.columnId);
 if (!table || !col) return false;
 return Boolean(col.unique || (col.primaryKey && table.columns.filter(c => c.primaryKey).length === 1));
}

function toSingular(name: string): string {
 const lower = name.toLowerCase();
 if (lower.endsWith('ies') && lower.length > 4) {
  return name.slice(0, -3) + 'y';
 }
 if (lower.endsWith('ses') && lower.length > 4) {
  return name.slice(0, -2);
 }
 if (lower.endsWith('s') && !lower.endsWith('ss') && lower.length > 3) {
  return name.slice(0, -1);
 }
 return name;
}

function formatFkLogicalName(sourceTable: DbTable, sourceCol: DbColumn): string {
 const tableLabel = sourceTable.description.trim() || sourceTable.name.trim() || '참조';
 const colLogical = sourceCol.logicalName?.trim();
 if (colLogical) {
  if (colLogical.toLowerCase().startsWith(tableLabel.toLowerCase())) {
   return colLogical.slice(0, 100);
  }
  return `${tableLabel} ${colLogical}`.slice(0, 100);
 }
 const colName = sourceCol.name.trim().toLowerCase();
 if (colName === 'id' || !colName) {
  return `${tableLabel} 식별자`.slice(0, 100);
 }
 return `${tableLabel} ${sourceCol.name.trim()}`.slice(0, 100);
}

/**
 * Smart bidirectional connection:
 * - When connecting PK to PK across different tables, automatically creates an FK column on the target table.
 * - Accepts PK/UQ -> FK or FK -> PK/UQ (automatically detects which side is the 1-side).
 * - If neither side is PK/UQ yet, promotes the first endpoint to PK (if table has no PK) or UNIQUE.
 * - Auto-fills empty FK dataType from the referenced column's dataType.
 */
export function smartConnectDbColumns(
 schema: DatabaseSchema,
 first: DbReference,
 second: DbReference,
 shape: DbRelationShape = { many: true, targetRequired: true, sourceRequired: false },
 notation: 'IE' | 'CHEN' = 'IE'
): {
 schema: DatabaseSchema;
 one: DbReference;
 foreign: DbReference;
 autoPromoted: boolean;
 createdColumnId?: string;
} {
 if (first.tableId === second.tableId && first.columnId === second.columnId) {
  throw new Error('다른 컬럼을 연결 대상으로 선택해 주세요.');
 }
 let working = schema;

 const firstTable = working.tables.find(t => t.id === first.tableId);
 const firstCol = firstTable?.columns.find(c => c.id === first.columnId);
 const secondTable = working.tables.find(t => t.id === second.tableId);
 const secondCol = secondTable?.columns.find(c => c.id === second.columnId);
 if (!firstTable || !firstCol || !secondTable || !secondCol) {
  throw new Error('연결할 테이블 또는 컬럼을 찾을 수 없습니다.');
 }

 // If both endpoints represent the primary key / identifier of their tables across different tables,
 // automatically add an FK column to the second (target) table referencing the first (or reuse an unreferenced matching column).
 const isFirstPk = Boolean(firstCol.primaryKey || (firstCol.name && firstCol.name.trim().toLowerCase() === 'id'));
 const isSecondPk = Boolean(secondCol.primaryKey || (secondCol.name && secondCol.name.trim().toLowerCase() === 'id'));

 if (isFirstPk && isSecondPk && first.tableId !== second.tableId) {
  let autoPromoted = false;
  if (!isReferencableDbColumn(working, first)) {
   const hasPk = firstTable.columns.some(c => c.primaryKey);
   working = updateDbColumn(working, first.tableId, first.columnId, hasPk ? { unique: true } : { primaryKey: true, nullable: false });
   autoPromoted = true;
  }

  const rawTable = (firstTable.name || 'ref').trim().replace(/\s+/g, '_').toLowerCase();
  const rawCol = (firstCol.name || 'id').trim().replace(/\s+/g, '_').toLowerCase();
  const singularTable = toSingular(rawTable);
  const candidateNames = new Set([
   `${rawTable}_${rawCol}`.toLowerCase(),
   `${singularTable}_${rawCol}`.toLowerCase(),
  ]);
  const existingMatchingCol = secondTable.columns.find(
   c => !c.primaryKey && !c.reference && candidateNames.has(c.name.trim().toLowerCase())
  );

  if (existingMatchingCol) {
   const res = smartConnectDbColumns(
    working,
    first,
    { tableId: second.tableId, columnId: existingMatchingCol.id },
    shape,
    notation
   );
   return { ...res, autoPromoted: autoPromoted || res.autoPromoted };
  }

  const result = connectDbColumnToTable(working, first, second.tableId, shape, notation);
  return {
   schema: result.schema,
   one: result.one,
   foreign: result.foreign,
   autoPromoted,
   createdColumnId: result.createdColumnId,
  };
 }

 let one = first;
 let foreign = second;
 let autoPromoted = false;

 const firstIsRef = isReferencableDbColumn(working, first);
 const secondIsRef = isReferencableDbColumn(working, second);

 if (firstIsRef) {
  one = first;
  foreign = second;
 } else if (secondIsRef) {
  one = second;
  foreign = first;
 } else {
  // Neither is PK/UQ yet: promote `first` so the user doesn't hit a wall
  const hasPk = firstTable.columns.some(c => c.primaryKey);
  working = updateDbColumn(working, first.tableId, first.columnId, hasPk ? { unique: true } : { primaryKey: true, nullable: false });
  one = first;
  foreign = second;
  autoPromoted = true;
 }

 const oneTable = working.tables.find(t => t.id === one.tableId)!;
 const oneCol = oneTable.columns.find(c => c.id === one.columnId)!;
 const foreignTable = working.tables.find(t => t.id === foreign.tableId);
 const foreignCol = foreignTable?.columns.find(c => c.id === foreign.columnId);
 if (!foreignTable || !foreignCol) throw new Error('연결할 대상 컬럼을 찾을 수 없습니다.');

 // Adjust shape if foreign column is a single PK
 const isForeignSinglePk = foreignCol.primaryKey && foreignTable.columns.filter(c => c.primaryKey).length === 1;
 const effectiveShape: DbRelationShape = {
  ...shape,
  many: isForeignSinglePk ? false : shape.many,
  targetRequired: foreignCol.primaryKey ? true : shape.targetRequired,
 };

 let connected = connectDbColumns(working, one, foreign, effectiveShape, notation);

 // Auto-fill dataType on FK if empty and 1-side has a dataType
 if (!foreignCol.dataType.trim() && oneCol.dataType.trim()) {
  connected = updateDbColumn(connected, foreign.tableId, foreign.columnId, { dataType: oneCol.dataType });
 }

 return { schema: connected, one, foreign, autoPromoted };
}

export function connectDbColumnToTable(
 schema: DatabaseSchema,
 sourceRef: DbReference,
 targetTableId: string,
 shape: DbRelationShape = { many: true, targetRequired: true, sourceRequired: false },
 notation: 'IE' | 'CHEN' = 'IE'
): { schema: DatabaseSchema; one: DbReference; foreign: DbReference; createdColumnId: string } {
 const sourceTable = schema.tables.find(t => t.id === sourceRef.tableId);
 const sourceCol = sourceTable?.columns.find(c => c.id === sourceRef.columnId);
 const targetTable = schema.tables.find(t => t.id === targetTableId);
 if (!sourceTable || !sourceCol || !targetTable) {
  throw new Error('연결할 테이블 또는 컬럼을 찾을 수 없습니다.');
 }
 if (targetTable.columns.length >= 50) {
  throw new Error('한 테이블에는 최대 50개까지 컬럼을 추가할 수 있습니다.');
 }
 const rawTable = (sourceTable.name || 'ref').trim().replace(/\s+/g, '_').toLowerCase();
 const rawCol = (sourceCol.name || 'id').trim().replace(/\s+/g, '_').toLowerCase();
 const baseName = `${rawTable}_${rawCol}`.slice(0, 90);
 const existingNames = new Set(targetTable.columns.map(c => c.name.trim().toLowerCase()));
 let fkName = baseName;
 let idx = 2;
 while (existingNames.has(fkName.toLowerCase())) {
  fkName = `${baseName}_${idx}`;
  idx++;
 }
 const fkCol: DbColumn = {
  ...newDbColumn(),
  name: fkName,
  logicalName: formatFkLogicalName(sourceTable, sourceCol),
  dataType: sourceCol.dataType || 'BIGINT',
  nullable: !shape.targetRequired,
  unique: !shape.many,
  description: `${sourceTable.description.trim() || sourceTable.name.trim() || '참조 테이블'} 외래 키`,
 };
 const withCol: DatabaseSchema = {
  ...schema,
  tables: schema.tables.map(t => t.id === targetTableId ? { ...t, columns: [...t.columns, fkCol] } : t),
 };
 const res = smartConnectDbColumns(withCol, sourceRef, { tableId: targetTableId, columnId: fkCol.id }, shape, notation);
 return { schema: res.schema, one: res.one, foreign: res.foreign, createdColumnId: fkCol.id };
}

export function disconnectDbColumn(schema: DatabaseSchema, tableId: string, columnId: string): DatabaseSchema {
 return updateDbColumn(schema, tableId, columnId, { reference: null });
}

export function changeDbRelationShape(
 schema: DatabaseSchema,
 fkTableId: string,
 fkColumnId: string,
 shape: DbRelationShape,
 notation?: 'IE' | 'CHEN'
): DatabaseSchema {
 const fkTable = schema.tables.find(t => t.id === fkTableId);
 const fkCol = fkTable?.columns.find(c => c.id === fkColumnId);
 if (!fkTable || !fkCol || !fkCol.reference) return schema;
 const resolvedNotation = notation ?? (fkCol.reference.notation === 'CHEN' ? 'CHEN' : 'IE');
 let working = schema;
 if (fkCol.primaryKey && (shape.many || !shape.targetRequired)) {
  working = updateDbColumn(working, fkTableId, fkColumnId, { primaryKey: false });
 }
 return connectDbColumns(
  working,
  { tableId: fkCol.reference.tableId, columnId: fkCol.reference.columnId },
  { tableId: fkTableId, columnId: fkColumnId },
  shape,
  resolvedNotation
 );
}

export function reverseDbRelation(
 schema: DatabaseSchema,
 fkTableId: string,
 fkColumnId: string
): { schema: DatabaseSchema; newFk: DbReference } | null {
 const fkTable = schema.tables.find(t => t.id === fkTableId);
 const fkCol = fkTable?.columns.find(c => c.id === fkColumnId);
 if (!fkTable || !fkCol || !fkCol.reference) return null;
 const oldOne = fkCol.reference;
 const notation = oldOne.notation === 'CHEN' ? 'CHEN' : 'IE';
 const shape: DbRelationShape = {
  many: !(fkCol.unique || (fkCol.primaryKey && fkTable.columns.filter(c => c.primaryKey).length === 1)),
  targetRequired: !fkCol.nullable,
  sourceRequired: oldOne.sourceRequired ?? false,
 };
 let working = updateDbColumn(schema, fkTableId, fkColumnId, { reference: null });
 const targetTable = working.tables.find(t => t.id === oldOne.tableId);
 const targetCol = targetTable?.columns.find(c => c.id === oldOne.columnId);
 if (!targetTable || !targetCol) return null;
 if (!isReferencableDbColumn(working, { tableId: fkTableId, columnId: fkColumnId })) {
  const hasPk = fkTable.columns.some(c => c.primaryKey);
  working = updateDbColumn(
   working,
   fkTableId,
   fkColumnId,
   hasPk ? { unique: true } : { primaryKey: true, nullable: false }
  );
 }
 if (targetCol.primaryKey && (shape.many || !shape.targetRequired)) {
  working = updateDbColumn(working, oldOne.tableId, oldOne.columnId, { primaryKey: false });
 }
 const connected = connectDbColumns(
  working,
  { tableId: fkTableId, columnId: fkColumnId },
  { tableId: oldOne.tableId, columnId: oldOne.columnId },
  shape,
  notation
 );
 return { schema: connected, newFk: { tableId: oldOne.tableId, columnId: oldOne.columnId } };
}
