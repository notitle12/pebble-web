import test from 'node:test';
import assert from 'node:assert/strict';
import { Schema } from '@tiptap/pm/model';
import { EditorState } from '@tiptap/pm/state';
import { contrastRatio, highlightThemePair, parseThemeColor, textThemePair } from '../src/features/post/theme-color.ts';
import { addThemeColorsToSanitizedHtml, ThemeTextDecorations } from '../src/features/post/theme-text-rendering.ts';

test('text colors map to readable light and dark variants without changing authored attrs', () => {
  const attrs = { color: '#eeeeee' };
  const original = structuredClone(attrs);
  const pair = textThemePair(attrs.color);
  assert.ok(pair);
  assert.ok(contrastRatio(parseThemeColor(pair.light), parseThemeColor('#ffffff')) >= 4.5);
  assert.ok(contrastRatio(parseThemeColor(pair.dark), parseThemeColor('#17211b')) >= 4.5);
  assert.deepEqual(attrs, original);
});

test('RGB alpha is composited and invalid CSS colors are ignored', () => {
  assert.deepEqual(parseThemeColor('rgba(255, 0, 0, .5)'), { r: 255, g: 0, b: 0, a: .5 });
  assert.equal(textThemePair('url(javascript:alert(1))'), null);
  assert.equal(textThemePair('currentColor'), null);
});

test('editor decorations adapt rendering but leave canonical ProseMirror JSON intact', () => {
  const schema = new Schema({
    nodes: { doc: { content: 'block+' }, paragraph: { content: 'inline*', group: 'block' }, text: { group: 'inline' }, pebbleCode: { group: 'block', atom: true } },
    marks: { textStyle: { attrs: { color: {} } }, highlight: { attrs: { color: {} } } },
  });
  const doc = schema.node('doc', null, [schema.node('paragraph', null, [schema.text('color', [schema.mark('textStyle', { color: '#eeeeee' })])])]);
  const before = doc.toJSON();
  const plugins = ThemeTextDecorations.config.addProseMirrorPlugins.call({});
  const state = EditorState.create({ schema, doc, plugins });
  const decorations = plugins[0].props.decorations(state);
  assert.equal(decorations.find().length, 1);
  assert.match(decorations.find()[0].type.attrs.style, /--pebble-text-dark:/);
  assert.deepEqual(state.doc.toJSON(), before);
});

test('already-sanitized viewer HTML gets bounded theme variables and code syntax stays unchanged', () => {
  const html = '<p><span style="color:#eeeeee">text</span><pre><code><span class="hl-keyword" style="color:#eeeeee">let</span></code></pre></p>';
  const rendered = addThemeColorsToSanitizedHtml(html);
  assert.match(rendered, /pebble-theme-text/);
  assert.match(rendered, /--pebble-text-light: #[\da-f]{6}/i);
  assert.match(rendered, /class="hl-keyword" style="color:#eeeeee"/);
  assert.match(rendered, /color:#eeeeee/);
});

test('highlight text is contrasted against the actual mapped highlight surface', () => {
 for(const foreground of ['#ffffff','#000000','#eeeeee','#ff0000']) for(const background of ['#ffffff','#000000','#ffff00','#181b20','rgba(255,0,0,.2)']) {
  const pair=textThemePair(foreground,background);
  const surface=highlightThemePair(background);
  for(const theme of ['light','dark']) assert.ok(contrastRatio(parseThemeColor(pair[theme]),parseThemeColor(surface[theme]))>=4.5, `${foreground} on ${background} in ${theme}`);
 }
});
