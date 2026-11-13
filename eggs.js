/* Bond Bell & Co · two quiet easter eggs. Nothing here is visible until it is found.
 *
 *  1. Arcade   Konami code on a keyboard (up up down down left right left right B A),
 *              or tap the "©" in the footer five times within three seconds.
 *              Opens the arcade at boardybell.com.
 *  2. Index    Tap the full stop at the end of "Past performance does not guarantee
 *              future results." three times within two seconds. Unlocks The Horniness
 *              Index: the page opens and its entry joins the primary navigation on
 *              every page from then on (this browser only).
 */
(function () {
  var script = document.currentScript;
  var root = new URL('./', script ? script.src : location.href);
  var ARCADE = 'https://boardybell.com/arcade/';
  var HI_URL = new URL('horniness-index/', root).href;
  var KEY = 'bbc.hi';

  function unlocked() { try { return localStorage.getItem(KEY) === '1'; } catch (_) { return false; } }
  function unlock() { try { localStorage.setItem(KEY, '1'); } catch (_) {} }

  function addNav() {
    var nav = document.querySelector('.site-nav');
    if (!nav || nav.querySelector('[data-hi-nav]')) return;
    var a = document.createElement('a');
    a.href = HI_URL;
    a.setAttribute('data-hi-nav', '');
    a.textContent = 'The Horniness Index';
    nav.appendChild(a);
  }

  function toast(text, then) {
    var t = document.createElement('div');
    t.setAttribute('role', 'status');
    t.textContent = text;
    t.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:99;background:#16233B;color:#FDF6EC;' +
      'border-top:2px solid #B98B3E;padding:12px 20px;font:500 12px/1.4 "IBM Plex Sans",sans-serif;letter-spacing:.14em;text-transform:uppercase';
    document.body.appendChild(t);
    setTimeout(then, 900);
  }

  // Wrap one character of a text node in a span, so it can be tapped. Returns the span or null.
  function wrapChar(scope, needle, offsetInNeedle) {
    if (!scope) return null;
    var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    for (var node = walker.nextNode(); node; node = walker.nextNode()) {
      var i = node.nodeValue.indexOf(needle);
      if (i < 0) continue;
      var target = node.splitText(i + offsetInNeedle);
      target.splitText(1);
      var span = document.createElement('span');
      span.className = 'egg';
      target.parentNode.replaceChild(span, target);
      span.appendChild(target);
      return span;
    }
    return null;
  }

  // Count taps on an element; fire after `need` taps inside `windowMs`.
  function onTaps(el, need, windowMs, fire) {
    if (!el) return;
    var times = [];
    el.addEventListener('click', function () {
      var now = Date.now();
      times = times.filter(function (t) { return now - t < windowMs; });
      times.push(now);
      if (times.length >= need) { times = []; fire(); }
    });
  }

  function goArcade() { toast('Insert coin', function () { location.href = ARCADE; }); }
  function goIndex() {
    unlock(); addNav();
    toast('Governance review opened', function () { location.href = HI_URL; });
  }

  // Konami: forgiving index matcher. Modifier keys and key repeat are ignored; typing in fields is ignored.
  var SEQ = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
  var pos = 0;
  document.addEventListener('keydown', function (e) {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    var k = (e.key || '').toLowerCase();
    if (k === 'shift') return;
    var tag = (e.target && e.target.tagName) || '';
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (e.target && e.target.isContentEditable)) return;
    if (k === SEQ[pos]) { pos++; if (pos === SEQ.length) { pos = 0; goArcade(); } }
    else pos = k === SEQ[0] ? (pos === 2 ? 2 : 1) : 0; // extra ups keep the run alive
  });

  function init() {
    if (location.pathname.indexOf('/horniness-index/') !== -1) unlock();
    if (unlocked()) addNav();
    var footer = document.querySelector('.site-footer');
    if (!footer) return;
    onTaps(wrapChar(footer.querySelector('.footer-meta'), '©', 0), 5, 3000, goArcade);
    var phrase = 'Past performance does not guarantee future results.';
    onTaps(wrapChar(footer.querySelector('.disclosure'), phrase, phrase.length - 1), 3, 2000, goIndex);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
