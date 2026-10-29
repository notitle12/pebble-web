import test from 'node:test';
import assert from 'node:assert/strict';
import {getSchema} from '@tiptap/core';
import {TableKit} from '@tiptap/extension-table';
import {EditorState,TextSelection} from '@tiptap/pm/state';
import {CellSelection,TableMap,mergeCells} from '@tiptap/pm/tables';
import {RichTextStarterKit} from '../src/features/post/rich-text-starter-kit.ts';
import {TableCellFormatting,selectTablePart} from '../src/features/post/table-tools.ts';
import {fitTableSelection,setCellVerticalAlignment,setSelectionBorders,moveTableBand} from '../src/features/post/table-layout.ts';
import {persistedRichHtml,richEditorHtml,richContentHtml} from '../src/features/post/rich-content.ts';
import {htmlToMarkdown} from '../src/features/post/html-to-markdown.ts';
const schema=getSchema([RichTextStarterKit,TableKit,TableCellFormatting]);
function initial() {
 const rows=[['A','B','C'],['D','E','F'],['G','H','I']].map((values,i)=>schema.node('tableRow',{height:[25,55,100][i]},values.map((text,c)=>schema.node(i===0?'tableHeader':'tableCell',{colwidth:[[80],[160],[240]][c]},schema.node('paragraph',null,schema.text(text))))));
 const doc=schema.node('doc',null,schema.node('table',null,rows));
 return EditorState.create({schema,doc,selection:TextSelection.create(doc,4)});
}
const selected=state=>state.apply(selectTablePart(state,'table'));
const cell=(state,r,c)=>state.doc.firstChild.child(r).child(c);
const settings={color:'#123456',width:2,style:'solid'};

test('uniform column widths and row heights use the selected range and keep content and selection',()=>{
 let state=selected(initial());
 const before=state.doc.textContent;
 state=state.apply(fitTableSelection(state,'columns',{widths:[80,160,240],heights:[25,55,100]}));
 for(let r=0;r<3;r++)for(let c=0;c<3;c++)assert.deepEqual(cell(state,r,c).attrs.colwidth,[160]);
 assert.equal(state.doc.textContent,before);assert.ok(state.selection instanceof CellSelection);
 state=state.apply(fitTableSelection(state,'rows',{widths:[160,160,160],heights:[25,55,100]}));
 state.doc.firstChild.forEach(row=>assert.equal(row.attrs.height,60));
});
test('content fitting clears selected fixed row heights and keeps other column widths stable',()=>{
 let state=initial();state=state.apply(fitTableSelection(state,'content',{widths:[80,160,240],heights:[25,55,100],contentWidths:[62,300,90]}));
 assert.deepEqual(cell(state,0,0).attrs.colwidth,[62]);assert.deepEqual(cell(state,1,0).attrs.colwidth,[62]);
 assert.deepEqual(cell(state,0,1).attrs.colwidth,[160]);assert.equal(state.doc.firstChild.firstChild.attrs.height,null);assert.equal(state.doc.firstChild.child(1).attrs.height,55);
});
test('vertical alignment applies to the selected cells independently',()=>{
 let state=initial();state=state.apply(setCellVerticalAlignment(state,'bottom'));
 assert.equal(cell(state,0,0).attrs.verticalAlign,'bottom');assert.equal(cell(state,0,1).attrs.verticalAlign,null);
 state=selected(state);state=state.apply(setCellVerticalAlignment(state,'top'));state.selection.forEachCell(c=>assert.equal(c.attrs.verticalAlign,'top'));
});
test('row and column reordering moves content, heading cells, widths and row heights as a unit',()=>{
 let state=initial();const before=state.doc;
 const tr=moveTableBand(state,0,'row',0,2);state=state.apply(tr);
 assert.equal(cell(state,2,0).textContent,'A');assert.equal(state.doc.firstChild.child(2).attrs.height,25);assert.equal(cell(state,2,0).type.name,'tableHeader');
 assert.equal(cell(state,0,0).textContent,'D');assert.equal(state.doc.firstChild.firstChild.attrs.height,55);
 let restored=tr.doc;for(let i=tr.steps.length-1;i>=0;i--)restored=tr.steps[i].invert(tr.docs[i]).apply(restored).doc;assert.deepEqual(restored.toJSON(),before.toJSON());
 state=initial();state=state.apply(moveTableBand(state,0,'column',0,2));
 assert.deepEqual([0,1,2].map(c=>cell(state,0,c).textContent),['B','C','A']);assert.deepEqual(cell(state,0,2).attrs.colwidth,[80]);assert.equal(state.selection.$anchorCell.nodeAfter.textContent,'A');
});
test('reordering refuses invalid and merged geometry without losing contents',()=>{
 let state=initial();assert.equal(moveTableBand(state,0,'row',0,0),null);assert.equal(moveTableBand(state,0,'column',0,3),null);
 state=state.apply(selectTablePart(state,'row'));mergeCells(state,tr=>{state=state.apply(tr);});assert.equal(moveTableBand(state,0,'row',0,2),null);
});
test('outer borders hide internal edges while shared neighbor edges can be restored',()=>{
 let state=selected(initial());state=state.apply(setSelectionBorders(state,'outer',settings));
 assert.equal(cell(state,0,0).attrs.borderTop,'2px solid #123456');assert.equal(cell(state,1,1).attrs.borderTop,'0px hidden');assert.equal(cell(state,1,1).attrs.borderRight,'0px hidden');assert.equal(cell(state,2,2).attrs.borderBottom,'2px solid #123456');
 const pos=1+TableMap.get(state.doc.firstChild).map[4];state=state.apply(state.tr.setSelection(CellSelection.create(state.doc,pos)));
 state=state.apply(setSelectionBorders(state,'top',settings));assert.equal(cell(state,1,1).attrs.borderTop,'2px solid #123456');assert.equal(cell(state,0,1).attrs.borderBottom,'2px solid #123456');
 state=state.apply(setSelectionBorders(state,'reset',settings));assert.equal(cell(state,1,1).attrs.borderTop,null);assert.equal(cell(state,0,1).attrs.borderBottom,null);
 assert.equal(setSelectionBorders(state,'all',{...settings,color:'url(javascript:1)'}),null);
});
test('borders and vertical alignment survive save, Markdown and editor reload',()=>{
 const source='<table><tbody><tr><td style="vertical-align:bottom;border-top:2px solid #123456;border-bottom:0px hidden"><p>내용</p></td></tr></tbody></table>';
 for(const html of [persistedRichHtml(source),richEditorHtml(source,'HTML'),richContentHtml(htmlToMarkdown(persistedRichHtml(source)),'MARKDOWN')]) {
  assert.match(html,/vertical-align:bottom/);assert.match(html,/border-top:2px solid #123456/);assert.match(html,/border-bottom:0px hidden/);
 }
 assert.doesNotMatch(persistedRichHtml(source.replace('2px solid #123456','99px solid red')),/99px/);
});
