import test from 'node:test';
import assert from 'node:assert/strict';
import { Schema } from '@tiptap/pm/model';
import { EditorState } from '@tiptap/pm/state';
import { contrastRatio, highlightThemePair, parseThemeColor, surfaceThemePair, textThemePair } from '../src/features/post/theme-color.ts';
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

test('cell surfaces receive distinct light/dark pairs and readable inherited text', () => {
  const surface = surfaceThemePair('rgba(255, 240, 0, .55)');
  const text = textThemePair('#202124', undefined, surface);
  assert.ok(surface && text);
  assert.ok(contrastRatio(parseThemeColor(text.light), parseThemeColor(surface.light)) >= 4.5);
  assert.ok(contrastRatio(parseThemeColor(text.dark), parseThemeColor(surface.dark)) >= 4.5);
});

test('table cell decorations adapt backgrounds and borders without changing saved attrs', () => {
  const schema = new Schema({
    nodes: {
      doc: { content: 'block+' }, table: { content: 'tableRow+', group: 'block' },
      tableRow: { content: 'tableCell+' }, tableCell: { content: 'block+', attrs: { backgroundColor: { default: null }, borderBottom: { default: null } } },
      paragraph: { content: 'inline*', group: 'block' }, text: { group: 'inline' }, pebbleCode: { group: 'block', atom: true },
    },
    marks: { textStyle: { attrs: { color: {} } }, highlight: { attrs: { color: {} } } },
  });
  const doc = schema.node('doc', null, [schema.node('table', null, [schema.node('tableRow', null, [schema.node('tableCell', { backgroundColor: '#eeeeee', borderBottom: '1px solid #dddddd' }, [schema.node('paragraph', null, [schema.text('cell', [schema.mark('textStyle', { color: '#eeeeee' })])])])])])]);
  const before = doc.toJSON();
  const plugins = ThemeTextDecorations.config.addProseMirrorPlugins.call({});
  const state = EditorState.create({ schema, doc, plugins });
  const found = plugins[0].props.decorations(state).find();
  assert.equal(found.length, 2);
  assert.match(found.find(decoration => decoration.from < decoration.to && decoration.type.attrs.class.includes('pebble-theme-cell')).type.attrs.style, /--pebble-cell-border-bottom-dark:/);
  assert.match(found.find(decoration => decoration.type.attrs.class.includes('pebble-theme-text')).type.attrs.style, /--pebble-text-light:/);
  assert.deepEqual(state.doc.toJSON(), before);
});

test('viewer table mapping preserves canonical inline styles and adapts cell text and borders', () => {
  const source = '<table><tbody><tr><td style="background-color:#eeeeee;border-bottom:1px solid #dddddd"><span style="color:#eeeeee">cell</span></td></tr></tbody></table>';
  const rendered = addThemeColorsToSanitizedHtml(source);
  assert.match(rendered, /background-color:#eeeeee/);
  assert.match(rendered, /class="pebble-theme-cell pebble-theme-cell-surface pebble-theme-border-bottom"/);
  assert.match(rendered, /--pebble-cell-dark:/);
  assert.match(rendered, /--pebble-cell-border-bottom-light:/);
  assert.match(rendered, /--pebble-text-dark:/);
});

test('highlight text is contrasted against the actual mapped highlight surface', () => {
 for(const foreground of ['#ffffff','#000000','#eeeeee','#ff0000']) for(const background of ['#ffffff','#000000','#ffff00','#181b20','rgba(255,0,0,.2)']) {
  const pair=textThemePair(foreground,background);
  const surface=highlightThemePair(background);
  for(const theme of ['light','dark']) assert.ok(contrastRatio(parseThemeColor(pair[theme]),parseThemeColor(surface[theme]))>=4.5, `${foreground} on ${background} in ${theme}`);
 }
});

test('viewer text nested inside a highlight uses the mapped highlight as its surface', () => {
 const html=addThemeColorsToSanitizedHtml('<mark data-color="#ffff00" style="background-color:#ffff00"><span style="color:#eeeeee">nested</span></mark>');
 const variables=[...html.matchAll(/--pebble-text-dark: (#[a-f0-9]{6})/g)].map(match=>match[1]);
 const surface=highlightThemePair('#ffff00');
 assert.equal(variables.length,2);
 for(const color of variables) assert.ok(contrastRatio(parseThemeColor(color),parseThemeColor(surface.dark))>=4.5);
});
