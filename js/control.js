/* WAR · Control: lo pendiente por tipo (tareas y avisos automáticos), notas y estado de los episodios. */
(function () {
  'use strict';
  var W = window.WAR, U = window.WARUI;
  var ETAPAS = ['Idea', 'Estructura', 'Borrador', 'Revisión', 'Guion aprobado', 'Narración', 'Edición', 'Publicado'];
  var CATS = ['Libros', 'Guiones', 'Voz', 'Producción', 'Web', 'Otros'];
  var DESTINO = { Libros: 'biblioteca', Guiones: 'episodios', Voz: 'muestras', 'Producción': 'episodios' };
  var META_MIN = 10, S = 'control';

  function dec(n) { return (Math.round(n * 10) / 10).toString().replace('.', ','); }
  function pad(n) { return ('0' + n).slice(-2); }
  function hoy() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dias(iso) { return Math.round((new Date(iso + 'T12:00:00') - new Date(hoy() + 'T12:00:00')) / 86400000); }
  function fmt(iso) { var p = iso.split('-'); return pad(+p[2]) + '/' + pad(+p[1]); }

  function tareasPendientes() { return (W.datos().tareas || []).filter(function (t) { return t.estado !== 'hecha'; }); }
  function minutosVoz() { return (W.datos().muestras || []).reduce(function (t, m) { return t + (m.dur || 0); }, 0) / 60; }

  /* Avisos calculados a partir de los datos: no se guardan, así nunca se duplican ni se quedan viejos. */
  function avisos() {
    var D = W.datos(), a = [];
    (D.episodios || []).slice().sort(function (x, y) { return (x.order || 0) - (y.order || 0); }).forEach(function (e, i) {
      var n = 'episodio ' + (i + 1);
      if (e.status === 'Borrador') a.push({ cat: 'Guiones', txt: 'Revisar borrador del ' + n });
      if (/BORRADOR PRELIMINAR/.test(e.notasFilos || '')) a.push({ cat: 'Guiones', txt: 'Contrastar referencias del ' + n });
      if (e.status === 'Guion aprobado') a.push({ cat: 'Producción', txt: 'Narrar el ' + n });
    });
    var mins = minutosVoz();
    if (mins < META_MIN) a.push({ cat: 'Voz', txt: 'Reunir muestras: ' + dec(mins) + ' de ' + META_MIN + ' min' });
    if (!(D.libros || []).length) a.push({ cat: 'Libros', txt: 'Cargar el texto de los libros' });
    return a;
  }

  function plazo() { return U.get(S, 'plazo', 'todos'); }
  function pasaFiltro(t) {
    var d = dias(t.fecha), p = plazo();
    if (p === 'vencidas') return d < 0;
    if (p === '1S') return d <= 7;
    if (p === '1M') return d <= 31;
    return true;
  }

  function filaTarea(t) {
    return U.fila(t.titulo, fmt(t.fecha), U.accion('Hecha', 'data-hecha="' + W.esc(t.id) + '"'), dias(t.fecha) < 0 ? 'venc' : '');
  }
  function filaAviso(a) {
    var d = DESTINO[a.cat];
    return U.fila(a.txt, '', d ? U.accion('Abrir', 'data-v="' + d + '"') : '');
  }

  function grupos() {
    var porCat = {}, ts = tareasPendientes().filter(pasaFiltro).sort(function (x, y) { return x.fecha < y.fecha ? -1 : 1; });
    CATS.forEach(function (c) { porCat[c] = { t: [], a: [] }; });
    ts.forEach(function (t) { (porCat[t.categoria] || porCat.Otros).t.push(t); });
    if (plazo() !== 'vencidas') avisos().forEach(function (a) { (porCat[a.cat] || porCat.Otros).a.push(a); });
    var h = '';
    CATS.forEach(function (c) {
      var g = porCat[c], n = g.t.length + g.a.length; if (!n) return;
      h += U.grupo(S, c, c, n, g.t.map(filaTarea).join('') + g.a.map(filaAviso).join(''), n <= 3);
    });
    return h || '<p class="mut">Nada pendiente.</p>';
  }

  function episodios() {
    var eps = W.datos().episodios || [], cuenta = {};
    eps.forEach(function (e) { var k = e.status || 'Idea'; cuenta[k] = (cuenta[k] || 0) + 1; });
    var filas = ETAPAS.filter(function (e) { return cuenta[e]; }).map(function (e) { return U.fila(e, String(cuenta[e])); }).join('');
    return filas ? U.grupo(S, 'episodios', 'Episodios', eps.length, filas, false) : '';
  }
  function notas() {
    var L = (W.datos().notas || []).slice().sort(function (a, b) { return a.creada < b.creada ? 1 : -1; }).slice(0, 8);
    return L.length ? U.grupo(S, 'notas', 'Notas', L.length, L.map(function (n) { return U.fila(n.texto, fmt(n.creada)); }).join(''), false) : '';
  }

  function vista(el) {
    var ts = tareasPendientes(), venc = ts.filter(function (t) { return dias(t.fecha) < 0; }).length, n = ts.length + avisos().length;
    el.innerHTML = '<div class="barra-f">' + U.filtro(S, 'plazo', 'Plazo', [['todos', 'Todos'], ['vencidas', 'Vencidas'], ['1S', '1S'], ['1M', '1M']], 'todos') +
      '<span class="mut peq">' + n + ' pendientes · <span class="' + (venc ? 'venc' : '') + '">' + venc + ' vencidas</span></span></div>' +
      '<div id="c-grupos">' + grupos() + '</div>' + episodios() + notas();
  }

  function guardar(t) {
    var datos = Object.assign({}, t); delete datos.id;
    return W.sb.from('war_docs').upsert({ coleccion: 'tareas', id: t.id, datos: datos, actualizado: new Date().toISOString() });
  }
  function repintar() {
    var raiz = document.getElementById('vista'); if (raiz) { var scroll = window.scrollY; vista(raiz); window.scrollTo(0, scroll); }
  }

  function clic(ev) {
    var t = ev.target.closest('button'); if (!t) return;
    if (t.dataset.fil) { W._filAbierto = W._filAbierto === t.dataset.fil ? null : t.dataset.fil; repintar(); }
    else if (t.dataset.filv) { U.set(S, t.dataset.filv.split('.')[1], t.dataset.v2); W._filAbierto = null; repintar(); }
    else if (t.dataset.hecha) {
      var tar = (W.datos().tareas || []).filter(function (x) { return x.id === t.dataset.hecha; })[0]; if (!tar) return;
      tar.estado = 'hecha'; tar.cerrada = hoy(); repintar();
      guardar(tar).then(function (r) { if (r && r.error) { tar.estado = 'pendiente'; repintar(); } });
    }
  }

  window.WARCONTROL = {
    control: function (el) { vista(el); el.onclick = clic; el.onchange = null; }
  };
})();
