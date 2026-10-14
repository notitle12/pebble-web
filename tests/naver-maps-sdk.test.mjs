import test from 'node:test';
import assert from 'node:assert/strict';

let moduleSequence = 0;
const importLoader = () => import(`../src/features/post/naver-maps-sdk.ts?test=${++moduleSequence}`);

function installBrowserMocks({ onFetch = async () => ({ ok: true, json: async () => ({ clientId: 'public-client-id' }) }) } = {}) {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const calls = [];
  const scripts = [];
  globalThis.fetch = async (...args) => { calls.push(args); return onFetch(...args); };
  globalThis.window = {};
  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, 'script');
      return { async: false, src: '', onerror: null, removed: false, remove() { this.removed = true; } };
    },
    head: { appendChild(script) { scripts.push(script); } },
  };
  return {
    calls, scripts,
    restore() {
      globalThis.fetch = originalFetch;
      if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
      if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
    },
  };
}

const fakeMaps = { Service: { geocode() {} } };
async function waitForScript(scripts) {
  for (let attempt = 0; attempt < 20 && scripts.length === 0; attempt++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(scripts.length, 1, 'expected one Maps script to be appended');
  return scripts[0];
}

test('loads SDK config and supplies only the Client ID as ncpKeyId', async () => {
  const browser = installBrowserMocks();
  try {
    const { loadNaverMaps } = await importLoader();
    const promise = loadNaverMaps();
    const script = await waitForScript(browser.scripts);
    assert.deepEqual(browser.calls, [['/api/maps/config', { cache: 'no-store' }]]);
    const url = new URL(script.src);
    assert.equal(url.origin + url.pathname, 'https://oapi.map.naver.com/openapi/v3/maps.js');
    assert.deepEqual([...url.searchParams.entries()], [
      ['ncpKeyId', 'public-client-id'],
      ['submodules', 'geocoder'],
      ['callback', '__pebbleNaverMapsReady'],
    ]);
    assert.equal(script.async, true);
    globalThis.window.naver = { maps: fakeMaps };
    globalThis.window.__pebbleNaverMapsReady();
    assert.equal(await promise, fakeMaps);
    assert.equal(typeof (await loadNaverMaps()).Service.geocode, 'function');
    assert.equal(globalThis.window.__pebbleNaverMapsReady, undefined);
    assert.equal(globalThis.window.navermap_authFailure, undefined);
  } finally { browser.restore(); }
});

test('simultaneous callers share one promise and append one script', async () => {
  const browser = installBrowserMocks();
  try {
    const { loadNaverMaps } = await importLoader();
    const first = loadNaverMaps();
    const second = loadNaverMaps();
    assert.equal(second, first);
    const script = await waitForScript(browser.scripts);
    assert.equal(browser.calls.length, 1);
    assert.equal(browser.scripts.length, 1);
    globalThis.window.naver = { maps: fakeMaps };
    globalThis.window.__pebbleNaverMapsReady();
    assert.equal(await first, fakeMaps);
    assert.equal(await second, fakeMaps);
    assert.equal(script.removed, false);
  } finally { browser.restore(); }
});

test('failed script load cleans up callbacks and script, then allows retry', async () => {
  const browser = installBrowserMocks();
  try {
    const { loadNaverMaps } = await importLoader();
    const failed = loadNaverMaps();
    const firstScript = await waitForScript(browser.scripts);
    firstScript.onerror();
    await assert.rejects(failed, /지도를 불러오지 못했어요/);
    assert.equal(firstScript.removed, true);
    assert.equal(globalThis.window.__pebbleNaverMapsReady, undefined);
    assert.equal(globalThis.window.navermap_authFailure, undefined);

    const retried = loadNaverMaps();
    for (let attempt = 0; attempt < 20 && browser.scripts.length < 2; attempt++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(browser.scripts.length, 2);
    assert.equal(browser.calls.length, 2);
    globalThis.window.naver = { maps: fakeMaps };
    globalThis.window.__pebbleNaverMapsReady();
    assert.equal(await retried, fakeMaps);
  } finally { browser.restore(); }
});
