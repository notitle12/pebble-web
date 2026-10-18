"use client";
import { useEffect, useId, useRef, useState } from 'react';
import {
 COMMON_DB_TYPES,
 relationCardinality,
 sortDbColumns,
 type DatabaseSchema,
 type DbColumn,
 type DbColumnPreset,
 type DbReference,
 type DbTable,
} from '../database-schema';
import { changeDbRelationShape, type DbRelationShape } from '../database-relationship-choice';
import { DatabaseNotationPicker, DatabaseRelationShapePicker } from './database-notation-picker';
import { TableTextInput } from './inline-block-views';
import s from './database-schema.module.css';

export type DatabaseEditActions = {
 changeTable: (id: string, patch: Partial<DbTable>) => void;
 changeColumn: (tableId: string, columnId: string, patch: Partial<DbColumn>) => void;
 addColumn: (id: string, preset?: DbColumnPreset) => void;
 moveColumn?: (tableId: string, columnId: string, direction: 'UP' | 'DOWN') => void;
 reorderColumn?: (tableId: string, sourceColId: string, targetColId: string) => void;
 removeColumn: (tableId: string, columnId: string) => void;
 removeTable: (id: string) => void;
 connect?: (reference: DbReference) => void;
 connectPair?: (source: DbReference, target: DbReference) => void;
 connectToTable?: (source: DbReference, targetTableId: string) => void;
 changeRelationShape?: (
  fkTableId: string,
  fkColumnId: string,
  shape: DbRelationShape,
  notation?: 'IE' | 'CHEN'
 ) => void;
 reverseRelation?: (fkTableId: string, fkColumnId: string) => void;
 disconnectColumn?: (tableId: string, columnId: string) => void;
 connecting?: boolean;
 connectingFrom?: DbReference | null;
};

export function DatabaseKeyCellSelect({
 schema,
 table,
 column,
 rowLabel,
 actions,
 onInspectRelation,
}: {
 schema: DatabaseSchema;
 table: DbTable;
 column: DbColumn;
 rowLabel: string;
 actions: DatabaseEditActions;
 onInspectRelation?: (relationId: string) => void;
}) {
 const [open, setOpen] = useState(false);
 const wrapRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
  if (!open) return;
  const onPointerDown = (e: PointerEvent) => {
   if (e.target instanceof Node && !wrapRef.current?.contains(e.target)) {
    setOpen(false);
   }
  };
  document.addEventListener('pointerdown', onPointerDown);
  return () => document.removeEventListener('pointerdown', onPointerDown);
 }, [open]);

 const keyText = column.primaryKey ? 'PK' : column.reference ? 'FK' : '';
 const refTargetTable = column.reference
  ? schema.tables.find(t => t.id === column.reference?.tableId)
  : null;
 const refTargetCol = refTargetTable?.columns.find(c => c.id === column.reference?.columnId);

 // Candidate PK/Unique columns from other tables (or first column of other tables if none is PK yet)
 const otherTables = schema.tables.filter(t => t.id !== table.id);
 const fkCandidates = otherTables.flatMap(t => {
  const keyCols = t.columns.filter(c => c.primaryKey || c.unique);
  const colsToUse = keyCols.length > 0 ? keyCols : t.columns.slice(0, 1);
  return colsToUse.map(c => ({
   tableId: t.id,
   tableName: t.name || '새 테이블',
   columnId: c.id,
   columnName: c.name || 'id',
   dataType: c.dataType,
   isKey: c.primaryKey || c.unique,
  }));
 });

 return (
  <div ref={wrapRef} className={s.keyMenuWrap}>
   <button
    type="button"
    className={s.erdKeyCellBtn}
    data-pk={column.primaryKey}
    data-fk={Boolean(column.reference)}
    aria-label={`${rowLabel} PK 설정`}
    aria-expanded={open}
    title={
     column.primaryKey
      ? 'PK (클릭하여 키 변경 · 드래그하여 순서 변경)'
      : column.reference && refTargetTable
        ? `FK → ${refTargetTable.name || '새 테이블'}.${refTargetCol?.name || 'id'} (클릭하여 변경)`
        : '클릭하여 PK / FK 설정 · 드래그하여 순서 변경'
    }
    onClick={e => {
     e.stopPropagation();
     setOpen(v => !v);
    }}
   >
    {keyText}
   </button>

   {open && (
    <div className={s.keyPopover} onClick={e => e.stopPropagation()}>
     <button
      type="button"
      className={s.keyPopoverItem}
      data-active={!column.primaryKey && !column.reference}
      onClick={() => {
       if (column.reference && actions.disconnectColumn) {
        actions.disconnectColumn(table.id, column.id);
       }
       if (column.primaryKey) {
        actions.changeColumn(table.id, column.id, { primaryKey: false });
       }
       setOpen(false);
      }}
     >
      <span>빈칸</span>
      <small>일반 칼럼</small>
     </button>

     <button
      type="button"
      className={s.keyPopoverItem}
      data-active={column.primaryKey}
      onClick={() => {
       if (column.reference && actions.disconnectColumn) {
        actions.disconnectColumn(table.id, column.id);
       }
       actions.changeColumn(table.id, column.id, { primaryKey: true, nullable: false });
       setOpen(false);
      }}
     >
      <span className={s.badgePk}>PK</span>
      <small>기본 키 (최상단)</small>
     </button>

     <div className={s.keyPopoverDivider} />
     <div className={s.keyPopoverSectionTitle}>FK (외래 키 — 참조할 대상 선택)</div>

     {fkCandidates.length === 0 ? (
      <div className={s.keyPopoverEmpty}>연결할 다른 테이블이 없습니다</div>
     ) : (
      fkCandidates.map(cand => {
       const isCurrent =
        column.reference?.tableId === cand.tableId &&
        column.reference?.columnId === cand.columnId;
       return (
        <button
         key={`${cand.tableId}:${cand.columnId}`}
         type="button"
         className={s.keyPopoverItem}
         data-active={isCurrent}
         onClick={() => {
          if (column.primaryKey) {
           actions.changeColumn(table.id, column.id, { primaryKey: false });
          }
          actions.connectPair?.(
           { tableId: cand.tableId, columnId: cand.columnId },
           { tableId: table.id, columnId: column.id }
          );
          setOpen(false);
         }}
        >
         <span className={s.badgeFk}>FK</span>
         <small className={s.keyPopoverTarget}>
          {cand.tableName}.{cand.columnName}
         </small>
        </button>
       );
      })
     )}

     {column.reference && onInspectRelation && (
      <>
       <div className={s.keyPopoverDivider} />
       <button
        type="button"
        className={s.keyPopoverItem}
        onClick={() => {
         onInspectRelation(`${table.id}-${column.id}`);
         setOpen(false);
        }}
       >
        <span>관계선 모양 설정 (1:N / 1:1)</span>
       </button>
      </>
     )}
    </div>
   )}
  </div>
 );
}

export function DatabaseColumnTable({
 schema,
 table,
 actions,
}: {
 schema: DatabaseSchema;
 table: DbTable;
 actions: DatabaseEditActions;
}) {
 const listId = useId();
 const [draggingColId, setDraggingColId] = useState<string | null>(null);
 const [dragOverColId, setDragOverColId] = useState<string | null>(null);

 const sortedColumns = sortDbColumns(table.columns);

 return (
  <div className={s.editTableScroll}>
   <datalist id={listId}>
    {COMMON_DB_TYPES.map(type => (
     <option key={type} value={type} />
    ))}
   </datalist>
   <table className={s.editTable} aria-label={`${table.name || '새 테이블'} 컬럼 명세 편집`}>
    <thead>
     <tr>
      <th style={{ width: 46, textAlign: 'center' }} title="PK / FK 구분 (클릭하여 PK·FK 설정 · 드래그하여 순서 변경)">
       구분
      </th>
      <th style={{ width: 140 }}>속성명</th>
      <th style={{ width: 145 }}>칼럼명</th>
      <th style={{ width: 135 }}>데이터타입</th>
      <th style={{ width: 100 }}>기본값</th>
      <th style={{ width: 72, textAlign: 'center' }}>자동증가</th>
      <th style={{ width: 72, textAlign: 'center' }}>NOT NULL</th>
      <th style={{ width: 72, textAlign: 'center' }}>UQ</th>
      <th style={{ minWidth: 260 }}>설명</th>
      <th style={{ width: 38, textAlign: 'center' }}>
       <span className={s.srOnly}>삭제</span>
      </th>
     </tr>
    </thead>
    <tbody>
     {sortedColumns.map((c, i) => {
      const label = `${table.name || '새 테이블'} 컬럼 ${i + 1}`;
      const change = (patch: Partial<DbColumn>) => actions.changeColumn(table.id, c.id, patch);

      return (
       <tr
        key={c.id}
        draggable={Boolean(actions.reorderColumn)}
        data-dragging={draggingColId === c.id}
        data-drag-over={dragOverColId === c.id}
        onDragStart={e => {
         e.dataTransfer.setData('text/plain', `${table.id}:${c.id}`);
         e.dataTransfer.effectAllowed = 'move';
         setDraggingColId(c.id);
        }}
        onDragOver={e => {
         e.preventDefault();
         e.dataTransfer.dropEffect = 'move';
         if (dragOverColId !== c.id) setDragOverColId(c.id);
        }}
        onDragLeave={() => {
         if (dragOverColId === c.id) setDragOverColId(null);
        }}
        onDrop={e => {
         e.preventDefault();
         setDraggingColId(null);
         setDragOverColId(null);
         const data = e.dataTransfer.getData('text/plain');
         if (!data) return;
         const [sourceTableId, sourceColId] = data.split(':');
         if (sourceTableId === table.id && sourceColId && sourceColId !== c.id) {
          actions.reorderColumn?.(table.id, sourceColId, c.id);
         }
        }}
        onDragEnd={() => {
         setDraggingColId(null);
         setDragOverColId(null);
        }}
       >
        <td className={s.specKeyCell} title="드래그하여 순서 변경 · 클릭하여 PK / FK 설정">
         <DatabaseKeyCellSelect
          schema={schema}
          table={table}
          column={c}
          rowLabel={label}
          actions={actions}
         />
        </td>
        <td>
         <TableTextInput
          aria-label={`${label} 속성명`}
          value={c.logicalName ?? ''}
          maxLength={100}
          placeholder={i === 0 ? '예: 회원 ID' : i === 1 ? '예: 이메일' : '속성명'}
          onCommit={logicalName => change({ logicalName })}
         />
        </td>
        <td>
         <TableTextInput
          aria-label={`${label} 이름`}
          value={c.name}
          maxLength={100}
          placeholder={i === 0 ? '예: id' : i === 1 ? '예: email' : '칼럼명'}
          onCommit={name => change({ name })}
         />
        </td>
        <td>
         <TableTextInput
          aria-label={`${label} 자료형`}
          list={listId}
          value={c.dataType}
          maxLength={100}
          placeholder={i === 0 ? '예: BIGINT' : i === 1 ? '예: VARCHAR(255)' : '데이터타입'}
          onCommit={dataType => change({ dataType })}
         />
        </td>
        <td>
         <TableTextInput
          aria-label={`${label} 기본값`}
          value={c.defaultValue ?? ''}
          maxLength={100}
          placeholder={i === 0 ? '예: 0' : '기본값'}
          onCommit={defaultValue => change({ defaultValue })}
         />
        </td>
        <td className={s.checkCell}>
         <input
          type="checkbox"
          aria-label={`${label} 자동증가`}
          title="자동증가 (AUTO_INCREMENT)"
          checked={Boolean(c.autoIncrement)}
          onChange={e => change({ autoIncrement: e.target.checked })}
         />
        </td>
        <td className={s.checkCell}>
         <input
          type="checkbox"
          aria-label={`${label} NOT NULL`}
          title="NOT NULL (필수 값)"
          checked={!c.nullable}
          disabled={c.primaryKey}
          onChange={e => change({ nullable: !e.target.checked })}
         />
        </td>
        <td className={s.checkCell}>
         <input
          type="checkbox"
          aria-label={`${label} UNIQUE`}
          title="UQ (Unique 고유 키)"
          checked={c.unique}
          onChange={e => change({ unique: e.target.checked })}
         />
        </td>
        <td>
         <TableTextInput
          aria-label={`${label} 설명`}
          value={c.description}
          maxLength={500}
          placeholder={i === 0 ? '예: 회원 고유 식별자 PK' : '설명'}
          onCommit={description => change({ description })}
          onKeyDown={e => {
           if (e.key === 'Enter' && i === sortedColumns.length - 1 && sortedColumns.length < 50) {
            e.preventDefault();
            actions.addColumn(table.id);
           }
          }}
         />
        </td>
        <td className={s.deleteCell}>
         <button
          type="button"
          className={s.rowDelete}
          aria-label={`${label} 삭제`}
          title="이 컬럼 삭제"
          disabled={table.columns.length <= 1}
          onClick={() => actions.removeColumn(table.id, c.id)}
         >
          ×
         </button>
        </td>
       </tr>
      );
     })}
    </tbody>
   </table>
  </div>
 );
}

export function DatabaseRelationControls({
 schema,
 table,
 actions,
}: {
 schema: DatabaseSchema;
 table: DbTable;
 actions: DatabaseEditActions;
}) {
 return (
  <div className={s.inlineRelations}>
   {table.columns
    .filter(c => c.reference)
    .map(c => {
     const relation = relationCardinality(table, c);
     const target = schema.tables.find(t => t.id === c.reference!.tableId);
     const targetColumn = target?.columns.find(k => k.id === c.reference!.columnId);
     const change = (patch: Partial<DbColumn>) => actions.changeColumn(table.id, c.id, patch);
     const refChange = (patch: Partial<DbReference>) =>
      change({ reference: { ...c.reference!, ...patch } });
     return (
      <details key={c.id}>
       <summary>
        {c.name || '새 컬럼'} → {target?.name}.{targetColumn?.name}{' '}
        <span>관계선 설정 · {relation.many ? '1:N' : '1:1'}</span>
       </summary>
       <div className={s.relationFields}>
        <DatabaseNotationPicker
         label={`${table.name}.${c.name} 관계선 표기법`}
         value={relation.notation}
         onChange={notation => refChange({ notation })}
        />
        <DatabaseRelationShapePicker
         label={`${table.name}.${c.name} 관계선 모양`}
         notation={relation.notation}
         value={relation}
         onChange={shape => {
          if (actions.changeRelationShape) {
           actions.changeRelationShape(
            table.id,
            c.id,
            shape,
            relation.notation === 'CHEN' ? 'CHEN' : 'IE'
           );
           return;
          }
          const next = changeDbRelationShape(
           schema,
           table.id,
           c.id,
           shape,
           relation.notation === 'CHEN' ? 'CHEN' : 'IE'
          );
          const updated = next.tables
           .find(t => t.id === table.id)!
           .columns.find(k => k.id === c.id)!;
          change({
           primaryKey: updated.primaryKey,
           unique: updated.unique,
           nullable: updated.nullable,
           reference: updated.reference,
          });
         }}
        />
       </div>
      </details>
     );
    })}
  </div>
 );
}

export function DatabaseTableFooter({
 schema,
 table,
 actions,
}: {
 schema: DatabaseSchema;
 table: DbTable;
 actions: DatabaseEditActions;
}) {
 const full = table.columns.length >= 50;
 return (
  <>
   <div className={s.tableFooter}>
    <button type="button" disabled={full} onClick={() => actions.addColumn(table.id)}>
     ＋ 컬럼 추가
    </button>
    <div className={s.presetButtons} role="group" aria-label="자주 쓰는 컬럼 빠른 추가">
     <button
      type="button"
      className={s.presetChip}
      disabled={full}
      onClick={() => actions.addColumn(table.id, 'id')}
     >
      + id (PK)
     </button>
     <button
      type="button"
      className={s.presetChip}
      disabled={full}
      onClick={() => actions.addColumn(table.id, 'created_at')}
     >
      + created_at
     </button>
     <button
      type="button"
      className={s.presetChip}
      disabled={full}
      onClick={() => actions.addColumn(table.id, 'updated_at')}
     >
      + updated_at
     </button>
    </div>
    <span>{table.columns.length}/50</span>
   </div>
   <DatabaseRelationControls schema={schema} table={table} actions={actions} />
  </>
 );
}

export function DatabaseSelectedRelationBar({
 schema,
 sourceTableId,
 sourceColumnId,
 actions,
 onClose,
 onResetBend,
 hasCustomBend,
}: {
 schema: DatabaseSchema;
 sourceTableId: string;
 sourceColumnId: string;
 actions?: DatabaseEditActions;
 onClose: () => void;
 onResetBend?: () => void;
 hasCustomBend?: boolean;
}) {
 const fkTable = schema.tables.find(t => t.id === sourceTableId);
 const fkCol = fkTable?.columns.find(c => c.id === sourceColumnId);
 if (!fkTable || !fkCol || !fkCol.reference) return null;

 const pkTable = schema.tables.find(t => t.id === fkCol.reference!.tableId);
 const pkCol = pkTable?.columns.find(c => c.id === fkCol.reference!.columnId);
 const relation = relationCardinality(fkTable, fkCol);
 const currentNotation = relation.notation === 'CHEN' ? 'CHEN' : 'IE';

 if (!actions) {
  return (
   <div className={s.relationFocus} role="status">
    <strong>
     {pkTable?.name || '새 테이블'}.{pkCol?.name || '새 컬럼'} → {fkTable.name || '새 테이블'}.
     {fkCol.name || '새 컬럼'}
    </strong>
    <span className={s.relationBadge}>
     {relation.targetRequired ? '1' : '0..1'} : {relation.sourceRequired ? '1' : '0'}..
     {relation.many ? 'N' : '1'}
    </span>
    <button type="button" onClick={onClose}>
     선택 해제
    </button>
   </div>
  );
 }

 const applyShape = (shape: DbRelationShape, nextNotation: 'IE' | 'CHEN' = currentNotation) => {
  if (actions.changeRelationShape) {
   actions.changeRelationShape(fkTable.id, fkCol.id, shape, nextNotation);
   return;
  }
  const next = changeDbRelationShape(schema, fkTable.id, fkCol.id, shape, nextNotation);
  const updated = next.tables
   .find(t => t.id === fkTable.id)!
   .columns.find(k => k.id === fkCol.id)!;
  actions.changeColumn(fkTable.id, fkCol.id, {
   primaryKey: updated.primaryKey,
   unique: updated.unique,
   nullable: updated.nullable,
   reference: updated.reference,
  });
 };

 return (
  <div className={s.relationEditorPanel} role="region" aria-label="선택한 관계선 종류 및 기호 편집">
   <div className={s.relationEditorTop}>
    <div className={s.relationEditorTitle}>
     <span className={s.badgePk}>1쪽 기준</span>
     <strong>
      {pkTable?.name || '새 테이블'}.{pkCol?.name || '새 컬럼'}
     </strong>
     <span className={s.relationArrowText}>──→</span>
     <span className={s.badgeFk}>{relation.many ? 'N쪽 (FK)' : '1쪽 (FK)'}</span>
     <strong>
      {fkTable.name || '새 테이블'}.{fkCol.name || '새 컬럼'}
     </strong>
    </div>

    <div className={s.relationEditorActions}>
     <div className={s.notationSwitch} role="group" aria-label="관계선 표기법 선택">
      <button
       type="button"
       aria-pressed={currentNotation === 'IE'}
       onClick={() => applyShape(relation, 'IE')}
      >
       IE (까마귀발)
      </button>
      <button
       type="button"
       aria-pressed={currentNotation === 'CHEN'}
       onClick={() => applyShape(relation, 'CHEN')}
      >
       피터 첸 (1:N)
      </button>
     </div>

     {onResetBend && hasCustomBend && (
      <button
       type="button"
       className={s.bendResetBtn}
       title="드래그로 수정한 꺾임 위치를 기본 자동 배치로 복원합니다"
       onClick={onResetBend}
      >
       선 꺾임 초기화
      </button>
     )}

     {actions.reverseRelation && (
      <button
       type="button"
       title="기준(1) 컬럼과 참조(FK) 컬럼의 방향을 서로 바꿉니다"
       onClick={() => actions.reverseRelation?.(fkTable.id, fkCol.id)}
      >
       ⇄ 방향 반전
      </button>
     )}

     {actions.disconnectColumn && (
      <button
       type="button"
       className={s.relationDeleteBtn}
       onClick={() => {
        actions.disconnectColumn?.(fkTable.id, fkCol.id);
        onClose();
       }}
      >
       관계선 삭제
      </button>
     )}

     <button type="button" onClick={onClose} aria-label="관계선 편집 닫기">
      닫기 ×
     </button>
    </div>
   </div>

   <div className={s.relationShapeRow}>
    <span className={s.relationShapeHint}>선 모양(기수성) 클릭 시 즉시 변경:</span>
    <DatabaseRelationShapePicker
     label={`${fkTable.name || '새 테이블'}.${fkCol.name || '새 컬럼'} 관계선 모양`}
     notation={currentNotation}
     value={relation}
     onChange={shape => applyShape(shape, currentNotation)}
    />
   </div>
  </div>
 );
}
