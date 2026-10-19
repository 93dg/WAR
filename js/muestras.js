/* WAR · Banco de muestras de voz: extrae el audio de archivos de audio o vídeo, lo corta en frases limpias y lo guarda en el espacio privado. */
(function () {
  'use strict';
  var W = window.WAR, esc = W.esc;
  var SR = 24000, BUCKET = 'war-muestras';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var E = { audio: null, nombre: '', segs: [], sens: 0.15, hueco: 0.4, maxLen: 12, ocupado: false, urlPrev: null };

  function mmss(seg) { seg = Math.round(seg); return Math.floor(seg / 60) + ':' + ('0' + (seg % 60)).slice(-2); }
  function dec(n) { return (Math.round(n * 10) / 10).toString().replace('.', ','); }

  /* ---------- Lectura del archivo: audio o vídeo, a mono 24 kHz ---------- */
  function decodificar(archivo, avisar) {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return Promise.reject(new Error('Este navegador no puede leer audio.'));
    if (archivo.size > 400 * 1024 * 1024) return Promise.reject(new Error('El archivo es muy grande. Extrae antes el audio o divídelo en partes de menos de 400 MB.'));
    avisar('Leyendo el archivo…');
    return archivo.arrayBuffer().then(function (ab) {
      avisar('Extrayendo el audio…');
      var ctx = new AC();
      return new Promise(function (res, rej) { ctx.decodeAudioData(ab, res, rej); }).then(function (buf) {
        try { ctx.close(); } catch (e) {}
        if (buf.duration > 45 * 60) throw new Error('El archivo dura más de 45 minutos. Divídelo en partes.');
        avisar('Preparando la voz (mono, 24 kHz)…');
        var off = new OfflineAudioContext(1, Math.max(1, Math.ceil(buf.duration * SR)), SR), src = off.createBufferSource();
        src.buffer = buf; src.connect(off.destination); src.start();
        return off.startRendering();
      }).then(function (r) { return r.getChannelData(0); });
    }).catch(function (e) {
      if (e && e.message && /grande|45 minutos|navegador/.test(e.message)) throw e;
      throw new Error('No se pudo leer el audio de este archivo. Prueba con MP3, WAV, M4A o MP4.');
    });
  }

  /* ---------- Detección de frases: silencios y volumen ---------- */
  function detectar(x, sens, hueco, maxLen) {
    var F = 480, n = Math.floor(x.length / F), r = new Float32Array(n), i, j;
    for (i = 0; i < n; i++) { var s = 0, o = i * F; for (j = 0; j < F; j++) s += x[o + j] * x[o + j]; r[i] = Math.sqrt(s / F); }
    var ord = Array.prototype.slice.call(r).sort(function (a, b) { return a - b; });
    var suelo = ord[Math.floor(n * 0.1)] || 0, alto = ord[Math.floor(n * 0.95)] || 0, thr = suelo + (alto - suelo) * sens;
    var activo = new Uint8Array(n); for (i = 0; i < n; i++) activo[i] = r[i] > thr ? 1 : 0;
    var gap = Math.round(hueco / 0.02), ini = -1, fin = -1, segs = [];
    for (i = 0; i < n; i++) {
      if (activo[i]) { if (ini < 0) ini = i; fin = i; }
      else if (ini >= 0 && i - fin > gap) { segs.push([ini, fin]); ini = -1; }
    }
    if (ini >= 0) segs.push([ini, fin]);
    var maxF = Math.round(maxLen / 0.02), out = [];
    function partir(a, b) {
      if (b - a <= maxF) { out.push([a, b]); return; }
      var mid = Math.round((a + b) / 2), lo = Math.max(a + Math.round(maxF * 0.4), mid - Math.round(maxF * 0.3)), hi = Math.min(b - Math.round(maxF * 0.4), mid + Math.round(maxF * 0.3)), mejor = mid, k;
      for (k = lo; k <= hi; k++) if (r[k] < r[mejor]) mejor = k;
      partir(a, mejor); partir(mejor + 1, b);
    }
    segs.forEach(function (s2) { partir(s2[0], s2[1]); });
    var pad = 0.12;
    return out.map(function (s3) {
      var a = Math.max(0, s3[0] * 0.02 - pad), b = Math.min(x.length / SR, (s3[1] + 1) * 0.02 + pad);
      return { a: a, b: b, ok: true, texto: '' };
    }).filter(function (s4) { return s4.b - s4.a >= 1.2; });
  }

  /* ---------- Recorte, normalización y WAV ---------- */
  function ganancia(x) {
    var pico = 0, i; for (i = 0; i < x.length; i += 7) { var v = Math.abs(x[i]); if (v > pico) pico = v; }
    return pico > 0.001 ? Math.min(8, 0.7 / pico) : 1;   // pico en torno a -3 dB
  }
  function recorte(x, a, b, g) {
    var i0 = Math.floor(a * SR), i1 = Math.min(x.length, Math.floor(b * SR)), n = i1 - i0, out = new Int16Array(n), f = Math.round(SR * 0.012), i;
    for (i = 0; i < n; i++) {
      var k = x[i0 + i] * g; if (i < f) k *= i / f; else if (n - i < f) k *= (n - i) / f;
      out[i] = Math.max(-32768, Math.min(32767, Math.round(k * 32767)));
    }
    return out;
  }
  function wav(pcm) {
    var b = new ArrayBuffer(44 + pcm.length * 2), v = new DataView(b);
    function s(o, t) { for (var i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); }
    s(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); s(8, 'WAVE'); s(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, SR, true); v.setUint32(28, SR * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); s(36, 'data'); v.setUint32(40, pcm.length * 2, true);
    new Int16Array(b, 44).set(pcm);
    return new Blob([b], { type: 'audio/wav' });
  }
  function escuchar(blob) {
    if (E.urlPrev) URL.revokeObjectURL(E.urlPrev);
    E.urlPrev = URL.createObjectURL(blob);
    var a = new Audio(E.urlPrev); a.play().catch(function () {});
  }

  /* ---------- Onda ---------- */
  function pintarOnda() {
    var c = $('#m-onda'); if (!c || !E.audio) return;
    var w = c.clientWidth || 340, h = 84, d = window.devicePixelRatio || 1;
    c.width = w * d; c.height = h * d;
    var g = c.getContext('2d'); g.scale(d, d); g.clearRect(0, 0, w, h);
    var x = E.audio, paso = Math.max(1, Math.floor(x.length / w)), i, j, tot = x.length / SR;
    g.fillStyle = 'rgba(214,168,100,.18)';
    E.segs.forEach(function (s) { if (s.ok) g.fillRect(s.a / tot * w, 0, (s.b - s.a) / tot * w, h); });
    g.fillStyle = '#98a1bb';
    for (i = 0; i < w; i++) {
      var mx = 0; for (j = 0; j < paso; j += 4) { var v = Math.abs(x[i * paso + j] || 0); if (v > mx) mx = v; }
      var alto = Math.max(1, mx * h * 0.95); g.fillRect(i, (h - alto) / 2, 1, alto);
    }
  }

  /* ---------- Datos guardados ---------- */
  function guardadas() { return (W.datos().muestras || []).slice().sort(function (a, b) { return (a.creada || 0) - (b.creada || 0); }); }
  function minutosGuardados() { return guardadas().reduce(function (t, m) { return t + (m.dur || 0); }, 0) / 60; }

  /* ---------- Vista ---------- */
  function cabecera() {
    var mins = minutosGuardados(), n = guardadas().length;
    return '<h2>Muestras</h2><p class="mut">Sube audios o vídeos con la voz. La web extrae el audio, lo corta en frases limpias y lo guarda en tu espacio privado para preparar la voz de la serie.</p>' +
      '<div class="cifras"><div><b>' + dec(mins) + ' min</b><span class="mut peq">Voz guardada</span></div><div><b>' + n + '</b><span class="mut peq">Frases guardadas</span></div></div>' +
      '<div class="tarjeta"><label for="m-voz">Nombre de la voz</label><input id="m-voz" type="text" value="' + esc(localStorageGet('voz') || 'Voz de la serie') + '">' +
      '<label for="m-arch">Audio o vídeo</label><input id="m-arch" type="file" accept="audio/*,video/*" multiple>' +
      '<div class="mut peq" id="m-est" style="margin-top:.7rem">Admite MP3, WAV, M4A, MP4 y similares. Cuanto más limpia la voz, mejor.</div></div>' +
      '<div id="m-editor"></div><h3>Frases guardadas</h3><div id="m-lista"></div>';
  }
  function localStorageGet(k) { try { return localStorage.getItem('war-' + k); } catch (e) { return null; } }
  function localStorageSet(k, v) { try { localStorage.setItem('war-' + k, v); } catch (e) {} }

  function pintarLista() {
    var l = $('#m-lista'); if (!l) return;
    var g = guardadas();
    l.innerHTML = g.length ? g.map(function (m) {
      return '<div class="tarjeta" data-m="' + esc(m.id) + '"><div class="fila-sp"><div><b>' + esc(m.nombre || m.id) + '</b><div class="mut peq">' + esc(m.voz || '') + ' · ' + dec(m.dur || 0) + ' s</div></div>' +
        '<div class="fila" style="margin:0"><button type="button" class="btn" data-oir="' + esc(m.id) + '">Escuchar</button><button type="button" class="btn" data-borrar="' + esc(m.id) + '">Borrar</button></div></div>' +
        (m.texto ? '<p class="mut peq" style="margin-bottom:0">' + esc(m.texto) + '</p>' : '') + '</div>';
    }).join('') : '<p class="mut">Todavía no hay frases guardadas.</p>';
  }

  function pintarEditor() {
    var ed = $('#m-editor'); if (!ed) return;
    if (!E.audio) { ed.innerHTML = ''; return; }
    var tot = E.audio.length / SR, sel = E.segs.filter(function (s) { return s.ok; }), dsel = sel.reduce(function (t, s) { return t + s.b - s.a; }, 0);
    ed.innerHTML = '<div class="tarjeta"><b class="no-cap">' + esc(E.nombre) + '</b><div class="mut peq">Duración ' + mmss(tot) + ' · ' + E.segs.length + ' frases detectadas · ' + sel.length + ' elegidas (' + mmss(dsel) + ')</div>' +
      '<canvas id="m-onda" style="width:100%;height:84px;margin-top:.8rem;display:block"></canvas>' +
      '<label for="m-sens">Sensibilidad: más a la derecha corta más</label><input id="m-sens" type="range" min="5" max="45" value="' + Math.round(E.sens * 100) + '">' +
      '<label for="m-max">Duración máxima de cada frase</label><select id="m-max"><option value="8">8 segundos</option><option value="12">12 segundos</option><option value="20">20 segundos</option></select>' +
      '<div class="fila"><button type="button" class="btn principal" id="m-guardar">Guardar las elegidas</button><button type="button" class="btn" id="m-todas">Marcar o quitar todas</button></div></div>' +
      E.segs.map(function (s, i) {
        return '<div class="tarjeta' + (s.ok ? ' sel' : '') + '" data-s="' + i + '"><div class="fila-sp"><div><b>Frase ' + (i + 1) + '</b><div class="mut peq">' + mmss(s.a) + ' a ' + mmss(s.b) + ' · ' + dec(s.b - s.a) + ' s</div></div>' +
          '<div class="fila" style="margin:0"><button type="button" class="chip' + (s.ok ? ' on' : '') + '" data-elegir="' + i + '" aria-pressed="' + s.ok + '">Elegida</button><button type="button" class="btn" data-esc="' + i + '">Escuchar</button></div></div>' +
          '<input class="nota" type="text" placeholder="Qué dice (opcional)" value="' + esc(s.texto) + '" data-txt="' + i + '"></div>';
      }).join('');
    var mx = $('#m-max'); if (mx) mx.value = String(E.maxLen);
    pintarOnda();
  }

  function setEst(t) { var e = $('#m-est'); if (e) e.textContent = t; }

  function cargarArchivo(archivos, k) {
    if (k >= archivos.length) return;
    var a = archivos[k];
    if (k > 0) { setEst('Solo se edita un archivo cada vez. Sube el siguiente cuando termines con este.'); return; }
    E.ocupado = true; E.audio = null; pintarEditor();
    decodificar(a, setEst).then(function (x) {
      E.audio = x; E.nombre = a.name; E.sens = 0.15; E.hueco = 0.4; E.maxLen = 12;
      E.segs = detectar(x, E.sens, E.hueco, E.maxLen);
      setEst(E.segs.length ? 'Listo. Revisa las frases, quita las que no valgan y guarda.' : 'No se detectaron frases. Prueba a subir la sensibilidad.');
      E.ocupado = false; pintarEditor();
    }).catch(function (e) { E.ocupado = false; setEst(e.message); });
  }

  function redetectar() { E.segs = detectar(E.audio, E.sens, E.hueco, E.maxLen); pintarEditor(); }

  function guardarElegidas() {
    if (E.ocupado) return;
    var voz = ($('#m-voz').value || '').trim() || 'Voz de la serie', sel = E.segs.filter(function (s) { return s.ok; });
    if (!sel.length) { setEst('No hay frases elegidas.'); return; }
    localStorageSet('voz', voz); E.ocupado = true;
    var g = ganancia(E.audio), i = 0, base = Date.now();
    (function sig() {
      if (i >= sel.length) { E.ocupado = false; setEst('Guardadas ' + sel.length + ' frases.'); E.audio = null; E.segs = []; pintarEditor(); pintarLista(); refrescarCifras(); return; }
      var s = sel[i], id = 'm' + (base + i).toString(36), ruta = 'muestras/' + id + '.wav', pcm = recorte(E.audio, s.a, s.b, g);
      setEst('Subiendo ' + (i + 1) + ' de ' + sel.length + '…');
      W.sb.storage.from(BUCKET).upload(ruta, wav(pcm), { contentType: 'audio/wav', upsert: true }).then(function (r) {
        if (r.error) throw r.error;
        var datos = { nombre: E.nombre.replace(/\.[^.]+$/, '') + ' · frase ' + (E.segs.indexOf(s) + 1), voz: voz, ruta: ruta, dur: pcm.length / SR, texto: s.texto || '', origen: E.nombre, creada: base + i };
        return W.sb.from('war_docs').upsert({ coleccion: 'muestras', id: id, datos: datos, actualizado: new Date().toISOString() }).then(function (q) {
          if (q.error) throw q.error;
          var D = W.datos(); D.muestras = D.muestras || []; D.muestras.push(Object.assign({ id: id }, datos));
        });
      }).then(function () { i++; sig(); }).catch(function (e) { E.ocupado = false; setEst('No se pudo guardar: ' + (e.message || e)); });
    })();
  }

  function refrescarCifras() {
    var c = document.querySelector('.cifras'); if (!c) return;
    c.innerHTML = '<div><b>' + dec(minutosGuardados()) + ' min</b><span class="mut peq">Voz guardada</span></div><div><b>' + guardadas().length + '</b><span class="mut peq">Frases guardadas</span></div>';
  }

  function oirGuardada(id) {
    var m = guardadas().filter(function (x) { return x.id === id; })[0]; if (!m) return;
    W.sb.storage.from(BUCKET).createSignedUrl(m.ruta, 600).then(function (r) {
      if (r.error) { setEst('No se pudo abrir la muestra: ' + r.error.message); return; }
      var a = new Audio(r.data.signedUrl); a.play().catch(function () {});
    });
  }
  function borrar(id) {
    var m = guardadas().filter(function (x) { return x.id === id; })[0]; if (!m) return;
    W.sb.storage.from(BUCKET).remove([m.ruta]).then(function () { return W.sb.from('war_docs').delete().eq('coleccion', 'muestras').eq('id', id); }).then(function (r) {
      if (r && r.error) { setEst('No se pudo borrar: ' + r.error.message); return; }
      var D = W.datos(); D.muestras = (D.muestras || []).filter(function (x) { return x.id !== id; }); pintarLista(); refrescarCifras();
    });
  }

  function clic(ev) {
    var t = ev.target.closest('button'); if (!t) return;
    if (t.dataset.elegir != null) { var s = E.segs[+t.dataset.elegir]; s.ok = !s.ok; pintarEditor(); }
    else if (t.dataset.esc != null) { var q = E.segs[+t.dataset.esc]; escuchar(wav(recorte(E.audio, q.a, q.b, ganancia(E.audio)))); }
    else if (t.id === 'm-guardar') guardarElegidas();
    else if (t.id === 'm-todas') { var todas = E.segs.every(function (z) { return z.ok; }); E.segs.forEach(function (z) { z.ok = !todas; }); pintarEditor(); }
    else if (t.dataset.oir) oirGuardada(t.dataset.oir);
    else if (t.dataset.borrar) borrar(t.dataset.borrar);
  }
  function cambio(ev) {
    var t = ev.target;
    if (t.id === 'm-arch') { if (t.files && t.files.length) cargarArchivo(t.files, 0); }
    else if (t.id === 'm-sens') { E.sens = (+t.value) / 100; redetectar(); }
    else if (t.id === 'm-max') { E.maxLen = +t.value; redetectar(); }
    else if (t.dataset && t.dataset.txt != null) { E.segs[+t.dataset.txt].texto = t.value; }
  }

  window.WARMUESTRAS = {
    muestras: function (el) {
      E.audio = null; E.segs = [];
      el.innerHTML = cabecera(); pintarLista();
      el.onclick = clic; el.onchange = cambio;
    }
  };
})();
