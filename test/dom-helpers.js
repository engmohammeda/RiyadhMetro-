'use strict';
/* Shared jsdom harness: boots web/index.html exactly as a browser would and
   hands back the live document. Used by test/dom.test.js (behaviour) and
   test/a11y.test.js (axe-core audit). Both suites skip when jsdom is absent so
   the zero-dependency `npm test` path keeps working. */
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { JSDOM = null; }

const skip = JSDOM ? false : 'jsdom is not installed — run `npm ci` to enable the browser suite';

/** Boot the page in jsdom, wait for init() to settle, return driver helpers. */
async function bootPage(hash) {
  const errors = [];
  const { VirtualConsole } = require('jsdom');
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(String(e && e.message || e)));
  vc.on('error', (...a) => errors.push(a.join(' ')));

  // A file:// URL keeps every relative asset (leaflet, data bundle, fonts) on
  // disk — no network — while still resolving exactly like the deployed page.
  const pageUrl = pathToFileURL(path.join(ROOT, 'web', 'index.html')).href + (hash || '');
  const html = fs.readFileSync(path.join(ROOT, 'web', 'index.html'), 'utf8');
  const dom = new JSDOM(html, {
    url: pageUrl,
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole: vc,
    // jsdom has no layout engine: patch the unimplemented APIs *before* any
    // page script runs, so the real init() path is what gets exercised.
    beforeParse(window) {
      window.Element.prototype.scrollIntoView = function () {};
      window.scrollTo = function () {};
      Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { value: 900, configurable: true });
      Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { value: 700, configurable: true });
      Object.defineProperty(window.HTMLElement.prototype, 'offsetWidth', { value: 900, configurable: true });
      Object.defineProperty(window.HTMLElement.prototype, 'offsetHeight', { value: 700, configurable: true });
    }
  });
  const { window } = dom;
  await new Promise(res => {
    if (window.document.readyState === 'complete') return res();
    window.addEventListener('load', res);
    setTimeout(res, 4000);
  });
  await new Promise(res => setTimeout(res, 150));   // let init() + rAF settle
  return {
    window, document: window.document, errors,
    $: s => window.document.querySelector(s),
    $$: s => [...window.document.querySelectorAll(s)],
    close: () => { try { window.close(); } catch (e) { /* already closed */ } }
  };
}

module.exports = { ROOT, bootPage, skip, hasJsdom: !!JSDOM };
