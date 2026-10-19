"use client";
import { memo, useState, type CSSProperties } from 'react';
import {
 DB_TABLE_COLORS,
 sortDbColumns,
 type DatabaseSchema,
} from '../database-schema';
import s from './database-schema.module.css';

export interface DatabaseSpecificationsProps {
 schema: DatabaseSchema;
 referenceSchema?: DatabaseSchema;
 onExpand?: () => void;
 onClose?: () => void;
 hideNav?: boolean;
 collapsedIds?: Set<string>;
 onToggleCollapse?: (id: string) => void;
 initiallyCollapsed?: boolean;
}

export const DatabaseSpecifications = memo(function DatabaseSpecifications({
 schema,
 referenceSchema = schema,
 onClose,
 hideNav = false,
 collapsedIds: controlledCollapsedIds,
 onToggleCollapse,
 initiallyCollapsed = true,
}: DatabaseSpecificationsProps) {
 const [localCollapsedIds, setLocalCollapsedIds] = useState<Set<string>>(
  () => new Set(initiallyCollapsed ? schema.tables.map(table => table.id) : [])
 );
 const collapsedIds = controlledCollapsedIds ?? localCollapsedIds;
 const isCollapseControlled = controlledCollapsedIds !== undefined;

 const toggleCollapse = (tableId: string) => {
  if (onToggleCollapse) {
   onToggleCollapse(tableId);
   return;
  }
  setLocalCollapsedIds(prev => {
   const next = new Set(prev);
   if (next.has(tableId)) next.delete(tableId);
   else next.add(tableId);
   return next;
  });
 };

 const toggleAll = () => {
  const allCollapsed =
   schema.tables.length > 0 && schema.tables.every(table => collapsedIds.has(table.id));
  if (isCollapseControlled) {
   if (!onToggleCollapse) return;
   for (const table of schema.tables) {
    if (collapsedIds.has(table.id) === allCollapsed) onToggleCollapse(table.id);
   }
   return;
  }
  setLocalCollapsedIds(
   allCollapsed ? new Set() : new Set(schema.tables.map(table => table.id))
  );
 };

 return (
  <div className={s.specifications}>
   {!hideNav && schema.tables.length > 1 && (
    <div className={s.specTopActions}>
     <button
      type="button"
      className={s.specNavToggleAll}
      onClick={toggleAll}
     >
      {schema.tables.length > 0 && schema.tables.every(table => collapsedIds.has(table.id))
       ? '모두 펼치기'
       : '모두 접기'}
     </button>
    </div>
   )}

   {schema.tables.map((t, idx) => {
    const color = DB_TABLE_COLORS[idx % DB_TABLE_COLORS.length];
    const isCollapsed = collapsedIds.has(t.id);
    const sorted = sortDbColumns(t.columns);
    const pkCol = t.columns.find(c => c.primaryKey);

    return (
     <section
      key={t.id}
      id={`spec-view-${t.id}`}
      aria-label={`${t.name} 테이블 명세`}
      style={{ '--table-color': color } as CSSProperties}
     >
      <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
       <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span className={s.tableIndexBadge}>{String(idx + 1).padStart(2, '0')}</span>
        <span>{t.name}</span>
        <span className={s.tableColCountBadge}>칼럼 {t.columns.length}개</span>
       </span>
       <div className={s.specHeaderActions}>
        <button
         type="button"
         className={s.specCollapseBtn}
         aria-expanded={!isCollapsed}
         title={isCollapsed ? '테이블 펼치기' : '테이블 접기'}
         onClick={() => toggleCollapse(t.id)}
        >
         {isCollapsed ? '펼치기 ▼' : '접기 ▲'}
        </button>
        {onClose && (
         <button
          type="button"
          className={s.specCloseBtn}
          aria-label="상세 닫기"
          title="상세 닫기"
          onClick={onClose}
         >
          ✕
         </button>
        )}
       </div>
      </h3>
      {t.description && !isCollapsed && <p>{t.description}</p>}

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
         <strong>{t.name}</strong>
         {t.description && <span>· {t.description}</span>}
         <span>
          (칼럼 {t.columns.length}개{pkCol ? ` · PK ${pkCol.name || 'id'}` : ''})
         </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>클릭하여 명세 펼치기</span>
       </div>
      ) : (
       <div className={s.specScroll} tabIndex={0}>
        <table>
         <caption>{t.name} 컬럼 명세</caption>
         <thead>
          <tr>
           <th style={{ width: 46, textAlign: 'center' }}>구분</th>
           <th style={{ width: 140 }}>속성명</th>
           <th style={{ width: 145 }}>칼럼명</th>
           <th style={{ width: 135 }}>데이터타입</th>
           <th style={{ width: 100 }}>기본값</th>
           <th style={{ width: 72, textAlign: 'center' }}>자동증가</th>
           <th style={{ width: 72, textAlign: 'center' }}>NOT NULL</th>
           <th style={{ width: 72, textAlign: 'center' }}>UQ</th>
           <th style={{ minWidth: 260 }}>설명</th>
          </tr>
         </thead>
         <tbody>
          {sorted.map(c => {
           const target = referenceSchema.tables.find(
            tbl => tbl.id === c.reference?.tableId
           );
           const col = target?.columns.find(k => k.id === c.reference?.columnId);
           const keyText = c.primaryKey ? 'PK' : c.reference ? 'FK' : '';
           return (
            <tr key={c.id}>
             <td
              style={{ textAlign: 'center', fontWeight: 700 }}
              title={target && col ? `참조: ${target.name}.${col.name}` : undefined}
             >
              {keyText}
             </td>
             <td>{c.logicalName || '-'}</td>
             <th scope="row">{c.name}</th>
             <td>{c.dataType}</td>
             <td>{c.defaultValue ?? ''}</td>
             <td style={{ textAlign: 'center' }}>{c.autoIncrement ? '✓' : ''}</td>
             <td style={{ textAlign: 'center' }}>{!c.nullable ? '✓' : ''}</td>
             <td style={{ textAlign: 'center' }}>{c.unique ? '✓' : ''}</td>
             <td>{c.description}</td>
            </tr>
           );
          })}
         </tbody>
        </table>
       </div>
      )}
     </section>
    );
   })}
  </div>
 );
});
