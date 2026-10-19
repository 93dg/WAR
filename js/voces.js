/* WAR · Voces y narrador. Motor de voz Piper dentro del navegador (lib/voz-worker.js). */
(function () {
  'use strict';
  var W = window.WAR;
  // Las voces Piper se retiraron de la lista el 19/10/2026: el usuario las descartó por calidad.
  // El motor y el narrador se conservan para conectar la voz propia cuando esté lista.
  var CATALOGO = [];
  var MUESTRA = 'Buenas noches. Ponte cómodo. No tienes que hacer nada más que estar ahí, con la cabeza apoyada, y escuchar. Yo hablaré despacio. Si en algún momento te quedas dormido, no pasa nada. Las ideas que importan tienen paciencia.';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = W.esc;

  /* ---------- Motor (hilo aparte para no bloquear la pantalla) ---------- */
  var worker = null, pend = {}, nid = 1, vozCargada = null;
  function motor() {
    if (worker) return worker;
    worker = new Worker('lib/voz-worker.js');
    worker.onmessage = function (e) {
      var m = e.data, p = pend[m.id];
      if (!p) return;
      if (m.t === 'prog') { if (p.prog) p.prog(m); return; }
      delete pend[m.id];
      if (m.t === 'error') p.rej(new Error(m.msg)); else p.res(m);
    };
    worker.onerror = function (e) {
      var msg = (e && e.message) || 'Error del motor de voz';
      Object.keys(pend).forEach(function (k) { var p = pend[k]; delete pend[k]; p.rej(new Error(msg)); });
      worker = null; vozCargada = null;
    };
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
    return worker;
  }
  function llamar(msg, prog) {
    return new Promise(function (res, rej) {
      var id = nid++; pend[id] = { res: res, rej: rej, prog: prog };
      motor().postMessage(Object.assign({ id: id }, msg));
    });
  }
  function asegurarVoz(voz, prog) {
    if (vozCargada === voz) return Promise.resolve();
    return llamar({ t: 'cargar', voz: voz }, prog).then(function () { vozCargada = voz; });
  }

  /* ---------- Caché de fragmentos ya generados (solo se regenera lo que cambia) ---------- */
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(16); }
  function bd() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open('war-voz', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('wav'); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function cget(k) {
    return bd().then(function (d) {
      return new Promise(function (res) {
        var q = d.transaction('wav').objectStore('wav').get(k);
        q.onsuccess = function () { res(q.result || null); };
        q.onerror = function () { res(null); };
      });
    }).catch(function () { return null; });
  }
  function cput(k, v) {
    return bd().then(function (d) {
      return new Promise(function (res) {
        var t = d.transaction('wav', 'readwrite'); t.objectStore('wav').put(v, k);
        t.oncomplete = function () { res(); }; t.onerror = function () { res(); };
      });
    }).catch(function () {});
  }
  function sintetizar(voz, texto, prog) {
    var k = voz + '|' + hash(texto) + '|' + texto.length;
    return cget(k).then(function (c) {
      if (c) return c;
      return asegurarVoz(voz, prog).then(function () { return llamar({ t: 'hablar', texto: texto }); }).then(function (m) { cput(k, m.wav.slice(0)); return m.wav; });
    });
  }

  /* ---------- Audio ---------- */
  function leerWav(ab) {
    var v = new DataView(ab), sr = v.getUint32(24, true), o = 12;
    while (o + 8 <= ab.byteLength) {
      var id = String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3)), len = v.getUint32(o + 4, true);
      if (id === 'data') return { sr: sr, pcm: new Int16Array(ab.slice(o + 8, o + 8 + len)) };
      o += 8 + len + (len % 2);
    }
    throw new Error('Audio no válido');
  }
  function crearWav(pcm, sr) {
    var b = new ArrayBuffer(44 + pcm.length * 2), v = new DataView(b);
    function s(o, t) { for (var i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); }
    s(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); s(8, 'WAVE'); s(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true);
    v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); s(36, 'data'); v.setUint32(40, pcm.length * 2, true);
    new Int16Array(b, 44).set(pcm);
    return new Blob([b], { type: 'audio/wav' });
  }
  function unir(partes) {
    var sr = 22050, i;
    for (i = 0; i < partes.length; i++) if (partes[i].sr) { sr = partes[i].sr; break; }
    var total = 0;
    partes.forEach(function (p) { p.n = p.pcm ? p.pcm.length : Math.round(p.s * sr); total += p.n; });
    var out = new Int16Array(total), o = 0;
    partes.forEach(function (p) { if (p.pcm) out.set(p.pcm, o); o += p.n; });
    return { blob: crearWav(out, sr), seg: total / sr };
  }
  function mmss(seg) { seg = Math.round(seg); return Math.floor(seg / 60) + ':' + ('0' + (seg % 60)).slice(-2); }

  /* ---------- Plan de narración a partir del guion ---------- */
  function plan(script, cfg, prueba) {
    var pp = (cfg && cfg.pausaParrafo) || 4, items = [];
    var parrs = (script || '').split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
    if (prueba) parrs = parrs.slice(0, 10);
    parrs.forEach(function (p) {
      var re = /\[pausa(?:\s+(\d+))?\]/g, last = 0, m, t;
      while ((m = re.exec(p))) {
        t = p.slice(last, m.index).trim(); if (t) items.push({ t: 'voz', x: t });
        items.push({ t: 'sil', s: m[1] ? +m[1] : 3 }); last = re.lastIndex;
      }
      t = p.slice(last).trim(); if (t) items.push({ t: 'voz', x: t });
      items.push({ t: 'sil', s: pp });
    });
    return items;
  }

  /* ---------- Datos de voces ---------- */
  function vocesGuardadas() { return W.datos().voces || []; }
  function registro(id) { return vocesGuardadas().filter(function (v) { return v.id === id; })[0]; }
  function asegurarRegistros() {
    var faltan = CATALOGO.filter(function (c) { return !registro(c.id); });
    if (!faltan.length) return Promise.resolve();
    var filas = faltan.map(function (c) {
      return { coleccion: 'voces', id: c.id, datos: { nombre: c.nombre, voiceId: c.id, pais: c.pais, cal: c.cal, favorita: false, nota: '', creada: Date.now() } };
    });
    return W.sb.from('war_docs').upsert(filas).then(function (r) {
      if (!r.error) { var D = W.datos(); D.voces = D.voces || []; filas.forEach(function (f) { D.voces.push(Object.assign({ id: f.id }, f.datos)); }); }
    });
  }
  function guardarVoz(id, cambios) {
    var r = registro(id); if (!r) return Promise.resolve();
    Object.assign(r, cambios);
    var datos = Object.assign({}, r); delete datos.id;
    return W.sb.from('war_docs').upsert({ coleccion: 'voces', id: id, datos: datos, actualizado: new Date().toISOString() });
  }

  /* ---------- Vista Voces ---------- */
  var estado = {};   // por voz: texto de estado y progreso
  var comparando = false;
  function barra(id) {
    var e = estado[id] || {};
    return '<div class="barra" id="b-' + esc(id) + '"' + (e.pct == null ? ' hidden' : '') + '><i style="width:' + (e.pct || 0) + '%"></i></div>' +
      '<div class="mut peq" id="e-' + esc(id) + '">' + esc(e.txt || '') + '</div>';
  }
  function setEstado(id, txt, pct) {
    estado[id] = { txt: txt, pct: pct };
    var b = $('#b-' + CSS.escape(id)), t = $('#e-' + CSS.escape(id));
    if (t) t.textContent = txt || '';
    if (b) { b.hidden = pct == null; var i = b.firstChild; if (i) i.style.width = (pct || 0) + '%'; }
  }
  function progDescarga(id) {
    return function (p) {
      if (p.url && /\.onnx$/.test(p.url) && p.total) setEstado(id, 'Descargando la voz: ' + Math.round(p.loaded * 100 / p.total) + ' %. Solo ocurre la primera vez.', Math.round(p.loaded * 100 / p.total));
    };
  }
  function tarjetaVoz(c) {
    var r = registro(c.id) || {}, fav = !!r.favorita;
    return '<div class="tarjeta" data-voz="' + esc(c.id) + '">' +
      '<div class="fila-sp"><div><b>' + esc(r.nombre || c.nombre) + '</b><div class="mut peq">' + esc(c.pais) + ' · calidad ' + esc(c.cal.toLowerCase()) + '</div></div>' +
      '<button type="button" class="chip' + (fav ? ' on' : '') + '" data-fav="' + esc(c.id) + '" aria-pressed="' + fav + '">Favorita</button></div>' +
      '<input class="nota" type="text" placeholder="Nota sobre esta voz" value="' + esc(r.nota || '') + '" data-nota="' + esc(c.id) + '">' +
      '<div class="fila"><button type="button" class="btn principal" data-probar="' + esc(c.id) + '">Probar esta voz</button></div>' +
      barra(c.id) + '<div id="a-' + esc(c.id) + '"></div></div>';
  }
  function limpiarDescargas(est) {
    var tareas = [];
    try { if (navigator.storage && navigator.storage.getDirectory) tareas.push(navigator.storage.getDirectory().then(function (r) { return r.removeEntry('piper', { recursive: true }); }).catch(function () {})); } catch (e) {}
    try { tareas.push(new Promise(function (res) { var q = indexedDB.deleteDatabase('war-voz'); q.onsuccess = q.onerror = q.onblocked = function () { res(); }; })); } catch (e) {}
    return Promise.all(tareas).then(function () { if (worker) { worker.terminate(); worker = null; vozCargada = null; } if (est) est.textContent = 'Voces descargadas borradas de este navegador.'; });
  }
  function vistaVoces(el) {
    if (!CATALOGO.length) {
      el.innerHTML = '<h2>Voces</h2><p class="mut">Todavía no hay ninguna voz. Aquí aparecerá la voz de la serie cuando esté preparada a partir de tus muestras.</p>' +
        '<div class="tarjeta"><b>Limpiar el navegador</b><p class="mut peq">Borra las voces de prueba que se descargaron antes y los audios generados con ellas. Libera espacio.</p>' +
        '<div class="fila"><button type="button" class="btn" id="limpiar">Borrar voces descargadas</button></div><div class="mut peq" id="limp-est" style="margin-top:.7rem"></div></div>';
      return;
    }
    el.innerHTML = '<h2>Voces</h2><p class="mut">Voces de IA que funcionan dentro de tu navegador, sin pagar por uso. La primera vez se descarga la voz y queda guardada; después se usa sin conexión.</p>' +
      '<div class="tarjeta"><label for="muestra">Texto de prueba</label><textarea id="muestra" rows="4">' + esc(MUESTRA) + '</textarea>' +
      '<div class="fila"><button type="button" class="btn" id="comparar">Comparar las favoritas</button></div><div class="mut peq" id="comp-est"></div></div>' +
      CATALOGO.map(tarjetaVoz).join('');
    asegurarRegistros().then(function () { CATALOGO.forEach(function (c) { var t = $('[data-voz="' + c.id + '"] .nota'); if (t && !t.value) t.value = (registro(c.id) || {}).nota || ''; }); });
  }
  function reproductor(destino, blob, titulo) {
    var url = URL.createObjectURL(blob);
    destino.innerHTML = '<audio controls preload="metadata" src="' + url + '"></audio>' +
      '<div class="fila"><a class="btn" href="' + url + '" download="' + esc(titulo) + '.wav">Descargar audio</a></div>';
  }
  function probar(id, texto) {
    setEstado(id, 'Preparando la voz…', 5);
    return sintetizar(id, texto, progDescarga(id)).then(function (wav) {
      var a = leerWav(wav), u = unir([{ pcm: a.pcm, sr: a.sr }]);
      setEstado(id, 'Listo. Duración ' + mmss(u.seg) + '.', null);
      var d = $('#a-' + CSS.escape(id)); if (d) reproductor(d, u.blob, 'prueba-' + id);
    }).catch(function (e) { setEstado(id, 'No se pudo generar: ' + e.message, null); });
  }
  function clickVoces(ev) {
    var t = ev.target.closest('button'); if (!t) return;
    if (t.id === 'limpiar') { limpiarDescargas($('#limp-est')); return; }
    if (t.dataset.probar) { var m = $('#muestra'); probar(t.dataset.probar, (m && m.value.trim()) || MUESTRA); }
    else if (t.dataset.fav) {
      var id = t.dataset.fav, r = registro(id), nuevo = !(r && r.favorita);
      guardarVoz(id, { favorita: nuevo }); t.classList.toggle('on', nuevo); t.setAttribute('aria-pressed', nuevo);
    } else if (t.id === 'comparar') {
      if (comparando) return;
      var favs = CATALOGO.filter(function (c) { return (registro(c.id) || {}).favorita; });
      var est = $('#comp-est');
      if (!favs.length) { est.textContent = 'Marca primero alguna voz como favorita.'; return; }
      comparando = true; var texto = ($('#muestra').value.trim()) || MUESTRA, i = 0;
      (function sig() {
        if (i >= favs.length) { comparando = false; est.textContent = 'Comparación terminada.'; return; }
        est.textContent = 'Voz ' + (i + 1) + ' de ' + favs.length + '…';
        probar(favs[i].id, texto).then(function () { i++; sig(); });
      })();
    }
  }
  function cambioVoces(ev) {
    var t = ev.target; if (t.dataset && t.dataset.nota) guardarVoz(t.dataset.nota, { nota: t.value });
  }

  /* ---------- Vista Narrador ---------- */
  var gen = { activo: false, cancelar: false };
  function opcionesVoz() {
    var v = CATALOGO.slice().sort(function (a, b) { return ((registro(b.id) || {}).favorita ? 1 : 0) - ((registro(a.id) || {}).favorita ? 1 : 0); });
    return v.map(function (c) { var r = registro(c.id) || {}; return '<option value="' + esc(c.id) + '">' + esc((r.favorita ? 'Favorita · ' : '') + (r.nombre || c.nombre) + ' · ' + c.pais + ' · ' + c.cal.toLowerCase()) + '</option>'; }).join('');
  }
  function vistaNarrador(el) {
    var eps = (W.datos().episodios || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    if (!CATALOGO.length) { el.innerHTML = '<h2>Narrador</h2><p class="mut">El narrador se activará cuando haya una voz preparada. Primero reúne las muestras en la pestaña Muestras.</p>'; return; }
    if (!eps.length) { el.innerHTML = '<h2>Narrador</h2><p class="mut">Todavía no hay episodios con guion.</p>'; return; }
    el.innerHTML = '<h2>Narrador</h2><p class="mut">Convierte el guion en audio, párrafo a párrafo, respetando las pausas. Lo que ya se generó se guarda y no se repite.</p>' +
      '<div class="tarjeta"><label for="n-ep">Episodio</label><select id="n-ep">' + eps.map(function (e) { return '<option value="' + esc(e.id) + '">' + esc(e.titulo) + '</option>'; }).join('') + '</select>' +
      '<label for="n-voz">Voz</label><select id="n-voz">' + opcionesVoz() + '</select>' +
      '<label for="n-modo">Qué generar</label><select id="n-modo"><option value="prueba">Prueba de voz (10 párrafos)</option><option value="todo">Episodio completo</option></select>' +
      '<div class="fila"><button type="button" class="btn principal" id="n-gen">Generar narración</button><button type="button" class="btn" id="n-stop" hidden>Cancelar</button></div>' +
      '<div class="barra" id="n-bar" hidden><i></i></div><div class="mut peq" id="n-est"></div></div><div id="n-res"></div>';
  }
  function setN(txt, pct) {
    var e = $('#n-est'), b = $('#n-bar'); if (e) e.textContent = txt || '';
    if (b) { b.hidden = pct == null; b.firstChild.style.width = (pct || 0) + '%'; }
  }
  function generar() {
    if (gen.activo) return;
    var ep = (W.datos().episodios || []).filter(function (e) { return e.id === $('#n-ep').value; })[0];
    var voz = $('#n-voz').value, prueba = $('#n-modo').value === 'prueba';
    var items = plan(ep && ep.script, (W.datos().config || [])[0], prueba), voces = items.filter(function (i) { return i.t === 'voz'; }).length;
    if (!voces) { setN('El episodio no tiene guion.', null); return; }
    gen.activo = true; gen.cancelar = false; $('#n-gen').hidden = true; $('#n-stop').hidden = false; $('#n-res').innerHTML = '';
    var partes = [], hechos = 0, t0 = Date.now(), i = 0;
    function fin(msg) { gen.activo = false; $('#n-gen').hidden = false; $('#n-stop').hidden = true; setN(msg, null); }
    (function sig() {
      if (gen.cancelar) return fin('Cancelado. Lo ya generado queda guardado.');
      if (i >= items.length) {
        var u = unir(partes), seg = Math.round((Date.now() - t0) / 1000);
        fin('Terminado en ' + mmss(seg) + '. Duración del audio: ' + mmss(u.seg) + '.');
        var d = $('#n-res'); if (d) { d.innerHTML = '<div class="tarjeta" id="n-play"></div>'; reproductor($('#n-play'), u.blob, (prueba ? 'prueba-' : 'episodio-') + (ep.id || 'ep') + '-' + voz); }
        return;
      }
      var it = items[i++];
      if (it.t === 'sil') { partes.push({ s: it.s }); return sig(); }
      setN('Párrafo ' + (hechos + 1) + ' de ' + voces + '…', Math.round(hechos * 100 / voces));
      sintetizar(voz, it.x, function (p) { if (p.url && /\.onnx$/.test(p.url) && p.total) setN('Descargando la voz: ' + Math.round(p.loaded * 100 / p.total) + ' %. Solo ocurre la primera vez.', Math.round(p.loaded * 100 / p.total)); })
        .then(function (wav) { var a = leerWav(wav); partes.push({ pcm: a.pcm, sr: a.sr }); hechos++; setTimeout(sig, 0); })
        .catch(function (e) { fin('No se pudo generar: ' + e.message); });
    })();
  }
  function clickNarrador(ev) {
    var t = ev.target.closest('button'); if (!t) return;
    if (t.id === 'n-gen') generar(); else if (t.id === 'n-stop') gen.cancelar = true;
  }

  window.WARVOCES = {
    voces: function (el) { vistaVoces(el); el.onclick = clickVoces; el.onchange = cambioVoces; },
    narrador: function (el) { vistaNarrador(el); el.onclick = clickNarrador; el.onchange = null; }
  };
})();
