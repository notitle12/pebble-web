import { flattenBoards, type Board } from "./boards.ts";
export type BoardDrop = { id: string; position: "before" | "after" | "inside" };
export function boardMove(boards: Board[], sourceId: string, drop: BoardDrop) {
  const flat = flattenBoards(boards);
  const source = flat.find(row => row.id === sourceId);
  const target = flat.find(row => row.id === drop.id);
  if (!source || !target || source.id === target.id) throw new Error("다른 게시판을 선택해 주세요.");
  const descendants = (row: Board): string[] => row.children.flatMap(child => [child.id, ...descendants(child)]);
  if (descendants(source).includes(target.id)) throw new Error("하위 게시판으로 이동할 수 없습니다.");
  const parentId = drop.position === "inside" ? target.id : target.parentId ?? null;
  const height = (row: Board): number => 1 + Math.max(0, ...row.children.map(height));
  const depth = drop.position === "inside" ? target.depth + 1 : target.depth;
  if (depth + height(source) > 3) throw new Error("게시판은 최대 3단계로 구성할 수 있어요.");
  const siblings = flat.filter(row => (row.parentId ?? null) === parentId && row.id !== source.id);
  if (siblings.some(row => row.name === source.name)) throw new Error("이 위치에 같은 이름의 게시판이 있습니다.");
  const index = drop.position === "inside" ? siblings.length : siblings.findIndex(row => row.id === target.id) + (drop.position === "after" ? 1 : 0);
  siblings.splice(index, 0, { ...source, parentId });
  const changed = siblings.map((row, displayOrder) => ({ id: row.id, parentId, displayOrder })).filter(row => {
    const old = flat.find(item => item.id === row.id)!;
    return (old.parentId ?? null) !== row.parentId || old.displayOrder !== row.displayOrder;
  });
  // Move the subtree first; all following writes only normalize sibling order.
  return changed.sort((a, b) => Number(b.id === sourceId) - Number(a.id === sourceId));
}
