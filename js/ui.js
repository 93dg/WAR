/* WAR · Componentes compartidos (GUIA_DISENO.md): grupo plegable, filtro en pastilla plegable, fila compacta y estado recordado en el servidor. */
(function () {
  'use strict';
  var W = window.WAR, esc = W.esc, guardando = null;

  function doc() {
    var D = W.datos(); D.ui = D.ui || []; var d = D.ui.filter(function (x) { return x.id === 'estado'; })[0];
    if (!d) { d = { id: 'estado' }; D.ui.push(d); } return d;
  }
  function get(sec, k, def) { var s = doc()[sec]; return s && s[k] !== undefined ? s[k] : def; }
  function set(sec, k, v) {
    var d = doc(); d[sec] = d[sec] || {}; if (d[sec][k] === v) return; d[sec][k] = v;
    clearTimeout(guardando);
    guardando = setTimeout(function () {
      var datos = Object.assign({}, d); delete datos.id;
      W.sb.from('war_docs').upsert({ coleccion: 'ui', id: 'estado', datos: datos, actualizado: new Date().toISOString() });
    }, 600);
  }

  /* Grupo plegable. El estado abierto o cerrado se recuerda por sección. */
  function grupo(sec, id, titulo, cifra, cuerpo, porDefecto) {
    var abierto = get(sec, 'g.' + id, porDefecto);
    return '<details class="grupo" data-ui="' + esc(sec) + '" data-g="' + esc(id) + '"' + (abierto ? ' open' : '') + '><summary><span>' + esc(titulo) + '</span><span class="cif">' + esc(cifra) + '</span></summary>' + cuerpo + '</details>';
  }
  /* Fila compacta: título a la izquierda, dato a la derecha, acción como palabra de acento. */
  function fila(izq, der, accion, cls) {
    return '<div class="fil-r' + (cls ? ' ' + cls : '') + '"><span class="t">' + esc(izq) + '</span>' + (der ? '<span class="d' + (cls === 'venc' ? ' venc' : '') + '">' + esc(der) + '</span>' : '') + (accion || '') + '</div>';
  }
  function accion(txt, attrs) { return '<button type="button" class="acc" ' + attrs + '>' + esc(txt) + '</button>'; }
  /* Filtro plegado: solo la elección en una pastilla; al abrirla, las opciones en línea. */
  function filtro(sec, k, rotulo, opciones, def) {
    var v = get(sec, k, def), abierto = !!(W._filAbierto && W._filAbierto === sec + '.' + k);
    var act = opciones.filter(function (o) { return o[0] === v; })[0] || opciones[0];
    if (!abierto) return '<div class="fil"><button type="button" class="chip" data-fil="' + esc(sec + '.' + k) + '" aria-expanded="false">' + esc(rotulo) + ' ' + esc(act[1]) + '</button></div>';
    return '<div class="fil">' + opciones.map(function (o) {
      return '<button type="button" class="chip' + (o[0] === v ? ' on' : '') + '" data-filv="' + esc(sec + '.' + k) + '" data-v2="' + esc(o[0]) + '" aria-pressed="' + (o[0] === v) + '">' + esc(o[1]) + '</button>';
    }).join('') + '</div>';
  }

  document.addEventListener('toggle', function (ev) {
    var d = ev.target; if (d && d.tagName === 'DETAILS' && d.dataset.ui) set(d.dataset.ui, 'g.' + d.dataset.g, d.open);
  }, true);

  window.WARUI = { get: get, set: set, grupo: grupo, fila: fila, accion: accion, filtro: filtro };
})();
