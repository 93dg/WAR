/* WAR · Asistente local: sin IA ni claves. Un motor de reglas y vocabulario (en código y en datos que enseña Claude) propone acciones; solo escribe un ejecutor central y solo tras confirmar. */
(function () {
  'use strict';
  var W = window.WAR, esc = W.esc;
  var C_PET = 'asistente_peticiones', C_ENT = 'asistente_entradas', C_REG = 'asistente_reglas', C_VOC = 'asistente_vocab', BUCKET = 'war-muestras', BORR = 'war-as-borrador';
  var ETAPAS = ['Idea', 'Estructura', 'Borrador', 'Revisión', 'Guion aprobado', 'Narración', 'Edición', 'Publicado'];
  var CATS = ['Libros', 'Guiones', 'Voz', 'Producción', 'Web', 'Otros'];
  var TIPOS = { tarea: 'Tarea', nota: 'Nota', estado: 'Estado de un episodio', cierre: 'Cerrar una tarea', consulta: 'Consulta', sinentender: 'Sin interpretar' };
  var VOC_BASE = {
    Libros: ['libro', 'libros', 'obra', 'obras', 'etica', 'fisica', 'metafisica', 'politica', 'poetica', 'retorica', 'capitulo', 'capitulos', 'texto', 'traduccion', 'pdf', 'epub', 'extraer'],
    Guiones: ['guion', 'guiones', 'episodio', 'episodios', 'borrador', 'frase final', 'revisar', 'redactar', 'escribir', 'practica', 'referencias'],
    Voz: ['voz', 'voces', 'muestra', 'muestras', 'audio', 'audios', 'clonar', 'clon', 'locucion', 'sintetica'],
    'Producción': ['video', 'videos', 'edicion', 'editar', 'miniatura', 'youtube', 'narrar', 'narracion', 'publicar', 'renderizar', 'fondo', 'musica'],
    Web: ['web', 'pantalla', 'boton', 'reporte', 'reportes', 'diseno', 'asistente', 'login', 'panel']
  };
  var PARAR = 'para,pero,como,desde,hasta,sobre,entre,tengo,tiene,tienen,hacer,hacerlo,debo,este,esta,estos,estas,esto,esos,esas,algo,nueva,nuevo,tarea,tareas,antes,despues,luego,cuando,donde,quiero,quieres,puedes,hay,que,con,sin,por,del,los,las,una,uno,unos,unas,mas,muy,ya,lo,la,el,en,de,y,a,o,un,se,me,mi,es'.split(',');
  var DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  var A = { tab: 'chat', hist: { f: 'todo', sel: {}, multi: false, det: null }, adj: [], res: null, fin: null, cur: 0, abierto: false, cargado: false, mejoras: false };

  /* ---------- Utilidades ---------- */
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function pad(n) { return ('0' + n).slice(-2); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hoy() { return iso(new Date()); }
  function sumar(f, n) { var d = new Date(f + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); }
  function fmt(f) { var p = String(f).split('-'); return (+p[2]) + '/' + (+p[1]); }
  function mayus(s) { s = String(s || '').trim(); return s.charAt(0).toUpperCase() + s.slice(1); }
  function id(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  function D() { return W.datos(); }
  function palabras(s) { return norm(s).split(/[^a-z0-9]+/).filter(function (w) { return w.length >= 4 && PARAR.indexOf(w) < 0; }); }
  function solape(a, b) { var wb = palabras(b), n = 0; palabras(a).forEach(function (w) { if (wb.indexOf(w) > -1) n++; }); return n; }
  function abiertas() { return (D().tareas || []).filter(function (t) { return t.estado !== 'hecha'; }); }
  function episodios() { return (D().episodios || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }
  function guardarDoc(col, id_, datos) {
    var d = Object.assign({}, datos); delete d.id;
    return W.sb.from('war_docs').upsert({ coleccion: col, id: id_, datos: d, actualizado: new Date().toISOString() }).then(function (r) { if (r && r.error) throw new Error(r.error.message); return r; });
  }
  function enMemoria(col, o) { var L = D()[col] = D()[col] || []; var i = -1; L.forEach(function (x, k) { if (x.id === o.id) i = k; }); if (i > -1) L[i] = o; else L.push(o); }
  function quitarDoc(col, id_) {
    return W.sb.from('war_docs').delete().eq('coleccion', col).eq('id', id_).then(function (r) { if (r && r.error) throw new Error(r.error.message); D()[col] = (D()[col] || []).filter(function (x) { return x.id !== id_; }); });
  }

  /* ---------- Motor local ---------- */
  function vocabulario() {
    var v = {}; Object.keys(VOC_BASE).forEach(function (c) { VOC_BASE[c].forEach(function (w) { v[w] = c; }); });
    (D()[C_VOC] || []).forEach(function (x) { if (x.palabra && x.valor) v[norm(x.palabra)] = x.valor; });
    return v;
  }
  function categoriaDe(txt) {
    var v = vocabulario(), n = norm(txt), cuenta = {}, mejor = null, max = 0;
    Object.keys(v).forEach(function (w) { if (new RegExp('(^|[^a-z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)').test(n)) { cuenta[v[w]] = (cuenta[v[w]] || 0) + 1; } });
    Object.keys(cuenta).forEach(function (c) { if (cuenta[c] > max) { max = cuenta[c]; mejor = c; } });
    return mejor;
  }
  function fechaDe(n) {
    var h = hoy(), m;
    if ((m = n.match(/\b(\d{4})-(\d{2})-(\d{2})\b/))) return { f: m[0], t: m[0] };
    if ((m = n.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?\b/))) {
      var y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : new Date().getFullYear(), f = y + '-' + pad(+m[2]) + '-' + pad(+m[1]);
      if (!m[3] && f < h) f = (y + 1) + '-' + pad(+m[2]) + '-' + pad(+m[1]); return { f: f, t: m[0] };
    }
    if ((m = n.match(/\b(\d{1,2}) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/))) {
      var mes = MESES.indexOf(m[2]) + 1, y2 = new Date().getFullYear(), f2 = y2 + '-' + pad(mes) + '-' + pad(+m[1]); if (f2 < h) f2 = (y2 + 1) + '-' + pad(mes) + '-' + pad(+m[1]); return { f: f2, t: m[0] };
    }
    if (/\bpasado manana\b/.test(n)) return { f: sumar(h, 2), t: 'pasado manana' };
    if (/\bmanana\b/.test(n)) return { f: sumar(h, 1), t: 'manana' };
    if (/\bhoy\b/.test(n)) return { f: h, t: 'hoy' };
    if (/\bayer\b/.test(n)) return { f: sumar(h, -1), t: 'ayer' };
    if ((m = n.match(/\ben (\d+) dias?\b/))) return { f: sumar(h, +m[1]), t: m[0] };
    if ((m = n.match(/\ben (una|dos|tres) semanas?\b/))) return { f: sumar(h, 7 * ({ una: 1, dos: 2, tres: 3 })[m[1]]), t: m[0] };
    if ((m = n.match(/\b(la semana que viene|la proxima semana|proxima semana)\b/))) return { f: sumar(h, 7), t: m[0] };
    if ((m = n.match(/\b(?:el|este|el proximo)\s+(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/))) {
      var dow = DIAS.indexOf(m[1]), hoyDow = new Date().getDay(), delta = (dow - hoyDow + 7) % 7; if (delta === 0) delta = 7; return { f: sumar(h, delta), t: m[0] };
    }
    return null;
  }
  function limpiarTitulo(orig, quitar) {
    var s = orig;
    if (quitar) { var re = new RegExp('(?:para|antes d[eel]+|hasta|de)?\\s*(?:el\\s+|la\\s+|este\\s+)?' + quitar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'i'); var n = norm(s), mm = n.match(new RegExp('(?:para |antes d[eel]+ |hasta )?(?:el |la |este |el proximo )?' + quitar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))); if (mm) s = s.slice(0, mm.index) + s.slice(mm.index + mm[0].length); }
    s = s.replace(/^\s*(?:por favor[, ]*)?(?:recuérdame|recuerdame|recordarme|añade|anade|añadir|crea|apunta|anota|pon|nueva tarea|tarea|tengo que|hay que|debo|toca|falta)\b\s*(?:una\s+|la\s+)?(?:nueva\s+)?(?:tarea\s+)?(?:de\s+|para\s+|que\s+)?[:,-]?\s*/i, '');
    s = s.replace(/\s+(para|antes de|hasta|el)\s*[.,;]?$/i, '').replace(/[\s,;:.]+$/, '').replace(/\s{2,}/g, ' ');
    return mayus(s);
  }
  function mejorEpisodio(txt) {
    var n = norm(txt), eps = episodios(), m = n.match(/episodio\s+(\d+)/);
    if (m && eps[+m[1] - 1]) return { ep: eps[+m[1] - 1], puntos: 3 };
    var best = null, bp = 0; eps.forEach(function (e) { var p = solape(txt, e.titulo || ''); if (p > bp) { bp = p; best = e; } });
    if (!best && eps.length === 1 && /episodio|guion|primero|el video/.test(n)) return { ep: eps[0], puntos: 1 };
    return best ? { ep: best, puntos: bp } : null;
  }
  function mejorTarea(txt) {
    var best = null, bp = 0; abiertas().forEach(function (t) { var p = solape(txt, t.titulo || ''); if (p > bp) { bp = p; best = t; } });
    return best ? { t: best, puntos: bp } : null;
  }
  function etapaDe(n) {
    var m = n.match(/\b(idea|estructura|borrador|revision|guion aprobado|aprobado|narracion|edicion|publicado)\b/);
    if (!m) return null; var k = m[1] === 'aprobado' ? 'Guion aprobado' : null;
    return k || ETAPAS.filter(function (e) { return norm(e) === m[1]; })[0];
  }
  function dividir(texto) {
    return texto.split(/\n+|;\s*|\s+(?:además|ademas|y también|y tambien)\s+|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚ¿¡])/).map(function (s) { return s.replace(/^\s*(?:\d+[).\-]|[-•*])\s*/, '').trim(); }).filter(function (s) { return s.length > 1; });
  }
  function reglasEnseñadas(seg, n) {
    var salida = null;
    (D()[C_REG] || []).filter(function (r) { return r.activa !== false && r.patron; }).some(function (r) {
      var m; try { m = n.match(new RegExp(r.patron, 'i')); } catch (e) { return false; }
      if (!m) return false;
      var orig = seg, datos = {};
      Object.keys(r.datos || {}).forEach(function (k) { var v = r.datos[k]; datos[k] = typeof v === 'string' ? v.replace(/\$(\d)/g, function (x, g) { return m[+g] || ''; }) : v; });
      var f = fechaDe(n); if (r.tipo === 'tarea') { if (!datos.titulo) datos.titulo = limpiarTitulo(orig, f && f.t); if (!datos.fecha && f) datos.fecha = f.f; if (!datos.categoria) datos.categoria = categoriaDe(seg) || 'Otros'; }
      salida = { tipo: r.tipo, datos: datos, conf: 92, motivos: ['Regla enseñada: ' + (r.nombre || r.patron)], regla: r.id }; return true;
    });
    return salida;
  }
  function interpretar(seg) {
    var n = norm(seg), motivos = [], t;
    var apr = reglasEnseñadas(seg, n); if (apr) return apr;
    var f = fechaDe(n);
    /* Consulta */
    if (/\?\s*$/.test(seg) || /^(que|cuantas?|cuantos?|cual|dime|muestrame|ensename|como va|como vamos)\b/.test(n)) {
      var q = 'general'; if (/pendiente|queda|falta|por hacer|tareas/.test(n)) q = 'pendientes'; else if (/minuto|voz|muestra/.test(n)) q = 'voz'; else if (/episodio|guion|video/.test(n)) q = 'episodios';
      if (q === 'general') return { tipo: 'sinentender', datos: { texto: seg }, conf: 20, motivos: ['No sé responder esa consulta todavía'] };
      return { tipo: 'consulta', datos: { texto: seg, q: q }, conf: 90, motivos: ['Consulta reconocida: ' + q] };
    }
    /* Cerrar una tarea */
    if (/^(cierra|cerrar|termina|terminar|da por hecha|da por hecho|marca(?: como)? (?:hecha|hecho|terminada|terminado)|ya (?:esta|he|hice|termine)|he (?:terminado|hecho|acabado)|hecha|hecho)\b/.test(n)) {
      var mt = mejorTarea(seg); motivos.push('Verbo de cierre reconocido');
      if (mt) { motivos.push('Coincide con «' + mt.t.titulo + '»'); return { tipo: 'cierre', datos: { tareaId: mt.t.id }, conf: Math.min(95, 60 + mt.puntos * 15), motivos: motivos }; }
      return { tipo: 'cierre', datos: { tareaId: '' }, conf: 45, motivos: motivos.concat(['No encuentro qué tarea es']) };
    }
    /* Estado de un episodio */
    var et = etapaDe(n);
    if (et && /^(pasa|pasar|cambia|cambiar|mueve|mover|marca|marcar|pon|poner|el episodio|episodio|guion)\b/.test(n)) {
      var me = mejorEpisodio(seg); motivos.push('Etapa reconocida: ' + et);
      if (me) { motivos.push('Episodio: «' + me.ep.titulo + '»'); return { tipo: 'estado', datos: { episodioId: me.ep.id, estado: et }, conf: Math.min(95, 65 + me.puntos * 10), motivos: motivos }; }
      return { tipo: 'estado', datos: { episodioId: '', estado: et }, conf: 50, motivos: motivos.concat(['No encuentro qué episodio es']) };
    }
    /* Nota */
    var mn = seg.match(/^\s*(?:nota|idea|anota que|apunta que|recuerda que)\s*[:\-]?\s*(.+)$/i);
    if (mn) { var me2 = mejorEpisodio(mn[1]); return { tipo: 'nota', datos: { texto: mayus(mn[1]), episodioId: me2 && me2.puntos >= 2 ? me2.ep.id : '' }, conf: 85, motivos: ['Empieza como nota'] }; }
    /* Tarea */
    var verbo = /^\s*(?:por favor[, ]*)?(recuerdame|recordarme|anade|añade|anadir|crea|crear|apunta|anota|pon|nueva tarea|tarea|tengo que|hay que|debo|toca|falta)\b/i.test(norm(seg)) || /^\s*(?:añade|anade|apunta|anota)/i.test(seg);
    var infinitivo = /^\s*[a-záéíóúñ]{3,}(?:ar|er|ir)\b/i.test(seg) && seg.split(/\s+/).length >= 3;
    if (verbo || infinitivo || f) {
      var conf = 55; motivos.push(verbo ? 'Verbo de tarea reconocido' : infinitivo ? 'Empieza con una acción' : 'Lleva una fecha');
      if (verbo) conf += 20; else if (infinitivo) conf += 10;
      var tit = limpiarTitulo(seg, f && f.t), cat = categoriaDe(tit + ' ' + seg);
      if (f) { conf += 12; motivos.push('Fecha entendida: ' + fmt(f.f)); } else { conf -= 8; motivos.push('Sin fecha: propongo una semana'); }
      if (cat) { conf += 8; motivos.push('Tipo por vocabulario: ' + cat); } else { motivos.push('Sin tipo claro: Otros'); }
      if (tit.length < 4) { conf -= 25; motivos.push('Título demasiado corto'); }
      return { tipo: 'tarea', datos: { titulo: tit, categoria: cat || 'Otros', fecha: f ? f.f : sumar(hoy(), 7), fechaSupuesta: !f }, conf: Math.max(5, Math.min(97, conf)), motivos: motivos };
    }
    return { tipo: 'sinentender', datos: { texto: seg }, conf: 15, motivos: ['No he reconocido ninguna regla'] };
  }
  function analizar(texto) {
    return dividir(texto).map(function (seg) { var r = interpretar(seg); r.origen = seg; r.estado = 'pendiente'; r.id = id('k'); return r; });
  }
  function faltante(t) {
    var d = t.datos;
    if (t.tipo === 'tarea') return !String(d.titulo || '').trim() ? 'Falta el título' : !d.fecha ? 'Falta la fecha' : '';
    if (t.tipo === 'nota') return !String(d.texto || '').trim() ? 'Falta el texto' : '';
    if (t.tipo === 'estado') return !d.episodioId ? 'Falta elegir el episodio' : !d.estado ? 'Falta elegir la etapa' : '';
    if (t.tipo === 'cierre') return !d.tareaId ? 'Falta elegir la tarea' : '';
    if (t.tipo === 'sinentender') return 'No lo he entendido';
    return '';
  }
  function duplicada(t) {
    if (t.tipo !== 'tarea' || !t.datos.titulo) return null; var n = norm(t.datos.titulo), best = null;
    abiertas().forEach(function (x) { var m = norm(x.titulo); if (m === n || (solape(x.titulo, t.datos.titulo) >= 3 && Math.abs(m.length - n.length) < 12)) best = x; });
    return best;
  }

  /* ---------- Consultas ---------- */
  function responder(q) {
    var d = D(), ts = abiertas().sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
    if (q === 'pendientes') return ts.length ? 'Hay ' + ts.length + ' tareas pendientes: ' + ts.slice(0, 5).map(function (t) { return '«' + t.titulo + '» (' + fmt(t.fecha) + ')'; }).join(', ') + (ts.length > 5 ? ' y ' + (ts.length - 5) + ' más.' : '.') : 'No hay tareas pendientes. Los avisos automáticos están en Control.';
    if (q === 'voz') { var m = (d.muestras || []).reduce(function (a, x) { return a + (x.dur || 0); }, 0) / 60; return 'Hay ' + (Math.round(m * 10) / 10).toString().replace('.', ',') + ' minutos de voz guardados en ' + (d.muestras || []).length + ' frases.'; }
    if (q === 'episodios') { var c = {}; (d.episodios || []).forEach(function (e) { c[e.status || 'Idea'] = (c[e.status || 'Idea'] || 0) + 1; }); return Object.keys(c).length ? Object.keys(c).map(function (k) { return c[k] + ' en ' + k; }).join(', ') + '.' : 'Todavía no hay episodios.'; }
    return '';
  }

  /* ---------- Ejecutor central: único sitio que escribe ---------- */
  async function ejecutar(t) {
    var d = t.datos;
    if (t.tipo === 'tarea') {
      if (t.usarExistente) return { msg: 'Ya existía: «' + t.usarExistente.titulo + '». No se ha creado otra.', vista: 'control', txt: 'Ver en Control' };
      var n = { id: id('t'), titulo: String(d.titulo).trim(), categoria: d.categoria || 'Otros', fecha: d.fecha, estado: 'pendiente', creada: hoy() };
      await guardarDoc('tareas', n.id, n); enMemoria('tareas', n); return { msg: 'Tarea creada: «' + n.titulo + '» para el ' + fmt(n.fecha) + '.', vista: 'control', txt: 'Ver en Control', ref: { col: 'tareas', id: n.id } };
    }
    if (t.tipo === 'cierre') {
      var ta = (D().tareas || []).filter(function (x) { return x.id === d.tareaId; })[0]; if (!ta) throw new Error('La tarea ya no existe');
      var nuevo = Object.assign({}, ta, { estado: 'hecha', cerrada: hoy() }); await guardarDoc('tareas', ta.id, nuevo); enMemoria('tareas', nuevo); return { msg: 'Tarea cerrada: «' + ta.titulo + '».', vista: 'control', txt: 'Ver en Control', ref: { col: 'tareas', id: ta.id } };
    }
    if (t.tipo === 'estado') {
      var ep = (D().episodios || []).filter(function (x) { return x.id === d.episodioId; })[0]; if (!ep) throw new Error('El episodio ya no existe');
      var e2 = Object.assign({}, ep, { status: d.estado }); await guardarDoc('episodios', ep.id, e2); enMemoria('episodios', e2); return { msg: '«' + ep.titulo + '» pasa a ' + d.estado + '.', vista: 'episodios', txt: 'Ver episodios', ref: { col: 'episodios', id: ep.id } };
    }
    if (t.tipo === 'nota') {
      var no = { id: id('n'), texto: String(d.texto).trim(), episodioId: d.episodioId || '', creada: hoy() }; await guardarDoc('notas', no.id, no); enMemoria('notas', no); return { msg: 'Nota guardada.', vista: 'control', txt: 'Ver en Control', ref: { col: 'notas', id: no.id } };
    }
    if (t.tipo === 'consulta') return { msg: 'Consulta respondida.' };
    throw new Error('Esta petición no se puede ejecutar');
  }
  async function aprender(t) {
    if (t.tipo !== 'tarea' || !t.propuesta || t.propuesta.categoria === t.datos.categoria) return 0;
    var v = vocabulario(), n = 0;
    for (var w of palabras(t.datos.titulo)) {
      if (w.length < 5 || v[w] === t.datos.categoria) continue;
      var o = { id: id('v'), palabra: w, campo: 'categoria', valor: t.datos.categoria, creada: hoy() }; await guardarDoc(C_VOC, o.id, o); enMemoria(C_VOC, o); n++; if (n >= 3) break;
    }
    return n;
  }

  /* ---------- Historial ---------- */
  function resumenPeticion(p) { return p.tareas.map(function (t) { return t.tipo; }); }
  async function guardarPeticion(p) { enMemoria(C_PET, p); try { await guardarDoc(C_PET, p.id, p); } catch (e) { p.errores = (p.errores || []).concat([e.message]); } }

  /* ---------- Interfaz ---------- */
  var panel = null, fab = null, fondo = null;
  var IC = {
    chat: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M8 10h8M8 13h5"/></svg>',
    hist: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 4v4.5h4.5M12 8v4.5l3 2"/></svg>',
    stats: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 20V11M12 20V5M19 20v-7"/></svg>',
    mas: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    mic: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>'
  };
  function css() {
    var s = document.createElement('style');
    s.textContent =
      '#as-fab{position:fixed;right:14px;bottom:calc(74px + env(safe-area-inset-bottom));z-index:41;width:48px;height:48px;padding:0;border-radius:50%;border:1px solid var(--acc);background:var(--card2);color:var(--acc);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.4);cursor:pointer}' +
      '#rep-btn{right:70px !important}' +
      'body.as-abierto #as-fab,body.as-abierto #rep-btn{display:none !important}' +
      '#as-fondo{position:fixed;inset:0;z-index:89;background:rgba(3,6,14,.6)}#as-fondo[hidden]{display:none !important}' +
      '#as-panel{position:fixed;left:0;right:0;bottom:0;height:92%;z-index:90;display:flex;flex-direction:column;background:var(--bg);border:1px solid var(--line);border-bottom:0;border-radius:20px 20px 0 0;color:var(--tx)}' +
      '#as-panel[hidden]{display:none !important}' +
      '@media (min-width:900px){#as-panel{left:auto;top:0;height:100% !important;width:27rem;border-radius:0;border-top:0}#as-fondo{display:none !important}}' +
      '.as-cab{padding:14px 14px 8px;display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.as-cab .as-barra{flex-wrap:nowrap}.as-cab .as-barra button{padding:8px 12px;font-size:.85rem}.as-cab h2{margin:0;font-size:1.2rem}.as-cab p{margin:.15rem 0 0;font-size:.85rem}' +
      '.as-tabs{display:flex;gap:6px;padding:0 14px 8px;border-bottom:1px solid var(--line)}' +
      '.as-tabs button{padding:8px 14px;border-color:transparent;color:var(--mut);display:flex;align-items:center;justify-content:center}.as-tabs button.on{border-color:var(--acc);color:var(--acc)}.as-tabs .ic{width:44px;padding:8px 0}' +
      '.as-cuerpo{flex:1 1 auto;overflow-y:auto;padding:14px;-webkit-overflow-scrolling:touch}' +
      '.as-comp{display:flex;flex-direction:column;gap:8px}.as-comp textarea{margin:0;min-height:96px;max-height:220px;resize:none;font-size:16px;line-height:1.4}' +
      '.as-barra{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.as-barra .ib{width:44px;height:44px;padding:0;border-color:transparent;display:flex;align-items:center;justify-content:center}.as-barra .ib.activo{border-color:var(--acc);color:var(--acc)}' +
      '.as-menu{display:flex;flex-direction:column;gap:6px;padding:8px;border:1px solid var(--line);border-radius:14px;background:var(--card2)}.as-menu button{text-align:left;border-color:transparent}' +
      '.as-th{display:flex;gap:8px;flex-wrap:wrap}.as-th .a{position:relative;width:64px;height:64px;border:1px solid var(--line);border-radius:10px;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:.7rem;color:var(--mut);text-align:center}.as-th img{width:100%;height:100%;object-fit:cover}.as-th button.q{position:absolute;right:0;top:0;width:22px;height:22px;padding:0;border:0;background:transparent;color:var(--tx);filter:drop-shadow(0 0 2px #000)}' +
      '.as-conf{display:inline-block;padding:2px 10px;border:1px solid var(--line);border-radius:999px;font-size:.78rem;margin-left:6px}.as-conf.v{color:#86d9a6;border-color:#86d9a6}.as-conf.a{color:#e4b865;border-color:#e4b865}.as-conf.r{color:var(--err);border-color:var(--err)}' +
      '.as-falta{color:var(--err);font-size:.85rem;margin:.5rem 0 0}' +
      '.as-motivos{margin:.5rem 0 0;padding-left:1.1rem;font-size:.82rem;color:var(--mut)}' +
      '.as-sug{display:flex;gap:6px;flex-wrap:wrap;margin-top:.5rem}.as-sug .chip{padding:5px 12px;font-size:.8rem}' +
      '.as-solo{margin:.2rem 0 .8rem}.as-fila{display:flex;gap:8px;flex-wrap:wrap;margin-top:.8rem}' +
      '.as-it{padding:12px;border:1px solid var(--line);border-radius:14px;margin:0 0 8px;background:var(--card)}.as-it.sel{border-color:var(--acc)}.as-it .mut{font-size:.82rem}' +
      '.as-plegado{padding:8px 12px;border:1px solid var(--line);border-radius:12px;margin:0 0 6px;font-size:.88rem}' +
      '.as-stat{display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)}.as-stat b{font-weight:600}';
    document.head.appendChild(s);
  }

  function confClase(c) { return c >= 80 ? 'v' : c >= 50 ? 'a' : 'r'; }
  function badge(c) { return '<span class="as-conf ' + confClase(c) + '">' + c + ' %</span>'; }
  function toast(t) { var x = document.createElement('div'); x.className = 'rep-toast'; x.textContent = t; x.style.zIndex = 140; document.body.appendChild(x); setTimeout(function () { x.remove(); }, 2800); }

  function montar() {
    css();
    fab = document.createElement('button'); fab.type = 'button'; fab.id = 'as-fab'; fab.setAttribute('aria-label', 'Abrir el asistente'); fab.innerHTML = IC.chat; fab.hidden = true; document.body.appendChild(fab);
    fondo = document.createElement('div'); fondo.id = 'as-fondo'; fondo.hidden = true; document.body.appendChild(fondo);
    panel = document.createElement('div'); panel.id = 'as-panel'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Asistente'); document.body.appendChild(panel);
    var app = document.getElementById('app');
    function ver() { fab.hidden = !app || app.hidden; if (app && app.hidden) cerrar(); }
    if (app && window.MutationObserver) new MutationObserver(ver).observe(app, { attributes: true, attributeFilter: ['hidden'] }); ver();
    fab.addEventListener('click', abrir); fondo.addEventListener('click', cerrar);
    panel.addEventListener('click', clic); panel.addEventListener('input', entrada); panel.addEventListener('change', cambio);
    if (window.visualViewport) { visualViewport.addEventListener('resize', ajustar); visualViewport.addEventListener('scroll', ajustar); }
    window.addEventListener('resize', ajustar);
  }
  function ajustar() {
    if (!panel || panel.hidden || innerWidth >= 900) { if (panel) { panel.style.height = ''; panel.style.top = ''; } return; }
    var vv = window.visualViewport; if (!vv) return;
    if (vv.height < innerHeight * 0.8) { panel.style.top = vv.offsetTop + 'px'; panel.style.height = vv.height + 'px'; panel.style.bottom = 'auto'; panel.style.borderRadius = '0'; }
    else { panel.style.top = ''; panel.style.height = ''; panel.style.bottom = '0'; panel.style.borderRadius = ''; }
  }
  async function abrir() {
    A.abierto = true; panel.hidden = false; fondo.hidden = false; document.body.classList.add('as-abierto');
    try { A.borrador = localStorage.getItem(BORR) || ''; } catch (e) { A.borrador = ''; }
    pintar(); ajustar();
  }
  function cerrar() { if (!panel) return; A.abierto = false; panel.hidden = true; fondo.hidden = true; document.body.classList.remove('as-abierto'); }

  function cabecera() {
    var tab = function (k, txt, ic) { return '<button type="button" data-tab="' + k + '" class="' + (A.tab === k ? 'on' : '') + (ic ? ' ic' : '') + '" aria-label="' + (ic ? txt : '') + '" aria-pressed="' + (A.tab === k) + '">' + (ic || txt) + '</button>'; };
    return '<div class="as-cab"><div><h2>Asistente</h2><p class="mut">Cuéntame qué ha pasado o qué necesitas</p></div><div class="as-barra"><button type="button" data-a="mejoras">Mejoras</button><button type="button" data-a="cerrar">Cerrar</button></div></div>' +
      '<div class="as-tabs">' + tab('chat', 'Chat') + tab('subir', 'Subir') + tab('hist', 'Historial', IC.hist) + tab('stats', 'Estadísticas', IC.stats) + '</div>';
  }
  function pintar() {
    if (!panel) return;
    var cuerpo = A.mejoras ? vMejoras() : A.tab === 'chat' ? vChat() : A.tab === 'subir' ? vSubir() : A.tab === 'hist' ? vHist() : vStats();
    var scroll = panel.querySelector('.as-cuerpo'); var y = scroll ? scroll.scrollTop : 0;
    panel.innerHTML = cabecera() + '<div class="as-cuerpo">' + cuerpo + '</div>' +
      '<input type="file" id="as-foto" accept="image/*" multiple hidden><input type="file" id="as-cam" accept="image/*" capture="environment" hidden><input type="file" id="as-arch" multiple hidden>';
    scroll = panel.querySelector('.as-cuerpo'); if (scroll && A.mantener) scroll.scrollTop = y; A.mantener = false;
  }

  /* --- Chat --- */
  function vAdjuntos() {
    if (!A.adj.length) return '';
    return '<div class="as-th">' + A.adj.map(function (a, i) { return '<div class="a">' + (a.url ? '<img alt="" src="' + a.url + '">' : esc(a.file.name.slice(0, 14))) + '<button type="button" class="q" data-qa="' + i + '" aria-label="Quitar adjunto">×</button></div>'; }).join('') + '</div>';
  }
  function vCompose(sub) {
    return '<div class="as-comp"><textarea id="as-txt" placeholder="Por ejemplo: añade cargar el libro 1 para el viernes; cierra la tarea de las muestras" aria-label="Qué necesitas">' + esc(A.borrador || '') + '</textarea>' + vAdjuntos() +
      '<div class="as-barra"><button type="button" class="ib' + (A.menu ? ' activo' : '') + '" data-a="adjuntar" aria-label="Adjuntar">' + IC.mas + '</button>' +
      ((window.SpeechRecognition || window.webkitSpeechRecognition) ? '<button type="button" class="ib' + (A.dictando ? ' activo' : '') + '" data-a="dictar" aria-label="Dictar por voz">' + IC.mic + '</button>' : '') +
      '<span style="flex:1"></span><button type="button" class="btn principal" data-a="' + sub + '">' + (sub === 'analizar' ? 'Analizar' : 'Dejar en la cola') + '</button></div>' +
      (A.menu ? '<div class="as-menu"><button type="button" data-a="cam">Hacer foto</button><button type="button" data-a="foto">Subir foto</button><button type="button" data-a="arch">Adjuntar archivo</button></div>' : '') +
      '<div class="mut peq">Las fotos y archivos no los lee el motor: quedan en la cola para que los revise Claude. No se gasta nada de IA.</div></div>';
  }
  function campo(t, k, rotulo, tipo, extra) {
    var v = t.datos[k] == null ? '' : t.datos[k];
    return '<label for="as-' + k + '">' + rotulo + '</label>' + (tipo === 'area' ? '<textarea id="as-' + k + '" data-k="' + k + '" rows="3">' + esc(v) + '</textarea>' : '<input id="as-' + k + '" data-k="' + k + '" type="' + (tipo || 'text') + '" value="' + esc(v) + '">') + (extra || '');
  }
  function selector(t, k, rotulo, opciones, vacio) {
    return '<label for="as-' + k + '">' + rotulo + '</label><select id="as-' + k + '" data-k="' + k + '">' + (vacio ? '<option value="">' + vacio + '</option>' : '') + opciones.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(t.datos[k]) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
  }
  function tarjetaTarea(t) {
    var d = t.datos, h = '';
    if (t.tipo === 'tarea') {
      var dup = duplicada(t);
      h += campo(t, 'titulo', 'Qué hay que hacer') + selector(t, 'categoria', 'Tipo', CATS.map(function (c) { return [c, c]; })) + campo(t, 'fecha', 'Fecha límite' + (d.fechaSupuesta ? ' (supuesta)' : ''), 'date');
      h += '<div class="as-sug">' + [1, 3, 7, 14].map(function (n) { return '<button type="button" class="chip" data-fecha="' + sumar(hoy(), n) + '">' + (n === 1 ? 'Mañana' : 'En ' + n + ' días') + '</button>'; }).join('') + '</div>';
      if (dup) h += '<div class="as-falta" style="color:var(--acc)">Ya hay una tarea parecida: «' + esc(dup.titulo) + '» (' + fmt(dup.fecha) + ').</div><div class="as-sug"><button type="button" class="chip' + (t.usarExistente ? ' on' : '') + '" data-a="existente" aria-pressed="' + !!t.usarExistente + '">Usar la existente</button></div>';
    } else if (t.tipo === 'nota') {
      h += campo(t, 'texto', 'Nota', 'area') + selector(t, 'episodioId', 'Episodio (opcional)', episodios().map(function (e) { return [e.id, e.titulo]; }), 'Ninguno');
    } else if (t.tipo === 'estado') {
      h += selector(t, 'episodioId', 'Episodio', episodios().map(function (e) { return [e.id, e.titulo + ' · ' + (e.status || 'Idea')]; }), 'Elegir…') + selector(t, 'estado', 'Nueva etapa', ETAPAS.map(function (e) { return [e, e]; }));
    } else if (t.tipo === 'cierre') {
      h += selector(t, 'tareaId', 'Tarea', abiertas().map(function (x) { return [x.id, x.titulo + ' · ' + fmt(x.fecha)]; }), 'Elegir…');
    } else if (t.tipo === 'consulta') {
      h += '<p style="white-space:pre-line">' + esc(responder(d.q)) + '</p>';
    } else {
      h += '<p class="mut">«' + esc(d.texto) + '»</p><p class="mut peq">El motor no lo ha entendido. Puedes tratarlo a mano o dejarlo en la cola para que Claude me enseñe cómo se hace.</p><div class="as-sug"><button type="button" class="chip" data-conv="tarea">Tratar como tarea</button><button type="button" class="chip" data-conv="nota">Tratar como nota</button></div>';
    }
    return h;
  }
  function vRevision() {
    var p = A.res, t = p.tareas[A.cur] || p.tareas[0];
    var tabs = '<div class="as-sug as-solo">' + p.tareas.map(function (x, i) { return '<button type="button" class="chip' + (i === A.cur ? ' on' : '') + '" data-ti="' + i + '" aria-pressed="' + (i === A.cur) + '">' + (i + 1) + '. ' + TIPOS[x.tipo] + (x.estado === 'hecha' ? ' · lista' : x.estado === 'omitida' ? ' · omitida' : faltante(x) && x.tipo !== 'consulta' ? ' · le falta algo' : '') + '</button>'; }).join('') + '</div>';
    var f = t.estado === 'pendiente' ? faltante(t) : '';
    var h = tabs + '<div class="tarjeta" style="margin:0"><div class="mut peq">Entendido de: «' + esc(t.origen) + '»</div><div style="margin-top:.4rem"><b>' + TIPOS[t.tipo] + '</b>' + badge(t.conf) + '</div>';
    if (t.estado !== 'pendiente') h += '<p class="mut">' + (t.estado === 'hecha' ? esc(t.resultado || 'Hecho.') : 'Omitida.') + '</p>';
    else {
      h += tarjetaTarea(t) + '<ul class="as-motivos">' + t.motivos.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul>';
      if (f && t.tipo !== 'consulta') h += '<div class="as-falta" role="alert">' + esc(f) + '</div>';
      h += '<div class="as-fila">' + (t.tipo === 'consulta' ? '<button type="button" class="btn principal" data-a="confirmar">Entendido</button>' : '<button type="button" class="btn principal" data-a="confirmar"' + (f ? ' disabled' : '') + ' id="as-conf">Confirmar</button>') +
        '<button type="button" data-a="omitir">Omitir</button><button type="button" data-a="copiar">Copiar para Claude</button>' + (t.tipo === 'sinentender' ? '<button type="button" data-a="cola1">Dejar en la cola</button>' : '') + '</div>';
    }
    h += '</div>';
    if (p.tareas.filter(function (x) { return x.estado === 'pendiente'; }).length > 1) h += '<div class="as-fila"><button type="button" data-a="todas">Confirmar todas las listas</button></div>';
    h += '<div class="as-fila"><button type="button" data-a="descartar">Empezar de nuevo</button></div>';
    return h;
  }
  function vFin() {
    var p = A.fin, hechas = p.tareas.filter(function (t) { return t.estado === 'hecha'; }), pend = abiertas().length;
    return '<h3 style="margin-top:0">Todo listo</h3>' + (hechas.length ? hechas.map(function (t) { return '<div class="as-it"><div>' + esc(t.resultado) + '</div>' + (t.vista ? '<div class="as-fila" style="margin-top:.4rem"><button type="button" data-ir="' + t.vista + '">' + esc(t.vistaTxt) + '</button></div>' : '') + '</div>'; }).join('') : '<p class="mut">No se ha ejecutado nada.</p>') +
      '<div class="as-fila"><button type="button" class="btn principal" data-a="otra">Pedir algo más</button><button type="button" data-a="cerrar">Cerrar</button>' + (pend ? '<button type="button" data-ir="control">Revisar la bandeja</button>' : '') + '</div>';
  }
  function vChat() { return A.res ? vRevision() : A.fin ? vFin() : vCompose('analizar'); }

  /* --- Cola --- */
  function vSubir() {
    var L = (D()[C_ENT] || []).slice().sort(function (a, b) { return (b.creada || '') < (a.creada || '') ? -1 : 1; });
    var pend = L.filter(function (x) { return x.estado !== 'verificada'; }), ver = L.filter(function (x) { return x.estado === 'verificada'; });
    var h = '<p class="mut peq" style="margin-top:0">Lo que dejes aquí no se interpreta ahora: queda para que lo revise Claude en el chat y me enseñe cómo hacerlo.</p>' + vCompose('subir') + '<h3>Pendiente de revisar</h3>';
    h += pend.length ? pend.map(function (x) { return itemCola(x); }).join('') : '<p class="mut">No hay nada pendiente.</p>';
    if (ver.length) h += '<h3>Verificado</h3>' + ver.map(function (x) { return '<details class="as-plegado"><summary>' + esc(mayus((x.texto || 'Adjuntos').slice(0, 60))) + '</summary><div class="mut peq" style="margin-top:.4rem">' + esc(x.resultado || 'Revisado.') + '</div></details>'; }).join('');
    return h;
  }
  function itemCola(x) {
    var pr = x.propuesta ? x.propuesta.map(function (t) { return TIPOS[t.tipo] + (t.conf != null ? ' (' + t.conf + ' %)' : ''); }).join(', ') : 'Sin propuesta';
    return '<div class="as-it"><div style="white-space:pre-line">' + esc(x.texto || '(solo adjuntos)') + '</div><div class="mut">Motor: ' + esc(pr) + '</div>' + (x.adjuntos && x.adjuntos.length ? '<div class="mut">' + x.adjuntos.length + ' adjuntos</div>' : '') + '<div class="mut">' + esc(fmt(x.creada || hoy())) + '</div></div>';
  }

  /* --- Historial --- */
  function enSemana(f) { return f >= sumar(hoy(), -6); }
  function filtrar(L) {
    var f = A.hist.f;
    return L.filter(function (p) {
      if (f === 'hoy') return p.creada === hoy(); if (f === 'semana') return enSemana(p.creada);
      if (f === 'sin') return !p.confirmada; if (f === 'no') return p.tareas.some(function (t) { return t.tipo === 'sinentender'; });
      if (f === 'aprendio') return (p.aprendido || 0) > 0; if (f === 'errores') return (p.errores || []).length > 0; return true;
    });
  }
  function vHist() {
    var h = A.hist, L = (D()[C_PET] || []).slice().sort(function (a, b) { return a.ts < b.ts ? 1 : -1; });
    if (h.det) return vDetalle(L.filter(function (p) { return p.id === h.det; })[0]);
    var fs = [['hoy', 'Hoy'], ['semana', 'Esta semana'], ['todo', 'Todo'], ['sin', 'Sin confirmar'], ['no', 'No interpretadas'], ['aprendio', 'Aprendió'], ['errores', 'Errores']];
    var out = '<div class="as-sug as-solo">' + fs.map(function (x) { return '<button type="button" class="chip' + (h.f === x[0] ? ' on' : '') + '" data-f="' + x[0] + '" aria-pressed="' + (h.f === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>';
    var F = filtrar(L);
    out += '<div class="as-fila" style="margin-top:0"><button type="button" data-a="multi" aria-pressed="' + h.multi + '" class="' + (h.multi ? 'chip on' : '') + '">' + (h.multi ? 'Terminar selección' : 'Seleccionar') + '</button>' +
      (h.multi ? '<button type="button" data-a="archivar">Archivar</button><button type="button" data-a="borrar">Borrar</button>' : '') + '</div><div style="margin-top:.8rem"></div>';
    out += F.length ? F.map(function (p) {
      var estado = p.confirmada ? 'Confirmada' : 'Sin confirmar';
      return '<div class="as-it' + (h.sel[p.id] ? ' sel' : '') + '" ' + (h.multi ? 'data-s="' + p.id + '"' : '') + '>' + '<div style="white-space:pre-line">' + esc((p.texto || '(solo adjuntos)').slice(0, 140)) + '</div><div class="mut">' + fmt(p.creada) + ' · ' + estado + ' · ' + p.tareas.length + (p.tareas.length === 1 ? ' tarea' : ' tareas') + (p.archivada ? ' · archivada' : '') + '</div>' +
        (h.multi ? '' : '<div class="as-fila" style="margin-top:.4rem"><button type="button" data-det="' + p.id + '">Abrir</button></div>') + '</div>';
    }).join('') : '<p class="mut">No hay peticiones con este filtro.</p>';
    return out;
  }
  function vDetalle(p) {
    if (!p) { A.hist.det = null; return vHist(); }
    var h = '<div class="as-fila" style="margin-top:0"><button type="button" data-a="volverh">Volver al historial</button></div><h3>Lo que pediste</h3><div class="as-it" style="white-space:pre-line">' + esc(p.texto || '(solo adjuntos)') + '</div>' +
      (p.adjuntos && p.adjuntos.length ? '<div class="mut peq">' + p.adjuntos.length + ' archivos adjuntos</div>' : '') + '<h3>Lo que entendió</h3>' +
      p.tareas.map(function (t) { return '<div class="as-it"><b>' + TIPOS[t.tipo] + '</b>' + badge(t.conf) + '<div class="mut">«' + esc(t.origen) + '»</div><div>' + (t.estado === 'hecha' ? esc(t.resultado || 'Hecho') : t.estado === 'omitida' ? 'Omitida' : 'Sin confirmar') + '</div>' +
        (t.vista ? '<div class="as-fila" style="margin-top:.4rem"><button type="button" data-ir="' + t.vista + '">' + esc(t.vistaTxt) + '</button></div>' : '') + '</div>'; }).join('') +
      '<h3>Coste</h3><p class="mut">0 €. Lo resolvió el motor local; no se ha usado IA.' + ((p.errores || []).length ? ' Errores: ' + esc(p.errores.join('; ')) : '') + '</p>' +
      '<div class="as-fila"><button type="button" data-a="reanalizar" data-p="' + p.id + '">Volver a analizar</button><button type="button" data-a="continuar" data-p="' + p.id + '">Continuar</button><button type="button" data-a="addarch" data-p="' + p.id + '">Añadir archivos</button></div>';
    return h;
  }

  /* --- Estadísticas --- */
  function vStats() {
    var L = D()[C_PET] || [], n = L.length, sin = 0, ok = 0, tot = 0, apr = 0, falla = {};
    L.forEach(function (p) { p.tareas.forEach(function (t) { tot++; if (t.tipo === 'sinentender') { sin++; var k = norm(t.origen).slice(0, 50); falla[k] = { t: t.origen, n: ((falla[k] || {}).n || 0) + 1 }; } else ok++; }); apr += p.aprendido || 0; });
    var pct = tot ? Math.round(ok * 100 / tot) : 0, vocab = (D()[C_VOC] || []).length, reglas = (D()[C_REG] || []).filter(function (r) { return r.activa !== false; }).length;
    var top = Object.keys(falla).map(function (k) { return falla[k]; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 5);
    var fila = function (a, b) { return '<div class="as-stat"><span>' + a + '</span><b>' + b + '</b></div>'; };
    return fila('Peticiones', n) + fila('Entendidas por el motor', pct + ' %') + fila('Sin interpretar (a enseñar)', sin) + fila('Gasto en IA', '0 €') + fila('Reglas enseñadas', reglas) + fila('Equivalencias aprendidas', vocab + (apr ? ' (' + apr + ' nuevas)' : '')) +
      '<h3>Lo que más se repite sin entender</h3>' + (top.length ? top.map(function (x) { return '<div class="as-it">«' + esc(x.t) + '»<div class="mut">' + x.n + (x.n === 1 ? ' vez' : ' veces') + '</div></div>'; }).join('') : '<p class="mut">Nada por ahora.</p>') +
      '<div class="as-fila"><button type="button" data-a="reportes">Ver reportes</button><button type="button" data-a="salir">Cerrar sesión</button></div>';
  }

  /* --- Mejoras --- */
  function pendientesEnseñar() {
    var out = []; (D()[C_PET] || []).forEach(function (p) { if (p.archivada) return; p.tareas.forEach(function (t) { if (t.tipo === 'sinentender' && t.estado !== 'hecha') out.push(t.origen); }); });
    return out.filter(function (x, i) { return out.indexOf(x) === i; });
  }
  function vMejoras() {
    var pe = pendientesEnseñar(), voc = (D()[C_VOC] || []), rg = (D()[C_REG] || []);
    return '<div class="as-fila" style="margin-top:0"><button type="button" data-a="volverm">Volver</button></div><h3>Pendiente de enseñar</h3><p class="mut peq">Lo que el motor no supo interpretar. Pásaselo a Claude en el chat y él añade la regla.</p>' +
      (pe.length ? pe.map(function (x) { return '<div class="as-it">«' + esc(x) + '»</div>'; }).join('') + '<div class="as-fila"><button type="button" class="btn principal" data-a="copiarmejoras">Copiar para Claude</button></div>' : '<p class="mut">No hay nada pendiente.</p>') +
      '<h3>Reglas enseñadas</h3>' + (rg.length ? rg.map(function (r) { return '<div class="as-it">' + esc(r.nombre || r.patron) + '<div class="mut">' + esc(r.tipo) + '</div></div>'; }).join('') : '<p class="mut">Todavía ninguna.</p>') +
      '<h3>Equivalencias aprendidas</h3>' + (voc.length ? voc.map(function (v) { return '<div class="as-it fila-sp"><span>' + esc(v.palabra) + ' = ' + esc(v.valor) + '</span><button type="button" data-qv="' + esc(v.id) + '">Olvidar</button></div>'; }).join('') : '<p class="mut">Todavía ninguna.</p>');
  }

  /* ---------- Eventos ---------- */
  function entrada(ev) {
    var el = ev.target;
    if (el.id === 'as-txt') { A.borrador = el.value; try { localStorage.setItem(BORR, el.value); } catch (e) {} return; }
    if (el.dataset && el.dataset.k && A.res) {
      var t = A.res.tareas[A.cur]; if (!t) return; t.datos[el.dataset.k] = el.value; if (el.dataset.k === 'fecha') t.datos.fechaSupuesta = false; revisarBoton(t);
    }
  }
  function cambio(ev) {
    var el = ev.target;
    if (el.dataset && el.dataset.k && A.res) { var t = A.res.tareas[A.cur]; t.datos[el.dataset.k] = el.value; if (el.dataset.k === 'categoria' || el.dataset.k === 'titulo') { A.mantener = true; } if (el.dataset.k === 'episodioId' || el.dataset.k === 'titulo' || el.dataset.k === 'fecha' || el.dataset.k === 'categoria') { A.mantener = true; pintar(); } }
    if (el.id === 'as-foto' || el.id === 'as-cam' || el.id === 'as-arch') { var fs = [].slice.call(el.files); el.value = ''; if (A.addPara) { anadirAPeticion(A.addPara, fs); A.addPara = null; } else agregarArchivos(fs); }
  }
  function revisarBoton(t) { var b = panel.querySelector('#as-conf'); if (b) b.disabled = !!faltante(t); var m = panel.querySelector('.as-falta[role=alert]'); if (m) m.textContent = faltante(t); }
  function agregarArchivos(fs) {
    fs.forEach(function (f) { var a = { file: f }; if (/^image\//.test(f.type)) a.url = URL.createObjectURL(f); A.adj.push(a); }); A.menu = false; guardarBorrador(); pintar();
  }
  async function anadirAPeticion(pid, fs) {
    var p = (D()[C_PET] || []).filter(function (z) { return z.id === pid; })[0]; if (!p) return;
    try { for (var i = 0; i < fs.length; i++) { var f = fs[i], ruta = 'asistente/' + pid + '/' + (p.adjuntos.length + i) + '-' + f.name.replace(/[^a-zA-Z0-9._-]/g, '_'); var r = await W.sb.storage.from(BUCKET).upload(ruta, f, { contentType: f.type || 'application/octet-stream', upsert: true }); if (r && r.error) throw new Error(r.error.message); p.adjuntos.push(ruta); } await guardarPeticion(p); toast('Archivos añadidos'); } catch (e) { toast('No se pudo: ' + e.message); }
    pintar();
  }
  function guardarBorrador() { var ta = panel.querySelector('#as-txt'); if (ta) { A.borrador = ta.value; try { localStorage.setItem(BORR, ta.value); } catch (e) {} } }

  async function subirAdjuntos(pid) {
    var rutas = [];
    for (var i = 0; i < A.adj.length; i++) {
      var f = A.adj[i].file, ruta = 'asistente/' + pid + '/' + i + '-' + f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      var r = await W.sb.storage.from(BUCKET).upload(ruta, f, { contentType: f.type || 'application/octet-stream', upsert: true }); if (r && r.error) throw new Error(r.error.message); rutas.push(ruta);
    }
    return rutas;
  }
  function limpiarAdj() { A.adj.forEach(function (a) { if (a.url) URL.revokeObjectURL(a.url); }); A.adj = []; }

  async function accionAnalizar() {
    guardarBorrador(); var txt = (A.borrador || '').trim(); if (!txt && !A.adj.length) { toast('Escribe algo o adjunta un archivo'); return; }
    var p = { id: id('p'), ts: Date.now(), creada: hoy(), texto: txt, adjuntos: [], tareas: txt ? analizar(txt) : [], motor: true, ia: false, confirmada: false, errores: [], aprendido: 0 };
    if (A.adj.length) { try { p.adjuntos = await subirAdjuntos(p.id); } catch (e) { p.errores.push('Adjuntos: ' + e.message); toast('No se pudieron subir los adjuntos'); }
      var ent = { id: id('e'), texto: txt, adjuntos: p.adjuntos, propuesta: p.tareas.map(function (t) { return { tipo: t.tipo, conf: t.conf, datos: t.datos }; }), estado: 'pendiente', creada: hoy(), peticion: p.id }; try { await guardarDoc(C_ENT, ent.id, ent); enMemoria(C_ENT, ent); } catch (e) { p.errores.push(e.message); }
      limpiarAdj(); }
    if (!p.tareas.length) { p.confirmada = true; await guardarPeticion(p); A.borrador = ''; try { localStorage.removeItem(BORR); } catch (e) {} toast('Los adjuntos han quedado en la cola'); A.tab = 'subir'; pintar(); return; }
    p.tareas.forEach(function (t) { t.propuesta = JSON.parse(JSON.stringify(t.datos)); });
    await guardarPeticion(p); A.res = p; A.cur = 0; A.borrador = ''; try { localStorage.removeItem(BORR); } catch (e) {} pintar();
  }
  async function accionSubir() {
    guardarBorrador(); var txt = (A.borrador || '').trim(); if (!txt && !A.adj.length) { toast('Escribe algo o adjunta un archivo'); return; }
    var eid = id('e'), adj = []; try { adj = await subirAdjuntos(eid); } catch (e) { toast('No se pudieron subir los adjuntos'); }
    var prop = txt ? analizar(txt).map(function (t) { return { tipo: t.tipo, conf: t.conf, datos: t.datos }; }) : [];
    var ent = { id: eid, texto: txt, adjuntos: adj, propuesta: prop, estado: 'pendiente', creada: hoy() };
    try { await guardarDoc(C_ENT, ent.id, ent); enMemoria(C_ENT, ent); limpiarAdj(); A.borrador = ''; try { localStorage.removeItem(BORR); } catch (e) {} toast('Dejado en la cola'); } catch (e) { toast('No se pudo guardar: ' + e.message); }
    pintar();
  }
  async function confirmarUno(t, p) {
    try {
      var r = await ejecutar(t); t.estado = 'hecha'; t.resultado = r.msg; if (r.vista) { t.vista = r.vista; t.vistaTxt = r.txt; } if (r.ref) t.ref = r.ref;
      var n = await aprender(t); p.aprendido = (p.aprendido || 0) + n; p.confirmada = true; await guardarPeticion(p); return true;
    } catch (e) { p.errores = (p.errores || []).concat([e.message]); await guardarPeticion(p); toast('No se pudo: ' + e.message); return false; }
  }
  function siguiente() {
    var p = A.res, i = p.tareas.findIndex(function (t) { return t.estado === 'pendiente'; });
    if (i < 0) { A.fin = p; A.res = null; if (W.pintar) W.pintar(); } else A.cur = i; pintar();
  }
  async function clic(ev) {
    var b = ev.target.closest('button, .as-it[data-s]'); if (!b) return; var d = b.dataset, a = d.a;
    if (d.tab) { A.tab = d.tab; A.mejoras = false; A.menu = false; A.hist.det = null; pintar(); return; }
    if (d.ti != null) { A.cur = +d.ti; pintar(); return; }
    if (d.fecha) { A.res.tareas[A.cur].datos.fecha = d.fecha; A.res.tareas[A.cur].datos.fechaSupuesta = false; pintar(); return; }
    if (d.conv) { var t0 = A.res.tareas[A.cur], o = t0.datos.texto; t0.tipo = d.conv; t0.datos = d.conv === 'tarea' ? { titulo: mayus(o), categoria: categoriaDe(o) || 'Otros', fecha: sumar(hoy(), 7), fechaSupuesta: true } : { texto: mayus(o), episodioId: '' }; t0.conf = 40; t0.motivos = ['Tratado a mano']; t0.propuesta = JSON.parse(JSON.stringify(t0.datos)); pintar(); return; }
    if (d.ir) { cerrar(); window.WAR.ir ? window.WAR.ir(d.ir) : null; return; }
    if (d.f) { A.hist.f = d.f; pintar(); return; }
    if (d.det) { A.hist.det = d.det; pintar(); return; }
    if (d.s) { A.hist.sel[d.s] = !A.hist.sel[d.s]; pintar(); return; }
    if (d.qa != null) { var q = A.adj.splice(+d.qa, 1)[0]; if (q && q.url) URL.revokeObjectURL(q.url); guardarBorrador(); pintar(); return; }
    if (d.qv) { try { await quitarDoc(C_VOC, d.qv); } catch (e) { toast('No se pudo: ' + e.message); } pintar(); return; }
    if (!a) return;
    if (a === 'cerrar') cerrar();
    else if (a === 'mejoras') { A.mejoras = true; pintar(); }
    else if (a === 'volverm') { A.mejoras = false; pintar(); }
    else if (a === 'adjuntar') { guardarBorrador(); A.menu = !A.menu; pintar(); }
    else if (a === 'cam') panel.querySelector('#as-cam').click();
    else if (a === 'foto') panel.querySelector('#as-foto').click();
    else if (a === 'arch') panel.querySelector('#as-arch').click();
    else if (a === 'dictar') dictar();
    else if (a === 'analizar') accionAnalizar();
    else if (a === 'subir') accionSubir();
    else if (a === 'existente') { var tt = A.res.tareas[A.cur]; tt.usarExistente = tt.usarExistente ? null : duplicada(tt); pintar(); }
    else if (a === 'omitir') { A.res.tareas[A.cur].estado = 'omitida'; await guardarPeticion(A.res); siguiente(); }
    else if (a === 'confirmar') { var tc = A.res.tareas[A.cur]; if (tc.tipo === 'consulta') { tc.estado = 'hecha'; tc.resultado = responder(tc.datos.q); A.res.confirmada = true; await guardarPeticion(A.res); siguiente(); } else if (!faltante(tc) && await confirmarUno(tc, A.res)) siguiente(); }
    else if (a === 'todas') { for (var k = 0; k < A.res.tareas.length; k++) { var x = A.res.tareas[k]; if (x.estado === 'pendiente' && x.tipo !== 'sinentender' && !faltante(x) && x.conf >= 80) await confirmarUno(x, A.res); } siguiente(); }
    else if (a === 'copiar') copiar(contextoClaude(A.res.tareas[A.cur]));
    else if (a === 'cola1') { var tq = A.res.tareas[A.cur], ent = { id: id('e'), texto: tq.origen, adjuntos: [], propuesta: [{ tipo: tq.tipo, conf: tq.conf, datos: tq.datos }], estado: 'pendiente', creada: hoy(), peticion: A.res.id }; try { await guardarDoc(C_ENT, ent.id, ent); enMemoria(C_ENT, ent); tq.estado = 'omitida'; await guardarPeticion(A.res); toast('Dejado en la cola'); siguiente(); } catch (e) { toast('No se pudo: ' + e.message); } }
    else if (a === 'descartar') { A.res = null; pintar(); }
    else if (a === 'otra') { A.fin = null; A.res = null; pintar(); }
    else if (a === 'multi') { A.hist.multi = !A.hist.multi; A.hist.sel = {}; pintar(); }
    else if (a === 'archivar' || a === 'borrar') {
      var ids = Object.keys(A.hist.sel).filter(function (k2) { return A.hist.sel[k2]; }); if (!ids.length) { toast('Elige alguna petición'); return; }
      try { for (var i = 0; i < ids.length; i++) { if (a === 'borrar') await quitarDoc(C_PET, ids[i]); else { var pp = (D()[C_PET] || []).filter(function (z) { return z.id === ids[i]; })[0]; pp.archivada = true; await guardarPeticion(pp); } } } catch (e) { toast('No se pudo: ' + e.message); }
      A.hist.sel = {}; A.hist.multi = false; pintar();
    }
    else if (a === 'volverh') { A.hist.det = null; pintar(); }
    else if (a === 'reanalizar' || a === 'continuar') {
      var pe = (D()[C_PET] || []).filter(function (z) { return z.id === d.p; })[0]; if (!pe) return;
      if (a === 'reanalizar') { var np = Object.assign({}, pe, { tareas: analizar(pe.texto || ''), confirmada: false, aprendido: 0, errores: [] }); np.tareas.forEach(function (t) { t.propuesta = JSON.parse(JSON.stringify(t.datos)); }); await guardarPeticion(np); A.res = np; }
      else A.res = pe;
      A.cur = Math.max(0, A.res.tareas.findIndex(function (t) { return t.estado === 'pendiente'; })); A.tab = 'chat'; A.hist.det = null; pintar();
    }
    else if (a === 'addarch') { A.addPara = d.p; panel.querySelector('#as-arch').click(); }
    else if (a === 'copiarmejoras') copiar('Pendiente de enseñar al asistente de WAR (no los entendió el motor):\n' + pendientesEnseñar().map(function (x) { return '- ' + x; }).join('\n') + '\n\nFormato de regla: colección asistente_reglas {nombre, tipo, patron (regex sin acentos), datos, activa}.');
    else if (a === 'reportes') { cerrar(); if (window.WARREP) window.WARREP.lista(); }
    else if (a === 'salir') { cerrar(); var s = document.getElementById('salir'); if (s) s.click(); }
  }
  function contextoClaude(t) {
    return 'Texto original: «' + t.origen + '»\nEl motor lo interpretó como: ' + TIPOS[t.tipo] + ' (' + t.conf + ' %)\nDatos: ' + JSON.stringify(t.datos) + '\nMotivos: ' + t.motivos.join('; ') + '\nDime cómo debe interpretarse y añade la regla al asistente de WAR.';
  }
  function copiar(txt) {
    var ok = function () { toast('Copiado'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, function () { toast('No se pudo copiar'); }); else { var ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); ok(); } catch (e) { toast('No se pudo copiar'); } ta.remove(); }
  }
  var rec = null;
  function dictar() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return;
    if (rec) { try { rec.stop(); } catch (e) {} return; }
    guardarBorrador(); var r = new SR(); r.lang = 'es-ES'; r.interimResults = false; r.continuous = false; rec = r; A.dictando = true; pintar();
    function fin() { rec = null; A.dictando = false; if (A.abierto) pintar(); }
    r.onresult = function (e) { var t = ''; for (var i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript; A.borrador = ((A.borrador || '').replace(/\s+$/, '') + ' ' + t.trim()).trim(); try { localStorage.setItem(BORR, A.borrador); } catch (x) {} };
    r.onend = fin; r.onerror = fin; try { r.start(); } catch (e) { fin(); }
  }

  window.WARASIS = { abrir: abrir, cerrar: cerrar, _interpretar: interpretar, _analizar: analizar, _estado: function () { return A; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();
