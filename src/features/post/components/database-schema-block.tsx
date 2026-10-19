"use client";
import {
 useCallback,
 useEffect,
 useId,
 useLayoutEffect,
 useMemo,
 useRef,
 useState,
 type CSSProperties,
} from 'react';
import {
 COMMON_DB_TYPES,
 getDatabaseContentBounds,
 sortDbColumns,
 type DatabaseSchema,
 type DbReference,
} from '../database-schema';
import { databaseSelectionPositions, databaseMarqueeTables, databaseTableSelection, databaseBendValue } from '../database-selection';
import { diagramZoomScroll } from '../diagram-viewport';
import { architectureZoom } from '../architecture-interaction';
import { databaseLinks, type DbSize } from '../database-relations';
import { RelationshipEndMark } from './database-relation-symbols';
import {
 DatabaseKeyCellSelect,
 DatabaseSelectedRelationBar,
 type DatabaseEditActions,
} from './database-edit-table';
import { TableTextInput } from './inline-block-views';
import { DatabaseSpecifications } from './database-specifications';
import s from './database-schema.module.css';
import { useDiagramFit } from './use-diagram-fit';
import { DiagramLightbox } from './diagram-lightbox';

export { DatabaseSpecifications } from './database-specifications';

function resolveTablePositions(
 rawTables: DatabaseSchema['tables'],
 cardWidth: number,
 sizes: Record<string, DbSize>,
 editable: boolean,
 movingId?: string
): DatabaseSchema['tables'] {
 if (rawTables.length <= 1) return rawTables;

 const sortedIndices = rawTables
  .map((t, idx) => ({ t, idx }))
  .sort((a, b) => a.t.position.x - b.t.position.x);

 const resolved = rawTables.map(t => ({ ...t, position: { ...t.position } }));
 const minGap = 28;

 for (let i = 0; i < sortedIndices.length; i++) {
  const currIdx = sortedIndices[i].idx;
  const curr = resolved[currIdx];
  if (curr.id === movingId) continue;

  const currH =
   sizes[curr.id]?.height ??
   (42 + curr.columns.length * 32 + (editable ? 32 : 0));

  for (let j = 0; j < i; j++) {
   const prevIdx = sortedIndices[j].idx;
   const prev = resolved[prevIdx];
   const prevW = sizes[prev.id]?.width ?? cardWidth;
   const prevH =
    sizes[prev.id]?.height ??
    (42 + prev.columns.length * 32 + (editable ? 32 : 0));

   const vOverlap =
    Math.max(curr.position.y, prev.position.y) <
    Math.min(curr.position.y + currH, prev.position.y + prevH) - 10;

   if (vOverlap) {
    const requiredX = prev.position.x + prevW + minGap;
    if (curr.position.x < requiredX) {
     curr.position.x = requiredX;
    }
   }
  }
 }

 return resolved;
}

export function DatabaseDiagram({
 schema,
 actions,
 statusMessage,
 onSelectTable,
 selectedTable,
 selectedTables,
 onSelectTables,
 selectedRelation,
 onSelectRelation,
 onClearSelection,
 onExpand,
 expanded = false,
}: {
 schema: DatabaseSchema;
 actions?: DatabaseEditActions;
 statusMessage?: string;
 onSelectTable?: (id: string) => void;
 selectedTable?: string | null;
 selectedTables?: string[] | Set<string>;
 onSelectTables?: (ids: string[]) => void;
 selectedRelation?: string | null;
 onSelectRelation?: (id: string | null) => void;
 onClearSelection?: () => void;
 onExpand?: () => void;
 expanded?: boolean;
}) {
 const viewport = useRef<HTMLDivElement>(null);
 const zoomAnchor = useRef<{
  x: number;
  y: number;
  ratio: number;
  left: number;
  top: number;
  padding: number;
  nextPadding: number;
 } | null>(null);
 const panState = useRef<{
  startX: number;
  startY: number;
  scrollLeft: number;
  scrollTop: number;
  active: boolean;
 } | null>(null);
 const [isPanning, setIsPanning] = useState(false);
 const typeListId = useId();
 const [namingMode, setNamingMode] = useState<'physical' | 'logical' | 'both'>(() =>
  schema.tables.some(table => table.columns.some(column => column.logicalName?.trim())) ? 'both' : 'physical'
 );
 const [zoom, setZoom] = useState(1);
 const [movingPositions, setMovingPositions] = useState<Record<string, { x: number; y: number }> | null>(null);
 const [localSelectedTables, setLocalSelectedTables] = useState<Set<string>>(new Set());
 const [editingTitleTableId, setEditingTitleTableId] = useState<string | null>(null);
 const [localRelation, setLocalRelation] = useState<string | null>(null);
 const [hover, setHover] = useState<string | null>(null);
 const [draggingBendId, setDraggingBendId] = useState<string | null>(null);
 const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

 const enterRelationHover = useCallback((id: string) => {
  if (hoverTimeoutRef.current) {
   clearTimeout(hoverTimeoutRef.current);
   hoverTimeoutRef.current = null;
  }
  setHover(id);
 }, []);

 const leaveRelationHover = useCallback((id: string) => {
  if (hoverTimeoutRef.current) {
   clearTimeout(hoverTimeoutRef.current);
  }
  hoverTimeoutRef.current = setTimeout(() => {
   setHover(curr => (curr === id ? null : curr));
  }, 350);
 }, []);

 const [dragPreview, setDragPreview] = useState<{
  from: { x: number; y: number };
  to: { x: number; y: number };
 } | null>(null);
 const [dropTarget, setDropTarget] = useState<{
  tableId: string;
  columnId?: string;
 } | null>(null);

 const relation = selectedRelation !== undefined ? selectedRelation : localRelation;
 const setRelation = useCallback(
  (next: string | null | ((prev: string | null) => string | null)) => {
   const resolved = typeof next === 'function' ? next(relation) : next;
   if (onSelectRelation) onSelectRelation(resolved);
   else setLocalRelation(resolved);
  },
  [onSelectRelation, relation]
 );

 const selectedTableSet = useMemo(() => {
  if (selectedTables) {
   return selectedTables instanceof Set ? selectedTables : new Set(selectedTables);
  }
  if (selectedTable) {
   return new Set([selectedTable]);
  }
  return localSelectedTables;
 }, [selectedTables, selectedTable, localSelectedTables]);

 const setSelectedTablesState = useCallback(
  (next: Set<string> | ((prev: Set<string>) => Set<string>)) => {
   const resolved = typeof next === 'function' ? next(selectedTableSet) : next;
   if (onSelectTables) {
    onSelectTables(Array.from(resolved));
   } else if (onSelectTable) {
    if (resolved.size === 1) {
     onSelectTable(Array.from(resolved)[0]);
    } else if (resolved.size === 0) {
     onClearSelection?.();
    }
   } else {
    setLocalSelectedTables(resolved);
   }
  },
  [selectedTableSet, onSelectTables, onSelectTable, onClearSelection]
 );

 const drag = useRef<{
  primaryId: string;
  targets: { id: string; startX: number; startY: number }[];
  px: number;
  py: number;
  isAdditive: boolean;
  isAlreadySelected: boolean;
  moved: boolean;
 } | null>(null);
 const rafMoveRef = useRef<number | null>(null);
 const pendingMovingPositionsRef = useRef<Record<string, { x: number; y: number }> | null>(null);
 const marqueeDrag = useRef<{
  startX: number;
  startY: number;
  isAdditive: boolean;
  moved: boolean;
 } | null>(null);
 const rafMarqueeRef = useRef<number | null>(null);
 const pendingMarqueeBoxRef = useRef<{
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
 } | null>(null);
 const rafBendRef = useRef<number | null>(null);
 const bendCleanupRef = useRef<(() => void) | null>(null);
 const [marqueeBox, setMarqueeBox] = useState<{
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
 } | null>(null);
 const connectionDrag = useRef<{
  ref: DbReference;
  x: number;
  y: number;
  side: 'left' | 'right';
 } | null>(null);
 const suppressClick = useRef(false);

 useEffect(() => {
  return () => {
   if (rafMoveRef.current !== null) cancelAnimationFrame(rafMoveRef.current);
   if (rafMarqueeRef.current !== null) cancelAnimationFrame(rafMarqueeRef.current);
   if (rafBendRef.current !== null) cancelAnimationFrame(rafBendRef.current);
   bendCleanupRef.current?.();
  };
 }, []);

 const editable = !!actions;
 const defaultCardWidth = namingMode === 'both' ? 440 : 330;
 const cards = useRef(new Map<string, HTMLElement>());
 const [sizes, setSizes] = useState<Record<string, DbSize>>({});
 const [customBends, setCustomBends] = useState<Record<string, { axis: 'x' | 'y'; value: number }>>({});
 const [draggingColId, setDraggingColId] = useState<string | null>(null);
 const [dragOverColId, setDragOverColId] = useState<string | null>(null);
 const [colCenters, setColCenters] = useState<Record<string, number>>({});

 const cardIds = schema.tables.map(t => `${t.id}:${t.columns.length}`).join(',');

 useLayoutEffect(() => {
  const measure = () => {
   const next = Object.fromEntries(
    [...cards.current].map(([id, el]) => [id, { width: el.offsetWidth, height: el.offsetHeight }])
   );
   setSizes(previous =>
    JSON.stringify(previous) === JSON.stringify(next) ? previous : next
   );
   const nextColCenters: Record<string, number> = {};
   cards.current.forEach((cardEl, tableId) => {
    const t = schema.tables.find(tbl => tbl.id === tableId);
    if (!t) return;
    const cardRect = cardEl.getBoundingClientRect();
    const scale = cardEl.offsetWidth ? cardRect.width / cardEl.offsetWidth : 1;
    const rows = cardEl.querySelectorAll<HTMLElement>('[data-db-column]');
    rows.forEach(rowEl => {
     const colId = rowEl.dataset.dbColumn;
     if (colId) {
      const rowRect = rowEl.getBoundingClientRect();
      nextColCenters[`${tableId}-${colId}`] =
       t.position.y + ((rowRect.top - cardRect.top) + rowRect.height / 2) / (scale || 1);
     }
    });
   });
   setColCenters(prev =>
    JSON.stringify(prev) === JSON.stringify(nextColCenters) ? prev : nextColCenters
   );
  };
  measure();
  const observer = new ResizeObserver(measure);
  cards.current.forEach(el => observer.observe(el));
  return () => observer.disconnect();
 }, [cardIds, schema, namingMode]);

 const tables = useMemo(() => {
  const base = schema.tables.map(t => {
   const sorted = sortDbColumns(t.columns);
   const movedPos = movingPositions?.[t.id];
   return movedPos
    ? { ...t, columns: sorted, position: { x: movedPos.x, y: movedPos.y } }
    : { ...t, columns: sorted };
  });
  if (namingMode === 'both' && !movingPositions) {
   return resolveTablePositions(
    base,
    defaultCardWidth,
    sizes,
    editable,
    movingPositions ? Object.keys(movingPositions)[0] : undefined
   );
  }
  return base;
 }, [schema, movingPositions, namingMode, defaultCardWidth, sizes, editable]);
 const links = useMemo(
  () => {
   if (!movingPositions) {
    return databaseLinks({ ...schema, tables }, false, sizes, colCenters, customBends);
   }
   const centers = { ...colCenters };
   for (const [tableId, newPos] of Object.entries(movingPositions)) {
    const original = schema.tables.find(t => t.id === tableId);
    if (original) for (const column of original.columns) {
     const key = `${original.id}-${column.id}`;
     if (centers[key] !== undefined) centers[key] += newPos.y - original.position.y;
    }
   }
   return databaseLinks({ ...schema, tables }, false, sizes, centers, customBends);
  },
  [schema, tables, sizes, colCenters, customBends, movingPositions]
 );
 const currentRelation = links.find(l => l.id === relation);
 const activeRelation = currentRelation;
 const activeTables = selectedTableSet;
 const focused = Boolean(activeRelation || activeTables.size > 0);

 const relevant = (l: (typeof links)[number]) =>
  activeRelation
   ? l.id === activeRelation.id
   : activeTables.size > 0
     ? activeTables.has(l.sourceTableId) || activeTables.has(l.targetTableId)
     : true;
 const relatedTables = new Set(
  links.filter(relevant).flatMap(l => [l.sourceTableId, l.targetTableId])
 );

 const width = Math.max(
  860,
  ...tables.map(t => t.position.x + (sizes[t.id]?.width ?? defaultCardWidth) + 80),
  ...links.flatMap(l => l.points.map(p => p.x + 40))
 );
 const height = Math.max(
  460,
  ...tables.map(
   t => t.position.y + (sizes[t.id]?.height ?? 42 + t.columns.length * 32 + (editable ? 32 : 0)) + 80
  ),
  ...links.flatMap(l => l.points.map(p => p.y + 40))
 );
 const fitted = useDiagramFit(viewport, width, height, expanded, !editable);
 const [userZoom, setUserZoom] = useState<number | null>(null);
 const viewScale = userZoom !== null ? userZoom : (editable ? zoom : fitted);
 const canvasPadding = !editable && (userZoom !== null || expanded) ? 48 : 0;

 const fitToView = useCallback(() => {
  const el = viewport.current;
  if (!el || !tables.length) {
   if (editable) setZoom(1);
   else setUserZoom(null);
   return;
  }
  const bounds = getDatabaseContentBounds({ ...schema, tables }, sizes, defaultCardWidth);
  const pad = editable ? 64 : 96;
  const availW = Math.max(320, el.clientWidth - pad);
  const availH = Math.max(240, el.clientHeight - pad);
  const scale = Math.min(1.25, Math.max(0.45, Math.min(availW / bounds.width, availH / bounds.height)));
  const rounded = Math.round(scale * 20) / 20;
  if (editable) setZoom(rounded);
  else setUserZoom(rounded);
  requestAnimationFrame(() => {
   const padding = editable ? 0 : 48;
   const targetLeft = Math.max(0, (bounds.minX + bounds.width / 2) * rounded + padding - el.clientWidth / 2);
   const targetTop = Math.max(0, (bounds.minY + bounds.height / 2) * rounded + padding - el.clientHeight / 2);
   el.scrollTo({ left: targetLeft, top: targetTop, behavior: 'smooth' });
  });
 }, [schema, tables, sizes, editable]);

 // Architecture-style Ctrl/Cmd + Wheel zoom with cursor anchor
 useEffect(() => {
  const el = viewport.current;
  if (!el) return;
  const onWheel = (event: WheelEvent) => {
   if (!(event.ctrlKey || event.metaKey)) return;
   event.preventDefault();
   const delta =
    event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el.clientHeight : 1);
   const current = viewScale;
   const next = architectureZoom(current, delta);
   const rect = el.getBoundingClientRect();
   zoomAnchor.current = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    ratio: next / current,
    left: el.scrollLeft,
    top: el.scrollTop,
    padding: canvasPadding,
    nextPadding: editable ? 0 : 48,
   };
   if (editable) {
    setZoom(next);
   } else {
    setUserZoom(next);
   }
  };
  el.addEventListener('wheel', onWheel, { passive: false, capture: true });
  return () => el.removeEventListener('wheel', onWheel, { capture: true });
 }, [editable, viewScale, canvasPadding]);

 useLayoutEffect(() => {
  const anchor = zoomAnchor.current;
  const el = viewport.current;
  if (anchor && el) {
   el.scrollLeft = diagramZoomScroll(anchor.left, anchor.x, anchor.ratio, anchor.padding, anchor.nextPadding);
   el.scrollTop = diagramZoomScroll(anchor.top, anchor.y, anchor.ratio, anchor.padding, anchor.nextPadding);
   zoomAnchor.current = null;
  }
 }, [viewScale]);

 const clear = useCallback(() => {
  // Flush a composing title before removing its input from the tree.
  const active = document.activeElement as HTMLElement | null;
  if (active?.closest(`.${s.cardHeading}`)) active.blur();
  if (hoverTimeoutRef.current) {
   clearTimeout(hoverTimeoutRef.current);
   hoverTimeoutRef.current = null;
  }
  setRelation(null);
  setLocalSelectedTables(new Set());
  setEditingTitleTableId(null);
  setHover(null);
  setSelectedTablesState(new Set());
  onClearSelection?.();
 }, [setRelation, setSelectedTablesState, onClearSelection]);

 // ERD를 눌러 연결된 테이블끼리 강조될 때 또는 제목 편집 중일 때 화면의 빈 공간 클릭 시 강조/선택 해제
 useEffect(() => {
  if (!focused && !editingTitleTableId) return;
  const handleGlobalPointerDown = (event: PointerEvent) => {
   const target = event.target as HTMLElement | null;
   if (!target || viewport.current?.contains(target)) return;
   if (
    target.closest(
     'article[data-table-id], [data-relation-id], button, input, select, textarea, .bendHandleGroup, [class*="selectedSpecification"]'
    )
   ) {
    return;
   }
   clear();
  };
  window.addEventListener('pointerdown', handleGlobalPointerDown, { capture: true });
  return () => window.removeEventListener('pointerdown', handleGlobalPointerDown, { capture: true });
 }, [focused, editingTitleTableId, clear]);

 const selectRelation = (id: string) => {
  const next = relation === id ? null : id;
  setSelectedTablesState(new Set());
  setRelation(next);
  setHover(null);
 };

 const bendDragRef = useRef<{
  relId: string;
  axis: 'x' | 'y';
  startCoord: number;
  startVal: number;
  min: number;
  max: number;
 } | null>(null);

 const handleBendPointerDown = useCallback(
  (e: React.PointerEvent, link: (typeof links)[number]) => {
   if (!editable || !link.bend || e.button !== 0) return;
   bendCleanupRef.current?.();
   if (rafBendRef.current !== null) {
    cancelAnimationFrame(rafBendRef.current);
    rafBendRef.current = null;
   }
   e.preventDefault();
   e.stopPropagation();

   if (hoverTimeoutRef.current) {
    clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = null;
   }
   setDraggingBendId(link.id);

   const d = {
    relId: link.id,
    pointerId: e.pointerId,
    axis: link.bend.axis,
    startCoord: link.bend.axis === 'x' ? e.clientX : e.clientY,
    startVal: link.bend.value,
    min: link.bend.min,
    max: link.bend.max,
   };
   bendDragRef.current = d;
   let latestClamped = d.startVal;

   const onPointerMove = (ev: PointerEvent) => {
    if (ev.pointerId !== d.pointerId) return;
    ev.preventDefault();
    latestClamped = databaseBendValue(d, ev, viewScale);
    if (rafBendRef.current === null) {
     rafBendRef.current = requestAnimationFrame(() => {
      rafBendRef.current = null;
      if (!bendDragRef.current) return;
      const clamped = latestClamped;
      setCustomBends(prev => {
       const curr = prev[d.relId];
       if (curr && curr.axis === d.axis && curr.value === clamped) return prev;
       return { ...prev, [d.relId]: { axis: d.axis, value: clamped } };
      });
     });
    }
   };

   const onPointerUp = (ev: PointerEvent) => {
    if (ev.pointerId !== d.pointerId) return;
    ev.preventDefault();
    bendCleanupRef.current?.();
    if (ev.type !== 'pointercancel') latestClamped = databaseBendValue(d, ev, viewScale);
    if (rafBendRef.current !== null) {
     cancelAnimationFrame(rafBendRef.current);
     rafBendRef.current = null;
    }
    const clamped = latestClamped;
    setCustomBends(prev => {
     const curr = prev[d.relId];
     if (curr && curr.axis === d.axis && curr.value === clamped) return prev;
     return { ...prev, [d.relId]: { axis: d.axis, value: clamped } };
    });
    bendDragRef.current = null;
    setDraggingBendId(null);
   };

   bendCleanupRef.current = () => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    bendCleanupRef.current = null;
   };
   window.addEventListener('pointermove', onPointerMove);
   window.addEventListener('pointerup', onPointerUp);
   window.addEventListener('pointercancel', onPointerUp);
  },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [editable, viewScale]
 );

 const handleResetBend = useCallback((relId: string) => {
  setCustomBends(prev => {
   if (prev[relId] === undefined) return prev;
   const next = { ...prev };
   delete next[relId];
   return next;
  });
 }, []);

 const selectTable = (id: string, isAdditive = false) => {
  setRelation(null);
  setHover(null);
  setSelectedTablesState(prev=>databaseTableSelection(prev,id,isAdditive));
 };

 const startConnectionDrag = (
  event: React.PointerEvent<HTMLButtonElement>,
  tableId: string,
  columnId: string,
  side: 'left' | 'right'
 ) => {
  event.stopPropagation();
  connectionDrag.current = {
   ref: { tableId, columnId },
   x: event.clientX,
   y: event.clientY,
   side,
  };
  event.currentTarget.setPointerCapture(event.pointerId);
 };

 const moveConnectionDrag = (
  event: React.PointerEvent<HTMLButtonElement>,
  table: DatabaseSchema['tables'][number],
  colId: string,
  colIndex: number
 ) => {
  const d = connectionDrag.current;
  const view = viewport.current;
  if (!d || !view || Math.hypot(event.clientX - d.x, event.clientY - d.y) < 5) return;
  const box = view.getBoundingClientRect();
  const currentCardW = sizes[table.id]?.width ?? defaultCardWidth;
  const fromX = d.side === 'left' ? table.position.x : table.position.x + currentCardW;
  const fromY =
   colCenters[`${table.id}-${colId}`] ?? table.position.y + 42 + (colIndex + 0.5) * 32;
  const toX = (event.clientX - box.left + view.scrollLeft) / viewScale;
  const toY = (event.clientY - box.top + view.scrollTop) / viewScale;
  setDragPreview({ from: { x: fromX, y: fromY }, to: { x: toX, y: toY } });

  const hitEl = document.elementFromPoint(event.clientX, event.clientY);
  const row = hitEl?.closest<HTMLElement>('[data-db-table][data-db-column]');
  if (row?.dataset.dbTable && row.dataset.dbColumn) {
   if (row.dataset.dbTable !== d.ref.tableId || row.dataset.dbColumn !== d.ref.columnId) {
    setDropTarget({ tableId: row.dataset.dbTable, columnId: row.dataset.dbColumn });
    return;
   }
  }
  const cardEl = hitEl?.closest<HTMLElement>('article[data-table-id]');
  if (cardEl?.dataset.tableId && cardEl.dataset.tableId !== d.ref.tableId) {
   setDropTarget({ tableId: cardEl.dataset.tableId });
   return;
  }
  setDropTarget(null);
 };

 const endConnectionDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
  const d = connectionDrag.current;
  connectionDrag.current = null;
  setDragPreview(null);
  setDropTarget(null);
  if (!d || !actions) return;
  if (Math.hypot(event.clientX - d.x, event.clientY - d.y) < 6) {
   suppressClick.current = true;
   actions.connect?.({ tableId: d.ref.tableId, columnId: d.ref.columnId });
   return;
  }
  suppressClick.current = true;
  const hitEl = document.elementFromPoint(event.clientX, event.clientY);
  const row = hitEl?.closest<HTMLElement>('[data-db-table][data-db-column]');
  if (row?.dataset.dbTable && row.dataset.dbColumn) {
   actions.connectPair?.(d.ref, {
    tableId: row.dataset.dbTable,
    columnId: row.dataset.dbColumn,
   });
   return;
  }
  const cardEl = hitEl?.closest<HTMLElement>('article[data-table-id]');
  if (cardEl?.dataset.tableId && cardEl.dataset.tableId !== d.ref.tableId) {
   actions.connectToTable?.(d.ref, cardEl.dataset.tableId);
  }
 };

 const colors = ['#4770d6', '#7c5cbf', '#2f856e', '#b5742c', '#b84b59', '#3b7a9e'];
 const linkColorMap = useMemo(
  () => new Map(links.map((l, idx) => [l.id, colors[idx % colors.length]])),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [links]
 );

 return (
  <section className={s.diagram} aria-label="ERD 관계도">
   {editable && (
    <datalist id={typeListId}>
     {COMMON_DB_TYPES.map(type => (
      <option key={type} value={type} />
     ))}
    </datalist>
   )}
   <div className={s.zoom}>
    <span>
     테이블 {tables.length} · 관계 {links.length}
    </span>
    {statusMessage ? (
     <span className={s.inlineStatusMsg} role="status">
      {statusMessage}
     </span>
    ) : (editable || expanded) ? (
     <span className={s.inlineHint}>
      {editable
       ? '상단 헤더 드래그로 이동(클릭 시 이름 수정) · 맨 앞 칸 클릭으로 PK·FK 설정 · Ctrl+휠 확대/축소'
       : 'Ctrl+휠로 다이어그램을 확대/축소할 수 있습니다.'}
     </span>
    ) : null}
    <div className={s.notationSwitch} role="group" aria-label="칼럼명 표기 방식">
     <button
      type="button"
      aria-pressed={namingMode === 'physical'}
      onClick={() => setNamingMode('physical')}
      title="물리명 (영문 식별자)만 표시"
     >
      물리명
     </button>
     <button
      type="button"
      aria-pressed={namingMode === 'logical'}
      onClick={() => setNamingMode('logical')}
      title="논리명 (한글 속성명) 표시"
     >
      논리명
     </button>
     <button
      type="button"
      aria-pressed={namingMode === 'both'}
      onClick={() => setNamingMode('both')}
      title="물리명과 논리명 함께 표시"
     >
      둘 다
     </button>
    </div>
    {!editable && !expanded && onExpand && (
     <button
      type="button"
      className={s.diagramExpandBtn}
      aria-label="데이터베이스 확대 보기"
      onClick={onExpand}
      title="데이터베이스 다이어그램 확대"
     >
      확대
     </button>
    )}
    {(editable || expanded || userZoom !== null) ? (
     <>
      <button
       type="button"
       aria-label="ERD 축소"
       disabled={viewScale <= 0.4}
       onClick={() => {
        const next = Math.max(0.4, Math.round((viewScale - 0.1) * 100) / 100);
        const el = viewport.current;
        if (el) {
         const rect = el.getBoundingClientRect();
         zoomAnchor.current = {
          x: rect.width / 2,
          y: rect.height / 2,
          ratio: next / viewScale,
          left: el.scrollLeft,
          top: el.scrollTop,
          padding: canvasPadding,
          nextPadding: editable ? 0 : 48,
         };
        }
        if (editable) setZoom(next);
        else setUserZoom(next);
       }}
      >
       −
      </button>
      <output>{Math.round(viewScale * 100)}%</output>
      <button
       type="button"
       aria-label="ERD 확대"
       disabled={viewScale >= 3}
       onClick={() => {
        const next = Math.min(3, Math.round((viewScale + 0.1) * 100) / 100);
        const el = viewport.current;
        if (el) {
         const rect = el.getBoundingClientRect();
         zoomAnchor.current = {
          x: rect.width / 2,
          y: rect.height / 2,
          ratio: next / viewScale,
          left: el.scrollLeft,
          top: el.scrollTop,
          padding: canvasPadding,
          nextPadding: editable ? 0 : 48,
         };
        }
        if (editable) setZoom(next);
        else setUserZoom(next);
       }}
      >
       ＋
      </button>
      <button
       type="button"
       onClick={() => {
        const el = viewport.current;
        if (el && viewScale !== 1) {
         const rect = el.getBoundingClientRect();
         zoomAnchor.current = {
          x: rect.width / 2,
          y: rect.height / 2,
          ratio: 1 / viewScale,
          left: el.scrollLeft,
          top: el.scrollTop,
          padding: canvasPadding,
          nextPadding: editable ? 0 : 48,
         };
        }
        if (editable) setZoom(1);
        else setUserZoom(1);
       }}
      >
       100%
      </button>
      <button
       type="button"
       onClick={() => {
        if (editable) fitToView();
        else setUserZoom(null);
       }}
       title="모든 테이블이 보이도록 화면에 맞춥니다"
      >
       화면 맞춤
      </button>
     </>
    ) : null}
   </div>

   <div className={s.canvasStage}>
    {editable && currentRelation && (
     <div className={s.floatingRelationOverlay}>
      <DatabaseSelectedRelationBar
       schema={schema}
       sourceTableId={currentRelation.sourceTableId}
       sourceColumnId={currentRelation.sourceColumnId}
       actions={actions}
       onClose={clear}
       onResetBend={() => handleResetBend(currentRelation.id)}
       hasCustomBend={currentRelation.hasCustomBend}
      />
     </div>
    )}

    <div
     ref={viewport}
     className={`${s.viewport}${isPanning ? ` ${s.isPanning}` : ''}`}
     data-preview={!editable}
     data-zoomed={userZoom !== null || viewScale !== fitted}
     data-connecting={Boolean(actions?.connecting || dragPreview)}
     style={{
      touchAction: !editable ? (expanded || userZoom !== null ? 'none' : 'pan-y') : undefined,
      userSelect: !editable ? 'none' : undefined,
     }}
     onPointerDown={event => {
      if (event.pointerType === 'touch' && !expanded && !editable && userZoom === null) return;
      if (event.button !== 0 && event.button !== 1) return;
      const target = event.target as HTMLElement;
      if (target.closest('input,button,select,textarea')) return;
      if (editable && target.closest('article[data-table-id], [data-relation-id], .bendHandleGroup')) return;
      if (!editable && target.closest('article[data-table-id], [data-relation-id], button, input, select')) return;

      const view = viewport.current;
      if (!view) return;

      // If editable and left-click on empty canvas -> Marquee selection!
      if (editable && event.button === 0 && !event.altKey) {
       view.focus({preventScroll:true});
       const active = document.activeElement as HTMLElement | null;
       if (active?.closest(`.${s.cardHeading}`)) active.blur();
       setEditingTitleTableId(null);
       const rect = view.getBoundingClientRect();
       const worldX = (event.clientX - rect.left + view.scrollLeft) / viewScale;
       const worldY = (event.clientY - rect.top + view.scrollTop) / viewScale;
       marqueeDrag.current = {
        startX: worldX,
        startY: worldY,
        isAdditive: event.shiftKey || event.metaKey || event.ctrlKey,
        moved: false,
       };
       try {
        event.currentTarget.setPointerCapture(event.pointerId);
       } catch {}
       return;
      }

      panState.current = {
       startX: event.clientX,
       startY: event.clientY,
       scrollLeft: view.scrollLeft,
       scrollTop: view.scrollTop,
       active: false,
      };
      try {
       event.currentTarget.setPointerCapture(event.pointerId);
      } catch {}
     }}
     onPointerMove={event => {
      const view = viewport.current;
      if (!view) return;

      if (marqueeDrag.current) {
       const rect = view.getBoundingClientRect();
       const worldX = (event.clientX - rect.left + view.scrollLeft) / viewScale;
       const worldY = (event.clientY - rect.top + view.scrollTop) / viewScale;
       const md = marqueeDrag.current;
       if (!md.moved && Math.hypot(worldX - md.startX, worldY - md.startY) > 3) {
        md.moved = true;
       }
       if (md.moved) {
        pendingMarqueeBoxRef.current = {
         minX: Math.min(md.startX, worldX),
         maxX: Math.max(md.startX, worldX),
         minY: Math.min(md.startY, worldY),
         maxY: Math.max(md.startY, worldY),
        };
        if (rafMarqueeRef.current === null) {
         rafMarqueeRef.current = requestAnimationFrame(() => {
          rafMarqueeRef.current = null;
          if (marqueeDrag.current?.moved && pendingMarqueeBoxRef.current) {
           setMarqueeBox(pendingMarqueeBoxRef.current);
          }
         });
        }
       }
       return;
      }

      if (!panState.current) return;
      const dx = event.clientX - panState.current.startX;
      const dy = event.clientY - panState.current.startY;
      if (Math.hypot(dx, dy) > 3) {
       if (!panState.current.active) {
        panState.current.active = true;
        setIsPanning(true);
       }
       view.scrollLeft = panState.current.scrollLeft - dx;
       view.scrollTop = panState.current.scrollTop - dy;
      }
     }}
     onPointerUp={event => {
      if (marqueeDrag.current) {
       const md = marqueeDrag.current;
       marqueeDrag.current = null;
       if (rafMarqueeRef.current !== null) {
        cancelAnimationFrame(rafMarqueeRef.current);
        rafMarqueeRef.current = null;
       }
       pendingMarqueeBoxRef.current = null;
       try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
         event.currentTarget.releasePointerCapture(event.pointerId);
        }
       } catch {}

       if (md.moved && viewport.current) {
        suppressClick.current = true;
        const view=viewport.current;
        const rect=view.getBoundingClientRect();
        const worldX=(event.clientX-rect.left+view.scrollLeft)/viewScale;
        const worldY=(event.clientY-rect.top+view.scrollTop)/viewScale;
        const box={minX:Math.min(md.startX,worldX),maxX:Math.max(md.startX,worldX),minY:Math.min(md.startY,worldY),maxY:Math.max(md.startY,worldY)};
        const selectedIds = databaseMarqueeTables(tables, box, sizes, defaultCardWidth, editable);
        setMarqueeBox(null);
        if (md.isAdditive) {
         const next = new Set(selectedTableSet);
         selectedIds.forEach(id => next.add(id));
         setSelectedTablesState(next);
        } else {
         setSelectedTablesState(new Set(selectedIds));
        }
        return;
       }
       setMarqueeBox(null);
       if (!md.isAdditive) clear();
       suppressClick.current = true;
      }

      if (panState.current) {
       if (panState.current.active) {
        suppressClick.current = true;
       }
       panState.current = null;
       setIsPanning(false);
       try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
         event.currentTarget.releasePointerCapture(event.pointerId);
        }
       } catch {}
      }
     }}
     onPointerCancel={event => {
      if (marqueeDrag.current) {
       marqueeDrag.current = null;
       if (rafMarqueeRef.current !== null) {
        cancelAnimationFrame(rafMarqueeRef.current);
        rafMarqueeRef.current = null;
       }
       pendingMarqueeBoxRef.current = null;
       setMarqueeBox(null);
       try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
         event.currentTarget.releasePointerCapture(event.pointerId);
        }
       } catch {}
      }
      if (panState.current) {
       panState.current = null;
       setIsPanning(false);
       try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
         event.currentTarget.releasePointerCapture(event.pointerId);
        }
       } catch {}
      }
     }}
     onKeyDown={event => {
      const target = event.target as HTMLElement;
      if (target.closest('input,select,textarea')) return;
      if (event.key === 'Escape') {
       clear();
       return;
      }
      if ((event.key === ' ' || event.code === 'Space') && editable && !target.closest('button')) {
       event.preventDefault();
       fitToView();
       return;
      }

      // Arrow keys to move selected tables
      if (
       editable &&
       selectedTableSet.size > 0 &&
       ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
      ) {
       event.preventDefault();
       const delta = event.shiftKey ? 10 : 2;
       const vectors: Record<string, { x: number; y: number }> = {
        ArrowLeft: { x: -delta, y: 0 },
        ArrowRight: { x: delta, y: 0 },
        ArrowUp: { x: 0, y: -delta },
        ArrowDown: { x: 0, y: delta },
       };
       const vec = vectors[event.key];
       if (vec && actions) {
        const positions = databaseSelectionPositions(schema.tables.filter(tbl=>selectedTableSet.has(tbl.id)).map(tbl=>({id:tbl.id,startX:tbl.position.x,startY:tbl.position.y})), vec.x, vec.y);
        actions.changeTables(Object.entries(positions).map(([id,position])=>({id,patch:{position}})));
       }
       return;
      }

      if (
       (event.key === 'Delete' || event.key === 'Backspace') &&
       editable &&
       currentRelation &&
       actions?.disconnectColumn
      ) {
       event.preventDefault();
       actions.disconnectColumn(currentRelation.sourceTableId, currentRelation.sourceColumnId);
       setRelation(null);
       return;
      }

      if (
       (event.key === 'Delete' || event.key === 'Backspace') &&
       editable &&
       selectedTableSet.size > 0 &&
       actions?.removeTables
      ) {
       event.preventDefault();
       const toDelete = Array.from(selectedTableSet);
       if (toDelete.length < schema.tables.length) {
        actions.removeTables(toDelete);
        setSelectedTablesState(new Set());
       }
       return;
      }
     }}
     onClick={event => {
      const target = event.target as HTMLElement;
      if (target.closest('input,button,select,textarea')) return;
      if (suppressClick.current) {
       suppressClick.current = false;
       return;
      }
      if (target.closest('article[data-table-id], [data-relation-id]')) return;
      clear();
      if (!editable && !expanded && onExpand) {
       onExpand();
       return;
      }
     }}
     tabIndex={0}
     aria-label="ERD 스크롤 영역"
    >
     <div
      style={{
       width: width * viewScale,
       height: height * viewScale,
       minWidth: canvasPadding ? 'calc(100% - 96px)' : '100%',
       marginInline: (editable || userZoom !== null || expanded) ? undefined : 'auto',
       padding: canvasPadding || undefined,
       boxSizing: 'content-box',
      }}
     >
      <div className={s.world} style={{ width, height, transform: `scale(${viewScale})` }}>
       <svg width={width} height={height} className={s.lines} aria-label="외래 키 관계선">
        {[...links.filter(l => !relevant(l)), ...links.filter(relevant)].map(l => {
         return (
          <g
           key={l.id}
           className={s.relationLine}
           data-relation-id={l.id}
           data-active={focused && relevant(l)}
           data-selected={relation === l.id}
           data-muted={focused && !relevant(l)}
           style={{ '--relation-color': linkColorMap.get(l.id) ?? colors[0] } as CSSProperties}
           role="button"
           tabIndex={0}
           aria-label={l.label}
           aria-pressed={relation === l.id}
           onPointerEnter={() => enterRelationHover(l.id)}
           onPointerLeave={() => leaveRelationHover(l.id)}
           onClick={event => {
            event.stopPropagation();
            selectRelation(l.id);
           }}
           onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
             event.preventDefault();
             selectRelation(l.id);
            }
           }}
          >
           <title>{`${l.label} (클릭하여 선 종류·기호 변경)`}</title>
           <path className={s.relationHit} d={l.d} />
           <path className={s.relationRoute} d={l.d} />
           <RelationshipEndMark
            x={l.source.x}
            y={l.source.y}
            angle={l.source.angle}
            many={l.many}
            required={l.sourceRequired}
            notation={l.notation}
           />
           <RelationshipEndMark
            x={l.target.x}
            y={l.target.y}
            angle={l.target.angle}
            many={false}
            required={l.targetRequired}
            notation={l.notation}
           />
          </g>
         );
        })}
        {editable && (
         <g className={s.bendHandlesLayer}>
          {links.map((l, index) => {
           if (!l.bend) return null;
           const isHovered = hover === l.id;
           const isSelected = relation === l.id;
           const isDragging = draggingBendId === l.id;
           if (!isHovered && !isSelected && !l.hasCustomBend && !isDragging) return null;
           const color = colors[index % colors.length];
           return (
            <g
             key={`bend-${l.id}`}
             className={s.bendHandleGroup}
             data-axis={l.bend.axis}
             data-dragging={isDragging}
             style={{ '--relation-color': color } as CSSProperties}
             onPointerEnter={() => enterRelationHover(l.id)}
             onPointerLeave={() => leaveRelationHover(l.id)}
             onPointerDown={e => handleBendPointerDown(e, l)}
             onDoubleClick={e => {
              e.stopPropagation();
              handleResetBend(l.id);
             }}
            >
             <title>드래그하여 꺾임 위치 조절 (더블클릭: 자동 정렬로 복원)</title>
             <rect
              x={l.bend.axis === 'x' ? l.bend.mid.x - 12 : l.bend.mid.x - 18}
              y={l.bend.axis === 'x' ? l.bend.mid.y - 18 : l.bend.mid.y - 12}
              width={l.bend.axis === 'x' ? 24 : 36}
              height={l.bend.axis === 'x' ? 36 : 24}
              rx={6}
              className={s.bendHandleHit}
             />
             {l.bend.axis === 'x' ? (
              <rect
               x={l.bend.mid.x - 3.5}
               y={l.bend.mid.y - 12}
               width={7}
               height={24}
               rx={3.5}
               className={s.bendHandlePill}
              />
             ) : (
              <rect
               x={l.bend.mid.x - 12}
               y={l.bend.mid.y - 3.5}
               width={24}
               height={7}
               rx={3.5}
               className={s.bendHandlePill}
              />
             )}
            </g>
           );
          })}
         </g>
        )}
        {dragPreview && (
         <g className={s.dragPreviewGroup}>
          <path
           className={s.dragRelationPreview}
           d={`M${dragPreview.from.x} ${dragPreview.from.y} L${dragPreview.to.x} ${dragPreview.to.y}`}
          />
          <circle cx={dragPreview.from.x} cy={dragPreview.from.y} r={4} />
          <circle cx={dragPreview.to.x} cy={dragPreview.to.y} r={4} />
         </g>
        )}
       </svg>

       {marqueeBox && (
        <div
         className={s.marqueeBox}
         style={{
          left: marqueeBox.minX,
          top: marqueeBox.minY,
          width: marqueeBox.maxX - marqueeBox.minX,
          height: marqueeBox.maxY - marqueeBox.minY,
         }}
        />
       )}

       {tables.map(t => {
        const isDropTable = dropTarget?.tableId === t.id && !dropTarget.columnId;
        const isEditingTitle = editingTitleTableId === t.id;
        const isSelected = selectedTableSet.has(t.id);
        const isMuted = focused && !isSelected && !relatedTables.has(t.id);

        return (
         <article
          key={t.id}
          data-table-id={t.id}
          ref={el => {
           if (el) cards.current.set(t.id, el);
           else cards.current.delete(t.id);
          }}
          className={s.card}
          data-editable={editable}
          data-selected={isSelected}
          data-drop-table={isDropTable}
          data-naming-mode={namingMode}
          data-muted={isMuted}
          style={{ width: defaultCardWidth, left: t.position.x, top: t.position.y }}
          onClick={e => {
           if (actions?.connecting && actions.connectingFrom && actions.connectingFrom.tableId !== t.id) {
            const el = e.target as HTMLElement;
            if (el.closest('input,button,select,textarea')) return;
            actions.connectToTable?.(actions.connectingFrom, t.id);
           } else if (!editable) {
            const el = e.target as HTMLElement;
            if (el.closest('button,input,select,textarea')) return;
            selectTable(t.id);
           }
          }}
         >
          {/* Header: Drag anywhere (including Table Name) to move; click without dragging to edit Table Name */}
          <div
           className={s.cardHeading}
           onPointerDown={
            editable
             ? event => {
                if ((event.target as Element).closest('input,button')) return;
                event.preventDefault();
                event.stopPropagation();
                // Commit the previous title before its input is unmounted on a new selection.
                const active = document.activeElement as HTMLElement | null;
                if (active?.closest(`.${s.cardHeading}`)) active.blur();
                setEditingTitleTableId(null);
                viewport.current?.focus({preventScroll:true});

                const isAdditive = event.shiftKey || event.metaKey || event.ctrlKey;
                const isAlreadySelected = selectedTableSet.has(t.id);

                let nextSelected = new Set(selectedTableSet);
                if (!isAlreadySelected && !isAdditive) {
                 nextSelected = new Set([t.id]);
                 setSelectedTablesState(nextSelected);
                } else if (isAdditive && !isAlreadySelected) {
                 nextSelected.add(t.id);
                 setSelectedTablesState(nextSelected);
                }

                const targetTables = schema.tables.filter(tbl =>
                 nextSelected.has(tbl.id) || tbl.id === t.id
                );

                drag.current = {
                 primaryId: t.id,
                 targets: targetTables.map(tbl => ({
                  id: tbl.id,
                  startX: tbl.position.x,
                  startY: tbl.position.y,
                 })),
                 px: event.clientX,
                 py: event.clientY,
                 isAdditive,
                 isAlreadySelected,
                 moved: false,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
               }
             : undefined
           }
           onPointerMove={
            editable
             ? event => {
                const d = drag.current;
                if (!d || d.primaryId !== t.id) return;
                const deltaX = (event.clientX - d.px) / viewScale;
                const deltaY = (event.clientY - d.py) / viewScale;
                if (!d.moved && Math.hypot(deltaX, deltaY) < 3) {
                 return;
                }
                d.moved = true;
                pendingMovingPositionsRef.current = databaseSelectionPositions(d.targets, deltaX, deltaY);
                if (rafMoveRef.current === null) {
                 rafMoveRef.current = requestAnimationFrame(() => {
                  rafMoveRef.current = null;
                  if (drag.current?.moved && pendingMovingPositionsRef.current) {
                   setMovingPositions(pendingMovingPositionsRef.current);
                  }
                 });
                }
               }
             : undefined
           }
           onPointerUp={
            editable
             ? event => {
                const d = drag.current;
                if (!d || d.primaryId !== t.id) return;
                drag.current = null;
                if (rafMoveRef.current !== null) {
                 cancelAnimationFrame(rafMoveRef.current);
                 rafMoveRef.current = null;
                }
                pendingMovingPositionsRef.current = null;
                setMovingPositions(null);
                try {
                 if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                 }
                } catch {}

                if (d.moved && actions) {
                 suppressClick.current = true;
                 const deltaX = (event.clientX - d.px) / viewScale;
                 const deltaY = (event.clientY - d.py) / viewScale;
                 const positions = databaseSelectionPositions(d.targets, deltaX, deltaY);
                 actions.changeTables(Object.entries(positions).map(([id,position])=>({id,patch:{position}})));
                } else {
                 if (d.isAdditive) {
                  if (d.isAlreadySelected) {
                   const next = new Set(selectedTableSet);
                   next.delete(t.id);
                   setSelectedTablesState(next);
                  }
                 } else {
                  setSelectedTablesState(new Set([t.id]));
                  setEditingTitleTableId(t.id);
                 }
                }
               }
             : undefined
           }
           onPointerCancel={
            editable
             ? () => {
                drag.current = null;
                if (rafMoveRef.current !== null) {
                 cancelAnimationFrame(rafMoveRef.current);
                 rafMoveRef.current = null;
                }
                pendingMovingPositionsRef.current = null;
                setMovingPositions(null);
               }
             : undefined
           }
          >
           {editable && actions ? (
            <>
             {isEditingTitle ? (
              <TableTextInput
               autoFocus
               className={s.cardTitleInput}
               aria-label={`${t.name || '새 테이블'} 편집`}
               value={t.name}
               maxLength={100}
               placeholder="테이블명 (예: users)"
               onFocus={e => e.currentTarget.select()}
               onCommit={name => {
                actions.changeTable(t.id, { name });
               }}
               onBlur={() => setEditingTitleTableId(null)}
               onKeyDown={e => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                 e.currentTarget.blur();
                }
               }}
              />
             ) : (
              <span
               className={s.cardTitleLabel}
               title="드래그하여 테이블 이동 · 클릭하여 테이블명 수정"
              >
               {t.name || 'Table Name'}
              </span>
             )}
             <button
              type="button"
              className={s.cardDeleteBtn}
              disabled={schema.tables.length <= 1}
              aria-label={`${t.name || '새 테이블'} 삭제`}
              title="이 테이블 삭제"
              onClick={() => actions.removeTable(t.id)}
             >
              ×
             </button>
            </>
           ) : (
            <button
             type="button"
             className={s.inspectTable}
             aria-label={`${t.name || '새 테이블'} 컬럼 상세 보기`}
             onClick={e => {
              e.stopPropagation();
              selectTable(t.id);
             }}
            >
             {t.name || '새 테이블'}
            </button>
           )}
          </div>

          {/* Pure 3-Column Table Body (PK/FK/Blank | 칼럼명 | 데이터타입) */}
          <div className={s.cardGrid}>
           <div className={s.cardSubHeader} role="row" aria-hidden="true">
            <span>구분</span>
            {namingMode === 'both' ? (
             <>
              <span>속성명</span>
              <span>칼럼명</span>
             </>
            ) : namingMode === 'logical' ? (
             <span>속성명</span>
            ) : (
             <span>칼럼명</span>
            )}
            <span>타입</span>
           </div>
           {t.columns.map((c, colIdx) => {
            const lit = Boolean(
             activeRelation &&
              ((activeRelation.sourceTableId === t.id &&
               activeRelation.sourceColumnId === c.id) ||
               (activeRelation.targetTableId === t.id &&
                activeRelation.targetColumnId === c.id))
            );
            const isConnectingFrom =
             actions?.connectingFrom?.tableId === t.id &&
             actions?.connectingFrom?.columnId === c.id;
            const isDropCol =
             dropTarget?.tableId === t.id && dropTarget?.columnId === c.id;
            const rowLabel = `${t.name || '새 테이블'} 컬럼 ${colIdx + 1}`;
            const keyText = c.primaryKey ? 'PK' : c.reference ? 'FK' : '';

            return (
             <div
              key={c.id}
              className={s.cardRow}
              data-editable={editable}
              data-highlight={lit}
              data-connecting-source={isConnectingFrom}
              data-drop-target={isDropCol}
              data-dragging={draggingColId === c.id}
              data-drag-over={dragOverColId === c.id}
              data-db-table={t.id}
              data-db-column={c.id}
              draggable={editable}
              onClick={e => {
               if (actions?.connecting) {
                const el = e.target as HTMLElement;
                if (el.closest('input,button,select,textarea')) return;
                e.stopPropagation();
                actions.connect?.({ tableId: t.id, columnId: c.id });
               }
              }}
              onDragStart={e => {
               e.dataTransfer.setData('text/plain', `${t.id}:${c.id}`);
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
               if (sourceTableId === t.id && sourceColId && sourceColId !== c.id) {
                actions?.reorderColumn?.(t.id, sourceColId, c.id);
               }
              }}
              onDragEnd={() => {
               setDraggingColId(null);
               setDragOverColId(null);
              }}
             >
              {/* Cell 1: PK / FK / Blank (Direct Selection Popover) */}
              <div className={s.cellKey} title="드래그하여 순서 변경 · 클릭하여 PK / FK 설정">
               {editable && actions ? (
                <DatabaseKeyCellSelect
                 schema={schema}
                 table={t}
                 column={c}
                 rowLabel={rowLabel}
                 actions={actions}
                 onInspectRelation={relId => selectRelation(relId)}
                />
               ) : (
                <span
                 className={s.erdKeyCellText}
                 data-pk={c.primaryKey}
                 data-fk={Boolean(c.reference)}
                >
                 {keyText}
                </span>
               )}
              </div>

              {/* Cell: 속성명 (둘 다 모드이거나 논리명 모드일 때 독립된 칸으로 표시) */}
              {(namingMode === 'both' || namingMode === 'logical') && (
               <div className={s.cellLogical}>
                {editable && actions ? (
                 <TableTextInput
                  className={s.erdCellInput}
                  aria-label={`${rowLabel} 속성명`}
                  value={c.logicalName ?? ''}
                  maxLength={100}
                  placeholder={colIdx === 0 ? '예: 회원 ID' : colIdx === 1 ? '예: 이메일' : '속성명'}
                  onFocus={() => {
                   if (actions.connecting) {
                    actions.connect?.({ tableId: t.id, columnId: c.id });
                   }
                  }}
                  onCommit={logicalName => actions.changeColumn(t.id, c.id, { logicalName })}
                 />
                ) : (
                 <span className={s.erdCellText} title={c.logicalName || '속성명'}>
                  {c.logicalName || (namingMode === 'logical' ? c.name : '') || '새 속성'}
                 </span>
                )}
               </div>
              )}

              {/* Cell: 칼럼명 (둘 다 모드이거나 물리명 모드일 때 독립된 칸으로 표시) */}
              {(namingMode === 'both' || namingMode === 'physical') && (
               <div className={s.cellName}>
                {editable && actions ? (
                 <TableTextInput
                  className={s.erdCellInput}
                  aria-label={`${rowLabel} 물리명`}
                  value={c.name}
                  maxLength={100}
                  placeholder={colIdx === 0 ? '예: id' : colIdx === 1 ? '예: email' : '칼럼명'}
                  onFocus={() => {
                   if (actions.connecting) {
                    actions.connect?.({ tableId: t.id, columnId: c.id });
                   }
                  }}
                  onCommit={name => actions.changeColumn(t.id, c.id, { name })}
                 />
                ) : (
                 <span className={s.erdCellText} title={c.name || '새 컬럼'}>
                  {c.name || '새 컬럼'}
                 </span>
                )}
               </div>
              )}

              {/* Cell 3: Data Type */}
              <div className={s.cellType}>
               {editable && actions ? (
                <TableTextInput
                 className={s.erdCellInput}
                 aria-label={`${rowLabel} 자료형`}
                 list={typeListId}
                 value={c.dataType}
                 maxLength={100}
                 placeholder={colIdx === 0 ? '예: BIGINT' : colIdx === 1 ? '예: VARCHAR(255)' : '데이터타입'}
                 onCommit={dataType => actions.changeColumn(t.id, c.id, { dataType })}
                 onKeyDown={e => {
                  if (
                   e.key === 'Enter' &&
                   colIdx === t.columns.length - 1 &&
                   t.columns.length < 50
                  ) {
                   e.preventDefault();
                   actions.addColumn(t.id);
                  }
                 }}
                />
               ) : (
                <span className={s.erdCellText} title={c.dataType}>
                 {c.dataType}
                </span>
               )}
              </div>

              {/* Delete column button floats on row hover at the right end */}
              {editable && actions && (
               <div className={s.cellActionFloating}>
                <button
                 type="button"
                 className={s.cardColDeleteBtn}
                 disabled={t.columns.length <= 1}
                 aria-label={`${rowLabel} 삭제`}
                 title="이 컬럼 삭제"
                 onClick={() => actions.removeColumn(t.id, c.id)}
                >
                 ×
                </button>
               </div>
              )}

              {/* Subtle connection handles ONLY visible when hovering this specific row (both left and right) */}
              {actions && (
               <>
                <button
                 type="button"
                 className={`${s.columnPort} ${s.columnPortLeft}`}
                 aria-label={`${t.name || '새 테이블'}.${c.name || '새 컬럼'} 왼쪽 관계 연결`}
                 title="드래그하여 다른 테이블/컬럼에 연결 (왼쪽)"
                 onPointerDown={e => startConnectionDrag(e, t.id, c.id, 'left')}
                 onPointerMove={e => moveConnectionDrag(e, t, c.id, colIdx)}
                 onPointerUp={endConnectionDrag}
                 onPointerCancel={() => {
                  connectionDrag.current = null;
                  setDragPreview(null);
                  setDropTarget(null);
                 }}
                 onClick={e => {
                  e.stopPropagation();
                  if (suppressClick.current) {
                   suppressClick.current = false;
                   return;
                  }
                  actions.connect?.({ tableId: t.id, columnId: c.id });
                 }}
                >
                 ○
                </button>
                <button
                 type="button"
                 className={`${s.columnPort} ${s.columnPortRight}`}
                 aria-label={`${t.name || '새 테이블'}.${c.name || '새 컬럼'} 오른쪽 관계 연결`}
                 title="드래그하여 다른 테이블/컬럼에 연결 (오른쪽)"
                 onPointerDown={e => startConnectionDrag(e, t.id, c.id, 'right')}
                 onPointerMove={e => moveConnectionDrag(e, t, c.id, colIdx)}
                 onPointerUp={endConnectionDrag}
                 onPointerCancel={() => {
                  connectionDrag.current = null;
                  setDragPreview(null);
                  setDropTarget(null);
                 }}
                 onClick={e => {
                  e.stopPropagation();
                  if (suppressClick.current) {
                   suppressClick.current = false;
                   return;
                  }
                  actions.connect?.({ tableId: t.id, columnId: c.id });
                 }}
                >
                 ○
                </button>
               </>
              )}
             </div>
            );
           })}
          </div>

          {actions && t.columns.length < 50 && (
           <div className={s.cardFooterActions}>
            <button
             type="button"
             className={s.addColumn}
             onClick={() => actions.addColumn(t.id)}
            >
             ＋ 컬럼 추가
            </button>
            <button
             type="button"
             className={s.addPkColumn}
             title="BIGINT 기본 키(id) 컬럼 추가"
             onClick={() => actions.addColumn(t.id, 'id')}
            >
             + id(PK)
            </button>
            <button
             type="button"
             className={s.addPresetColBtn}
             title="TIMESTAMP 생성일시(created_at) 컬럼 추가"
             onClick={() => actions.addColumn(t.id, 'created_at')}
            >
             + created_at
            </button>
            <button
             type="button"
             className={s.addPresetColBtn}
             title="TIMESTAMP 수정일시(updated_at) 컬럼 추가"
             onClick={() => actions.addColumn(t.id, 'updated_at')}
            >
             + updated_at
            </button>
           </div>
          )}

          {!actions && (
           <div className={s.cardReadFooter}>
            <span>총 {t.columns.length}개 칼럼</span>
            <span className={s.cardReadFooterHint}>
             {activeTables.has(t.id) ? '선택됨' : '클릭하여 상세 보기'}
            </span>
           </div>
          )}
         </article>
        );
       })}
      </div>
     </div>
    </div>
   </div>

   {links.length > 0 && (
    <details className={s.relations}>
     <summary>관계 목록 ({links.length}) — 클릭하여 관계선 종류·기호 편집</summary>
     <ul>
      {links.map(l => (
       <li key={l.id}>
        <button
         type="button"
         aria-pressed={relation === l.id}
         onClick={() => selectRelation(l.id)}
        >
         {l.label}{' '}
         <span>
          ({l.sourceRequired ? '1' : '0'}..{l.many ? 'N' : '1'} :{' '}
          {l.targetRequired ? '1' : '0..1'})
         </span>
        </button>
       </li>
      ))}
     </ul>
    </details>
   )}
   </section>
 );
}

export function DatabaseSchemaBlock({
 schema,
 title,
 expanded = false,
 initialView = 'ERD',
}: {
 schema: DatabaseSchema;
 title: string | null;
 expanded?: boolean;
 initialView?: 'ERD' | 'SPEC';
}) {
 const [selected, setSelected] = useState<string | null>(null);
 const [viewerOpen, setViewerOpen] = useState(false);
 const [viewTab, setViewTab] = useState<'ERD' | 'SPEC'>(initialView);
 const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set(schema.tables.map(t => t.id)));
 const detailId = useId();
 const tabId = useId();
 const erdTabRef = useRef<HTMLButtonElement>(null);
 const specTabRef = useRef<HTMLButtonElement>(null);
 const root = useRef<HTMLElement>(null);

 const activeTab = schema.display === 'SPEC' ? 'SPEC' : schema.display === 'ERD' ? 'ERD' : viewTab;
 const showTabs = schema.display === 'BOTH';
 const panelId = `${tabId}-panel`;
 const erdTabId = `${tabId}-erd`;
 const specTabId = `${tabId}-spec`;

 const focusTab = (next: 'ERD' | 'SPEC') => {
  setViewTab(next);
  if (next === 'SPEC') {
   setCollapsedIds(new Set(schema.tables.map(t => t.id)));
  }
  (next === 'ERD' ? erdTabRef : specTabRef).current?.focus();
 };

 const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
  let next: 'ERD' | 'SPEC' | null = null;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') next = activeTab === 'ERD' ? 'SPEC' : 'ERD';
  else if (event.key === 'Home') next = 'ERD';
  else if (event.key === 'End') next = 'SPEC';
  if (!next) return;
  event.preventDefault();
  focusTab(next);
 };

 const toggleCollapse = (tableId: string) => {
  setCollapsedIds(prev => {
   const next = new Set(prev);
   if (next.has(tableId)) next.delete(tableId);
   else next.add(tableId);
   return next;
  });
 };

 useEffect(() => {
  if (!selected) return;
  const clear = (event: PointerEvent) => {
   if (event.target instanceof Node && !root.current?.contains(event.target)) {
    setSelected(null);
   }
  };
  document.addEventListener('pointerdown', clear);
  return () => document.removeEventListener('pointerdown', clear);
 }, [selected]);

 const table = schema.tables.find(t => t.id === selected);

 return (
  <section
   ref={root}
   className={`${s.block}${!expanded ? ' database-reader' : ''}`}
   aria-label={title || 'DB 설계'}
  >
   {title && <h2>{title}</h2>}
   {!expanded && (
    <DiagramLightbox
     label="데이터베이스"
     hideTrigger
     open={viewerOpen}
     onOpenChange={setViewerOpen}
    >
     {() => <DatabaseSchemaBlock schema={schema} title={title} expanded initialView={activeTab} />}
    </DiagramLightbox>
   )}

   {/* View Switcher Row: Left = ERD / SPEC tabs, Right = [확대] [모두 펼치기/접기] when in SPEC view */}
   {(showTabs || (activeTab === 'SPEC' && (!expanded || schema.tables.length > 1))) && <div className={s.viewHeaderRow}>
    {showTabs && <div className={s.viewTabBar} role="tablist" aria-label="데이터베이스 보기 선택">
     <button
      type="button"
      ref={erdTabRef}
      id={erdTabId}
      role="tab"
      aria-selected={activeTab === 'ERD'}
      aria-controls={panelId}
      tabIndex={activeTab === 'ERD' ? 0 : -1}
      className={`${s.viewTabBtn} ${activeTab === 'ERD' ? s.viewTabBtnActive : ''}`}
      onClick={() => setViewTab('ERD')}
      onKeyDown={onTabKeyDown}
     >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
       <rect x="3" y="3" width="7" height="9" rx="1" />
       <rect x="14" y="3" width="7" height="5" rx="1" />
       <rect x="14" y="12" width="7" height="9" rx="1" />
       <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
      <span>ERD 다이어그램</span>
     </button>
     <button
      type="button"
      ref={specTabRef}
      id={specTabId}
      role="tab"
      aria-selected={activeTab === 'SPEC'}
      aria-controls={panelId}
      tabIndex={activeTab === 'SPEC' ? 0 : -1}
      className={`${s.viewTabBtn} ${activeTab === 'SPEC' ? s.viewTabBtnActive : ''}`}
      onClick={() => {
       setViewTab('SPEC');
       setCollapsedIds(new Set(schema.tables.map(t => t.id)));
      }}
      onKeyDown={onTabKeyDown}
     >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
       <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
       <polyline points="14 2 14 8 20 8" />
       <line x1="16" y1="13" x2="8" y2="13" />
       <line x1="16" y1="17" x2="8" y2="17" />
       <polyline points="10 9 9 9 8 9" />
      </svg>
      <span>테이블 명세서</span>
     </button>
    </div>}

    {activeTab === 'SPEC' && (!expanded || schema.tables.length > 1) && (
     <div className={s.specTopActions}>
      {schema.tables.length > 1 && (() => {
       const isAllCollapsed = schema.tables.length > 0 && schema.tables.every(t => collapsedIds.has(t.id));
       return (
        <button
         type="button"
         className={s.specNavToggleAll}
         onClick={() => {
          if (isAllCollapsed) {
           setCollapsedIds(new Set());
          } else {
           setCollapsedIds(new Set(schema.tables.map(t => t.id)));
          }
         }}
        >
         {isAllCollapsed ? '모두 펼치기' : '모두 접기'}
        </button>
       );
      })()}
      {!expanded && <button type="button" className={s.diagramExpandBtn} aria-label="데이터베이스 확대 보기" onClick={() => setViewerOpen(true)}>확대</button>}
     </div>
    )}
   </div>}

   <div id={panelId} role={showTabs ? 'tabpanel' : undefined} aria-labelledby={showTabs ? (activeTab === 'ERD' ? erdTabId : specTabId) : undefined} tabIndex={showTabs ? 0 : undefined}>
   {activeTab === 'ERD' ? (
    <>
     <DatabaseDiagram
      schema={schema}
      expanded={expanded}
      onExpand={!expanded ? () => setViewerOpen(true) : undefined}
      onClearSelection={() => setSelected(null)}
      selectedTable={table?.id}
      onSelectTable={id => setSelected(current => (current === id ? null : id))}
     />

     {/* When a table is selected in ERD view, show only that table's specification below */}
     {table && (
      <section
       id={detailId}
       className={s.selectedSpecification}
       aria-label={`${table.name} 컬럼 상세`}
      >
       <DatabaseSpecifications
        schema={{ ...schema, tables: [table] }}
        referenceSchema={schema}
        initiallyCollapsed={false}
        onClose={() => setSelected(null)}
        hideNav
       />
      </section>
     )}
    </>
   ) : (
    <DatabaseSpecifications
     schema={schema}
     referenceSchema={schema}
     collapsedIds={collapsedIds}
     onToggleCollapse={toggleCollapse}
     hideNav
    />
   )}
   </div>
  </section>
 );
}
