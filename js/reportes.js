/* WAR · Botón de reportes: captura de la pantalla, marcas, etiquetas, fotos, dictado y envío sin pérdidas. */
(function () {
  'use strict';
  var W = window.WAR, esc = W.esc, PROYECTO = 'war', BUCKET = 'reportes', COLA = 'war-rep-cola';
  var ETIQ = ['Diseño', 'Colores', 'Tamaño', 'Texto', 'Posición', 'Fallo'];
  var PROTOCOLO = [
    'Protocolo para la IA que trata este reporte.',
    '1. Al empezar cada conversación, consultar los reportes pendientes con reportes_pendientes(\'war\') y avisar de cuántos hay.',
    '2. Para cada reporte: leer el texto entero y abrir la captura para ver lo marcado.',
    '3. Si no se llega al 80 % de seguridad sobre lo que se pide, hacer una sola pregunta con la propuesta escrita.',
    '4. Arreglarlo buscando la causa raíz.',
    '5. Revisar si el mismo problema está en otras pantallas y arreglarlo también.',
    '6. Comprobarlo con la pantalla real (390 px en móvil) y datos reales.',
    '7. Publicar y marcar el reporte como resuelto en ese momento, con la resolución y la versión. No esperar confirmación: si no gusta, se reporta otra vez.',
    '8. Lo que enseña el reporte se guarda: un gusto o una decisión de diseño pasa a regla, con comprobación automática si se puede.',
    '9. Antes de tocar una pantalla, leer todos los reportes anteriores de esa sección.'
  ].join('\n');
  var AYUDA = [['Lápiz', 'Dibuja a mano alzada en rojo.'], ['Recuadro', 'Arrastra para encuadrar una zona.'], ['Goma', 'Pasa el dedo por encima de lo pintado para borrarlo.'], ['Deshacer', 'Quita lo último que hiciste.'], ['Zoom', 'Pellizca con dos dedos, o usa la rueda, para ampliar.'], ['Enviar', 'Manda la captura, las marcas, las etiquetas y el texto. No hace falta escribir nada.']];

  var IC = {
    bug: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 7.5V6a3 3 0 0 1 6 0v1.5"/><path d="M7 11a5 5 0 0 1 10 0v4a5 5 0 0 1-10 0z"/><path d="M12 10v10M4 12h3M17 12h3M4.5 7.5l3 2M19.5 7.5l-3 2M4.5 19l3-2.5M19.5 19l-3-2.5"/></svg>',
    lapiz: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z"/><path d="M14.5 6.5l3 3"/></svg>',
    rect: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="6" width="16" height="12" rx="2"/></svg>',
    goma: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 20h11"/><path d="M5 15l8.5-8.5a2.1 2.1 0 0 1 3 0l2 2a2.1 2.1 0 0 1 0 3L11 20H8l-3-3a2.1 2.1 0 0 1 0-2z"/></svg>',
    deshacer: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
    cerrar: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    ayuda: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.8"/><path d="M12 16.6v.1"/></svg>',
    mas: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    mic: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
    enviar: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>'
  };

  function css() {
    var s = document.createElement('style');
    s.textContent =
      '#rep-btn{position:fixed;right:14px;bottom:calc(74px + env(safe-area-inset-bottom));z-index:40;width:48px;height:48px;padding:0;border-radius:50%;border:1px solid rgba(0,0,0,.14);background:#fff;color:#1a2140;box-shadow:0 4px 14px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;cursor:pointer}' +
      '#rep-btn.parp{animation:repParp .7s ease-in-out infinite}@keyframes repParp{50%{opacity:.45}}' +
      'body.rep-capt .rep-toast{display:none !important}' +
      '.rep-toast{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(132px + env(safe-area-inset-bottom));z-index:130;max-width:min(92vw,28rem);padding:10px 16px;border:1px solid var(--acc);border-radius:14px;background:var(--card2);color:var(--tx);font-size:.9rem;text-align:center}' +
      '#rep-ov{position:fixed;left:0;right:0;top:0;height:100%;z-index:100;display:flex;flex-direction:column;background:var(--bg);color:var(--tx);touch-action:manipulation}' +
      '#rep-ov[hidden]{display:none !important}' +
      '.rm-top{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:calc(8px + env(safe-area-inset-top)) 10px 8px;border-bottom:1px solid var(--line)}' +
      '.rm-ib{width:44px;height:44px;padding:0;border-color:transparent;display:flex;align-items:center;justify-content:center;border-radius:12px;color:var(--tx);flex:0 0 auto}' +
      '.rm-ib.on{border-color:var(--acc);color:var(--acc);box-shadow:0 0 0 1px var(--acc)}' +
      '.rm-dest{flex:1 1 auto;min-width:0;font-size:.8rem;color:var(--acc);text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.rm-stage{position:relative;flex:1 1 auto;min-height:110px;overflow:hidden;touch-action:none;background:#05080f;display:flex;align-items:center;justify-content:center}' +
      '.rm-zoom{transform-origin:0 0;position:absolute;left:0;top:0}' +
      '.rm-zoom canvas{display:block;touch-action:none}' +
      '.rm-tools{display:flex;justify-content:center;gap:10px;padding:6px 10px}' +
      '.rm-th{display:flex;gap:8px;padding:0 10px 6px;overflow-x:auto}' +
      '.rm-th .t{position:relative;flex:0 0 auto;width:48px;height:48px;padding:0;border-color:transparent;border-radius:10px;overflow:hidden}' +
      '.rm-th .t.on{border-color:var(--acc);box-shadow:0 0 0 1px var(--acc)}' +
      '.rm-th img{width:100%;height:100%;object-fit:cover;display:block}' +
      '.rm-th .q{position:absolute;right:0;top:0;width:20px;height:20px;padding:0;border:0;border-radius:0;background:transparent;color:var(--tx);filter:drop-shadow(0 0 2px #000);display:flex;align-items:center;justify-content:center}' +
      '.rm-tags{display:flex;flex-wrap:wrap;gap:6px;padding:0 10px 6px}' +
      '.rm-tags .chip{padding:5px 12px;font-size:.8rem}' +
      '.rm-comp{display:flex;align-items:flex-end;gap:6px;padding:4px 10px calc(8px + env(safe-area-inset-bottom));border-top:1px solid var(--line)}' +
      '.rm-comp textarea{flex:1 1 auto;min-width:0;margin:0;resize:none;overflow-y:auto;max-height:120px;min-height:44px;padding:10px 12px;font-size:16px;line-height:1.35}' +
      '.rm-otra{padding:0 10px 4px;text-align:center}' +
      '.rm-otra button{padding:6px 12px;font-size:.82rem;color:var(--mut);border-color:transparent}' +
      '.rm-ayuda{position:absolute;left:12px;right:12px;top:calc(58px + env(safe-area-inset-top));z-index:5;padding:14px;border:1px solid var(--line);border-radius:16px;background:var(--card2)}' +
      '.rm-ayuda div{margin:.35rem 0;font-size:.9rem}.rm-ayuda b{font-weight:600}' +
      '#rep-lista{position:fixed;inset:0;z-index:100;overflow:auto;background:var(--bg);padding:calc(14px + env(safe-area-inset-top)) 16px 24px}' +
      '#rep-lista[hidden]{display:none !important}' +
      '#rep-lista .cont{max-width:46rem;margin:0 auto}';
    document.head.appendChild(s);
  }

  /* ---------- Utilidades ---------- */
  function conTiempo(p, ms, motivo) {
    return new Promise(function (ok, ko) {
      var t = setTimeout(function () { ko(new Error(motivo || 'Tiempo agotado')); }, ms);
      Promise.resolve(p).then(function (v) { clearTimeout(t); ok(v); }, function (e) { clearTimeout(t); ko(e); });
    });
  }
  function aviso(txt) {
    if (document.body.classList.contains('rep-capt')) return;
    [].slice.call(document.querySelectorAll('.rep-toast')).forEach(function (x) { x.parentNode.removeChild(x); });
    var t = document.createElement('div'); t.className = 'rep-toast'; t.setAttribute('role', 'status'); t.textContent = txt;
    document.body.appendChild(t); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 3200);
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  }
  function seccion() {
    var on = document.querySelector('#menu .on'); var app = document.getElementById('app');
    if (!app || app.hidden) return 'Acceso';
    return on ? on.textContent.trim() : 'Inicio';
  }
  function blobADataUrl(b) { return new Promise(function (ok, ko) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = ko; r.readAsDataURL(b); }); }
  function esRed(e) { return !navigator.onLine || /failed to fetch|network|load failed|fetch|tiempo agotado/i.test(String((e && e.message) || e)); }

  /* ---------- Captura de la pantalla ---------- */
  var cvC = document.createElement('canvas'); cvC.width = cvC.height = 1;
  var cxC = cvC.getContext('2d', { willReadFrequently: true });
  function aRgba(c) {
    try {
      cxC.clearRect(0, 0, 1, 1); cxC.fillStyle = 'rgba(0,0,0,0)'; cxC.fillStyle = c; cxC.fillRect(0, 0, 1, 1);
      var d = cxC.getImageData(0, 0, 1, 1).data; return 'rgba(' + d[0] + ',' + d[1] + ',' + d[2] + ',' + (d[3] / 255).toFixed(3) + ')';
    } catch (e) { return 'rgba(0,0,0,0)'; }
  }
  var MODERNO = /(color-mix|oklch|oklab|lab|lch|color)\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/g;
  var PROPS = ['color', 'background-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'outline-color', 'text-decoration-color', 'caret-color', 'box-shadow', 'text-shadow', 'background-image', 'fill', 'stroke'];
  function arreglarClon(doc) {
    var all = doc.querySelectorAll('script,template,noscript,iframe,audio,video');
    for (var i = 0; i < all.length; i++) all[i].parentNode && all[i].parentNode.removeChild(all[i]);
    var els = doc.querySelectorAll('*'), vw = doc.defaultView;
    for (var j = 0; j < els.length; j++) {
      var el = els[j], st = el.getAttribute && el.getAttribute('style');
      if (st) el.setAttribute('style', st.replace(/\s*:\s*/g, ':').replace(/;\s+/g, ';'));
      if (el.hasAttribute && el.hasAttribute('data-rc')) el.style.setProperty('visibility', 'hidden', 'important');
      var cs = vw.getComputedStyle(el);
      for (var k = 0; k < PROPS.length; k++) {
        var v = cs.getPropertyValue(PROPS[k]);
        if (v && v.indexOf('(') > -1) { MODERNO.lastIndex = 0; if (MODERNO.test(v)) { MODERNO.lastIndex = 0; el.style.setProperty(PROPS[k], v.replace(MODERNO, aRgba), 'important'); } }
      }
    }
  }
  function marcarFuera(vw, vh, px, py) {
    var els = document.body.querySelectorAll('*'), marcados = [];
    for (var i = 0; i < els.length; i++) {
      var e = els[i]; if (e.id === 'rep-btn') continue;
      var r = e.getBoundingClientRect(); if (!r.width && !r.height) continue;
      if (r.bottom < -40 || r.top > vh + 40) { e.setAttribute('data-rc', '1'); marcados.push(e); }
    }
    return marcados;
  }
  function esperarImagenes() {
    var im = [].slice.call(document.images).filter(function (i) { return !i.complete || !i.naturalWidth; });
    return Promise.all(im.map(function (i) { return i.decode ? i.decode().catch(function () {}) : Promise.resolve(); }));
  }
  function grisSinCaptura(vw, vh) {
    var c = document.createElement('canvas'); c.width = Math.max(vw, 200); c.height = Math.max(vh, 200);
    var x = c.getContext('2d'); x.fillStyle = '#4a5068'; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#ffffff'; x.font = '600 ' + Math.round(c.width / 20) + 'px sans-serif'; x.textAlign = 'center';
    x.fillText('Esta pantalla no se puede capturar.', c.width / 2, c.height / 2 - 12);
    x.fillText('Se enviará sin imagen.', c.width / 2, c.height / 2 + 24);
    return c;
  }
  var cargandoLib = null;
  function cargarLib() {
    if (window.html2canvas) return Promise.resolve();
    if (cargandoLib) return cargandoLib;
    cargandoLib = new Promise(function (ok, ko) {
      var s = document.createElement('script'); s.src = 'lib/html2canvas.min.js';
      s.onload = ok; s.onerror = function () { cargandoLib = null; ko(new Error('No se pudo cargar la librería de captura')); };
      document.head.appendChild(s);
    });
    return cargandoLib;
  }

  async function capturar() {
    var vv = window.visualViewport, vw = Math.round(vv ? vv.width : innerWidth), vh = Math.round(vv ? vv.height : innerHeight);
    var px = Math.round(vv ? vv.pageLeft : scrollX), py = Math.round(vv ? vv.pageTop : scrollY);
    var esc2 = Math.min(2, window.devicePixelRatio || 1), diag = { vw: vw, vh: vh, escala: esc2, px: px, py: py, dpr: window.devicePixelRatio || 1 };
    var marcados = [];
    try {
      await conTiempo(cargarLib(), 8000, 'Librería de captura no disponible');
      await conTiempo(esperarImagenes(), 3000, 'Imágenes sin decodificar');
      marcados = marcarFuera(vw, vh, px, py);
      var cv = await conTiempo(window.html2canvas(document.documentElement, {
        backgroundColor: '#0a0f1f', scale: esc2, useCORS: true, logging: false, x: px, y: py, width: vw, height: vh + 8,
        windowWidth: document.documentElement.clientWidth, windowHeight: document.documentElement.clientHeight,
        ignoreElements: function (e) { return e.id === 'rep-btn' || e.id === 'rep-ov' || (e.classList && e.classList.contains('rep-toast')); },
        onclone: function (doc) {
          arreglarClon(doc);
          var m = doc.createElement('div'); m.setAttribute('style', 'position:absolute;left:' + px + 'px;top:' + (py + vh) + 'px;width:' + vw + 'px;height:8px;background:rgb(254,1,253);z-index:2147483647');
          doc.body.appendChild(m);
        }
      }), 8000, 'La captura tardó demasiado');
      /* Busca dónde ha caído la marca de color para recortar justo. */
      var cx = cv.getContext('2d'), fila = -1, ancho = cv.width;
      var datos = cx.getImageData(Math.floor(ancho / 2) - 2, 0, 4, cv.height).data;
      for (var y = cv.height - 1; y >= 0; y--) {
        var o = y * 16; if (datos[o] > 240 && datos[o + 1] < 20 && datos[o + 2] > 240) fila = y; else if (fila > -1) break;
      }
      var alto = fila > 0 ? fila : Math.min(cv.height, Math.round(vh * esc2));
      diag.lienzo = [cv.width, cv.height]; diag.marcaEn = fila; diag.recorte = [ancho, alto];
      var out = document.createElement('canvas'); out.width = ancho; out.height = alto;
      out.getContext('2d').drawImage(cv, 0, 0);
      return { canvas: out, motivo: null, diag: diag };
    } catch (e) {
      diag.error = String((e && e.message) || e).slice(0, 200);
      return { canvas: grisSinCaptura(vw, vh), motivo: diag.error, diag: diag, gris: true };
    } finally {
      marcados.forEach(function (e) { e.removeAttribute('data-rc'); });
    }
  }

  /* ---------- Estado de la pantalla de marcar ---------- */
  var ov = null, E = null, rec = null;
  function nuevoEstado(cap) {
    return { imgs: [{ canvas: cap.canvas, marks: [], hist: [], gris: !!cap.gris }], cur: 0, herr: 'lapiz', tags: {}, destino: null, motivo: cap.motivo, diag: cap.diag, ctx: contexto(), seccion: seccion() };
  }
  var destinoPendiente = null;
  function contexto() {
    return { url: location.href, fecha: new Date().toISOString(), ancho: innerWidth, alto: innerHeight, dpr: window.devicePixelRatio || 1, agente: navigator.userAgent.slice(0, 160) };
  }

  function pintarMarcas(c, w, h, marks) {
    c.lineWidth = Math.max(3, w * 0.006); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#ff3b30';
    marks.forEach(function (m) {
      if (m.t === 'trazo') {
        if (m.p.length === 1) { c.beginPath(); c.arc(m.p[0][0] * w, m.p[0][1] * h, c.lineWidth / 2, 0, 7); c.fillStyle = '#ff3b30'; c.fill(); return; }
        c.beginPath(); m.p.forEach(function (q, i) { i ? c.lineTo(q[0] * w, q[1] * h) : c.moveTo(q[0] * w, q[1] * h); }); c.stroke();
      } else { c.strokeRect(Math.min(m.x0, m.x1) * w, Math.min(m.y0, m.y1) * h, Math.abs(m.x1 - m.x0) * w, Math.abs(m.y1 - m.y0) * h); }
    });
  }
  function dibujar() {
    var im = E.imgs[E.cur], cv = ov.querySelector('#rm-cv'), c = cv.getContext('2d'), w = im.canvas.width, h = im.canvas.height;
    c.clearRect(0, 0, w, h); c.drawImage(im.canvas, 0, 0);
    pintarMarcas(c, w, h, im.marks.concat(E.actual ? [E.actual] : []));
  }
  function ajustar() {
    var st = ov.querySelector('.rm-stage'), z = ov.querySelector('.rm-zoom'), cv = ov.querySelector('#rm-cv'), im = E.imgs[E.cur];
    var sw = st.clientWidth, sh = st.clientHeight; if (!sw || !sh) return;
    var f = Math.min(sw / im.canvas.width, sh / im.canvas.height), cw = Math.round(im.canvas.width * f), ch = Math.round(im.canvas.height * f);
    cv.width = im.canvas.width; cv.height = im.canvas.height; cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
    z.style.width = cw + 'px'; z.style.height = ch + 'px'; E.base = { x: (sw - cw) / 2, y: (sh - ch) / 2 };
    aplicarZoom(); dibujar();
  }
  function aplicarZoom() {
    var z = ov.querySelector('.rm-zoom'), q = E.z || (E.z = { s: 1, x: 0, y: 0 });
    z.style.transform = 'translate(' + (E.base.x + q.x) + 'px,' + (E.base.y + q.y) + 'px) scale(' + q.s + ')';
  }
  function reiniciarZoom() { E.z = { s: 1, x: 0, y: 0 }; if (E.base) aplicarZoom(); }
  function ajustarVisor() {
    if (!ov || ov.hidden) return;
    var vv = window.visualViewport;
    ov.style.top = (vv ? vv.offsetTop : 0) + 'px'; ov.style.height = (vv ? vv.height : innerHeight) + 'px';
    ajustar();
  }
  function copiaMarcas(im) { return JSON.stringify(im.marks); }
  function guardarHist(im) { im.hist.push(copiaMarcas(im)); if (im.hist.length > 50) im.hist.shift(); }

  function pintarTools() {
    ov.querySelectorAll('[data-h]').forEach(function (b) { var on = b.dataset.h === E.herr; b.classList.toggle('on', on); b.classList.toggle('activo', on); b.setAttribute('aria-pressed', on); });
  }
  function pintarThumbs() {
    var h = ov.querySelector('.rm-th');
    if (E.imgs.length < 2) { h.hidden = true; h.innerHTML = ''; return; }
    h.hidden = false;
    h.innerHTML = E.imgs.map(function (im, i) {
      return '<div style="position:relative" class="tw"><button type="button" class="t' + (i === E.cur ? ' on activo' : '') + '" data-t="' + i + '" aria-label="Imagen ' + (i + 1) + '"><img alt="" src="' + miniatura(im.canvas) + '"></button>' +
        '<button type="button" class="q" data-q="' + i + '" aria-label="Quitar imagen ' + (i + 1) + '">' + IC.cerrar.replace(/width="22" height="22"/, 'width="12" height="12"') + '</button></div>';
    }).join('');
  }
  function miniatura(c) {
    var t = document.createElement('canvas'), r = 96 / Math.max(c.width, c.height); t.width = Math.max(1, Math.round(c.width * r)); t.height = Math.max(1, Math.round(c.height * r));
    t.getContext('2d').drawImage(c, 0, 0, t.width, t.height); return t.toDataURL('image/jpeg', .6);
  }
  function pintarDestino() {
    var d = ov.querySelector('.rm-dest');
    d.textContent = E.destino ? 'Se añadirá al reporte del ' + E.destino.fecha : '';
    d.hidden = !E.destino;
  }

  function construir() {
    ov = document.createElement('div'); ov.id = 'rep-ov'; ov.hidden = true; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Nuevo reporte');
    ov.innerHTML =
      '<div class="rm-top"><button type="button" class="rm-ib" data-a="cerrar" aria-label="Cerrar sin enviar">' + IC.cerrar + '</button><div class="rm-dest peq" hidden></div>' +
      '<button type="button" class="rm-ib" data-a="ayuda" aria-label="Ayuda" aria-pressed="false">' + IC.ayuda + '</button></div>' +
      '<div class="rm-stage"><div class="rm-zoom"><canvas id="rm-cv"></canvas></div></div>' +
      '<div class="rm-tools">' +
      '<button type="button" class="rm-ib" data-h="lapiz" aria-label="Lápiz">' + IC.lapiz + '</button>' +
      '<button type="button" class="rm-ib" data-h="rect" aria-label="Recuadro">' + IC.rect + '</button>' +
      '<button type="button" class="rm-ib" data-h="goma" aria-label="Goma">' + IC.goma + '</button>' +
      '<button type="button" class="rm-ib" data-a="deshacer" aria-label="Deshacer">' + IC.deshacer + '</button></div>' +
      '<div class="rm-th" hidden></div>' +
      '<div class="rm-tags">' + ETIQ.map(function (t) { return '<button type="button" class="chip" data-e="' + t + '" aria-pressed="false">' + t + '</button>'; }).join('') + '</div>' +
      '<div class="rm-otra"><button type="button" data-a="otra">Enviar y marcar otra cosa</button></div>' +
      '<div class="rm-comp"><button type="button" class="rm-ib" data-a="mas" aria-label="Añadir fotos">' + IC.mas + '</button>' +
      '<textarea id="rm-txt" rows="1" placeholder="Qué pasa (si quieres)…" aria-label="Qué pasa"></textarea>' +
      '<button type="button" class="rm-ib" data-a="dictar" aria-label="Dictar" aria-pressed="false">' + IC.mic + '</button>' +
      '<button type="button" class="rm-ib" data-a="enviar" aria-label="Enviar reporte" style="color:var(--acc)">' + IC.enviar + '</button></div>' +
      '<input type="file" id="rm-file" accept="image/*" multiple hidden>' +
      '<div class="rm-ayuda" hidden>' + AYUDA.map(function (a) { return '<div><b>' + a[0] + '.</b> ' + a[1] + '</div>'; }).join('') + '</div>';
    document.body.appendChild(ov);
    if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) ov.querySelector('[data-a=dictar]').hidden = true;
    ov.addEventListener('click', clicOv);
    ov.querySelector('#rm-file').addEventListener('change', archivos);
    var ta = ov.querySelector('#rm-txt');
    ta.addEventListener('input', crecer);
    ta.addEventListener('focus', function () { setTimeout(function () { ajustarVisor(); window.scrollTo(0, 0); }, 150); });
    ligarDibujo(ov.querySelector('.rm-stage'));
    if (window.visualViewport) { visualViewport.addEventListener('resize', ajustarVisor); visualViewport.addEventListener('scroll', ajustarVisor); }
    window.addEventListener('resize', ajustarVisor);
  }
  function crecer() { var ta = ov.querySelector('#rm-txt'); ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; }

  /* ---------- Dibujo con puntero, goma y zoom ---------- */
  function punto(ev) {
    var cv = ov.querySelector('#rm-cv'), r = cv.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height))];
  }
  function borrar(im, p) {
    var cv = im.canvas, w = cv.width, h = cv.height, rad = Math.max(0.025 * w, 14), cambio = false, nuevos = [];
    function cerca(q) { var dx = (q[0] - p[0]) * w, dy = (q[1] - p[1]) * h; return dx * dx + dy * dy < rad * rad; }
    function distSeg(a, b) {
      var ax = a[0] * w, ay = a[1] * h, bx = b[0] * w, by = b[1] * h, px = p[0] * w, py = p[1] * h, dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
      var t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0, ex = ax + t * dx - px, ey = ay + t * dy - py; return Math.sqrt(ex * ex + ey * ey);
    }
    im.marks.forEach(function (m) {
      if (m.t === 'trazo') {
        var seg = [], partes = [];
        m.p.forEach(function (q, i) {
          var toca = cerca(q) || (i > 0 && distSeg(m.p[i - 1], q) < rad * 0.6);
          if (toca) { cambio = true; if (seg.length) partes.push(seg); seg = []; } else seg.push(q);
        });
        if (seg.length) partes.push(seg);
        if (partes.length === 1 && partes[0].length === m.p.length) nuevos.push(m); else partes.forEach(function (s) { if (s.length > 1) nuevos.push({ t: 'trazo', p: s }); });
      } else {
        var x0 = Math.min(m.x0, m.x1), x1 = Math.max(m.x0, m.x1), y0 = Math.min(m.y0, m.y1), y1 = Math.max(m.y0, m.y1);
        var lados = [[[x0, y0], [x1, y0]], [[x1, y0], [x1, y1]], [[x1, y1], [x0, y1]], [[x0, y1], [x0, y0]]];
        if (lados.some(function (l) { return distSeg(l[0], l[1]) < rad; })) cambio = true; else nuevos.push(m);
      }
    });
    if (cambio) im.marks = nuevos; return cambio;
  }
  function ligarDibujo(st) {
    var ptrs = {}, pinch = null, borrando = false, tocoGoma = false;
    function n() { return Object.keys(ptrs).length; }
    function rel(ev) { var r = st.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; }
    st.addEventListener('pointerdown', function (ev) {
      if (ev.target.closest('.rm-ayuda')) return;
      ptrs[ev.pointerId] = rel(ev); try { st.setPointerCapture(ev.pointerId); } catch (e) {}
      var im = E.imgs[E.cur];
      if (n() === 2) {
        E.actual = null; if (borrando && tocoGoma) { /* ya guardado */ } dibujar();
        var k = Object.keys(ptrs), a = ptrs[k[0]], b = ptrs[k[1]];
        pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], z: Object.assign({}, E.z || { s: 1, x: 0, y: 0 }) };
        borrando = false; return;
      }
      if (n() > 2) return;
      var p = punto(ev);
      if (E.herr === 'lapiz') E.actual = { t: 'trazo', p: [p] };
      else if (E.herr === 'rect') E.actual = { t: 'rect', x0: p[0], y0: p[1], x1: p[0], y1: p[1] };
      else { guardarHist(im); borrando = true; tocoGoma = borrar(im, p); dibujar(); }
      ev.preventDefault();
    });
    st.addEventListener('pointermove', function (ev) {
      if (!ptrs[ev.pointerId]) return;
      ptrs[ev.pointerId] = rel(ev);
      if (pinch && n() === 2) {
        var k = Object.keys(ptrs), a = ptrs[k[0]], b = ptrs[k[1]], d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        var s = Math.min(6, Math.max(1, pinch.z.s * d / pinch.d));
        E.z = s === 1 ? { s: 1, x: 0, y: 0 } : { s: s, x: m[0] - (pinch.m[0] - pinch.z.x) * s / pinch.z.s, y: m[1] - (pinch.m[1] - pinch.z.y) * s / pinch.z.s };
        aplicarZoom(); return;
      }
      if (n() !== 1) return;
      var p = punto(ev);
      if (borrando) { if (borrar(E.imgs[E.cur], p)) tocoGoma = true; dibujar(); }
      else if (E.actual && E.actual.t === 'trazo') { var u = E.actual.p[E.actual.p.length - 1]; if (Math.abs(u[0] - p[0]) + Math.abs(u[1] - p[1]) > 0.0015) { E.actual.p.push(p); dibujar(); } }
      else if (E.actual) { E.actual.x1 = p[0]; E.actual.y1 = p[1]; dibujar(); }
    });
    function fin(ev) {
      if (!ptrs[ev.pointerId]) return;
      delete ptrs[ev.pointerId];
      if (pinch) { if (n() < 2) pinch = null; E.actual = null; return; }
      var im = E.imgs[E.cur];
      if (borrando) { borrando = false; if (!tocoGoma) im.hist.pop(); tocoGoma = false; dibujar(); return; }
      if (E.actual) {
        var a = E.actual; E.actual = null;
        if (a.t === 'rect' && Math.abs(a.x1 - a.x0) < 0.005 && Math.abs(a.y1 - a.y0) < 0.005) { dibujar(); return; }
        guardarHist(im); im.marks.push(a); dibujar();
      }
    }
    st.addEventListener('pointerup', fin); st.addEventListener('pointercancel', fin);
    st.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var q = E.z || (E.z = { s: 1, x: 0, y: 0 }), r = st.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
      var s = Math.min(6, Math.max(1, q.s * (ev.deltaY < 0 ? 1.15 : 1 / 1.15)));
      E.z = s === 1 ? { s: 1, x: 0, y: 0 } : { s: s, x: mx - (mx - q.x) * s / q.s, y: my - (my - q.y) * s / q.s }; aplicarZoom();
    }, { passive: false });
    st.addEventListener('dblclick', reiniciarZoom);
  }

  /* ---------- Acciones de la pantalla ---------- */
  function clicOv(ev) {
    var b = ev.target.closest('button'); if (!b) return;
    var a = b.dataset.a;
    if (b.dataset.h) { E.herr = b.dataset.h; pintarTools(); }
    else if (b.dataset.e) { var t = b.dataset.e; E.tags[t] = !E.tags[t]; b.classList.toggle('on', E.tags[t]); b.setAttribute('aria-pressed', !!E.tags[t]); }
    else if (b.dataset.t != null) { E.cur = +b.dataset.t; reiniciarZoom(); pintarThumbs(); ajustar(); }
    else if (b.dataset.q != null) {
      var i = +b.dataset.q; E.imgs.splice(i, 1); if (E.cur >= E.imgs.length) E.cur = E.imgs.length - 1; if (i < E.cur) E.cur--;
      reiniciarZoom(); pintarThumbs(); ajustar();
    }
    else if (a === 'cerrar') cerrar();
    else if (a === 'ayuda') { var p = ov.querySelector('.rm-ayuda'); p.hidden = !p.hidden; b.setAttribute('aria-pressed', !p.hidden); b.classList.toggle('on', !p.hidden); b.classList.toggle('activo', !p.hidden); }
    else if (a === 'deshacer') { var im = E.imgs[E.cur]; if (im.hist.length) { im.marks = JSON.parse(im.hist.pop()); dibujar(); } }
    else if (a === 'mas') ov.querySelector('#rm-file').click();
    else if (a === 'dictar') dictar(b);
    else if (a === 'enviar') enviar(false);
    else if (a === 'otra') enviar(true);
  }
  function cerrar() {
    if (rec) { try { rec.stop(); } catch (e) {} rec = null; }
    ov.hidden = true; document.body.style.overflow = ''; var f = document.getElementById('rep-btn'); if (f) f.hidden = false; E = null;
  }
  function dictar(b) {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return;
    if (rec) { try { rec.stop(); } catch (e) {} return; }
    var r = new SR(); r.lang = 'es-ES'; r.interimResults = false; r.continuous = false; rec = r;
    function fin() { rec = null; b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); }
    r.onresult = function (e) {
      var txt = ''; for (var i = e.resultIndex; i < e.results.length; i++) txt += e.results[i][0].transcript;
      var ta = ov.querySelector('#rm-txt'); ta.value = (ta.value ? ta.value.replace(/\s+$/, '') + ' ' : '') + txt.trim(); crecer();
    };
    r.onend = fin; r.onerror = fin;
    b.classList.add('on'); b.setAttribute('aria-pressed', 'true');
    try { r.start(); } catch (e) { fin(); }
  }
  function archivos(ev) {
    var fs = [].slice.call(ev.target.files || []); ev.target.value = '';
    fs.forEach(function (f) {
      var u = URL.createObjectURL(f), im = new Image();
      im.onload = function () {
        var r = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.round(im.naturalWidth * r); c.height = Math.round(im.naturalHeight * r); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u);
        if (!E) return;
        E.imgs.push({ canvas: c, marks: [], hist: [] }); E.cur = E.imgs.length - 1; reiniciarZoom(); pintarThumbs(); ajustar();
      };
      im.onerror = function () { URL.revokeObjectURL(u); aviso('No se pudo leer una de las fotos.'); };
      im.src = u;
    });
  }

  /* ---------- Composición del reporte ---------- */
  function categoria(etq, txt, hayMarcas) {
    var t = (txt || '').toLowerCase();
    if (etq.indexOf('Fallo') > -1 || /error|fallo|no funciona|no va\b|roto|se rompe|no carga/.test(t)) return 'fallo';
    if (etq.some(function (x) { return x !== 'Fallo'; }) || /dise|color|tamañ|grande|pequeñ|posici|orden|letra|aspecto/.test(t)) return 'diseño';
    return 'marcado';
  }
  function resumenMarcas() {
    var out = [];
    E.imgs.forEach(function (im, i) {
      im.marks.forEach(function (m) {
        if (m.t === 'rect') out.push({ img: i, tipo: 'recuadro', x0: r3(Math.min(m.x0, m.x1)), y0: r3(Math.min(m.y0, m.y1)), x1: r3(Math.max(m.x0, m.x1)), y1: r3(Math.max(m.y0, m.y1)) });
        else { var paso = Math.max(1, Math.ceil(m.p.length / 40)); out.push({ img: i, tipo: 'trazo', puntos: m.p.filter(function (q, k) { return k % paso === 0 || k === m.p.length - 1; }).map(function (q) { return [r3(q[0]), r3(q[1])]; }) }); }
      });
    });
    return out;
  }
  function r3(n) { return Math.round(n * 1000) / 1000; }
  function aBlob(im) {
    var c = document.createElement('canvas'); c.width = im.canvas.width; c.height = im.canvas.height;
    var x = c.getContext('2d'); x.drawImage(im.canvas, 0, 0); pintarMarcas(x, c.width, c.height, im.marks);
    return new Promise(function (ok) { c.toBlob(function (b) { ok(b); }, 'image/jpeg', 0.82); });
  }

  async function enviar(otra) {
    if (!E) return;
    var estado = E, ta = ov.querySelector('#rm-txt'), txt = ta.value.trim();
    var etq = ETIQ.filter(function (t) { return estado.tags[t]; }), marcas = resumenMarcas();
    var cuerpo = txt || (marcas.length ? 'Revisar lo marcado en la captura' : 'Revisar esta pantalla');
    var texto = '[' + estado.seccion + '] ' + (etq.length ? etq.join(', ') + ': ' : '') + cuerpo;
    var blobs = [];
    for (var i = 0; i < estado.imgs.length; i++) blobs.push(await aBlob(estado.imgs[i]));
    var gris = !!estado.imgs[0].gris;
    var p = {
      id: uuid(), ts: Date.now(), blobs: blobs, destino: estado.destino ? estado.destino.id : null,
      fila: {
        proyecto: PROYECTO, seccion: estado.seccion, texto: texto, categoria: categoria(etq, txt, marcas.length > 0), etiquetas: etq, marcas: marcas,
        sin_captura: gris, motivo: gris ? estado.motivo : null, diagnostico: estado.diag, contexto: estado.ctx, estado: 'pendiente', protocolo: PROTOCOLO
      }
    };
    if (gris) p.blobs = blobs.slice(1);
    if (otra) {
      estado.imgs.forEach(function (im, k) { im.marks = []; im.hist = []; });
      estado.imgs = estado.imgs.slice(0, 1); estado.cur = 0; estado.tags = {}; ta.value = ''; crecer();
      ov.querySelectorAll('[data-e]').forEach(function (b) { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); });
      estado.destino = null; pintarDestino(); pintarThumbs(); reiniciarZoom(); dibujar();
    } else cerrar();
    procesar(p);
  }

  /* ---------- Envío con tiempos máximos y cola sin conexión ---------- */
  function leerCola() { try { return JSON.parse(localStorage.getItem(COLA) || '[]'); } catch (e) { return []; } }
  function escribirCola(c) { try { localStorage.setItem(COLA, JSON.stringify(c)); return true; } catch (e) { return false; } }
  async function encolar(p) {
    var imgs = [];
    for (var i = 0; i < p.blobs.length; i++) imgs.push(await blobADataUrl(p.blobs[i]));
    var item = { id: p.id, ts: p.ts, fila: p.fila, destino: p.destino, imgs: imgs }, c = leerCola();
    c.push(item);
    if (!escribirCola(c)) { c.pop(); item.imgs = []; item.fila = Object.assign({}, item.fila, { sin_captura: true, motivo: 'Sin espacio en el móvil para guardar la imagen sin conexión' }); c.push(item); escribirCola(c); }
  }
  async function subir(ruta, blob) {
    var r = await conTiempo(W.sb.storage.from(BUCKET).upload(ruta, blob, { contentType: 'image/jpeg', upsert: true }), 20000, 'La subida tardó demasiado');
    if (r && r.error) throw new Error(r.error.message || 'Error al subir');
  }
  /* Devuelve un texto de aviso. Lanza solo si hay que dejarlo en cola. */
  async function enviarAhora(p) {
    var f = Object.assign({}, p.fila), sinImg = '', rutas = [], nombre = 'reportes/' + p.ts;
    var tieneCaptura = !f.sin_captura && p.blobs.length > 0, referencias = [];
    for (var i = 0; i < p.blobs.length; i++) {
      var esPrincipal = tieneCaptura && i === 0, ruta = esPrincipal ? nombre + '.jpg' : nombre + '-' + (tieneCaptura ? i : i + 1) + '.jpg';
      try { await subir(ruta, p.blobs[i]); rutas.push(ruta); if (!esPrincipal) referencias.push(ruta); }
      catch (e) {
        if (esRed(e)) throw e;
        sinImg = String(e.message || e).slice(0, 120);
        if (esPrincipal) { f.sin_captura = true; f.motivo = sinImg; }
      }
    }
    if (tieneCaptura && !f.sin_captura) f.captura_url = nombre + '.jpg';
    f.referencias = referencias;
    var r;
    if (p.destino) {
      var ex = await conTiempo(W.sb.from('reportes').select('texto,referencias,etiquetas,marcas').eq('id', p.destino).single(), 15000, 'Tiempo agotado');
      if (ex.error) throw new Error(ex.error.message);
      var refs = (ex.data.referencias || []).concat(referencias).concat(f.captura_url ? [f.captura_url] : []);
      var etqs = (ex.data.etiquetas || []).slice(); (f.etiquetas || []).forEach(function (t) { if (etqs.indexOf(t) < 0) etqs.push(t); });
      r = await conTiempo(W.sb.from('reportes').update({ texto: ex.data.texto + '\n' + f.texto, referencias: refs, etiquetas: etqs, marcas: (ex.data.marcas || []).concat(f.marcas || []), estado: 'pendiente' }).eq('id', p.destino), 15000, 'Tiempo agotado');
    } else {
      f.id = p.id;
      r = await conTiempo(W.sb.from('reportes').insert(f), 15000, 'Tiempo agotado');
      if (r && r.error && /duplicate|already exists|23505/i.test(r.error.message + (r.error.code || ''))) r = { error: null };
    }
    if (r && r.error) { var er = new Error(r.error.message); er.db = true; throw er; }
    return sinImg || (f.sin_captura && f.motivo) || '';
  }
  async function procesar(p) {
    if (!navigator.onLine) { await encolar(p); aviso('Sin conexión: el reporte se ha guardado y se enviará solo'); return; }
    try {
      var sin = await enviarAhora(p);
      aviso(sin ? 'Reporte enviado (sin imagen: ' + sin + ')' : 'Reporte enviado');
    } catch (e) {
      await encolar(p);
      aviso(esRed(e) ? 'Sin conexión: el reporte se ha guardado y se enviará solo' : 'No se pudo enviar: el reporte se ha guardado y se reintentará');
    }
  }
  var vaciando = false;
  async function vaciar() {
    if (vaciando || !navigator.onLine || !W.sb) return;
    var c = leerCola(); if (!c.length) return;
    vaciando = true;
    try {
      var s = await W.sb.auth.getSession(); if (!(s.data && s.data.session)) return;
      var rest = [], enviados = 0;
      for (var i = 0; i < c.length; i++) {
        var it = c[i];
        try {
          var blobs = []; for (var k = 0; k < it.imgs.length; k++) blobs.push(await (await fetch(it.imgs[k])).blob());
          await enviarAhora({ id: it.id, ts: it.ts, fila: it.fila, destino: it.destino, blobs: blobs }); enviados++;
        } catch (e) { rest.push(it); }
      }
      escribirCola(rest);
      if (enviados) aviso(enviados === 1 ? 'Reporte enviado' : enviados + ' reportes enviados');
    } finally { vaciando = false; }
  }

  /* ---------- Abrir ---------- */
  var abriendo = false;
  async function abrir() {
    if (abriendo || (ov && !ov.hidden)) return;
    abriendo = true;
    var fab = document.getElementById('rep-btn');
    document.body.classList.add('rep-capt'); fab.classList.add('parp');
    try {
      var cap = await capturar();
      E = nuevoEstado(cap);
      if (destinoPendiente) { E.destino = destinoPendiente; destinoPendiente = null; }
      if (!ov) construir();
      var ta = ov.querySelector('#rm-txt'); ta.value = ''; crecer();
      ov.querySelectorAll('[data-e]').forEach(function (b) { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); });
      ov.querySelector('.rm-ayuda').hidden = true;
      ov.hidden = false; fab.hidden = true; document.body.style.overflow = 'hidden';
      pintarTools(); pintarThumbs(); pintarDestino(); reiniciarZoom(); ajustarVisor();
      requestAnimationFrame(ajustarVisor);
    } finally { fab.classList.remove('parp'); document.body.classList.remove('rep-capt'); abriendo = false; }
  }

  /* ---------- Lista de reportes ---------- */
  var lista = null;
  async function verLista() {
    if (!lista) {
      lista = document.createElement('div'); lista.id = 'rep-lista'; lista.hidden = true; document.body.appendChild(lista);
      lista.addEventListener('click', function (ev) {
        var b = ev.target.closest('button'); if (!b) return;
        if (b.dataset.cerrar) { lista.hidden = true; document.body.style.overflow = ''; }
        else if (b.dataset.sumar) {
          destinoPendiente = { id: b.dataset.sumar, fecha: b.dataset.fecha }; lista.hidden = true; document.body.style.overflow = '';
          aviso('Pulsa el botón de reportes para añadir a ese reporte');
        }
      });
    }
    lista.hidden = false; document.body.style.overflow = 'hidden';
    lista.innerHTML = '<div class="cont"><div class="fila-sp"><h2 style="margin:0">Reportes</h2><button type="button" data-cerrar="1">Cerrar</button></div><p class="mut">Cargando…</p></div>';
    var r = await W.sb.from('reportes').select('id,created_at,seccion,texto,estado,resolucion').eq('proyecto', PROYECTO).order('created_at', { ascending: false }).limit(60);
    var pend = leerCola().length;
    var h = '<div class="cont"><div class="fila-sp"><h2 style="margin:0">Reportes</h2><button type="button" data-cerrar="1">Cerrar</button></div>';
    if (pend) h += '<p class="mut peq">' + pend + (pend === 1 ? ' reporte espera' : ' reportes esperan') + ' a enviarse cuando haya conexión.</p>';
    if (r.error) h += '<p class="mut">No se pudieron leer los reportes: ' + esc(r.error.message) + '</p>';
    else if (!r.data.length) h += '<p class="mut">Todavía no hay reportes.</p>';
    else h += r.data.map(function (x) {
      var d = new Date(x.created_at), f = ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
      return '<div class="tarjeta"><div class="mut peq">' + esc(f) + ' · ' + esc(x.seccion || '') + ' · ' + esc(x.estado) + '</div><div style="margin-top:.3rem;white-space:pre-line">' + esc(x.texto) + '</div>' +
        (x.resolucion ? '<div class="mut peq" style="margin-top:.4rem">Resolución: ' + esc(x.resolucion) + '</div>' : '') +
        (x.estado === 'pendiente' ? '<div class="fila"><button type="button" data-sumar="' + esc(x.id) + '" data-fecha="' + esc(f) + '">Añadir a este reporte</button></div>' : '') + '</div>';
    }).join('');
    lista.innerHTML = h + '</div>';
  }

  /* ---------- Botón flotante y congelado ---------- */
  function montar() {
    css();
    var b = document.createElement('button'); b.type = 'button'; b.id = 'rep-btn'; b.setAttribute('aria-label', 'Reportar un problema'); b.innerHTML = IC.bug; b.hidden = true;
    document.body.appendChild(b);
    var app = document.getElementById('app');
    function ver() { if (!ov || ov.hidden) b.hidden = !app || app.hidden; }
    if (app && window.MutationObserver) new MutationObserver(ver).observe(app, { attributes: true, attributeFilter: ['hidden'] });
    ver();
    /* Al pulsar se congela todo: nadie más ve la pulsación, así desplegables y menús siguen abiertos. */
    ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click', 'focusin', 'focus'].forEach(function (tipo) {
      window.addEventListener(tipo, function (ev) {
        if (!ev.target || !ev.target.closest || !ev.target.closest('#rep-btn')) return;
        ev.stopImmediatePropagation();
        if (tipo === 'mousedown' || tipo === 'pointerdown' && ev.pointerType === 'mouse') ev.preventDefault();
        if (tipo === 'click') abrir();
      }, true);
    });
    window.addEventListener('keydown', function (ev) {
      if (ev.target && ev.target.id === 'rep-btn' && (ev.key === 'Enter' || ev.key === ' ')) { ev.stopImmediatePropagation(); ev.preventDefault(); abrir(); }
    }, true);
    setTimeout(function () { cargarLib().catch(function () {}); }, 3000);
    window.addEventListener('online', vaciar);
    setTimeout(vaciar, 4000);
  }

  window.WARREP = { abrir: abrir, lista: verLista, vaciar: vaciar, _estado: function () { return E; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();
