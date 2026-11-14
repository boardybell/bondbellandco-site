/* Shared coin-slot behaviour for the insert-coin design options.
 * Needs: #plate (drop zone), #slot (fly target), #credit, #start, #hint, #live, .coin buttons.
 * Optional: #door (gets .armed while dragging, .paid once credited), .sound toggle, #fade.
 * Sound is synthesised in the browser (WebAudio): no files, no requests.
 * window.COIN_THEME may set { clink:[...], start:[...] } frequencies to retune per design. */
(function () {
  var ARCADE = 'https://boardybell.com/arcade/';
  var $ = function (id) { return document.getElementById(id); };
  var door = $('door') || document.body, plate = $('plate'), slot = $('slot'), creditEl = $('credit'), start = $('start');
  var hint = $('hint'), live = $('live'), fade = $('fade'), soundBtn = document.querySelector('.sound');
  var T = window.COIN_THEME || {};
  var credits = 0, leaving = false, soundOn = true, ac = null;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function audio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {} } return ac; }
  function tone(freq, t0, dur, type, vol) {
    var a = audio(); if (!a || !soundOn) return;
    var o = a.createOscillator(), g = a.createGain(), t = a.currentTime + t0;
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol || 0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function clink() { tone(2400, 0, 0.06, 'triangle', 0.12); tone(1800, 0.05, 0.08, 'triangle', 0.08); tone(140, 0.16, 0.12, 'sine', 0.25); }
  function credit() { (T.credit || [988, 1319]).forEach(function (f, i) { tone(f, 0.22 + i * 0.08, i ? 0.22 : 0.08, T.wave); }); }
  function jingle() { (T.start || [523, 659, 784, 1047]).forEach(function (f, i) { tone(f, i * 0.09, 0.14, T.wave); }); }
  function setSound(on) { soundOn = on; if (soundBtn) { soundBtn.setAttribute('aria-pressed', String(on)); soundBtn.textContent = on ? 'Sound on' : 'Sound off'; } }
  try { if (localStorage.getItem('bbc.arcade.mute') === '1') setSound(false); } catch (_) {}
  if (soundBtn) soundBtn.addEventListener('click', function () { setSound(!soundOn); try { localStorage.setItem('bbc.arcade.mute', soundOn ? '0' : '1'); } catch (_) {} });

  function retrigger(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function addCredit(coin) {
    if (coin) { coin.classList.add('spent'); coin.hidden = true; }
    clink(); credit(); retrigger(plate, 'clunk');
    credits++; creditEl.textContent = String(credits).padStart(creditEl.dataset.pad || 1, '0');
    retrigger(creditEl, 'bump'); door.classList.add('paid'); start.classList.add('ready');
    if (hint) hint.textContent = credits === 1 ? (hint.dataset.one || 'Credit accepted. Press start.') : credits + ' credits. Press start.';
    if (live) live.textContent = 'Credit ' + credits + '. Press start.';
    if (!document.querySelector('.coin:not(.spent)')) setTimeout(function () { start.focus(); }, 300);
  }
  function overPlate(x, y) { var p = plate.getBoundingClientRect(); return x > p.left - 30 && x < p.right + 30 && y > p.top - 30 && y < p.bottom + 30; }
  function flyIn(coin, fromRect) {
    if (reduce || !coin.animate) { addCredit(coin); return; }
    var r = fromRect || coin.getBoundingClientRect(), s = slot.getBoundingClientRect();
    var ghost = coin.cloneNode(true); ghost.classList.add('dragging'); ghost.style.left = r.left + 'px'; ghost.style.top = r.top + 'px';
    ghost.style.width = r.width + 'px'; ghost.style.height = r.height + 'px'; document.body.appendChild(ghost);
    coin.classList.add('spent');
    var dx = s.left + s.width / 2 - (r.left + r.width / 2), dy = s.top + s.height / 2 - (r.top + r.height / 2);
    var turn = slot.offsetWidth > slot.offsetHeight ? 'rotateX' : 'rotateY'; // horizontal slots flip the coin the other way
    ghost.animate([
      { transform: 'translate(0,0) ' + turn + '(0deg) scale(1)' },
      { transform: 'translate(' + dx + 'px,' + (dy - 40) + 'px) ' + turn + '(80deg) scale(.95)', offset: 0.7 },
      { transform: 'translate(' + dx + 'px,' + (dy + 10) + 'px) ' + turn + '(90deg) scale(.85)', opacity: 0 }
    ], { duration: 520, easing: 'cubic-bezier(.4,0,.2,1)' }).onfinish = function () { ghost.remove(); addCredit(coin); };
  }
  document.querySelectorAll('.coin').forEach(function (coin) {
    var d = null;
    coin.addEventListener('pointerdown', function (e) {
      if (coin.classList.contains('spent')) return; audio();
      var r = coin.getBoundingClientRect();
      d = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, w: r.width, h: r.height, moved: false, ghost: null };
      coin.setPointerCapture(e.pointerId); e.preventDefault();
    });
    coin.addEventListener('pointermove', function (e) {
      if (!d || e.pointerId !== d.id) return;
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
      if (!d.moved) {
        d.moved = true; d.ghost = coin.cloneNode(true); d.ghost.classList.add('dragging');
        d.ghost.style.width = d.w + 'px'; d.ghost.style.height = d.h + 'px';
        document.body.appendChild(d.ghost); coin.classList.add('spent'); door.classList.add('armed');
      }
      d.ghost.style.left = (e.clientX - d.ox) + 'px'; d.ghost.style.top = (e.clientY - d.oy) + 'px';
      door.classList.toggle('hot', overPlate(e.clientX, e.clientY));
    });
    function end(e) {
      if (!d || e.pointerId !== d.id) return;
      var k = d; d = null; door.classList.remove('armed', 'hot');
      if (!k.moved) { if (e.type === 'pointerup') flyIn(coin); return; }
      var g = k.ghost.getBoundingClientRect(); k.ghost.remove();
      if (e.type === 'pointerup' && overPlate(g.left + g.width / 2, g.top + g.height / 2)) { flyIn(coin, g); return; }
      coin.classList.remove('spent');
    }
    coin.addEventListener('pointerup', end); coin.addEventListener('pointercancel', end);
    coin.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && !coin.classList.contains('spent')) { e.preventDefault(); flyIn(coin); } });
    coin.addEventListener('click', function (e) { if (e.detail === 0 && !coin.classList.contains('spent')) flyIn(coin); });
  });
  function go() {
    if (!credits || leaving) return; leaving = true; jingle();
    if (hint) hint.textContent = hint.dataset.go || 'Player 1. Good luck.'; if (live) live.textContent = 'Starting.';
    if (fade) fade.classList.add('on');
    setTimeout(function () { location.href = ARCADE; }, reduce ? 150 : 700);
  }
  start.addEventListener('click', go);
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    if (e.key === '5') { var c = document.querySelector('.coin:not(.spent)'); if (c) flyIn(c); else addCredit(null); }
    else if (e.key === '1') go();
  });
  window.addEventListener('pageshow', function (e) { if (e.persisted) location.reload(); });
})();
