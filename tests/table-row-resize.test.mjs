import test from 'node:test';
import assert from 'node:assert/strict';
import {getSchema} from '@tiptap/core';
import {TableKit} from '@tiptap/extension-table';
import {EditorState,TextSelection} from '@tiptap/pm/state';
import {CellSelection,TableMap} from '@tiptap/pm/tables';
import {RichTextStarterKit} from '../src/features/post/rich-text-starter-kit.ts';
import {TableCellFormatting} from '../src/features/post/table-tools.ts';
import {normalizeRowHeights,pairedRowHeights,resizeTableRowBoundary} from '../src/features/post/table-row-resize.ts';
import {persistedRichHtml} from '../src/features/post/rich-content.ts';
import {htmlToMarkdown} from '../src/features/post/html-to-markdown.ts';

const schema=getSchema([RichTextStarterKit,TableKit,TableCellFormatting]);
const sum=values=>values.reduce((a,b)=>a+b,0);
function initial() {
 const rows=[100,150,120,130].map((height,index)=>schema.node('tableRow',{height},[
  schema.node('tableCell',null,schema.node('paragraph',null,schema.text(`행 ${index+1}`))),
  schema.node('tableCell',null,schema.node('paragraph')),
 ]));
 const doc=schema.node('doc',null,schema.node('table',null,rows));
 return EditorState.create({schema,doc,selection:TextSelection.create(doc,4)});
}

test('internal row boundaries preserve total height and every unrelated row',()=>{
 const measured=[100,150,120,130];
 assert.deepEqual(pairedRowHeights(measured,1,40),[100,190,80,130]);
 assert.deepEqual(pairedRowHeights(measured,1,-40),[100,110,160,130]);
 for(const boundary of [0,1,2]) for(const delta of [-10000,-35,0,35,10000]) {
  const result=pairedRowHeights(measured,boundary,delta);
  assert.equal(sum(result),sum(measured));
  result.forEach((height,index)=>{assert.ok(height>=20&&height<=1200);if(index!==boundary&&index!==boundary+1)assert.equal(height,measured[index]);});
 }
 assert.deepEqual(measured,[100,150,120,130]);
});

test('content minimums stop both directions without moving the outer boundary',()=>{
 const measured=[100,150,120,130],minimums=[25,90,80,25];
 assert.deepEqual(pairedRowHeights(measured,1,1000,minimums),[100,190,80,130]);
 assert.deepEqual(pairedRowHeights(measured,1,-1000,minimums),[100,90,180,130]);
 assert.deepEqual(pairedRowHeights([25,25],0,100,[25,25]),[25,25]);
 assert.deepEqual(pairedRowHeights([1190,100],0,100),[1200,90]);
});

test('fractional measurements keep their rounded total and invalid or outside boundaries are rejected',()=>{
 assert.equal(sum(normalizeRowHeights([99.65625,99.65625,99.6875])),299);
 for(const boundary of [-1,3,4,NaN,1.5])assert.equal(pairedRowHeights([100,150,120,130],boundary,20),null);
 for(const measured of [[],[19,100],[NaN,100],[100,1201]])assert.equal(normalizeRowHeights(measured),null);
 assert.equal(pairedRowHeights([100,100],0,NaN),null);
 assert.equal(pairedRowHeights([100,100],0,10,[20]),null);
 assert.equal(pairedRowHeights([100,100],0,10,[NaN,20]),null);
});

test('one reversible row resize preserves text, cell ranges and other row geometry',()=>{
 let before=initial();const map=TableMap.get(before.doc.firstChild);
 before=before.apply(before.tr.setSelection(CellSelection.create(before.doc,1+map.map[0],1+map.map[3])));
 const tr=resizeTableRowBoundary(before,0,[100,150,120,130],1,40),after=before.apply(tr);
 assert.deepEqual(Array.from({length:4},(_,i)=>after.doc.firstChild.child(i).attrs.height),[100,190,80,130]);
 assert.equal(after.doc.textContent,before.doc.textContent);assert.ok(after.selection.eq(before.selection));
 let restored=tr.doc;for(let i=tr.steps.length-1;i>=0;i--)restored=tr.steps[i].invert(tr.docs[i]).apply(restored).doc;
 assert.deepEqual(restored.toJSON(),before.doc.toJSON());
 assert.equal(resizeTableRowBoundary(before,0,[100,150],0,20),null);
 assert.equal(resizeTableRowBoundary(before,1,[100,150,120,130],1,20),null);
});

test('paired explicit heights survive saving and Markdown without changing their sum',()=>{
 const heights=pairedRowHeights([100,150,120,130],1,40);
 const html=`<table><tbody>${heights.map((height,i)=>`<tr style="height: ${height}px"><td><p>행 ${i+1}</p></td></tr>`).join('')}</tbody></table>`;
 const saved=persistedRichHtml(html),markdown=htmlToMarkdown(saved);
 assert.deepEqual([...markdown.matchAll(/height:\s*(\d+)px/g)].map(match=>Number(match[1])),heights);
 assert.equal(sum(heights),500);
});
