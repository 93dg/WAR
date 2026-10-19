/* WAR · Texto del episodio listo para copiar y pegar en Suno, en partes del tamaño elegido. */
(function () {
  'use strict';
  var W = window.WAR, U = window.WARUI, esc = W.esc, S = 'suno', actual = null, host = null;
  var OPC = [['3000', '3.000 car.'], ['5000', '5.000 car.'], ['todo', 'Entero']];

  function miles(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  /* Sin marcas de pausa: en Suno los corchetes se leen como instrucciones. Cada párrafo, separado por una línea en blanco. */
  function limpio(script) {
    return (script || '').replace(/\[pausa(?:\s+\d+)?\]/g, '').split(/\n\s*\n/).map(function (p) { return p.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
  }
  function partes(pars, max) {
    if (!max) return [pars.join('\n\n')];
    var r = [], cur = [], n = 0;
    pars.forEach(function (p) {
      if (cur.length && n + p.length + 2 > max) { r.push(cur.join('\n\n')); cur = []; n = 0; }
      cur.push(p); n += p.length + 2;
    });
    if (cur.length) r.push(cur.join('\n\n'));
    return r;
  }

  function pintar() {
    if (!host || !actual) return;
    var v = U.get(S, 'tam', '3000'), pars = limpio(actual.script), ps = partes(pars, v === 'todo' ? 0 : +v);
    var total = ps.reduce(function (a, p) { return a + p.length; }, 0);
    var h = U.filtro(S, 'tam', 'Tamaño', OPC, '3000');
    h += ps.map(function (p, i) {
      return '<details class="sub"><summary class="fil-r"><span class="t">' + esc(ps.length > 1 ? 'Parte ' + (i + 1) + ' de ' + ps.length : 'Texto completo') + '</span><span class="d">' + esc(miles(p.length) + ' car.') + '</span>' +
        U.accion('Copiar', 'data-suno="' + i + '"') + '</summary><div class="cuerpo">' + esc(p) + '</div></details>';
    }).join('');
    host.innerHTML = U.grupo('episodio', 'suno', 'Texto para Suno', miles(total) + ' car.', h, true);
    host.__partes = ps;
  }

  function copiar(txt, b) {
    function ok() { b.textContent = 'Copiado'; setTimeout(function () { b.textContent = 'Copiar'; }, 1500); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, fallback); else fallback();
    function fallback() {
      var t = document.createElement('textarea'); t.value = txt; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); ok(); } catch (e) { b.textContent = 'No se pudo copiar'; } document.body.removeChild(t);
    }
  }

  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b || !host || !host.contains(b)) return;
    if (b.dataset.suno != null) { ev.preventDefault(); ev.stopPropagation(); copiar(host.__partes[+b.dataset.suno], b); return; }
    if (b.dataset.fil && b.dataset.fil.indexOf(S + '.') === 0) { W._filAbierto = W._filAbierto === b.dataset.fil ? null : b.dataset.fil; pintar(); return; }
    if (b.dataset.filv && b.dataset.filv.indexOf(S + '.') === 0) { U.set(S, b.dataset.filv.split('.')[1], b.dataset.v2); W._filAbierto = null; pintar(); }
  }, true);

  window.WARSUNO = { bloque: function (e, el) { actual = e; host = el; pintar(); } };
})();
