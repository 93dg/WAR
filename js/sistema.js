/* WAR · Sistema: lo que el método tiene anotado de este proyecto (decisiones, versiones y reglas), solo lectura. */
(function () {
  'use strict';
  var W = window.WAR, U = window.WARUI, esc = W.esc, S = 'sistema', C = null;

  function pad(n) { return ('0' + n).slice(-2); }
  function fecha(iso) { var d = new Date(iso); return isNaN(d) ? '' : pad(d.getDate()) + '/' + pad(d.getMonth() + 1); }
  function fila(izq, der, cuerpo) {
    return '<details class="sub"><summary class="fil-r"><span class="t">' + esc(izq) + '</span><span class="d">' + esc(der) + '</span></summary><div class="cuerpo">' + esc(cuerpo) + '</div></details>';
  }
  function titulo(t) { var i = t.indexOf(':'); t = i > 8 && i < 70 ? t.slice(0, i) : t.slice(0, 60); if (t === t.toUpperCase()) t = t.toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); }

  function pintar(el) {
    if (!C) return;
    if (C.error) { el.innerHTML = '<p class="mut">No se pudo leer: ' + esc(C.error) + '</p>'; return; }
    el.innerHTML =
      U.grupo(S, 'decisiones', 'Decisiones', C.hechos.length, C.hechos.map(function (h) { return fila(h.tema, fecha(h.created_at), h.hecho); }).join(''), true) +
      U.grupo(S, 'versiones', 'Versiones', C.casos.length, C.casos.map(function (c) { return fila(c.version_final, fecha(c.cerrado_at), c.resultado + (c.aprendizaje ? '\n\n' + c.aprendizaje : '')); }).join(''), false) +
      U.grupo(S, 'reglas', 'Reglas', C.reglas.length, C.reglas.map(function (r) { return fila(titulo(r.regla), '', r.regla); }).join(''), false);
  }

  function cargar(el) {
    var sb = W.sb;
    return Promise.all([
      sb.from('hechos_usuario').select('tema,hecho,created_at').eq('proyecto', 'war').eq('vigente', true).order('created_at', { ascending: false }).limit(200),
      sb.from('casos').select('version_final,resultado,aprendizaje,cerrado_at').eq('proyecto', 'war').not('version_final', 'is', null).order('cerrado_at', { ascending: false }).limit(60),
      sb.from('reglas_trabajo').select('regla,orden').order('orden', { ascending: true })
    ]).then(function (r) {
      var err = r[0].error || r[1].error || r[2].error;
      C = err ? { error: err.message } : { hechos: r[0].data || [], casos: r[1].data || [], reglas: r[2].data || [] };
      pintar(el);
    }).catch(function (e) { C = { error: e.message || String(e) }; pintar(el); });
  }

  window.WARSISTEMA = { sistema: function (el) { pintar(el); cargar(el); } };
})();
