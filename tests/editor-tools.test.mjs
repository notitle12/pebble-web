import test from 'node:test';
import assert from 'node:assert/strict';
import { getSchema } from '@tiptap/core';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { newlineInCode, exitCode } from '@tiptap/pm/commands';
import { Node } from '@tiptap/core';
import { RichTextStarterKit } from '../src/features/post/rich-text-starter-kit.ts';
import { TextPanel, StyledDivider, CodeKeyboard, slashMatch } from '../src/features/post/editor-tools.ts';
import { richContentHtml } from '../src/features/post/rich-content.ts';
import { htmlToMarkdown } from '../src/features/post/html-to-markdown.ts';
const schema = getSchema([RichTextStarterKit.configure({codeBlock:false,horizontalRule:false}),TextPanel,StyledDivider,CodeKeyboard,Node.create({name:'pebbleCode',group:'block',content:'text*',code:true})]);
const p = text => schema.node('paragraph',null,text ? schema.text(text) : undefined);
const stateAt = (node,from,to=from) => {const doc=schema.node('doc',null,node);return EditorState.create({schema,doc,selection:TextSelection.create(doc,from,to)});};

test('code Enter inserts newlines and replaces selections; Mod-Enter exits the custom node',()=>{
 let state=stateAt(schema.node('pebbleCode',null,schema.text('firstsecond')),6);
 assert.equal(newlineInCode(state,tr=>{state=state.apply(tr);}),true);
 assert.equal(state.doc.firstChild.textContent,'first\nsecond');
 assert.equal(state.doc.childCount,1);
 state=EditorState.create({schema,doc:state.doc,selection:TextSelection.create(state.doc,1,6)});
 newlineInCode(state,tr=>{state=state.apply(tr);});
 assert.equal(state.doc.firstChild.textContent,'\n\nsecond');
 assert.equal(exitCode(state,tr=>{state=state.apply(tr);}),true);
 assert.equal(state.selection.$from.parent.type.name,'paragraph');
 assert.equal(newlineInCode(state),false);
});
test('slash commands match paragraph starts and ignore code, URLs and text selections',()=>{
 assert.deepEqual(slashMatch(stateAt(p('/코드'),4)),{from:1,to:4,query:'코드'});
 assert.equal(slashMatch(stateAt(p('https://x'),10)),null);
 assert.equal(slashMatch(stateAt(schema.node('pebbleCode',null,schema.text('/code')),6)),null);
 assert.equal(slashMatch(stateAt(p('/code'),1,6)),null);
 assert.deepEqual(slashMatch(stateAt(schema.node('textPanel',null,p('/표')),4)),{from:2,to:4,query:'표'});
});
test('text panels and all divider variants survive sanitizing and Markdown round trips',()=>{
 const source='<div class="post-text-block"><p><strong>중요</strong></p><ul><li><p>목록</p></li></ul></div>' + ['solid','dashed','double','short'].map(x=>`<hr class="post-divider-${x}">`).join('');
 const html=richContentHtml(source,'HTML');
 assert.match(html,/class="post-text-block"/);
 const roundtrip=richContentHtml(htmlToMarkdown(html),'MARKDOWN');
 assert.match(roundtrip,/class="post-text-block"/);
 for(const style of ['dashed','double','short']) assert.match(roundtrip,new RegExp(`class="post-divider-${style}"`));
 assert.doesNotMatch(richContentHtml('<div class="evil" onclick="alert(1)">text</div><hr class="post-divider-evil">','HTML'),/evil|onclick/);
});
