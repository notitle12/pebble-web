import test from 'node:test';
import assert from 'node:assert/strict';
import { getSchema } from '@tiptap/core';
import TextAlign from '@tiptap/extension-text-align';
import { TableKit } from '@tiptap/extension-table';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { CellSelection, TableMap, mergeCells, setCellAttr } from '@tiptap/pm/tables';
import { RichTextStarterKit } from '../src/features/post/rich-text-starter-kit.ts';
import { TableCellFormatting, tableContext, selectTablePart, setSelectedColumnWidth, toggleCornerDiagonal, setCellAlignment, moveSelectedCells, appendTableEdge, cursorInTableCell, insertTablePart, selectSingleTableCell } from '../src/features/post/table-tools.ts';
import { richContentHtml, persistedRichHtml, richEditorHtml } from '../src/features/post/rich-content.ts';
import { setTableRowHeight } from '../src/features/post/table-row-resize.ts';
import { htmlToMarkdown } from '../src/features/post/html-to-markdown.ts';

const schema = getSchema([RichTextStarterKit, TableKit, TableCellFormatting, TextAlign.configure({types:["paragraph", "heading"]})]);
function initial() {
  const cell = text => schema.node('tableCell', null, schema.node('paragraph', null, schema.text(text)));
  const row = () => schema.node('tableRow', null, [cell('가'), cell('나'), cell('다')]);
  const table = schema.node('table', null, [row(), row(), row()]);
  const doc = schema.node('doc', null, table);
  return EditorState.create({ schema, doc, selection: TextSelection.create(doc, 4), plugins: TableCellFormatting.config.addProseMirrorPlugins() });
}

test('cell, row, column and whole table selections cover the intended cells', () => {
  for (const [part, count] of [['cell', 1], ['row', 3], ['column', 3], ['table', 9]]) {
    const state = initial().apply(selectTablePart(initial(), part));
    assert.ok(state.selection instanceof CellSelection);
    let selected = 0; state.selection.forEachCell(() => selected++);
    assert.equal(selected, count);
    assert.equal(tableContext(state).cellPos, 2);
  }
});

test('column widths apply through all rows and merged cells, with invalid values rejected', () => {
  let state = initial();
  state = state.apply(setSelectedColumnWidth(state, 160));
  const map = TableMap.get(state.doc.firstChild);
  for (let row = 0; row < 3; row++) {
    assert.deepEqual(state.doc.nodeAt(1 + map.map[row * 3]).attrs.colwidth, [160]);
    assert.equal(state.doc.nodeAt(1 + map.map[row * 3 + 1]).attrs.colwidth, null);
  }
  for (const width of [0, 47, 1201, NaN, 1.5]) assert.equal(setSelectedColumnWidth(state, width), null);
  state = state.apply(selectTablePart(state, 'row'));
  mergeCells(state, tr => { state = state.apply(tr); });
  state = state.apply(setSelectedColumnWidth(state, 200));
  assert.deepEqual(state.doc.nodeAt(2).attrs.colwidth, [200, 200, 200]);
});

test('diagonal corner keeps original text and adds a second editable paragraph, undo restores it', () => {
  const original = initial();
  const tr = toggleCornerDiagonal(original);
  let state = original.apply(tr);
  assert.equal(state.doc.nodeAt(2).attrs.diagonal, true);
  assert.equal(state.doc.nodeAt(2).firstChild.textContent, '가');
  assert.equal(state.doc.nodeAt(2).childCount, 2);
  state = state.apply(toggleCornerDiagonal(state));
  assert.equal(state.doc.nodeAt(2).attrs.diagonal, false);
  state = EditorState.create({ schema, doc: original.doc, selection: TextSelection.create(original.doc, 9) });
  assert.equal(toggleCornerDiagonal(state), null);
  let restored = tr.doc;
  for (let i = tr.steps.length - 1; i >= 0; i--) restored = tr.steps[i].invert(tr.docs[i]).apply(restored).doc;
  assert.deepEqual(restored.toJSON(), original.doc.toJSON());
});

test('cell colors apply to every selected cell', () => {
  let state = initial(); state = state.apply(selectTablePart(state, 'row'));
  setCellAttr('backgroundColor', '#e8eff8')(state, tr => { state = state.apply(tr); });
  state.selection.forEachCell(cell => assert.equal(cell.attrs.backgroundColor, '#e8eff8'));
});

test('formatted tables survive saving, editor reload, and Markdown switching', () => {
  const source = '<table style="width: 320px; min-width: 320px"><colgroup><col style="width: 160px"><col style="width: 160px"></colgroup><tbody><tr><th colwidth="160" data-diagonal="backslash" style="background-color: #e8eff8"><p>요일</p><p>시간</p></th><th colwidth="160"><p>월</p></th></tr><tr><td colspan="2" colwidth="160,160"><p>내용</p></td></tr></tbody></table>';
  for (const html of [persistedRichHtml(source), richEditorHtml(source, 'HTML'), richContentHtml(htmlToMarkdown(persistedRichHtml(source)), 'MARKDOWN')]) {
    assert.match(html, /data-diagonal="backslash"/);
    assert.match(html, /colwidth="160,160"/);
    assert.match(html, /background-color:#e8eff8/);
    assert.match(html, /<col style="width:160px"/);
    assert.match(html, /width:320px/);
    assert.match(html, /<p>요일<\/p><p>시간<\/p>/);
  }
  const unsafe = persistedRichHtml('<table><tr><td data-diagonal="evil" colwidth="NaN" onclick="alert(1)">x</td></tr></table>');
  assert.doesNotMatch(unsafe, /evil|NaN|onclick/);
});


test('table edits clear diagonal formatting outside an unmerged corner cell', () => {
  let state = initial();
  const context = tableContext(state);
  const tr = state.tr;
  for (const offset of context.map.map) {
    const pos = context.start + offset;
    tr.setNodeMarkup(pos, undefined, { ...state.doc.nodeAt(pos).attrs, diagonal: true });
  }
  state = state.apply(tr);
  const diagonals = [];
  state.doc.descendants((node, pos) => { if (node.attrs.diagonal) diagonals.push(pos); });
  assert.deepEqual(diagonals, [2]);
  state = state.apply(selectTablePart(state, 'row'));
  mergeCells(state, next => { state = state.apply(next); });
  assert.equal(state.doc.nodeAt(2).attrs.diagonal, false);
});


test('cell alignment updates only selected cells and their paragraphs', () => {
  let state = initial();
  state = state.apply(setCellAlignment(state, 'right'));
  assert.equal(state.doc.nodeAt(2).attrs.align, 'right');
  assert.equal(state.doc.nodeAt(2).firstChild.attrs.textAlign, 'right');
  assert.equal(state.doc.nodeAt(7).attrs.align, null);
  state = state.apply(selectTablePart(state, 'column'));
  state = state.apply(setCellAlignment(state, 'center'));
  state.selection.forEachCell(cell => {
    assert.equal(cell.attrs.align, 'center');
    assert.equal(cell.firstChild.attrs.textAlign, 'center');
  });
  assert.equal(state.doc.nodeAt(7).attrs.align, null);
});

test('independent body cell alignments survive Markdown switching', () => {
  const source = '<table><tbody><tr><th>항목</th><th>설명</th></tr><tr><td style="text-align:right"><p style="text-align:right">내용</p></td><td style="text-align:left"><p>다른 칸</p></td></tr></tbody></table>';
  const result = richContentHtml(htmlToMarkdown(persistedRichHtml(source)), 'MARKDOWN');
  assert.match(result, /<td style="text-align:right"><p style="text-align:right">내용/);
  assert.match(result, /<td style="text-align:left"><p>다른 칸/);
});


function moveFixture() {
  const rows = [['첫 번째 긴 내용', 'B', 'C'], ['D', '두 번째', 'F'], ['G', 'H', 'I']].map((values, row) =>
    schema.node('tableRow', null, values.map((text, col) => schema.node('tableCell', { colwidth: [100 + col * 30], backgroundColor: row === 0 && col === 0 ? '#e8eff8' : null }, schema.node('paragraph', null, schema.text(text))))));
  const doc = schema.node('doc', null, schema.node('table', null, rows));
  return EditorState.create({schema, doc, selection: CellSelection.create(doc, 2)});
}
const cellAt = (state, row, col) => state.doc.firstChild.child(row).child(col);
const cellPosAt = (state, row, col) => 1 + TableMap.get(state.doc.firstChild).map[row * 3 + col];

test('cell moves exchange occupied contents and formatting while column widths stay in place', () => {
  const before = moveFixture();
  const tr = moveSelectedCells(before, cellPosAt(before, 1, 1));
  const after = before.apply(tr);
  assert.equal(cellAt(after, 1, 1).textContent, '첫 번째 긴 내용');
  assert.equal(cellAt(after, 0, 0).textContent, '두 번째');
  assert.equal(cellAt(after, 1, 1).attrs.backgroundColor, '#e8eff8');
  assert.deepEqual(cellAt(after, 1, 1).attrs.colwidth, [130]);
  assert.deepEqual(cellAt(after, 0, 0).attrs.colwidth, [100]);
  assert.equal(after.selection.$anchorCell.nodeAfter.textContent, '첫 번째 긴 내용');
  let restored = tr.doc;
  for (let i = tr.steps.length - 1; i >= 0; i--) restored = tr.steps[i].invert(tr.docs[i]).apply(restored).doc;
  assert.deepEqual(restored.toJSON(), before.doc.toJSON());
});

test('rectangular selections move as a unit with destination selection retained', () => {
  let state = moveFixture();
  state = state.apply(state.tr.setSelection(CellSelection.create(state.doc, cellPosAt(state, 0, 0), cellPosAt(state, 0, 1))));
  state = state.apply(moveSelectedCells(state, cellPosAt(state, 2, 1)));
  assert.equal(cellAt(state, 2, 1).textContent, '첫 번째 긴 내용');
  assert.equal(cellAt(state, 2, 2).textContent, 'B');
  assert.equal(cellAt(state, 0, 0).textContent, 'H');
  assert.equal(cellAt(state, 0, 1).textContent, 'I');
  let count = 0; state.selection.forEachCell(() => count++); assert.equal(count, 2);
});

test('invalid, overlapping, out-of-bounds and merged destinations do not modify contents', () => {
  let state = moveFixture();
  assert.equal(moveSelectedCells(state, 0), null);
  assert.equal(moveSelectedCells(state, cellPosAt(state, 0, 0)), null);
  state = state.apply(state.tr.setSelection(CellSelection.create(state.doc, cellPosAt(state, 0, 0), cellPosAt(state, 0, 1))));
  assert.equal(moveSelectedCells(state, cellPosAt(state, 0, 1)), null);
  assert.equal(moveSelectedCells(state, cellPosAt(state, 2, 2)), null);
  mergeCells(state, tr => { state = state.apply(tr); });
  assert.equal(moveSelectedCells(state, cellPosAt(state, 2, 0)), null);
});


test('row resizing preserves cell contents and other row heights and can be undone', () => {
  const before = initial();
  const tr = setTableRowHeight(before, 1, 144);
  const after = before.apply(tr);
  assert.equal(after.doc.firstChild.firstChild.attrs.height, 144);
  assert.equal(after.doc.firstChild.child(1).attrs.height, null);
  assert.equal(after.doc.textContent, before.doc.textContent);
  assert.deepEqual(tr.steps[0].invert(tr.docs[0]).apply(tr.doc).doc.toJSON(), before.doc.toJSON());
  for (const height of [0, 19, 1201, NaN, 50.5]) assert.equal(setTableRowHeight(before, 1, height), null);
  assert.equal(setTableRowHeight(before, 2, 100), null);
});

test('edge add buttons append at the end regardless of the text cursor position', () => {
  for (const edge of ['row','column']) {
    const before = initial();
    const after = before.apply(appendTableEdge(before, 0, edge));
    const table = after.doc.firstChild;
    assert.equal(table.childCount, edge === 'row' ? 4 : 3);
    assert.equal(TableMap.get(table).width, edge === 'column' ? 4 : 3);
    assert.equal(table.firstChild.firstChild.textContent, '가');
    if (edge === 'row') assert.equal(table.lastChild.textContent, '');
    else table.forEach(row => assert.equal(row.lastChild.textContent, ''));
  }
});

test('row heights survive save, Markdown switching and editor reload', () => {
  const source = '<table><tbody><tr style="height:144px"><td><p>가운데</p></td></tr></tbody></table>';
  for (const html of [persistedRichHtml(source), richEditorHtml(source, 'HTML'), richContentHtml(htmlToMarkdown(persistedRichHtml(source)), 'MARKDOWN')]) assert.match(html, /height:144px/);
  assert.doesNotMatch(persistedRichHtml(source.replace('144px','99999px')), /height:/);
});


test('edge additions retain the original caret or selected cells', () => {
  for (const edge of ['row','column']) {
    for (const part of [null,'cell','row']) {
      let state = initial();
      if (part) state = state.apply(selectTablePart(state,part));
      const after = state.apply(appendTableEdge(state,0,edge));
      if (state.selection instanceof CellSelection) {
        assert.equal(after.selection.$anchorCell.nodeAfter.textContent, state.selection.$anchorCell.nodeAfter.textContent);
        assert.equal(after.selection.$headCell.nodeAfter.textContent, state.selection.$headCell.nodeAfter.textContent);
      } else assert.ok(after.selection.eq(state.selection.map(after.doc, appendTableEdge(state,0,edge).mapping)));
      assert.equal(tableContext(after).cellPos, tableContext(state).cellPos);
      assert.equal(after.selection.constructor, state.selection.constructor);
      assert.equal(tableContext(after).map.width, edge === 'column' ? 4 : 3);
    }
  }
});

test('entering an empty cell replaces a rectangle selection with a ready insertion cursor', () => {
  let state = initial();
  const pos = cellPosAt(state, 1, 1);
  const cell = state.doc.nodeAt(pos);
  state = state.apply(state.tr.replaceWith(pos + 1, pos + cell.nodeSize - 1, schema.node('paragraph')));
  state = state.apply(selectTablePart(state, 'table'));
  state = state.apply(cursorInTableCell(state.tr, pos));
  assert.ok(state.selection instanceof TextSelection);
  assert.equal(state.selection.empty, true);
  assert.equal(tableContext(state).cellPos, pos);
  state = state.apply(state.tr.insertText('바로 입력'));
  assert.equal(state.doc.nodeAt(pos).textContent, '바로 입력');
});


test('menu insertions preserve the original caret or cell range before and after the insertion', () => {
  for (const edge of ['row','column']) for (const before of [true,false]) for (const part of [null,'row','table']) {
    let state = initial();
    if (part) state=state.apply(selectTablePart(state,part));
    const tr=insertTablePart(state,edge,before), after=state.apply(tr);
    if (state.selection instanceof CellSelection) {
      assert.equal(after.selection.$anchorCell.pos,tr.mapping.map(state.selection.$anchorCell.pos,1));
      assert.equal(after.selection.$headCell.pos,tr.mapping.map(state.selection.$headCell.pos,1));
    } else assert.ok(after.selection.eq(state.selection.map(after.doc,tr.mapping)));
    assert.equal(after.selection.constructor,state.selection.constructor);
    assert.equal(after.doc.nodeAt(tableContext(after).cellPos).textContent,'가');
  }
});


test('single-cell selection is stable across repeated double clicks and replaces multi-cell selections', () => {
  let state = initial();
  for (const [row,col] of [[0,0],[1,1],[2,2]]) {
    const pos = cellPosAt(state,row,col);
    state = state.apply(selectTablePart(state,'table'));
    for (let repeat = 0; repeat < 3; repeat++) {
      state = state.apply(selectSingleTableCell(state,pos));
      assert.ok(state.selection instanceof CellSelection);
      assert.equal(state.selection.$anchorCell.pos,pos);
      assert.equal(state.selection.$headCell.pos,pos);
      let count=0; state.selection.forEachCell(()=>count++); assert.equal(count,1);
    }
    // The following single click returns to editing.
    state = state.apply(cursorInTableCell(state.tr,pos));
    assert.ok(state.selection instanceof TextSelection);
  }
  assert.equal(selectSingleTableCell(state,0),null);
});


test('compact row heights down to 20px survive saving and Markdown switching', () => {
  for (const height of [20,24,28,35]) {
    const state=initial(); const after=state.apply(setTableRowHeight(state,1,height));
    assert.equal(after.doc.firstChild.firstChild.attrs.height,height);
    const html=`<table><tr style="height:${height}px"><td><p>내용</p></td></tr></table>`;
    assert.match(richEditorHtml(html,'HTML'),new RegExp(`height:${height}px`));
    assert.match(richContentHtml(htmlToMarkdown(persistedRichHtml(html)),'MARKDOWN'),new RegExp(`height:${height}px`));
  }
});
