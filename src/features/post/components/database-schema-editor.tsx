"use client";
import { useId, useRef, useState } from 'react';
import {
 autoLayoutDbTables,
 moveDbColumnOrder,
 newDbPresetColumn,
 newDbTable,
 parseDatabaseSchema,
 removeDbColumn,
 removeDbTable,
 reorderDbColumns,
 sortDbColumns,
 updateDbColumn,
 type DatabaseSchema,
 type DbColumnPreset,
 type DbReference,
 DB_TABLE_COLORS,
} from '../database-schema';
import {
 changeDbRelationShape,
 connectDbColumnToTable,
 disconnectDbColumn,
 reverseDbRelation,
 smartConnectDbColumns,
 type DbRelationShape,
} from '../database-relationship-choice';
import { DatabaseDiagram } from './database-schema-block';
import {
 DatabaseColumnTable,
 DatabaseTableFooter,
 type DatabaseEditActions,
} from './database-edit-table';
import { TableTextInput } from './inline-block-views';
import s from './database-schema.module.css';

export function DatabaseSchemaEditor({
 value,
 onChange,
 initialTab = 'ERD',
}: {
 value: DatabaseSchema;
 initialTab?: 'ERD' | 'SPEC';
 onChange: (schema: DatabaseSchema) => void;
}) {
 const schema = value;
 const id = useId();
 const [tab, setTab] = useState<'ERD' | 'SPEC'>(initialTab);
 const [connecting, setConnecting] = useState(false);
 const [from, setFrom] = useState<DbReference | null>(null);
 const [message, setMessage] = useState('');
 const [selectedTable, setSelectedTable] = useState<string | null>(null);
 const [selectedRelationId, setSelectedRelationId] = useState<string | null>(null);
 const [collapsedTableIds, setCollapsedTableIds] = useState<Set<string>>(() => new Set(schema.tables.map(t => t.id)));

 const toggleCollapse = (tableId: string) => {
  setCollapsedTableIds(prev => {
   const next = new Set(prev);
   if (next.has(tableId)) next.delete(tableId);
   else next.add(tableId);
   return next;
  });
 };
 const notation: 'IE' | 'CHEN' = 'IE';
 const shape: DbRelationShape = {
  many: true,
  targetRequired: true,
  sourceRequired: false,
 };

 const pastRef = useRef<DatabaseSchema[]>([]);
 const futureRef = useRef<DatabaseSchema[]>([]);
 const [, forceHistoryRender] = useState(0);

 let error = '';
 try {
  parseDatabaseSchema(schema);
 } catch (e) {
  error = e instanceof Error ? e.message : '입력값을 확인해 주세요.';
 }

 const update = (next: DatabaseSchema, recordHistory = true) => {
  if (recordHistory && JSON.stringify(next) !== JSON.stringify(schema)) {
   pastRef.current = [...pastRef.current.slice(-29), schema];
   futureRef.current = [];
   forceHistoryRender(n => n + 1);
  }
  onChange(next);
 };

 const undo = (redo = false) => {
  if (redo) {
   const next = futureRef.current.at(-1);
   if (!next) return;
   futureRef.current = futureRef.current.slice(0, -1);
   pastRef.current = [...pastRef.current, schema];
   forceHistoryRender(n => n + 1);
   onChange(next);
   return;
  }
  const prev = pastRef.current.at(-1);
  if (!prev) return;
  pastRef.current = pastRef.current.slice(0, -1);
  futureRef.current = [...futureRef.current, schema];
  forceHistoryRender(n => n + 1);
  onChange(prev);
 };

 const finishConnection = (first: DbReference, second: DbReference) => {
  try {
   const res = smartConnectDbColumns(schema, first, second, shape, notation);
   update(res.schema);
   setFrom(null);
   setConnecting(false);
   setSelectedTable(null);
   setMessage('');
  } catch (e) {
   setMessage(e instanceof Error ? e.message : '연결할 컬럼을 확인해 주세요.');
  }
 };

 const handleConnectToTable = (source: DbReference, targetTableId: string) => {
  try {
   const res = connectDbColumnToTable(schema, source, targetTableId, shape, notation);
   update(res.schema);
   setFrom(null);
   setConnecting(false);
   setSelectedTable(null);
   setMessage('');
  } catch (e) {
   setMessage(e instanceof Error ? e.message : '테이블에 관계를 연결할 수 없습니다.');
  }
 };

 const connect = (ref: DbReference) => {
  if (!from) {
   const table = schema.tables.find(t => t.id === ref.tableId);
   const target = table?.columns.find(c => c.id === ref.columnId);
   if (!table || !target) return;
   setConnecting(true);
   setFrom(ref);
   setMessage(
    `${table.name || '새 테이블'}.${target.name || '새 컬럼'} → 연결할 대상 칼럼이나 테이블을 클릭하세요 (Esc 취소)`
   );
   return;
  }
  if (from.tableId === ref.tableId && from.columnId === ref.columnId) {
   setConnecting(false);
   setFrom(null);
   setMessage('');
   return;
  }
  finishConnection(from, ref);
 };

 const actions: DatabaseEditActions = {
  changeTable: (tableId, patch) =>
   update({
    ...schema,
    tables: schema.tables.map(t => (t.id === tableId ? { ...t, ...patch } : t)),
   }),
  changeColumn: (tableId, columnId, patch) =>
   update(updateDbColumn(schema, tableId, columnId, patch)),
  addColumn: (tableId, preset: DbColumnPreset = 'empty') =>
   update({
    ...schema,
    tables: schema.tables.map(t =>
     t.id === tableId && t.columns.length < 50
      ? { ...t, columns: sortDbColumns([...t.columns, newDbPresetColumn(preset, t.columns)]) }
      : t
    ),
   }),
  moveColumn: (tableId, columnId, direction) =>
   update(moveDbColumnOrder(schema, tableId, columnId, direction)),
  reorderColumn: (tableId, sourceColId, targetColId) =>
   update({
    ...schema,
    tables: schema.tables.map(t =>
     t.id === tableId
      ? { ...t, columns: reorderDbColumns(t.columns, sourceColId, targetColId) }
      : t
    ),
   }),
  removeColumn: (tableId, columnId) => {
   update(removeDbColumn(schema, tableId, columnId));
   setFrom(null);
  },
  removeTable: tableId => {
   update(removeDbTable(schema, tableId));
   setFrom(null);
   setSelectedTable(null);
  },
  connect,
  connectPair: finishConnection,
  connectToTable: handleConnectToTable,
  changeRelationShape: (fkTableId, fkColumnId, nextShape, nextNotation) => {
   try {
    update(changeDbRelationShape(schema, fkTableId, fkColumnId, nextShape, nextNotation));
   } catch (e) {
    setMessage(e instanceof Error ? e.message : '관계선 모양을 변경할 수 없습니다.');
   }
  },
  reverseRelation: (fkTableId, fkColumnId) => {
   try {
    const res = reverseDbRelation(schema, fkTableId, fkColumnId);
    if (!res) return;
    update(res.schema);
    setSelectedRelationId(`${res.newFk.tableId}-${res.newFk.columnId}`);
   } catch (e) {
    setMessage(e instanceof Error ? e.message : '관계선 방향을 반전할 수 없습니다.');
   }
  },
  disconnectColumn: (tableId, columnId) => {
   update(disconnectDbColumn(schema, tableId, columnId));
   setSelectedRelationId(null);
  },
  connecting,
  connectingFrom: from,
 };

 return (
  <div
   className={s.editor}
   onKeyDown={event => {
    const target = event.target as HTMLElement;
    if (event.key === 'Escape' && connecting) {
     event.stopPropagation();
     setConnecting(false);
     setFrom(null);
     setMessage('');
     return;
    }
    if (
     !target.closest('input,textarea,select,[contenteditable=true]') &&
     (event.ctrlKey || event.metaKey) &&
     ['z', 'y'].includes(event.key.toLowerCase())
    ) {
     event.preventDefault();
     event.stopPropagation();
     undo(event.shiftKey || event.key.toLowerCase() === 'y');
    }
   }}
  >
   <div className={s.editorHeading}>
    <div className={s.tabs} role="tablist" aria-label="DB 설계 편집 방식">
     <button
      id={`${id}-erd`}
      type="button"
      role="tab"
      aria-selected={tab === 'ERD'}
      aria-controls={`${id}-panel`}
      onClick={() => setTab('ERD')}
     >
      ERD 다이어그램
     </button>
     <button
      id={`${id}-spec`}
      type="button"
      role="tab"
      aria-selected={tab === 'SPEC'}
      aria-controls={`${id}-panel`}
      onClick={() => {
       setTab('SPEC');
       setCollapsedTableIds(new Set(schema.tables.map(t => t.id)));
       setConnecting(false);
       setFrom(null);
      }}
     >
      테이블 명세서 ({schema.tables.length})
     </button>
    </div>

    <button
     type="button"
     className={s.primaryToolbarBtn}
     disabled={schema.tables.length >= 20}
     onClick={() => {
      const idx = schema.tables.length;
      const base = newDbTable(idx);
      const table = {
       ...base,
       position: {
        x: 36 + (idx % 2) * 380,
        y: 36 + Math.floor(idx / 2) * 240,
       },
      };
      update({ ...schema, tables: [...schema.tables, table] });
      setSelectedRelationId(null);
      setSelectedTable(table.id);
     }}
    >
     ＋ 테이블 추가
    </button>

    {tab === 'ERD' && (
     <button type="button" onClick={() => update(autoLayoutDbTables(schema))}>
      자동 배치
     </button>
    )}

    <label>
     본문 표시
     <select
      aria-label="DB 설계 본문 표시"
      value={schema.display}
      onChange={e =>
       update({ ...schema, display: e.target.value as DatabaseSchema['display'] })
      }
     >
      <option value="BOTH">ERD + 테이블 선택 시 상세</option>
      <option value="ERD">ERD만</option>
      <option value="SPEC">명세서만</option>
     </select>
    </label>
   </div>

   <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab === 'ERD' ? 'erd' : 'spec'}`}>
    {tab === 'ERD' ? (
     <DatabaseDiagram
      schema={schema}
      actions={actions}
      statusMessage={message}
      selectedTable={selectedTable}
      selectedRelation={selectedRelationId}
      onSelectRelation={relId => {
       setSelectedRelationId(relId);
       if (relId) setSelectedTable(null);
      }}
      onSelectTable={tableId => {
       setSelectedRelationId(null);
       setSelectedTable(tableId);
      }}
      onClearSelection={() => {
       setSelectedTable(null);
       setSelectedRelationId(null);
      }}
     />
    ) : (
     <div className={s.editSpecifications}>
      {/* 상단 퀵점프 목차 바 */}
      <div className={s.specNav} role="navigation" aria-label="테이블 목차 및 퀵점프">
       <div className={s.specNavScroll}>
        <span className={s.specNavLabel}>목차 ({schema.tables.length})</span>
        {schema.tables.map((t, idx) => {
         const color = DB_TABLE_COLORS[idx % DB_TABLE_COLORS.length];
         const isCollapsed = collapsedTableIds.has(t.id);
         return (
          <button
           key={t.id}
           type="button"
           className={s.specNavChip}
           style={{ '--table-color': color } as React.CSSProperties}
           title={`${t.name || '새 테이블'} 위치로 이동`}
           onClick={() => {
            if (isCollapsed) {
             setCollapsedTableIds(prev => {
              const next = new Set(prev);
              next.delete(t.id);
              return next;
             });
            }
            document.getElementById(`spec-table-${t.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
           }}
          >
           <span className={s.specNavChipNum}>{String(idx + 1).padStart(2, '0')}</span>
           <span className={s.specNavChipName}>{t.name || '새 테이블'}</span>
           <span className={s.specNavChipCount}>{t.columns.length}</span>
          </button>
         );
        })}
       </div>
       <div className={s.specNavActions}>
        {(() => {
         const isAllCollapsed = schema.tables.length > 0 && schema.tables.every(t => collapsedTableIds.has(t.id));
         return (
          <button
           type="button"
           className={s.specNavToggleAll}
           onClick={() => {
            if (isAllCollapsed) {
             setCollapsedTableIds(new Set());
            } else {
             setCollapsedTableIds(new Set(schema.tables.map(t => t.id)));
            }
           }}
          >
           {isAllCollapsed ? '모두 펼치기' : '모두 접기'}
          </button>
         );
        })()}
       </div>
      </div>

      {schema.tables.map((t, i) => {
       const color = DB_TABLE_COLORS[i % DB_TABLE_COLORS.length];
       const isCollapsed = collapsedTableIds.has(t.id);
       const pkCol = t.columns.find(c => c.primaryKey);

       return (
        <section
         key={t.id}
         id={`spec-table-${t.id}`}
         aria-label={`${t.name || '새 테이블'} 테이블 명세 편집`}
         style={{ '--table-color': color } as React.CSSProperties}
        >
         <header className={s.specHeading}>
          <div className={s.specHeadingInputs}>
           <span className={s.tableIndexBadge}>{String(i + 1).padStart(2, '0')}</span>
           <TableTextInput
            aria-label={`테이블 ${i + 1} 이름`}
            className={s.specTableNameInput}
            value={t.name}
            maxLength={100}
            placeholder="테이블명 (예: users)"
            onCommit={name => actions.changeTable(t.id, { name })}
           />
           <TableTextInput
            aria-label={`${t.name || '새 테이블'} 테이블 설명`}
            className={s.specTableDescInput}
            value={t.description}
            maxLength={500}
            placeholder="테이블 설명 (선택)"
            onCommit={description => actions.changeTable(t.id, { description })}
           />
           <span className={s.tableColCountBadge}>칼럼 {t.columns.length}개</span>
          </div>
          <div className={s.specHeadingActions}>
           <button
            type="button"
            className={s.specCollapseBtn}
            aria-expanded={!isCollapsed}
            title={isCollapsed ? '테이블 펼치기' : '테이블 접기'}
            onClick={() => toggleCollapse(t.id)}
           >
            {isCollapsed ? '펼치기 ▼' : '접기 ▲'}
           </button>
           <button
            type="button"
            disabled={schema.tables.length <= 1}
            aria-label={`${t.name || '새 테이블'} 테이블 삭제`}
            onClick={() => actions.removeTable(t.id)}
           >
            테이블 삭제
           </button>
          </div>
         </header>

         {isCollapsed ? (
          <div
           className={s.specCollapsedSummary}
           role="button"
           tabIndex={0}
           onClick={() => toggleCollapse(t.id)}
           onKeyDown={e => e.key === 'Enter' && toggleCollapse(t.id)}
           style={{ cursor: 'pointer' }}
          >
           <div className={s.specCollapsedInfo}>
            <strong>{t.name || '새 테이블'}</strong>
            {t.description && <span>· {t.description}</span>}
            <span>(칼럼 {t.columns.length}개{pkCol ? ` · PK ${pkCol.name || 'id'}` : ''})</span>
           </div>
           <span style={{ fontSize: 11, color: 'var(--muted)' }}>클릭하여 명세 펼치기</span>
          </div>
         ) : (
          <>
           <DatabaseColumnTable schema={schema} table={t} actions={actions} />
           <DatabaseTableFooter schema={schema} table={t} actions={actions} />
          </>
         )}
        </section>
       );
      })}
     </div>
    )}
   </div>
   {error && (
    <p role="alert" className={s.error}>
     {error}
    </p>
   )}
  </div>
 );
}
