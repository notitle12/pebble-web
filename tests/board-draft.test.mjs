import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBoardTreeSaveBody,
  createDraftBoard,
  deleteDraftBoard,
  moveDraftBoard,
  renameDraftBoard,
} from '../src/features/board/api/board-draft.ts';

const row = (id, name, parentId = null, displayOrder = 0, children = []) => ({ id, name, parentId, displayOrder, children });
const original = [row('1', '개발', null, 0, [row('2', 'Java', '1')]), row('3', '일상', null, 1)];

test('새 게시판은 초안 맨 위에 추가되고 기존 형제 순서를 밀어 둔다', () => {
  const draft = createDraftBoard(original, 'draft:local-1');
  assert.deepEqual(draft.map(board => [board.id, board.name, board.displayOrder]), [
    ['draft:local-1', '새 게시판', 0], ['1', '개발', 1], ['3', '일상', 2],
  ]);
  assert.deepEqual(draft[1].children.map(board => board.id), ['2']);
});

test('기본 이름이 이미 있으면 빈 접미 숫자를 고른다', () => {
  const first = createDraftBoard(original, 'draft:local-1');
  const second = createDraftBoard(first, 'draft:local-2');
  assert.deepEqual(second.slice(0, 2).map(board => board.name), ['새 게시판 2', '새 게시판']);
  const third = createDraftBoard(second, 'draft:local-3');
  assert.equal(third[0].name, '새 게시판 3');
});

test('이름 편집은 초안만 바꾸고 중복·빈 이름을 거부한다', () => {
  const renamed = renameDraftBoard(original, '2', 'Kotlin');
  assert.equal(renamed[0].children[0].name, 'Kotlin');
  assert.equal(original[0].children[0].name, 'Java');
  assert.throws(() => renameDraftBoard(original, '3', '개발'), /같은 위치/);
  assert.throws(() => renameDraftBoard(original, '2', '  '), /1~50자/);
});

test('이동·삭제는 트리 구조와 표시 순서를 초안에서 계산한다', () => {
  const moved = moveDraftBoard(original, '3', { id: '1', position: 'inside' });
  assert.deepEqual(moved.map(board => board.id), ['1']);
  assert.deepEqual(moved[0].children.map(board => [board.id, board.displayOrder]), [['2', 0], ['3', 1]]);
  const deleted = deleteDraftBoard(moved, '2');
  assert.deepEqual(deleted[0].children.map(board => [board.id, board.displayOrder]), [['3', 0]]);
  assert.throws(() => deleteDraftBoard(original, '1'), /하위 게시판/);
});

test('저장 요청은 원래 전체 트리와 중첩 초안만 직렬화하고 로컬 ID를 null로 바꾼다', () => {
  const draft = createDraftBoard(original, 'draft:local-1');
  const body = buildBoardTreeSaveBody(original, draft);
  assert.deepEqual(body.base, [
    { id: '1', name: '개발', parentId: null, displayOrder: 0 },
    { id: '2', name: 'Java', parentId: '1', displayOrder: 0 },
    { id: '3', name: '일상', parentId: null, displayOrder: 1 },
  ]);
  assert.deepEqual(body.boards, [
    { id: null, name: '새 게시판', children: [] },
    { id: '1', name: '개발', children: [{ id: '2', name: 'Java', children: [] }] },
    { id: '3', name: '일상', children: [] },
  ]);
  assert.deepEqual(Object.keys(body), ['base', 'boards']);
});

test('새 게시판끼리 중첩 이동하면 요청은 null ID와 children으로 부모 관계를 표현한다', () => {
  const parent = createDraftBoard(original, 'draft:parent');
  const withChild = createDraftBoard(parent, 'draft:child');
  const nested = moveDraftBoard(withChild, 'draft:child', { id: 'draft:parent', position: 'inside' });
  const body = buildBoardTreeSaveBody(original, nested);
  assert.deepEqual(body.boards[0], {
    id: null,
    name: '새 게시판',
    children: [{ id: null, name: '새 게시판 2', children: [] }],
  });
  assert.deepEqual(body.base[0], { id: '1', name: '개발', parentId: null, displayOrder: 0 });
});
