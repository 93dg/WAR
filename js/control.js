/* WAR · Centro de control: lo pendiente por tipo, avisos automáticos, tareas con fecha y estado de los episodios. */
(function () {
  'use strict';
  var W = window.WAR, esc = W.esc;
  var ETAPAS = ['Idea', 'Estructura', 'Borrador', 'Revisión', 'Guion aprobado', 'Narración', 'Edición', 'Publicado'];
  var CATS = ['Libros', 'Guiones', 'Voz', 'Producción', 'Web', 'Otros'];
  var DESTINO = { Libros: 'biblioteca', Guiones: 'episodios', Voz: 'muestras', 'Producción': 'narrador' };
  var META_MIN = 10;
  var F = { plazo: 'todas' }, abiertas = {};

  function dec(n) { return (Math.round(n * 10) / 10).toString().replace('.', ','); }
  function pad(n) { return ('0' + n).slice(-2); }
  function hoy() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function sumar(iso, dias) { var d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + dias); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dias(iso) { return Math.round((new Date(iso + 'T12:00:00') - new Date(hoy() + 'T12:00:00')) / 86400000); }
  function fmt(iso) { var p = iso.split('-'); return (+p[2]) + '/' + (+p[1]); }
  function plural(n, uno, varios) { return n === 1 ? uno : varios; }

  function tareasPendientes() { return (W.datos().tareas || []).filter(function (t) { return t.estado !== 'hecha'; }); }
  function minutosVoz() { return (W.datos().muestras || []).reduce(function (t, m) { return t + (m.dur || 0); }, 0) / 60; }

  /* Avisos calculados a partir de los datos: no se guardan, así nunca se duplican ni se quedan viejos. */
  function avisos() {
    var D = W.datos(), a = [];
    (D.episodios || []).forEach(function (e) {
      if (e.status === 'Borrador') a.push({ cat: 'Guiones', txt: 'Revisar el borrador de «' + e.titulo + '».' });
      if (/BORRADOR PRELIMINAR/.test(e.notasFilos || '')) a.push({ cat: 'Guiones', txt: 'Contrastar con tu traducción las referencias de «' + e.titulo + '».' });
      if (e.status === 'Guion aprobado') a.push({ cat: 'Producción', txt: 'Narrar «' + e.titulo + '».' });
    });
    var mins = minutosVoz();
    if (mins < META_MIN) a.push({ cat: 'Voz', txt: 'Reunir muestras de la voz: llevas ' + dec(mins) + ' de ' + META_MIN + ' minutos.' });
    if (!(D.libros || []).length) a.push({ cat: 'Libros', txt: 'Cargar el texto de los libros: todavía no hay ninguno.' });
    return a;
  }

  function pasaFiltro(t) {
    var d = dias(t.fecha);
    if (F.plazo === 'vencidas') return d < 0;
    if (F.plazo === '7') return d <= 7;
    if (F.plazo === '31') return d <= 31;
    return true;
  }

  function textoFecha(t) {
    var d = dias(t.fecha);
    if (d < 0) return '<span class="venc">Vencida hace ' + (-d) + ' ' + plural(-d, 'día', 'días') + ' · ' + fmt(t.fecha) + '</span>';
    if (d === 0) return '<span class="venc">Vence hoy · ' + fmt(t.fecha) + '</span>';
    return 'Quedan ' + d + ' ' + plural(d, 'día', 'días') + ' · ' + fmt(t.fecha);
  }

  function filaTarea(t) {
    return '<div class="item"><div class="fila-sp"><div><div>' + esc(t.titulo) + '</div><div class="mut peq">' + textoFecha(t) + '</div></div>' +
      '<button type="button" class="btn" data-hecha="' + esc(t.id) + '">Hecha</button></div></div>';
  }
  function filaAviso(a) {
    var d = DESTINO[a.cat];
    return '<div class="item"><div class="fila-sp"><div><div>' + esc(a.txt) + '</div><div class="mut peq">Aviso automático</div></div>' +
      (d ? '<button type="button" class="btn" data-v="' + d + '">Abrir</button>' : '') + '</div></div>';
  }

  function grupos() {
    var porCat = {}, ts = tareasPendientes().filter(pasaFiltro).sort(function (x, y) { return x.fecha < y.fecha ? -1 : 1; });
    CATS.forEach(function (c) { porCat[c] = { t: [], a: [] }; });
    ts.forEach(function (t) { (porCat[t.categoria] || porCat.Otros).t.push(t); });
    if (F.plazo !== 'vencidas') avisos().forEach(function (a) { (porCat[a.cat] || porCat.Otros).a.push(a); });
    var h = '';
    CATS.forEach(function (c) {
      var g = porCat[c], n = g.t.length + g.a.length; if (!n) return;
      var venc = g.t.filter(function (t) { return dias(t.fecha) < 0; }).length;
      var abierto = abiertas[c] != null ? abiertas[c] : n <= 3;
      h += '<details class="grupo" data-cat="' + esc(c) + '"' + (abierto ? ' open' : '') + '><summary><span>' + esc(c) + '</span><span class="num">' + n + '</span>' +
        (venc ? '<span class="peq venc">' + venc + ' ' + plural(venc, 'vencida', 'vencidas') + '</span>' : '') + '</summary>' +
        g.t.map(filaTarea).join('') + g.a.map(filaAviso).join('') + '</details>';
    });
    return h || '<p class="mut">Nada pendiente con este plazo.</p>';
  }

  function etapas() {
    var eps = W.datos().episodios || [], cuenta = {};
    eps.forEach(function (e) { var k = e.status || 'Idea'; cuenta[k] = (cuenta[k] || 0) + 1; });
    var con = ETAPAS.filter(function (e) { return cuenta[e]; });
    return '<p class="mut">' + (con.length ? con.map(function (e) { return esc(e) + ': ' + cuenta[e]; }).join(' · ') : 'Todavía no hay episodios.') + '</p>';
  }

  function chips() {
    var o = [['todas', 'Todas'], ['vencidas', 'Vencidas'], ['7', '7 días'], ['31', '1 mes']];
    return '<div class="fila" style="margin:.2rem 0 1rem">' + o.map(function (x) {
      return '<button type="button" class="chip' + (F.plazo === x[0] ? ' on' : '') + '" data-plazo="' + x[0] + '" aria-pressed="' + (F.plazo === x[0]) + '">' + x[1] + '</button>';
    }).join('') + '</div>';
  }

  function notas() {
    var L = (W.datos().notas || []).slice().sort(function (a, b) { return a.creada < b.creada ? 1 : -1; }).slice(0, 5);
    return L.length ? '<h3>Notas</h3>' + L.map(function (n) { return '<div class="item"><div>' + esc(n.texto) + '</div><div class="mut peq">' + fmt(n.creada) + '</div></div>'; }).join('') : '';
  }
  function vista(el) {
    var D = W.datos(), eps = D.episodios || [], pub = eps.filter(function (e) { return e.status === 'Publicado'; }).length;
    var ts = tareasPendientes(), venc = ts.filter(function (t) { return dias(t.fecha) < 0; }).length, av = avisos().length;
    el.innerHTML = '<h2>Centro de control</h2>' +
      '<p class="mut">' + (ts.length + av) + ' pendientes · <span class="' + (venc ? 'venc' : '') + '">' + venc + ' vencidas</span> · ' + pub + ' de ' + eps.length + ' episodios publicados · ' + dec(minutosVoz()) + ' min de voz</p>' +
      '<h3>Pendiente</h3>' + chips() + '<div id="c-grupos">' + grupos() + '</div>' +
      '<h3>Estado de los episodios</h3>' + etapas() + notas();
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
    if (t.dataset.plazo) { F.plazo = t.dataset.plazo; repintar(); }
    else if (t.dataset.hecha) {
      var tar = (W.datos().tareas || []).filter(function (x) { return x.id === t.dataset.hecha; })[0]; if (!tar) return;
      tar.estado = 'hecha'; tar.cerrada = hoy();
      guardar(tar).then(function (r) { if (r && r.error) { tar.estado = 'pendiente'; var e = document.getElementById('c-est'); if (e) e.textContent = 'No se pudo guardar: ' + r.error.message; } repintar(); });
    }
  }
  function alternar(ev) {
    var d = ev.target; if (d && d.tagName === 'DETAILS' && d.dataset.cat) abiertas[d.dataset.cat] = d.open;
  }

  window.WARCONTROL = {
    control: function (el) {
      vista(el); el.onclick = clic; el.onchange = null;
      if (!el._tg) { el.addEventListener('toggle', alternar, true); el._tg = 1; }
    }
  };
})();
