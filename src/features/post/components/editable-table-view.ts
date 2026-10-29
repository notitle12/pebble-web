import { Table, TableView } from "@tiptap/extension-table";
import type { Node as PMNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import { Plugin, type Command } from "@tiptap/pm/state";
import { tableEditingKey, columnResizingPluginKey, TableMap, CellSelection, deleteColumn, deleteRow, deleteTable, mergeCells, splitCell, setCellAttr, toggleHeaderRow, toggleHeaderColumn } from "@tiptap/pm/tables";
import { insertTablePart, selectTablePart, appendTableEdge, moveSelectedCells, tableContext, toggleCornerDiagonal } from "../table-tools";
import { fitTableSelection, moveTableBand, setSelectionBorders, tableSelectionRect, type BorderMode, type BorderSettings, type TableDimensions } from "../table-layout";
import { stableTableColumnResizing, tableGripCorridors } from "../table-column-resize";
import { tableShortcuts } from "../table-shortcuts";
import { tableCellInteractions } from "../table-cell-interactions";
import { tableRowResizing } from "../table-row-resize";
import styles from "./rich-body-editor.module.css";

const icons = {
  paint: '<path d="m5 10 7-7 8 8-7 7zM3 3l9 9M3 21h18M20 13s-2 2.5-2 4a2 2 0 0 0 4 0c0-1.5-2-4-2-4Z"/>',
  move: '<path d="M12 3v18M3 12h18m-12-6 3-3 3 3m-6 12 3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
};

class EditableTableView extends TableView {
  private tools = document.createElement("div");
  private addRowButton = document.createElement("button");
  private addColumnButton = document.createElement("button");
  private rowGrip = document.createElement("button");
  private columnGrip = document.createElement("button");
  private gripBounds: DOMRect | null = null;
  private hoveredBand = { row: 0, column: 0 };
  private bandSession: { doc: PMNode; axis: "row" | "column"; from: number; to: number | null } | null = null;
  private suppressBandClick = false;
  private palette = document.createElement("div");
  private menu = document.createElement("div");
  private actions: { button: HTMLButtonElement; available: () => boolean }[] = [];
  private dropMarker = document.createElement("div");
  private liveStatus = document.createElement("span");
  private moveSession: { doc: PMNode; target: number | null; startX: number; startY: number; moved: boolean } | null = null;
  private view: EditorView;
  private dragging = false;
  private dismissed = false;
  private frame = 0;
  private lastSelection: EditorView["state"]["selection"] | null = null;
  private lastDocument: PMNode | null = null;
  private statusTimer = 0;

  constructor(node: PMNode, minWidth: number, view: EditorView, attrs: Record<string, unknown> = {}) {
    super(node, minWidth, view, attrs);
    this.view = view;
    this.dom.classList.add(styles.editableTable);
    for (const [button, edge, label] of [[this.addRowButton, "row", "표 끝에 행 추가"], [this.addColumnButton, "column", "표 끝에 열 추가"]] as const) {
      button.type = "button"; button.className = styles.tableEdgeAdd; button.textContent = "+";
      button.setAttribute("aria-label", label); button.title = label; button.hidden = true;
      button.setAttribute("data-writer-popup", "");
      button.addEventListener("mousedown", event => event.preventDefault());
      button.addEventListener("click", () => {
        if (!view.editable) return;
        const pos = view.posAtDOM(this.contentDOM, 0) - 1;
        const tr = appendTableEdge(view.state, pos, edge);
        if (tr) { view.dispatch(tr); view.focus(); }
        this.addRowButton.hidden = true; this.addColumnButton.hidden = true;
      });
      document.body.append(button);
    }
    for (const [button, axis, label] of [[this.rowGrip, "row", "행 이동 손잡이"], [this.columnGrip, "column", "열 이동 손잡이"]] as const) {
      button.type = "button"; button.className = styles.tableBandGrip; button.textContent = "⠿"; button.hidden = true;
      button.setAttribute("aria-label", label); button.title = `${label} · 드래그해서 순서 변경 · 클릭해서 선택`;
      button.addEventListener("mousedown", event => event.preventDefault());
      button.addEventListener("pointerdown", event => {
        if (!view.editable || event.button !== 0) return;
        event.preventDefault(); event.stopPropagation(); this.suppressBandClick = false;
        this.bandSession = { doc: view.state.doc, axis, from: this.hoveredBand[axis], to: null };
      });
      button.addEventListener("click", () => {
        if (!view.editable || this.suppressBandClick) return;
        const map = TableMap.get(this.node), index = this.hoveredBand[axis];
        const first = axis === "row" ? index * map.width : index;
        const last = axis === "row" ? first + map.width - 1 : (map.height - 1) * map.width + index;
        const start = view.posAtDOM(this.contentDOM, 0);
        view.dispatch(view.state.tr.setSelection(CellSelection.create(view.state.doc, start + map.map[first], start + map.map[last]))); view.focus();
      });
      document.body.append(button);
    }
    this.tools.className = styles.tableBubble;
    this.tools.contentEditable = "false";
    this.tools.setAttribute("role", "toolbar");
    this.tools.setAttribute("aria-label", "선택한 셀 도구");
    this.tools.setAttribute("data-writer-popup", "");
    this.tools.addEventListener("mousedown", event => {
      // Keep the ProseMirror cell selection when operating the floating tools.
      if (!(event.target as Element).closest("input,select")) event.preventDefault();
      event.stopPropagation();
    });
    this.tools.addEventListener("keydown", event => {
      event.stopPropagation();
      if (event.key === "Escape") { this.dismissed = true; this.refresh(); view.focus(); }
    });
    const paint = this.iconButton("셀 배경색", icons.paint, () => {
      const open = this.palette.hidden;
      this.closePanels(); this.palette.hidden = !open;
      paint.setAttribute("aria-expanded", String(open)); this.position();
    });
    paint.setAttribute("aria-haspopup", "dialog"); paint.setAttribute("aria-expanded", "false");
    this.palette.className = styles.tableSwatches;
    this.palette.hidden = true;
    this.palette.setAttribute("role", "dialog"); this.palette.setAttribute("aria-label", "셀 배경색 선택");
    const colors = ["#f3f4f6", "#e8eff8", "#e3f1e8", "#fff1cd", "#fbe5df", "#eee6f7", "#243b30", "#24364a", "#55482b", "#50332f", "#42354e", "#212529"];
    for (const color of colors) {
      const button = this.textButton(this.palette, `배경색 ${color}`, () => this.color(color));
      button.textContent = ""; button.style.backgroundColor = color;
    }
    this.textButton(this.palette, "배경 지우기", () => this.color(null));
    const custom = document.createElement("input"); custom.type = "color"; custom.value = "#e8eff8"; custom.setAttribute("aria-label", "사용자 지정 셀 배경색");
    custom.addEventListener("input", () => { if (this.active()) setCellAttr("backgroundColor", custom.value)(view.state, view.dispatch); });
    this.palette.append(custom);
    const move = this.iconButton("선택한 셀 이동 (드래그)", icons.move, () => {});
    move.style.cursor = "grab";
    move.addEventListener("pointerdown", event => {
      if (event.button !== 0 || !this.active()) return;
      event.preventDefault(); event.stopPropagation();
      this.closePanels();
      this.moveSession = { doc: view.state.doc, target: null, startX: event.clientX, startY: event.clientY, moved: false };
    });
    this.dropMarker.className = styles.cellDropMarker; this.dropMarker.hidden = true;
    this.liveStatus.className = styles.cellMoveStatus; this.liveStatus.setAttribute("role", "status");
    document.body.append(this.dropMarker, this.liveStatus);
    const more = this.iconButton("표 추가 도구", icons.more, () => {
      const open = this.menu.hidden;
      this.closePanels(); this.menu.hidden = !open;
      more.setAttribute("aria-expanded", String(open)); this.position();
    });
    more.setAttribute("aria-haspopup", "menu"); more.setAttribute("aria-expanded", "false");
    this.menu.className = styles.tableContextMenu; this.menu.hidden = true;
    this.menu.setAttribute("role", "menu"); this.menu.setAttribute("aria-label", "표 추가 도구");
    for (const [part, label] of [["row", "행 선택"], ["column", "열 선택"], ["table", "표 전체 선택"]] as const) {
      this.textButton(this.menu, label, () => { const tr = selectTablePart(view.state, part); if (tr) view.dispatch(tr); });
    }
    for (const [label, edge, before] of [["위에 행 추가", "row", true], ["아래에 행 추가", "row", false], ["왼쪽에 열 추가", "column", true], ["오른쪽에 열 추가", "column", false]] as const) {
      this.textButton(this.menu, label, () => { const tr = insertTablePart(view.state, edge, before); if (tr) view.dispatch(tr); });
    }
    const sizes = this.menuSection("크기 맞추기");
    for (const [label, mode] of [["열 너비 균등하게", "columns"], ["행 높이 균등하게", "rows"], ["내용에 맞추기", "content"]] as const) {
      this.textButton(sizes, label, () => { const tr = fitTableSelection(view.state, mode, this.dimensions()); if (tr) view.dispatch(tr); });
    }
    const movement = this.menuSection("행·열 이동");
    for (const [label, axis, delta] of [["현재 행 위로", "row", -1], ["현재 행 아래로", "row", 1], ["현재 열 왼쪽으로", "column", -1], ["현재 열 오른쪽으로", "column", 1]] as const) {
      const transaction = () => {
        const context = tableSelectionRect(view.state); if (!context) return null;
        const from = axis === "row" ? context.rect.top : context.rect.left;
        return moveTableBand(view.state, context.start - 1, axis, from, from + delta);
      };
      this.textButton(movement, label, () => { const tr = transaction(); if (tr) view.dispatch(tr); }, () => !!transaction());
    }
    const borders = this.menuSection("테두리");
    const settings: BorderSettings = { color: "#87929f", width: 1, style: "solid" };
    const fields = document.createElement("div"); fields.className = styles.tableBorderFields;
    const color = document.createElement("input"); color.type = "color"; color.value = settings.color; color.setAttribute("aria-label", "테두리 색");
    color.addEventListener("input", () => { settings.color = color.value; });
    const width = document.createElement("select"); width.setAttribute("aria-label", "테두리 굵기");
    for (const value of [1, 2, 3, 4]) width.add(new Option(`${value}px`, String(value)));
    width.addEventListener("change", () => { settings.width = Number(width.value); });
    const line = document.createElement("select"); line.setAttribute("aria-label", "테두리 선 종류");
    for (const [value, label] of [["solid", "실선"], ["dashed", "파선"], ["dotted", "점선"], ["hidden", "숨김"]]) line.add(new Option(label, value));
    line.addEventListener("change", () => { settings.style = line.value as BorderSettings["style"]; });
    fields.append(color, width, line); borders.append(fields);
    for (const [mode, label] of [["all", "모든 테두리"], ["outer", "바깥선만"], ["inner", "안쪽 선"], ["top", "위쪽 선"], ["bottom", "아래쪽 선"], ["left", "왼쪽 선"], ["right", "오른쪽 선"], ["none", "테두리 숨기기"], ["reset", "기본 테두리로 복원"]] as const) {
      this.textButton(borders, label, () => { const tr = setSelectionBorders(view.state, mode, settings); if (tr) view.dispatch(tr); });
    }
    const commands: [string, Command][] = [
      ["셀 병합", mergeCells], ["셀 분할", splitCell], ["제목 행 전환", toggleHeaderRow], ["제목 열 전환", toggleHeaderColumn],
      ["행 삭제", deleteRow], ["열 삭제", deleteColumn], ["표 삭제", deleteTable],
    ];
    for (const [label, command] of commands) this.textButton(this.menu, label, () => command(view.state, view.dispatch, view), () => command(view.state));
    this.textButton(this.menu, "왼쪽 위 셀 대각선 \\", () => { const tr = toggleCornerDiagonal(view.state); if (tr) view.dispatch(tr); }, () => !!toggleCornerDiagonal(view.state));
    this.tools.append(this.palette, this.menu);
    // A body portal avoids clipping inside the horizontally scrollable table.
    document.body.append(this.tools);
    view.dom.addEventListener("pebble-table-selection", this.selectionChanged);
    view.dom.addEventListener("pointerdown", this.pointerDown);
    this.table.addEventListener("contextmenu", this.contextMenu);
    document.addEventListener("pointerup", this.pointerUp);
    document.addEventListener("pointermove", this.movePointer);
    document.addEventListener("pointercancel", this.cancelMove);
    window.addEventListener("blur", this.cancelMove);
    document.addEventListener("pointerdown", this.outsideDown);
    document.addEventListener("keydown", this.escape);
    window.addEventListener("scroll", this.position, true);
    window.addEventListener("resize", this.position);
    this.refresh();
  }

  private active = () => this.view.editable && tableContext(this.view.state)?.table === this.node;
  private closePanels = () => {
    this.palette.hidden = true; this.menu.hidden = true;
    this.tools.querySelectorAll("[aria-expanded]").forEach(button => button.setAttribute("aria-expanded", "false"));
  };
  private iconButton(label: string, paths: string, action: () => void) {
    const button = document.createElement("button"); button.type = "button"; button.title = label; button.setAttribute("aria-label", label);
    button.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
    button.addEventListener("click", () => { if (this.active()) { action(); this.refresh(); } });
    this.tools.append(button); return button;
  }
  private textButton(parent: HTMLElement, label: string, action: () => unknown, available = () => true) {
    const button = document.createElement("button"); button.type = "button"; button.textContent = label; button.title = label; button.setAttribute("aria-label", label);
    if (this.menu.contains(parent)) {
      button.setAttribute("role", "menuitem");
      const shortcut = tableShortcuts.find(item => item.label === label);
      if (shortcut) {
        const name = document.createElement("span"); name.textContent = label;
        const hint = document.createElement("kbd"); hint.textContent = shortcut.hint;
        button.replaceChildren(name, hint); button.title = `${label} · ${shortcut.hint}`;
        button.setAttribute("aria-keyshortcuts", shortcut.aria);
      }
    }
    button.addEventListener("click", () => { if (!this.active()) return; action(); this.closePanels(); this.view.focus(); this.refresh(); });
    this.actions.push({ button, available }); parent.append(button); return button;
  }
  private menuSection(label: string) {
    const details = document.createElement("details"), summary = document.createElement("summary"), body = document.createElement("div");
    details.className = styles.tableMenuSection; summary.textContent = label; details.append(summary, body); this.menu.append(details);
    details.addEventListener("toggle", this.position); return body;
  }
  private dimensions(): TableDimensions {
    const map = TableMap.get(this.node);
    const widths = Array.from(this.colgroup.children).map(col => col.getBoundingClientRect().width);
    const heights = Array.from(this.table.rows).map(row => row.getBoundingClientRect().height);
    const contentWidths = Array.from({ length: map.width }, () => 48);
    const canvas = document.createElement("canvas"), context = canvas.getContext("2d");
    if (context) for (const offset of new Set(map.map)) {
      const start = this.view.posAtDOM(this.contentDOM, 0);
      const cell = this.view.nodeDOM(start + offset) as HTMLElement;
      if (!cell) continue;
      const rect = map.findCell(offset), style = getComputedStyle(cell);
      let measure = 0;
      for (const block of Array.from(cell.querySelectorAll("p,h1,h2,h3,pre,li"))) {
        const font = getComputedStyle(block); context.font = `${font.fontWeight} ${font.fontSize} ${font.fontFamily}`;
        measure = Math.max(measure, ...((block.textContent || "").split("\n").map(line => context.measureText(line).width)));
      }
      for (const media of Array.from(cell.querySelectorAll("img,iframe"))) measure = Math.max(measure, media.getBoundingClientRect().width);
      const needed = (measure + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + 4) / (rect.right - rect.left);
      for (let col = rect.left; col < rect.right; col++) contentWidths[col] = Math.max(contentWidths[col], needed);
    }
    return { widths, heights, contentWidths };
  }
  private announce(message: string) {
    window.clearTimeout(this.statusTimer); this.liveStatus.textContent = message;
    this.statusTimer = window.setTimeout(() => { this.liveStatus.textContent = ""; }, 4500);
  }
  private color(value: string | null) { setCellAttr("backgroundColor", value)(this.view.state, this.view.dispatch); }
  private pointerDown = () => { this.dragging = true; this.dismissed = false; this.closePanels(); this.tools.hidden = true; };
  private pointerUp = () => {
    if (this.bandSession) {
      const session = this.bandSession; this.bandSession = null; this.dropMarker.hidden = true;
      this.suppressBandClick = session.to !== null;
      const tr = session.doc === this.view.state.doc && session.to !== null ? moveTableBand(this.view.state, this.view.posAtDOM(this.contentDOM, 0) - 1, session.axis, session.from, session.to) : null;
      if (tr) { this.view.dispatch(tr); this.view.focus(); this.announce(session.axis === "row" ? "행 순서를 변경했습니다." : "열 순서를 변경했습니다."); }
      else if (session.to !== null) this.announce("병합된 칸이 있는 표는 칸을 분할한 뒤 행·열을 이동해 주세요.");
    }
    if (this.moveSession) {
      const session = this.moveSession; this.moveSession = null; this.dropMarker.hidden = true;
      const tr = session.doc === this.view.state.doc && session.target !== null ? moveSelectedCells(this.view.state, session.target) : null;
      if (tr) { this.view.dispatch(tr); this.view.focus(); this.announce("선택한 셀을 이동했습니다. 대상 칸의 기존 내용은 원래 위치로 옮겼습니다."); }
      else if (session.moved) this.announce("이 위치로 옮길 수 없습니다. 같은 표 안에서 선택 범위와 겹치지 않는 병합되지 않은 칸에 놓아 주세요.");
    }
    this.dragging = false; cancelAnimationFrame(this.frame); this.frame = requestAnimationFrame(this.refresh); };
  private cancelMove = () => {
    this.bandSession = null; this.moveSession = null; this.dropMarker.hidden = true; this.dragging = false; this.refresh();
  };
  private movePointer = (event: PointerEvent) => {
    if (this.bandSession) { this.moveBandPointer(event); return; }
    const session = this.moveSession; if (!session) { this.edgeHover(event); return; }
    if (Math.hypot(event.clientX - session.startX, event.clientY - session.startY) < 4 && !session.moved) return;
    session.moved = true; event.preventDefault();
    this.tools.hidden = true; this.dragging = true;
    const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest("td,th");
    session.target = null; this.dropMarker.hidden = true;
    if (!cell || !this.table.contains(cell) || session.doc !== this.view.state.doc) return;
    const target = this.view.posAtDOM(cell, 0) - 1;
    const tr = moveSelectedCells(this.view.state, target); if (!tr) return;
    session.target = target;
    const context = tableContext(this.view.state)!;
    const selection = this.view.state.selection as CellSelection;
    const sourceRect = context.map.rectBetween(selection.$anchorCell.pos - context.start, selection.$headCell.pos - context.start);
    const targetRect = context.map.findCell(target - context.start);
    const end = context.start + context.map.map[(targetRect.top + sourceRect.bottom - sourceRect.top - 1) * context.map.width + targetRect.left + sourceRect.right - sourceRect.left - 1];
    const first = cell.getBoundingClientRect();
    const last = (this.view.nodeDOM(end) as Element)?.getBoundingClientRect(); if (!last) return;
    Object.assign(this.dropMarker.style, { left: `${first.left}px`, top: `${first.top}px`, width: `${last.right - first.left}px`, height: `${last.bottom - first.top}px` });
    this.dropMarker.hidden = false;
  };
  private moveBandPointer(event: PointerEvent) {
    const session = this.bandSession; if (!session || session.doc !== this.view.state.doc) return;
    const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest("td,th");
    if (!cell || !this.table.contains(cell)) { session.to = null; this.dropMarker.hidden = true; return; }
    const start = this.view.posAtDOM(this.contentDOM, 0), map = TableMap.get(this.node);
    const rect = map.findCell(this.view.posAtDOM(cell, 0) - 1 - start);
    const to = session.axis === "row" ? rect.top : rect.left;
    session.to = to === session.from ? null : to;
    if (session.to === null) return;
    event.preventDefault(); this.dragging = true; this.tools.hidden = true; this.rowGrip.hidden = true; this.columnGrip.hidden = true;
    const table = this.table.getBoundingClientRect();
    const bounds = session.axis === "row" ? this.table.rows[to].getBoundingClientRect() : this.colgroup.children[to].getBoundingClientRect();
    Object.assign(this.dropMarker.style, { left: `${session.axis === "row" ? table.left : bounds.left}px`, top: `${session.axis === "row" ? bounds.top : table.top}px`, width: `${session.axis === "row" ? table.width : bounds.width}px`, height: `${session.axis === "row" ? bounds.height : table.height}px` });
    this.dropMarker.hidden = false;
  }
  private edgeHover = (event: PointerEvent) => {
    if ([this.addRowButton, this.addColumnButton, this.rowGrip, this.columnGrip].some(button => button.contains(event.target as globalThis.Node))) return;
    const rect = this.table.getBoundingClientRect();
    const hovered = (event.target as Element)?.closest?.("td,th");
    const grips = this.view.editable && !this.dragging && event.buttons === 0 && hovered && this.table.contains(hovered);
    const corridor = this.gripBounds && this.view.editable && !this.dragging && event.buttons === 0
      ? tableGripCorridors({ x: event.clientX, y: event.clientY }, rect, this.gripBounds) : null;
    this.rowGrip.hidden = !grips && !corridor?.row; this.columnGrip.hidden = !grips && !corridor?.column;
    if (grips) {
      const map = TableMap.get(this.node), start = this.view.posAtDOM(this.contentDOM, 0);
      const cell = map.findCell(this.view.posAtDOM(hovered, 0) - 1 - start), bounds = hovered.getBoundingClientRect();
      this.gripBounds = bounds;
      this.hoveredBand = { row: cell.top, column: cell.left };
      Object.assign(this.rowGrip.style, { left: `${Math.max(2, rect.left - 23)}px`, top: `${(bounds.top + bounds.bottom) / 2 - 10}px` });
      Object.assign(this.columnGrip.style, { left: `${(bounds.left + bounds.right) / 2 - 10}px`, top: `${Math.max(76, rect.top - 23)}px` });
    }
    const available = this.view.editable && !this.dragging && event.buttons === 0 && rect.width > 0;
    this.addRowButton.hidden = !available || event.clientX < rect.left || event.clientX > rect.right || Math.abs(event.clientY - rect.bottom) > 16;
    this.addColumnButton.hidden = !available || event.clientY < rect.top || event.clientY > rect.bottom || Math.abs(event.clientX - rect.right) > 16;
    Object.assign(this.addRowButton.style, { left: `${Math.max(4, Math.min(window.innerWidth - 30, (rect.left + rect.right) / 2 - 13))}px`, top: `${Math.min(window.innerHeight - 30, rect.bottom + 3)}px` });
    Object.assign(this.addColumnButton.style, { left: `${Math.min(window.innerWidth - 30, rect.right + 3)}px`, top: `${Math.max(76, (rect.top + rect.bottom) / 2 - 13)}px` });
  };
  private outsideDown = (event: Event) => {
    if (!this.tools.contains(event.target as globalThis.Node) && !this.table.contains(event.target as globalThis.Node)) {
      this.dismissed = true; this.refresh();
    }
  };
  private escape = (event: KeyboardEvent) => { if (event.key === "Escape") { this.bandSession = null; this.moveSession = null; this.dropMarker.hidden = true; this.dragging = false; this.dismissed = true; this.refresh(); } };
  private contextMenu = (event: MouseEvent) => {
    if (!this.view.editable) return;
    const cell = (event.target as Element).closest("td,th"); if (!cell) return;
    event.preventDefault();
    const pos = this.view.posAtDOM(cell, 0) - 1;
    const selection = this.view.state.selection;
    // Preserve a multi-cell selection when its context menu is opened.
    if (!(selection instanceof CellSelection) || !cell.classList.contains("selectedCell")) {
      this.view.dispatch(this.view.state.tr.setSelection(CellSelection.create(this.view.state.doc, pos)));
    }
    this.dismissed = false; this.dragging = false; this.refresh();
  };
  private selectionChanged = () => {
    const { selection, doc } = this.view.state;
    if (doc !== this.lastDocument) { this.rowGrip.hidden = true; this.columnGrip.hidden = true; this.gripBounds = null; }
    if (doc !== this.lastDocument || !this.lastSelection?.eq(selection)) this.closePanels();
    this.lastDocument = doc; this.lastSelection = selection;
    cancelAnimationFrame(this.frame); this.frame = requestAnimationFrame(this.refresh);
  };
  private position = (event?: Event) => {
    this.addRowButton.hidden = true; this.addColumnButton.hidden = true;
    if (event?.type === "scroll" || event?.type === "resize") { this.rowGrip.hidden = true; this.columnGrip.hidden = true; this.gripBounds = null; }
    if (this.tools.hidden) return;
    const cells = Array.from(this.table.querySelectorAll(".selectedCell"));
    if (!cells.length) { this.tools.hidden = true; return; }
    const bounds = cells.map(cell => cell.getBoundingClientRect());
    const left = Math.min(...bounds.map(rect => rect.left)), right = Math.max(...bounds.map(rect => rect.right));
    const top = Math.min(...bounds.map(rect => rect.top)), bottom = Math.max(...bounds.map(rect => rect.bottom));
    this.tools.style.visibility = bottom < 80 || top > window.innerHeight ? "hidden" : "visible";
    const width = this.tools.offsetWidth, height = this.tools.offsetHeight;
    this.tools.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, (left + right - width) / 2))}px`;
    const bubbleTop = top - height - 8 > 80 ? top - height - 8 : Math.min(window.innerHeight - height - 8, bottom + 8);
    this.tools.style.top = `${bubbleTop}px`;
    for (const panel of [this.palette, this.menu]) {
      if (!panel.hidden) {
        const bubbleLeft = this.tools.getBoundingClientRect().left;
        const panelLeft = Math.max(8, Math.min(window.innerWidth - panel.offsetWidth - 8, bubbleLeft + width - panel.offsetWidth));
        panel.style.left = `${panelLeft - bubbleLeft}px`; panel.style.right = "auto";
      }
      const above = bubbleTop + height + panel.offsetHeight + 14 > window.innerHeight;
      panel.style.top = above ? "auto" : "calc(100% + 6px)";
      panel.style.bottom = above ? "calc(100% + 6px)" : "auto";
    }
  };
  private refresh = () => {
    this.dom.setAttribute("data-align", this.node.attrs.align || "left"); this.table.setAttribute("data-align", this.node.attrs.align || "left");
    const show = this.active() && this.view.state.selection instanceof CellSelection && !this.dragging && !this.dismissed;
    this.tools.hidden = !show;
    if (!show) { this.closePanels(); return; }
    for (const { button, available } of this.actions) button.disabled = !available();
    this.position();
  };
  update(node: PMNode) { const result = super.update(node); if (result && this.view) this.selectionChanged(); return result; }
  destroy() {
    window.clearTimeout(this.statusTimer); cancelAnimationFrame(this.frame); this.tools.remove(); this.dropMarker.remove(); this.liveStatus.remove(); this.addRowButton.remove(); this.addColumnButton.remove(); this.rowGrip.remove(); this.columnGrip.remove();
    this.view.dom.removeEventListener("pebble-table-selection", this.selectionChanged);
    this.view.dom.removeEventListener("pointerdown", this.pointerDown);
    this.table.removeEventListener("contextmenu", this.contextMenu);
    document.removeEventListener("pointerup", this.pointerUp);
    document.removeEventListener("pointermove", this.movePointer);
    document.removeEventListener("pointercancel", this.cancelMove);
    window.removeEventListener("blur", this.cancelMove);
    document.removeEventListener("pointerdown", this.outsideDown);
    document.removeEventListener("keydown", this.escape);
    window.removeEventListener("scroll", this.position, true); window.removeEventListener("resize", this.position);
  }
}

export const ControllableTable = Table.extend({
  addProseMirrorPlugins() {
    return [tableRowResizing(), stableTableColumnResizing(), ...(this.parent?.() ?? []).flatMap(plugin => plugin.spec.key === tableEditingKey ? [tableCellInteractions(), plugin] : [plugin]), new Plugin({
      props: { attributes: state => ({ "data-column-resizing": columnResizingPluginKey.getState(state)?.dragging ? "true" : "false" }) },
      view: () => ({
      update(view) { view.dom.dispatchEvent(new Event("pebble-table-selection")); },
    }) })];
  },
}).configure({ resizable: true, lastColumnResizable: false, handleWidth: 7, cellMinWidth: 48, View: EditableTableView });
