import { flattenBoards, type Board } from "./boards.ts";
import { boardMove, type BoardDrop } from "./board-order.ts";

export type BoardDraftTree = Board[];
export type BoardBaseRow = { id: string; name: string; parentId: string | null; displayOrder: number };
export type BoardDraftNode = { id: string | null; name: string; children: BoardDraftNode[] };
export type BoardTreeSaveBody = { base: BoardBaseRow[]; boards: BoardDraftNode[] };

export function cloneBoardTree(boards: Board[]): BoardDraftTree {
  return boards.map(board => ({
    ...board,
    parentId: board.parentId ?? null,
    children: cloneBoardTree(board.children),
  }));
}

export function nextDraftBoardName(boards: Board[]): string {
  const names = new Set(boards.map(board => board.name));
  if (!names.has("새 게시판")) return "새 게시판";
  let suffix = 2;
  while (names.has(`새 게시판 ${suffix}`)) suffix++;
  return `새 게시판 ${suffix}`;
}

export function createDraftBoard(boards: Board[], id: string, name = nextDraftBoardName(boards)): BoardDraftTree {
  const roots = boards.map((board, displayOrder) => ({ ...board, displayOrder: displayOrder + 1 }));
  return [{ id, name, parentId: null, displayOrder: 0, children: [] }, ...roots];
}

export function renameDraftBoard(boards: Board[], id: string, value: string): BoardDraftTree {
  const board = flattenBoards(boards).find(item => item.id === id);
  if (!board) throw new Error("게시판을 찾을 수 없습니다.");
  const name = value.trim();
  if (!name || Array.from(name).length > 50 || /[\u0000]/u.test(name) || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(name)) {
    throw new Error("게시판 이름은 올바른 문자로 1~50자여야 합니다.");
  }
  const siblings = flattenBoards(boards).filter(item => (item.parentId ?? null) === (board.parentId ?? null) && item.id !== id);
  if (siblings.some(item => item.name === name)) throw new Error("같은 위치에 같은 이름의 게시판이 있습니다.");
  return mapTree(boards, item => item.id === id ? { ...item, name } : item);
}

export function moveDraftBoard(boards: Board[], sourceId: string, drop: BoardDrop): BoardDraftTree {
  const changes = boardMove(boards, sourceId, drop);
  if (changes.length === 0) return boards;
  const updated = new Map(changes.map(change => [change.id, change]));
  const rows = flattenBoards(boards).map(board => {
    const change = updated.get(board.id);
    return {
      ...board,
      parentId: change ? change.parentId : board.parentId ?? null,
      displayOrder: change ? change.displayOrder : board.displayOrder,
      children: [] as Board[],
    };
  });
  const byId = new Map(rows.map(row => [row.id, row]));
  const roots: Board[] = [];
  for (const row of rows) {
    if (row.parentId === null) roots.push(row);
    else {
      const parent = byId.get(row.parentId);
      if (!parent) throw new Error("상위 게시판을 찾을 수 없습니다.");
      parent.children.push(row);
    }
  }
  const sort = (items: Board[]) => {
    items.sort((a, b) => a.displayOrder - b.displayOrder);
    items.forEach(item => sort(item.children));
  };
  sort(roots);
  return roots;
}

export function deleteDraftBoard(boards: Board[], id: string): BoardDraftTree {
  const board = flattenBoards(boards).find(item => item.id === id);
  if (!board) return boards;
  if (board.children.length) throw new Error("하위 게시판이 있는 게시판은 먼저 하위를 이동하거나 삭제해 주세요.");
  const remove = (items: Board[]): Board[] => items
    .filter(item => item.id !== id)
    .map((item, displayOrder) => ({ ...item, displayOrder, children: remove(item.children) }));
  return remove(boards);
}

export function buildBoardTreeSaveBody(original: Board[], draft: Board[]): BoardTreeSaveBody {
  const base = flattenBoards(original).map(({ id, name, parentId, displayOrder }) => ({
    id,
    name,
    parentId: parentId ?? null,
    displayOrder,
  }));
  const serialize = (items: Board[]): BoardDraftNode[] => items.map(board => ({
    id: board.id.startsWith("draft:") ? null : board.id,
    name: board.name,
    children: serialize(board.children),
  }));
  return { base, boards: serialize(draft) };
}

export function sameBoardTree(left: Board[], right: Board[]): boolean {
  const shape = (items: Board[]): unknown[] => items.map(board => ({
    id: board.id,
    name: board.name,
    parentId: board.parentId ?? null,
    displayOrder: board.displayOrder,
    children: shape(board.children),
  }));
  return JSON.stringify(shape(left)) === JSON.stringify(shape(right));
}

function mapTree(items: Board[], mapper: (board: Board) => Board): Board[] {
  return items.map(item => mapper({ ...item, children: mapTree(item.children, mapper) }));
}
