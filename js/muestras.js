/* WAR · Muestras de voz: sube un audio o vídeo, la web mide el ruido de fondo, lo limpia si hace falta, extrae solo la voz y la guarda en el espacio privado. */
(function () {
  'use strict';
  var W = window.WAR, esc = W.esc;
  var SR = 24000, BUCKET = 'war-muestras';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var E = { audio: null, nombre: '', info: null, ocupado: false, urlPrev: null };

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
  var PLAY = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>';
  var PAUSA = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M6 4.5h4v15H6zM14 4.5h4v15h-4z"/></svg>';
  function icono(attrs) { return '<button type="button" class="acc" aria-label="Escuchar" ' + attrs + '>' + PLAY + '</button>'; }
  /* Reproductor único: el mismo botón escucha y pausa. */
  function reproducir(url, btn, pie) {
    var parar = E.aud && E.btn === btn;
    if (E.aud) { E.aud.pause(); if (E.btn) { E.btn.innerHTML = PLAY; E.btn.setAttribute('aria-label', 'Escuchar'); } E.aud = null; E.btn = null; }
    if (parar) return;
    var a = new Audio(url); E.aud = a; E.btn = btn; btn.innerHTML = PAUSA; btn.setAttribute('aria-label', 'Pausar');
    var fin = function () { if (E.aud === a) { btn.innerHTML = PLAY; btn.setAttribute('aria-label', 'Escuchar'); E.aud = null; E.btn = null; } };
    a.onended = fin; a.onerror = fin; a.play().catch(fin);
  }
  function escuchar(blob, btn) {
    if (E.urlPrev) URL.revokeObjectURL(E.urlPrev);
    E.urlPrev = URL.createObjectURL(blob); reproducir(E.urlPrev, btn);
  }

  /* ---------- Ruido de fondo: medir y, si hace falta, limpiar ---------- */
  function medir(x) {
    var F = 480, n = Math.floor(x.length / F), r = new Float32Array(n), i, j;
    for (i = 0; i < n; i++) { var q = 0, o = i * F; for (j = 0; j < F; j++) q += x[o + j] * x[o + j]; r[i] = Math.sqrt(q / F); }
    var ord = Array.prototype.slice.call(r).sort(function (a, b) { return a - b; });
    var ruido = Math.max(ord[Math.floor(n * 0.1)] || 0, 1e-5), voz = ord[Math.floor(n * 0.9)] || 0;
    var snr = 20 * Math.log10(Math.max(voz, 1e-5) / ruido);
    return { snr: snr, nivel: snr >= 28 ? 'bajo' : snr >= 18 ? 'medio' : 'alto' };
  }
  function fft(re, im, inv) {
    var n = re.length, i, j = 0, k, t;
    for (i = 1; i < n; i++) { var bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (var len = 2; len <= n; len <<= 1) {
      var ang = 2 * Math.PI / len * (inv ? 1 : -1), wr = Math.cos(ang), wi = Math.sin(ang);
      for (i = 0; i < n; i += len) {
        var cr = 1, ci = 0;
        for (k = 0; k < len / 2; k++) {
          var ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
          re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
          var nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
    if (inv) for (i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }
  /* Sustracción espectral: aprende el ruido de los tramos más silenciosos y lo resta en cada ventana. */
  function limpiarRuido(x, avisar) {
    var N = 1024, H = 256, nf = Math.max(0, Math.floor((x.length - N) / H) + 1), win = new Float64Array(N), i, f, k;
    if (nf < 8) return Promise.resolve(x);
    for (i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
    var en = new Float32Array(nf);
    for (f = 0; f < nf; f++) { var e = 0, o = f * H; for (i = 0; i < N; i += 4) e += x[o + i] * x[o + i]; en[f] = e; }
    var idx = Array.prototype.slice.call(en.keys()).sort(function (a, b) { return en[a] - en[b]; }).slice(0, Math.max(8, Math.floor(nf * 0.1)));
    var ruido = new Float64Array(N / 2 + 1), re = new Float64Array(N), im = new Float64Array(N);
    idx.slice(0, 400).forEach(function (fr) {
      for (i = 0; i < N; i++) { re[i] = x[fr * H + i] * win[i]; im[i] = 0; }
      fft(re, im, false); for (k = 0; k <= N / 2; k++) ruido[k] += Math.sqrt(re[k] * re[k] + im[k] * im[k]) / Math.min(400, idx.length);
    });
    var y = new Float32Array(x.length), ant = new Float64Array(N / 2 + 1).fill(1), f0 = 0;
    return new Promise(function (ok) {
      (function trozo() {
        var fin = Math.min(nf, f0 + 600);
        for (f = f0; f < fin; f++) {
          var o2 = f * H;
          for (i = 0; i < N; i++) { re[i] = x[o2 + i] * win[i]; im[i] = 0; }
          fft(re, im, false);
          for (k = 0; k <= N / 2; k++) {
            var m = Math.sqrt(re[k] * re[k] + im[k] * im[k]) + 1e-12, g = Math.max(0.3, 1 - 1.1 * ruido[k] / m);
            g = 0.55 * g + 0.45 * ant[k]; ant[k] = g; re[k] *= g; im[k] *= g;
            if (k > 0 && k < N / 2) { re[N - k] = re[k]; im[N - k] = -im[k]; }
          }
          fft(re, im, true);
          for (i = 0; i < N; i++) y[o2 + i] += re[i] * win[i] / 1.5;
        }
        f0 = fin; avisar('Limpiando el ruido de fondo… ' + Math.round(f0 * 100 / nf) + ' %');
        if (f0 < nf) setTimeout(trozo, 0); else ok(y);
      })();
    });
  }

  /* La voz se deja entera, sin cortes: solo se quita el silencio del principio y del final. */
  function extraerVoz(x) {
    var F = 480, n = Math.floor(x.length / F), r = [], i, j, mx = 0;
    for (i = 0; i < n; i++) { var q = 0; for (j = 0; j < F; j++) q += x[i * F + j] * x[i * F + j]; r.push(Math.sqrt(q / F)); if (r[i] > mx) mx = r[i]; }
    var u = mx * 0.06, a = 0, b = n - 1;
    while (a < n && r[a] < u) a++;
    while (b > a && r[b] < u) b--;
    if (b <= a) return null;
    var i0 = Math.max(0, (a - 12) * F), i1 = Math.min(x.length, (b + 13) * F);
    return x.slice(i0, i1);
  }

  /* ---------- Onda ---------- */
  function pintarOnda() {
    var c = $('#m-onda'); if (!c || !E.audio) return;
    var w = c.clientWidth || 340, h = 64, d = window.devicePixelRatio || 1;
    c.width = w * d; c.height = h * d;
    var g = c.getContext('2d'); g.scale(d, d); g.clearRect(0, 0, w, h);
    var x = E.audio, paso = Math.max(1, Math.floor(x.length / w)), i, j;
    g.fillStyle = '#98a1bb';
    for (i = 0; i < w; i++) {
      var mx = 0; for (j = 0; j < paso; j += 4) { var v = Math.abs(x[i * paso + j] || 0); if (v > mx) mx = v; }
      var alto = Math.max(1, mx * h * 0.95); g.fillRect(i, (h - alto) / 2, 1, alto);
    }
  }

  /* ---------- Datos guardados ---------- */
  function guardadas() { return (W.datos().muestras || []).slice().sort(function (a, b) { return (a.creada || 0) - (b.creada || 0); }); }
  function minutosGuardados() { return guardadas().reduce(function (t, m) { return t + (m.dur || 0); }, 0) / 60; }
  function localStorageGet(k) { try { return localStorage.getItem('war-' + k); } catch (e) { return null; } }
  function localStorageSet(k, v) { try { localStorage.setItem('war-' + k, v); } catch (e) {} }

  /* ---------- Vista ---------- */
  function cabecera() {
    return '<div class="fil-c"><label for="m-voz">Voz</label><input id="m-voz" type="text" value="' + esc(localStorageGet('voz') || 'Voz de la serie') + '"></div>' +
      '<div class="barra-f" style="margin-top:8px"><label class="btn" for="m-arch">Elegir archivo</label><input id="m-arch" class="oculto" type="file" multiple><span class="mut peq" id="m-est">MP3, WAV, M4A o MP4</span></div>' +
      '<div id="m-editor"></div><div id="m-lista"></div><div id="m-prueba"></div>';
  }
  function pintarLista() {
    var l = $('#m-lista'); if (!l) return;
    var g = guardadas(), U = window.WARUI;
    var filas = g.map(function (m) {
      return '<div class="fil-r" data-m="' + esc(m.id) + '"><span class="t">' + esc(m.nombre || m.id) + '</span><span class="d">' + mmss(m.dur || 0) + '</span>' +
        icono('data-oir="' + esc(m.id) + '"') + U.accion('Quitar', 'data-borrar="' + esc(m.id) + '"') + '</div>';
    }).join('');
    l.innerHTML = U.grupo('muestras', 'guardadas', 'Voces guardadas', dec(minutosGuardados()) + ' min', filas || '<div class="fil-r"><span class="t mut">Ninguna</span></div>', true);
  }
  function pintarEditor() {
    var ed = $('#m-editor'); if (!ed) return;
    if (!E.audio) { ed.innerHTML = ''; return; }
    var i = E.info, U = window.WARUI, dato = function (a, b) { return '<div class="fil-r" style="border:0;padding:4px 0;min-height:0"><span class="t mut">' + a + '</span><span class="d" style="color:var(--tx)">' + b + '</span></div>'; };
    ed.innerHTML = '<div class="tarjeta" style="padding:12px"><div class="fila-sp"><b class="no-cap t1">' + esc(E.nombre) + '</b></div>' +
      dato('Ruido de fondo', i.nivel.charAt(0).toUpperCase() + i.nivel.slice(1) + (i.limpiado ? ', limpiado' : ', sin cambios')) + dato('Duración', mmss(E.audio.length / SR)) +
      '<canvas id="m-onda" style="width:100%;height:64px;margin:.4rem 0;display:block"></canvas>' +
      '<div class="fil-r" style="border:0;padding:0;min-height:0;gap:18px">' + icono('id="m-oir"') + U.accion('Guardar voz', 'id="m-guardar"') + U.accion('Descartar', 'id="m-descartar"') + '</div></div>';
    pintarOnda();
  }
  function setEst(t) { var e = $('#m-est'); if (e) e.textContent = t; }

  function cargarArchivo(archivos) {
    var a = archivos[0]; if (!a || E.ocupado) return;
    if (archivos.length > 1) setEst('Se procesa un archivo cada vez');
    E.ocupado = true; E.audio = null; pintarEditor();
    var total = 0;
    decodificar(a, setEst).then(function (x) {
      total = x.length / SR; var m = medir(x), hacer = m.nivel !== 'bajo';
      setEst('Ruido de fondo ' + m.nivel + (hacer ? ': limpiando…' : ': no hace falta limpiar'));
      return (hacer ? limpiarRuido(x, setEst) : Promise.resolve(x)).then(function (y) {
        setEst('Preparando la voz…');
        return new Promise(function (r) { setTimeout(function () { r(extraerVoz(y)); }, 20); }).then(function (v) {
          if (!v) throw new Error('No se ha encontrado voz en este archivo');
          var g = ganancia(v), o = new Float32Array(v.length), i; for (i = 0; i < v.length; i++) o[i] = v[i] * g;
          E.audio = o; E.nombre = a.name; E.info = { nivel: m.nivel, snr: m.snr, limpiado: hacer, total: total };
          setEst('Listo'); E.ocupado = false; pintarEditor();
        });
      });
    }).catch(function (e) { E.ocupado = false; setEst(e.message); });
  }

  function guardarVoz() {
    if (E.ocupado || !E.audio) return;
    var voz = ($('#m-voz').value || '').trim() || 'Voz de la serie', parte = 15 * 60 * SR, partes = Math.ceil(E.audio.length / parte), base = Date.now(), k = 0;
    localStorageSet('voz', voz); E.ocupado = true;
    (function sig() {
      if (k >= partes) { E.ocupado = false; setEst('Voz guardada'); E.audio = null; pintarEditor(); pintarLista(); return; }
      var a = k * parte, b = Math.min(E.audio.length, a + parte), id = 'm' + (base + k).toString(36), ruta = 'muestras/' + id + '.wav';
      var pcm = recorte(E.audio, a / SR, b / SR, 1);
      setEst('Guardando' + (partes > 1 ? ' ' + (k + 1) + ' de ' + partes : '') + '…');
      W.sb.storage.from(BUCKET).upload(ruta, wav(pcm), { contentType: 'audio/wav', upsert: true }).then(function (r) {
        if (r.error) throw r.error;
        var datos = { nombre: E.nombre.replace(/\.[^.]+$/, '') + (partes > 1 ? ' · parte ' + (k + 1) : ''), voz: voz, ruta: ruta, dur: pcm.length / SR, origen: E.nombre, limpiada: E.info.limpiado, ruido: E.info.nivel, creada: base + k };
        return W.sb.from('war_docs').upsert({ coleccion: 'muestras', id: id, datos: datos, actualizado: new Date().toISOString() }).then(function (q) {
          if (q.error) throw q.error;
          var D = W.datos(); D.muestras = D.muestras || []; D.muestras.push(Object.assign({ id: id }, datos));
        });
      }).then(function () { k++; sig(); }).catch(function (e) { E.ocupado = false; setEst('No se pudo guardar: ' + (e.message || e)); });
    })();
  }

  function oirGuardada(id, btn) {
    var m = guardadas().filter(function (x) { return x.id === id; })[0]; if (!m) return;
    W.sb.storage.from(BUCKET).createSignedUrl(m.ruta, 600).then(function (r) {
      if (r.error) { setEst('No se pudo abrir: ' + r.error.message); return; }
      reproducir(r.data.signedUrl, btn);
    });
  }
  function borrar(id) {
    var m = guardadas().filter(function (x) { return x.id === id; })[0]; if (!m) return;
    W.sb.storage.from(BUCKET).remove([m.ruta]).then(function () { return W.sb.from('war_docs').delete().eq('coleccion', 'muestras').eq('id', id); }).then(function (r) {
      if (r && r.error) { setEst('No se pudo quitar: ' + r.error.message); return; }
      var D = W.datos(); D.muestras = (D.muestras || []).filter(function (x) { return x.id !== id; }); pintarLista();
    });
  }

  function clic(ev) {
    var t = ev.target.closest('button'); if (!t) return;
    if (t.dataset.fil) { W._filAbierto = W._filAbierto === t.dataset.fil ? null : t.dataset.fil; pintarPrueba(); return; }
    if (t.dataset.filv) {
      var k = t.dataset.filv.split('.')[1]; window.WARUI.set('muestras', k, t.dataset.v2); W._filAbierto = null;
      if (k === 'ep') window.WARUI.set('muestras', 'min', '1');
      elegirTexto(); pintarPrueba(); return;
    }
    if (t.id === 'm-oir') escuchar(wav(recorte(E.audio, 0, E.audio.length / SR, 1)), t);
    else if (t.id === 'm-guardar') guardarVoz();
    else if (t.id === 'm-pt') probarTexto(t);
    else if (t.id === 'm-descartar') { if (E.aud) { E.aud.pause(); E.aud = null; E.btn = null; } E.audio = null; setEst('MP3, WAV, M4A o MP4'); pintarEditor(); }
    else if (t.dataset.oir) oirGuardada(t.dataset.oir, t);
    else if (t.dataset.borrar) borrar(t.dataset.borrar);
  }
  function cambio(ev) {
    var t = ev.target;
    if (t.id === 'm-txt') localStorageSet('texto', t.value);
    if (t.id === 'm-arch') { if (t.files && t.files.length) cargarArchivo(t.files); t.value = ''; }
  }

  /* ---------- Probar un texto con la voz (Pocket TTS en español, en el navegador, con el procesador) ---------- */
  var P = { w: null, espera: {}, ref: null, chunks: [], ocupado: false };
  function pEst(t) { var e = $('#m-pst'); if (e) e.textContent = t; }
  function pEsperar(tipo) { return new Promise(function (ok, ko) { P.espera[tipo] = { ok: ok, ko: ko }; }); }
  function pFallo(msg) { Object.keys(P.espera).forEach(function (k) { P.espera[k].ko(new Error(msg)); }); P.espera = {}; }
  function pTrabajador() {
    if (P.w) return P.w;
    var w = new Worker('pocket/inference-worker.js?v=1.14'); P.w = w;
    w.onerror = function (e) { pFallo('No se pudo iniciar el motor de voz'); P.w = null; };
    w.onmessage = function (ev) {
      var m = ev.data || {}, r;
      if (m.type === 'status' && m.state === 'loading') pEst('Preparando el motor (solo la primera vez)…');
      else if (m.type === 'status' && m.state === 'running') pEst('Generando…');
      else if (m.type === 'error') pFallo(String(m.error || 'Error del motor de voz'));
      else if (m.type === 'audio_chunk') P.chunks.push(m.data);
      else if ((r = P.espera[m.type])) { delete P.espera[m.type]; r.ok(m); }
    };
    return w;
  }
  function pReferencia() {
    if (E.audio) return Promise.resolve({ clave: 'act:' + E.nombre + ':' + E.audio.length, pcm: E.audio });
    var g = guardadas(), m = g[g.length - 1];
    if (!m) return Promise.reject(new Error('Sube y guarda una voz primero'));
    if (P.ref === 'gua:' + m.id) return Promise.resolve({ clave: P.ref });
    return W.sb.storage.from(BUCKET).download(m.ruta).then(function (r) {
      if (r.error) throw r.error; return decodificar(r.data, function () {});
    }).then(function (pcm) { return { clave: 'gua:' + m.id, pcm: pcm }; });
  }
  function probarTexto(btn) {
    if (E.aud && E.btn === btn) { reproducir('', btn); return; }
    if (P.ocupado) return;
    var texto = ($('#m-txt').value || '').trim();
    if (!texto) { pEst('Escribe un texto'); return; }
    localStorageSet('texto', texto); P.ocupado = true; P.chunks = [];
    var w = pTrabajador(), listo = P.listo ? Promise.resolve() : (w.postMessage({ type: 'load' }), pEsperar('loaded').then(function () { P.listo = true; }));
    pEst('Preparando…');
    listo.then(pReferencia).then(function (ref) {
      if (ref.clave === P.ref) return;
      var clip = ref.pcm.slice(0, SR * 10), v = pEsperar('voice_encoded');
      w.postMessage({ type: 'encode_voice', data: { audio: clip } }, [clip.buffer]);
      return v.then(function () { P.ref = ref.clave; });
    }).then(function () {
      var fin = pEsperar('stream_ended'); w.postMessage({ type: 'generate', data: { text: texto, voice: 'custom' } });
      return fin;
    }).then(function () {
      var n = P.chunks.reduce(function (t, c) { return t + c.length; }, 0), todo = new Float32Array(n), p = 0;
      if (!n) throw new Error('No se generó audio');
      P.chunks.forEach(function (c) { todo.set(c, p); p += c.length; });
      P.ocupado = false; pEst(mmss(n / SR));
      if (E.urlPrev) URL.revokeObjectURL(E.urlPrev);
      E.urlPrev = URL.createObjectURL(wav(recorte(todo, 0, n / SR, 1))); reproducir(E.urlPrev, btn);
    }).catch(function (e) { P.ocupado = false; pEst('Error: ' + (e.message || e)); });
  }
  /* Guion de un episodio sin marcas de pausa, en trozos de un minuto (unos 900 caracteres), cortados por párrafo. */
  function episodiosConGuion() {
    return (W.datos().episodios || []).filter(function (e) { return (e.script || '').trim(); }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  }
  function minutosDe(ep) {
    var pars = (ep.script || '').replace(/\[pausa[^\]]*\]/gi, '').split(/\n\s*\n/).map(function (x) { return x.replace(/\s+/g, ' ').trim(); }).filter(Boolean), out = [], cur = '';
    pars.forEach(function (p) { if (cur && (cur + ' ' + p).length > 1000) { out.push(cur); cur = p; } else cur = cur ? cur + ' ' + p : p; });
    if (cur) out.push(cur);
    return out;
  }
  function textoElegido() {
    var U = window.WARUI, eps = episodiosConGuion(); if (!eps.length) return null;
    var id = U.get('muestras', 'ep', eps[0].id), ep = eps.filter(function (e) { return e.id === id; })[0] || eps[0], m = minutosDe(ep), n = Math.min(m.length, parseInt(U.get('muestras', 'min', '1'), 10) || 1);
    return m[n - 1] || '';
  }
  function pintarPrueba() {
    var c = $('#m-prueba'); if (!c) return;
    var U = window.WARUI, eps = episodiosConGuion(), filtros = '';
    if (eps.length) {
      var id = U.get('muestras', 'ep', eps[0].id), ep = eps.filter(function (e) { return e.id === id; })[0] || eps[0], mins = minutosDe(ep).map(function (x, i) { return [String(i + 1), String(i + 1)]; });
      filtros = '<div class="barra-f" style="padding:8px 12px 0;justify-content:flex-start;gap:8px">' + U.filtro('muestras', 'ep', 'Episodio', eps.map(function (e, i) { return [e.id, String(e.order || i + 1)]; }), eps[0].id) +
        U.filtro('muestras', 'min', 'Minuto', mins, '1') + '</div>';
    }
    var cuerpo = filtros + '<div class="fil-c" style="padding:8px 12px"><textarea id="m-txt" rows="3" style="width:100%;font-size:16px">' + esc(localStorageGet('texto') || textoElegido() || '') + '</textarea></div>' +
      '<div class="fil-r">' + icono('id="m-pt"') + '<span class="d mut" id="m-pst"></span></div>';
    c.innerHTML = U.grupo('muestras', 'prueba', 'Probar texto', 'Español', cuerpo, true);
  }
  function elegirTexto() { var t = textoElegido(); if (t !== null) localStorageSet('texto', t); }

  window.WARMUESTRAS = {
    muestras: function (el) {
      E.audio = null;
      el.innerHTML = cabecera(); pintarLista(); pintarPrueba();
      el.onclick = clic; el.onchange = cambio;
    },
    _medir: medir, _limpiar: limpiarRuido, _extraer: extraerVoz
  };
})();
