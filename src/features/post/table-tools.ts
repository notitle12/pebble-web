import { Extension } from "@tiptap/core";
import { CellSelection, TableMap, addRowBefore, addColumnBefore, addRowAfter, addColumnAfter } from "@tiptap/pm/tables";
import { Plugin, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";

export const TableCellFormatting = Extension.create({
  name: "tableCellFormatting",
  addProseMirrorPlugins() { return [new Plugin({
    appendTransaction(transactions, _oldState, state) {
      if (!transactions.some(tr => tr.docChanged)) return null;
      const tr = state.tr;
      state.doc.descendants((table, pos) => {
        if (table.type.spec.tableRole !== "table") return;
        const corner = TableMap.get(table).map[0];
        table.descendants((cell, offset) => {
          if (cell.type.spec.tableRole !== "cell" && cell.type.spec.tableRole !== "header_cell") return;
          if (cell.attrs.diagonal && (offset !== corner || cell.attrs.colspan !== 1 || cell.attrs.rowspan !== 1)) {
            tr.setNodeMarkup(pos + 1 + offset, undefined, { ...cell.attrs, diagonal: false });
          }
          return false;
        });
        return false;
      });
      return tr.docChanged ? tr : null;
    },
  })]; },
  addGlobalAttributes() { return [{ types: ["tableCell", "tableHeader"], attributes: {
    backgroundColor: { default: null, parseHTML: element => element.style.backgroundColor || null,
      renderHTML: attrs => attrs.backgroundColor ? { style: `background-color: ${attrs.backgroundColor}` } : {} },
    verticalAlign: { default: null, parseHTML: element => ["top", "middle", "bottom"].includes(element.style.verticalAlign) ? element.style.verticalAlign : null,
      renderHTML: attrs => ["top", "middle", "bottom"].includes(attrs.verticalAlign) ? { style: `vertical-align: ${attrs.verticalAlign}` } : {} },
    ...Object.fromEntries(["Top", "Right", "Bottom", "Left"].map(side => [`border${side}`, {
      default: null, parseHTML: (element: HTMLElement) => element.style.getPropertyValue(`border-${side.toLowerCase()}`) || null,
      renderHTML: (attrs: Record<string, unknown>) => attrs[`border${side}`] ? { style: `border-${side.toLowerCase()}: ${attrs[`border${side}`]}` } : {},
    }])),
    diagonal: { default: false, parseHTML: element => element.getAttribute("data-diagonal") === "backslash",
      renderHTML: attrs => attrs.diagonal ? { "data-diagonal": "backslash" } : {} },
  } }, { types: ["tableRow"], attributes: {
    height: { default: null,
      parseHTML: element => { const value = Number.parseFloat(element.style.height); return /^\d+px$/.test(element.style.height) && value >= 20 && value <= 1200 ? value : null; },
      renderHTML: attrs => Number.isInteger(attrs.height) && attrs.height >= 20 && attrs.height <= 1200 ? { style: `height: ${attrs.height}px` } : {},
    },
  } }]; },
});

export function tableContext(state: EditorState) {
  const $cell = state.selection instanceof CellSelection ? state.selection.$anchorCell : state.selection.$from;
  for (let depth = $cell.depth; depth > 0; depth--) {
    const table = $cell.node(depth);
    if (table.type.spec.tableRole !== "table") continue;
    const start = $cell.start(depth);
    const cellPos = state.selection instanceof CellSelection ? $cell.pos : $cell.before(depth + 2);
    return { table, start, cellPos, map: TableMap.get(table) };
  }
  return null;
}

export function selectTablePart(state: EditorState, part: "cell" | "row" | "column" | "table"): Transaction | null {
  const context = tableContext(state);
  if (!context) return null;
  const { start, cellPos, map } = context;
  const $cell = state.doc.resolve(cellPos);
  const rect = map.findCell(cellPos - start);
  const selection = part === "row" ? CellSelection.rowSelection($cell)
    : part === "column" ? CellSelection.colSelection($cell)
    : part === "table" ? CellSelection.create(state.doc, start + map.map[0], start + map.map[map.map.length - 1])
    : CellSelection.create(state.doc, start + map.positionAt(rect.top, rect.left, context.table));
  return state.tr.setSelection(selection);
}

export function setSelectedColumnWidth(state: EditorState, width: number): Transaction | null {
  const context = tableContext(state);
  if (!context || !Number.isInteger(width) || width < 48 || width > 1200) return null;
  const { table, start, map, cellPos } = context;
  const rect = state.selection instanceof CellSelection
    ? map.rectBetween(state.selection.$anchorCell.pos - start, state.selection.$headCell.pos - start)
    : map.findCell(cellPos - start);
  const tr = state.tr;
  for (const offset of new Set(map.map)) {
    const cell = table.nodeAt(offset);
    if (!cell) continue;
    const cellRect = map.findCell(offset);
    const colwidth = Array.from({ length: cell.attrs.colspan }, (_, index) => cell.attrs.colwidth?.[index] ?? 0);
    let changed = false;
    for (let col = Math.max(rect.left, cellRect.left); col < Math.min(rect.right, cellRect.right); col++) {
      colwidth[col - cellRect.left] = width; changed = true;
    }
    if (changed) tr.setNodeMarkup(start + offset, undefined, { ...cell.attrs, colwidth });
  }
  return tr;
}

export function toggleCornerDiagonal(state: EditorState): Transaction | null {
  const context = tableContext(state);
  if (!context || context.cellPos !== context.start + context.map.map[0]) return null;
  const cell = state.doc.nodeAt(context.cellPos);
  if (!cell || cell.attrs.colspan !== 1 || cell.attrs.rowspan !== 1) return null;
  const tr = state.tr.setNodeMarkup(context.cellPos, undefined, { ...cell.attrs, diagonal: !cell.attrs.diagonal });
  if (!cell.attrs.diagonal && cell.childCount === 1) {
    tr.insert(context.cellPos + cell.nodeSize - 1, state.schema.nodes.paragraph.create());
  }
  return tr;
}

/** Align every selected cell and its paragraphs, preserving independent neighboring cells. */
export function setCellAlignment(state: EditorState, align: "left" | "center" | "right"): Transaction | null {
  const context = tableContext(state);
  if (!context) return null;
  const tr = state.tr;
  const apply = (cell: import("@tiptap/pm/model").Node, pos: number) => {
    tr.setNodeMarkup(pos, undefined, { ...cell.attrs, align });
    cell.descendants((child, offset) => {
      if (child.type.name === "paragraph" || child.type.name === "heading") {
        tr.setNodeMarkup(pos + 1 + offset, undefined, { ...child.attrs, textAlign: align });
      }
    });
  };
  if (state.selection instanceof CellSelection) state.selection.forEachCell(apply);
  else { const cell = state.doc.nodeAt(context.cellPos); if (cell) apply(cell, context.cellPos); }
  return tr;
}

/** Move a rectangular cell range; occupied destinations exchange contents rather than losing text. */
export function moveSelectedCells(state: EditorState, destination: number): Transaction | null {
  const context = tableContext(state);
  if (!context || !(state.selection instanceof CellSelection)) return null;
  const { map, start, table } = context;
  if (destination < start || destination >= start + table.content.size) return null;
  const targetOffset = destination - start;
  if (!map.map.includes(targetOffset)) return null;
  const source = map.rectBetween(state.selection.$anchorCell.pos - start, state.selection.$headCell.pos - start);
  const target = map.findCell(targetOffset);
  const width = source.right - source.left, height = source.bottom - source.top;
  const right = target.left + width, bottom = target.top + height;
  if (right > map.width || bottom > map.height) return null;
  // Overlapping ranges and merged cells need different geometry; leave them unchanged.
  if (source.left < right && source.right > target.left && source.top < bottom && source.bottom > target.top) return null;
  const replacements = new Map<number, import("@tiptap/pm/model").Node>();
  for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
    const from = map.map[(source.top + row) * map.width + source.left + col];
    const to = map.map[(target.top + row) * map.width + target.left + col];
    const a = table.nodeAt(from), b = table.nodeAt(to);
    if (!a || !b || a.attrs.colspan !== 1 || a.attrs.rowspan !== 1 || b.attrs.colspan !== 1 || b.attrs.rowspan !== 1) return null;
    const payload = (slot: typeof a, content: typeof a) => slot.type.create({
      ...content.attrs, colspan: 1, rowspan: 1, colwidth: slot.attrs.colwidth,
    }, content.content, slot.marks);
    replacements.set(start + from, payload(a, b));
    replacements.set(start + to, payload(b, a));
  }
  const tr = state.tr;
  for (const [pos, cell] of [...replacements].sort(([a], [b]) => b - a)) {
    tr.replaceWith(pos, pos + state.doc.nodeAt(pos)!.nodeSize, cell);
  }
  const anchor = tr.mapping.map(destination, -1);
  const head = tr.mapping.map(start + map.map[(bottom - 1) * map.width + right - 1], -1);
  return tr.setSelection(CellSelection.create(tr.doc, anchor, head)).scrollIntoView();
}


function restoreTableSelection(state: EditorState, tr: Transaction) {
  const selection = state.selection;
  // CellSelection.map expands a whole row/column to include inserted cells.
  // Map the original endpoints explicitly so the original cells stay selected.
  return tr.setSelection(selection instanceof CellSelection
    ? CellSelection.create(tr.doc, tr.mapping.map(selection.$anchorCell.pos, 1), tr.mapping.map(selection.$headCell.pos, 1))
    : selection.map(tr.doc, tr.mapping));
}

export function appendTableEdge(state: EditorState, tablePos: number, edge: "row" | "column"): Transaction | null {
  const table = state.doc.nodeAt(tablePos);
  if (table?.type.spec.tableRole !== "table") return null;
  const map = TableMap.get(table);
  const selected = state.apply(state.tr.setSelection(CellSelection.create(state.doc, tablePos + 1 + map.map[map.map.length - 1])));
  const tr = insertTablePart(selected, edge);
  return tr ? restoreTableSelection(state, tr) : null;
}

/** Inserting a row or column preserves the original caret or cell range. */
export function insertTablePart(state: EditorState, edge: "row" | "column", before = false): Transaction | null {
  const context = tableContext(state); if (!context) return null;
  const command = edge === "row" ? before ? addRowBefore : addRowAfter : before ? addColumnBefore : addColumnAfter;
  const results: Transaction[] = [];
  command(state, tr => { results.push(tr); });
  const result = results[0]; if (!result) return null;
  return restoreTableSelection(state, result);
}


/** Place an insertion cursor in a cell, instead of selecting its contents as a rectangle. */
export function cursorInTableCell(tr: Transaction, cellPos: number): Transaction | null {
  const cell = tr.doc.nodeAt(cellPos);
  if (!cell || !["cell", "header_cell"].includes(cell.type.spec.tableRole)) return null;
  const selection = TextSelection.findFrom(tr.doc.resolve(cellPos + 1), 1, true);
  if (!selection || selection.from >= cellPos + cell.nodeSize - 1) return null;
  return tr.setSelection(selection);
}

export function selectSingleTableCell(state: EditorState, cellPos: number): Transaction | null {
  const cell = state.doc.nodeAt(cellPos);
  if (!cell || !["cell", "header_cell"].includes(cell.type.spec.tableRole)) return null;
  return state.tr.setSelection(CellSelection.create(state.doc, cellPos));
}

