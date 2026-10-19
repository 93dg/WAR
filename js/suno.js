/* WAR · Texto del episodio listo para copiar y pegar en Suno, en partes de hasta 5.000 caracteres. */
(function () {
  'use strict';
  var W = window.WAR, U = window.WARUI, esc = W.esc, actual = null, host = null;
  var MAX = 5000;   // límite de Suno por generación, indicado por el usuario

  function miles(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  /* Sin marcas de pausa: en Suno los corchetes se leen como instrucciones. Cada párrafo, separado por una línea en blanco. */
  function limpio(script) {
    return (script || '').replace(/\[pausa(?:\s+\d+)?\]/g, '').split(/\n\s*\n/).map(function (p) { return p.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
  }
  function partes(pars, max) {
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
    var ps = partes(limpio(actual.script), MAX);
    var total = ps.reduce(function (a, p) { return a + p.length; }, 0);
    var h = '', P = window.WARPROMPTS, pr = P && P.elegido(), ops = P ? P.opciones() : [];
    if (pr) {
      h += (ops.length > 1 ? U.filtro('suno', 'prompt', 'Prompt', ops, pr.id) : '') +
        '<div class="fil-r"><span class="t">' + esc(ops.length > 1 ? 'Prompt de estilo' : 'Prompt: ' + pr.nombre) + '</span><span class="d">' + esc(pr.estado) + '</span>' + U.accion('Copiar', 'data-suno="p"') + '</div>';
    } else {
      h += '<div class="fil-r"><span class="t mut">Sin prompt de estilo</span>' + U.accion('Añadir', 'data-v="muestras"') + '</div>';
    }
    h += ps.map(function (p, i) {
      return '<details class="sub"><summary class="fil-r"><span class="t">' + esc(ps.length > 1 ? 'Parte ' + (i + 1) + ' de ' + ps.length : 'Texto completo') + '</span><span class="d">' + esc(miles(p.length) + ' car.') + '</span>' +
        U.accion('Copiar', 'data-suno="' + i + '"') + '</summary><div class="cuerpo">' + esc(p) + '</div></details>';
    }).join('');
    host.innerHTML = U.grupo('episodio', 'suno', 'Texto para Suno', miles(total) + ' car.', h, true);
    host.__partes = ps; host.__prompt = pr ? pr.texto : '';
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
    if (b.dataset.suno != null) { ev.preventDefault(); ev.stopPropagation(); copiar(b.dataset.suno === 'p' ? host.__prompt : host.__partes[+b.dataset.suno], b); return; }
    if (b.dataset.fil && b.dataset.fil.indexOf('suno.') === 0) { W._filAbierto = W._filAbierto === b.dataset.fil ? null : b.dataset.fil; pintar(); return; }
    if (b.dataset.filv && b.dataset.filv.indexOf('suno.') === 0) { U.set('suno', 'prompt', b.dataset.v2); W._filAbierto = null; pintar(); }
  }, true);

  window.WARSUNO = { bloque: function (e, el) { actual = e; host = el; pintar(); } };
})();
