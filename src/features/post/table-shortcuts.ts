import { Extension } from "@tiptap/core";
import type { Command } from "@tiptap/pm/state";
import { mergeCells, splitCell } from "@tiptap/pm/tables";
import { insertTablePart, selectTablePart, setCellAlignment, tableContext } from "./table-tools.ts";

const transactionCommand = (create: (state: Parameters<Command>[0]) => ReturnType<typeof insertTablePart>): Command => (state, dispatch) => {
  const tr = create(state); if (!tr) return false;
  dispatch?.(tr); return true;
};

export const tableShortcuts: { label: string; key: string; hint: string; aria: string; command: Command }[] = [
  ...([["위에 행 추가", "ArrowUp", "↑", "row", true], ["아래에 행 추가", "ArrowDown", "↓", "row", false], ["왼쪽에 열 추가", "ArrowLeft", "←", "column", true], ["오른쪽에 열 추가", "ArrowRight", "→", "column", false]] as const).map(([label, arrow, symbol, edge, before]) => ({
    label, key: `Mod-Alt-${arrow}`, hint: `⌘/Ctrl + Alt + ${symbol}`, aria: `Meta+Alt+${arrow} Control+Alt+${arrow}`,
    command: transactionCommand(state => insertTablePart(state, edge, before)),
  })),
  { label: "표 전체 선택", key: "Mod-a", hint: "⌘/Ctrl + A", aria: "Meta+a Control+a", command: transactionCommand(state => selectTablePart(state, "table")) },
  { label: "행 선택", key: "Shift-Space", hint: "Shift + Space", aria: "Shift+Space", command: transactionCommand(state => selectTablePart(state, "row")) },
  { label: "열 선택", key: "Mod-Shift-Space", hint: "⌘/Ctrl + Shift + Space", aria: "Meta+Shift+Space Control+Shift+Space", command: transactionCommand(state => selectTablePart(state, "column")) },
  { label: "셀 병합", key: "Mod-Shift-m", hint: "⌘/Ctrl + Shift + M", aria: "Meta+Shift+m Control+Shift+m", command: mergeCells },
  { label: "셀 분할", key: "Mod-Alt-Shift-m", hint: "⌘/Ctrl + Alt + Shift + M", aria: "Meta+Alt+Shift+m Control+Alt+Shift+m", command: splitCell },
  ...([["왼쪽", "left", "l"], ["가운데", "center", "e"], ["오른쪽", "right", "r"]] as const).map(([label, align, letter]) => ({
    label: `셀 ${label} 정렬`, key: `Mod-Shift-${letter}`, hint: `⌘/Ctrl + Shift + ${letter.toUpperCase()}`, aria: `Meta+Shift+${letter} Control+Shift+${letter}`,
    command: transactionCommand(state => setCellAlignment(state, align)),
  })),
];

export const TableShortcuts = Extension.create({
  name: "pebbleTableShortcuts", priority: 1100,
  addKeyboardShortcuts() {
    const bindings = Object.fromEntries(tableShortcuts.map(shortcut => [shortcut.key, () => {
      if (!this.editor.isEditable || this.editor.view.composing || !tableContext(this.editor.state)) return false;
      shortcut.command(this.editor.state, this.editor.view.dispatch, this.editor.view);
      return true;
    }]));
    bindings["Ctrl-a"] = bindings["Mod-a"];
    return bindings;
  },
});
