/* WAR · Biblioteca: libros importados desde PDF, lectura por capítulos y pasajes que usa cada episodio, marcados en amarillo. */
(function () {
  'use strict';
  var W = window.WAR, U = window.WARUI, esc = W.esc, S = 'biblioteca', N = window.WARLIBROSNUCLEO;
  var PDF = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
  var PDF_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  var textos = {}, pend = null, estado = '', host = null;

  function D() { return W.datos(); }
  function miles(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function ordenados() { return (D().episodios || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }
  function numEp(e) { return ordenados().indexOf(e) + 1; }

  /* Pasajes marcados por los episodios en un texto (id de parte) o en un capítulo concreto. */
  function usos(textoId, cap) {
    var r = [];
    ordenados().forEach(function (e) {
      (e.fuentes || []).forEach(function (f) {
        if (f.texto === textoId && (cap == null || f.cap === cap)) r.push({ ep: numEp(e), cap: f.cap, ini: f.ini, fin: f.fin, idea: f.idea || '' });
      });
    });
    return r;
  }
  function etiquetaEps(us) {
    var v = []; us.forEach(function (u) { if (v.indexOf(u.ep) < 0) v.push(u.ep); });
    return v.length ? 'Ep. ' + v.sort(function (a, b) { return a - b; }).join(', ') : '';
  }

  /* Texto del capítulo con los pasajes en amarillo, como con rotulador. */
  function htmlTexto(texto, rangos) {
    var off = 0;
    return texto.split('\n\n').map(function (p) {
      var ini = off, fin = off + p.length; off = fin + 2;
      var cortes = rangos.filter(function (r) { return r.fin > ini && r.ini < fin; }).map(function (r) {
        return { a: Math.max(r.ini, ini) - ini, b: Math.min(r.fin, fin) - ini, t: 'Episodio ' + r.ep + (r.idea ? ': ' + r.idea : '') };
      }).sort(function (x, y) { return x.a - y.a; });
      var out = '', pos = 0;
      cortes.forEach(function (c) {
        if (c.a < pos) c.a = pos;
        if (c.b <= c.a) return;
        out += esc(p.slice(pos, c.a)) + '<mark class="rot" title="' + esc(c.t) + '">' + esc(p.slice(c.a, c.b)) + '</mark>';
        pos = c.b;
      });
      return '<p>' + out + esc(p.slice(pos)) + '</p>';
    }).join('');
  }

  /* Los textos son pesados: no entran en la carga inicial, se piden al abrir. */
  function texto(id) {
    if (textos[id]) return Promise.resolve(textos[id]);
    return W.sb.from('war_docs').select('datos').eq('coleccion', 'textos').eq('id', id).then(function (r) {
      var d = r.data && r.data[0] ? r.data[0].datos : null;
      if (d) textos[id] = d;
      return d;
    });
  }

  function cuerpoCapitulo(doc, c, ep) {
    var us = usos(doc.id, c.n).filter(function (u) { return !ep || u.ep === ep; });
    return '<div class="texto">' + htmlTexto(c.texto, us) + '</div>';
  }
  function filaCapitulo(doc, c) {
    var us = usos(doc.id, c.n), et = etiquetaEps(us);
    var g = 'c.' + doc.id + '.' + c.n;
    return '<details class="sub" data-ui="' + S + '" data-g="' + g + '"' + (U.get(S, 'g.' + g, false) ? ' open' : '') + '><summary class="fil-r"><span class="t">' + esc('Capítulo ' + c.n + (c.titulo ? '. ' + c.titulo : '')) +
      '</span><span class="d' + (et ? ' ac' : '') + '">' + esc((et ? et + ' · ' : '') + miles(c.palabras) + ' pal.') + '</span></summary>' + cuerpoCapitulo(doc, c) + '</details>';
  }
  function pintarParte(det) {
    var id = det.dataset.parte, cont = det.querySelector('.lector');
    if (!cont || cont.dataset.listo) return;
    cont.textContent = 'Cargando…';
    texto(id).then(function (d) {
      if (!d) { cont.innerHTML = '<p class="mut peq" style="padding:8px 14px">No se pudo leer el texto.</p>'; return; }
      d.id = id; cont.dataset.listo = '1';
      cont.innerHTML = d.capitulos.map(function (c) { return filaCapitulo(d, c); }).join('');
    });
  }

  function filaParte(libro, p) {
    var id = libro.id + '-l' + p.n, us = usos(id), et = etiquetaEps(us), g = 'p.' + id;
    var abierto = U.get(S, 'g.' + g, false);
    return '<details class="sub" data-ui="' + S + '" data-g="' + g + '" data-parte="' + id + '"' + (abierto ? ' open' : '') + '><summary class="fil-r"><span class="t">' + esc(p.titulo) +
      '</span><span class="d' + (et ? ' ac' : '') + '">' + esc((et ? et + ' · ' : '') + p.capitulos + ' cap. · ' + miles(p.palabras) + ' pal.') + '</span></summary><div class="lector"></div></details>';
  }
  function bloqueLibro(l) {
    var pal = l.partes.reduce(function (a, p) { return a + p.palabras; }, 0);
    var usados = l.partes.filter(function (p) { return usos(l.id + '-l' + p.n).length; }).length;
    var cuerpo = l.partes.map(function (p) { return filaParte(l, p); }).join('');
    return U.grupo(S, 'libro.' + l.id, l.titulo, usados + ' de ' + l.partes.length + ' en episodios', '<p class="mut peq nota">' + esc(l.autor + ' · ' + miles(pal) + ' palabras. ' + (l.nota || '')) + '</p>' + cuerpo, true);
  }

  /* Importación del PDF en el navegador: el texto no sale de la cuenta del usuario. */
  function cargarPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    return new Promise(function (ok, ko) {
      var s = document.createElement('script'); s.src = PDF; s.onload = function () { ok(window.pdfjsLib); };
      s.onerror = function () { ko(new Error('No se pudo cargar el lector de PDF.')); }; document.head.appendChild(s);
    }).then(function (lib) {
      return fetch(PDF_WORKER).then(function (r) { return r.text(); }).then(function (t) {
        lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([t], { type: 'text/javascript' })); return lib;
      });
    });
  }
  function leerPaginas(lib, buf, progreso) {
    return lib.getDocument({ data: buf }).promise.then(function (doc) {
      var pags = [], i = 0;
      function sig() {
        if (i >= doc.numPages) return Promise.resolve(pags);
        i++; progreso('Leyendo página ' + i + ' de ' + doc.numPages);
        return doc.getPage(i).then(function (p) { return p.getTextContent(); }).then(function (tc) {
          pags.push(tc.items.map(function (it) { return { x: it.transform[4], y: it.transform[5], str: it.str }; })); return sig();
        });
      }
      return sig();
    });
  }
  function adivinar(nombre) {
    var n = nombre.replace(/\.pdf$/i, '').replace(/_/g, ' ');
    if (/nicomaco/i.test(n)) return { id: 'ne', titulo: 'Ética a Nicómaco', autor: 'Aristóteles' };
    var p = n.split(/\s-\s/);
    var id = (p[p.length - 1] || 'libro').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 8) || 'libro';
    return { id: id, titulo: p.length > 1 ? p[1] : n, autor: p.length > 1 ? p[0] : '' };
  }
  function importar(file) {
    pend = null; estado = 'Preparando…'; pintarImportar();
    var b = adivinar(file.name);
    file.arrayBuffer().then(function (buf) {
      return cargarPdfJs().then(function (lib) { return leerPaginas(lib, buf, function (t) { estado = t; pintarImportar(); }); });
    }).then(function (pags) {
      var r = N.parsear(pags);
      if (!r.partes.length) throw new Error('No se encontraron libros ni capítulos en el PDF.');
      pend = { id: b.id, titulo: b.titulo, autor: b.autor, res: r, archivo: file.name };
      estado = ''; pintarImportar();
    }).catch(function (e) { estado = 'No se pudo leer el PDF: ' + (e.message || e); pintarImportar(); });
  }
  function guardar() {
    if (!pend) return;
    var p = pend, hoy = new Date().toISOString(), i = 0;
    var libro = { titulo: p.titulo, autor: p.autor, archivo: p.archivo, importado: hoy, nota: 'Se han quitado los resúmenes del editor; en los libros que no son el primero la limpieza es automática y aproximada.',
      partes: p.res.partes.map(function (pt) { return { n: pt.n, titulo: pt.titulo, capitulos: pt.capitulos.length, palabras: pt.palabras }; }) };
    function sig() {
      if (i >= p.res.partes.length) return W.sb.from('war_docs').upsert({ coleccion: 'libros', id: p.id, datos: libro, actualizado: hoy });
      var pt = p.res.partes[i++]; estado = 'Guardando ' + pt.titulo + '…'; pintarImportar();
      var datos = { libro: p.id, parte: pt.n, titulo: pt.titulo, capitulos: pt.capitulos.map(function (c) { return { n: c.n, titulo: c.titulo, texto: c.texto, palabras: c.palabras, quitados: c.quitados }; }) };
      return W.sb.from('war_docs').upsert({ coleccion: 'textos', id: p.id + '-l' + pt.n, datos: datos, actualizado: hoy }).then(function (r) {
        if (r && r.error) throw new Error(r.error.message); return sig();
      });
    }
    sig().then(function (r) {
      if (r && r.error) throw new Error(r.error.message);
      var L = D().libros = (D().libros || []).filter(function (x) { return x.id !== p.id; });
      L.push(Object.assign({ id: p.id }, libro)); textos = {}; pend = null; estado = ''; pintar();
    }).catch(function (e) { estado = 'No se pudo guardar: ' + (e.message || e); pintarImportar(); });
  }

  function pintarImportar() {
    var c = document.getElementById('imp'); if (!c) return;
    var h = '<label class="btn" for="imp-file" style="margin:8px 14px">Elegir PDF</label><input id="imp-file" type="file" accept="application/pdf" hidden>';
    if (estado) h += '<p class="mut peq" style="margin:0 14px 8px">' + esc(estado) + '</p>';
    if (pend) {
      var np = pend.res.partes.length, nc = pend.res.partes.reduce(function (a, p) { return a + p.capitulos.length; }, 0), pal = pend.res.partes.reduce(function (a, p) { return a + p.palabras; }, 0);
      h += '<div class="fil-c" style="margin:0 14px"><label for="imp-t">Título</label><input id="imp-t" value="' + esc(pend.titulo) + '"></div>' +
        '<div class="fil-c" style="margin:0 14px"><label for="imp-a">Autor</label><input id="imp-a" value="' + esc(pend.autor) + '"></div>' +
        U.fila(np + ' libros · ' + nc + ' capítulos', miles(pal) + ' pal.', '') +
        U.fila('Notas del editor quitadas', String(pend.res.quitados), U.accion('Guardar', 'data-lib-guardar="1"'));
    }
    c.innerHTML = h;
  }

  function biblioteca(el) {
    host = el; pintar();
    el.onclick = function (ev) {
      var b = ev.target.closest('button[data-lib-guardar]'); if (!b) return;
      var t = document.getElementById('imp-t'), a = document.getElementById('imp-a');
      if (t) pend.titulo = t.value.trim() || pend.titulo; if (a) pend.autor = a.value.trim();
      guardar();
    };
    el.onchange = function (ev) {
      if (ev.target.id === 'imp-file' && ev.target.files[0]) importar(ev.target.files[0]);
    };
  }
  function pintar() {
    if (!host) return;
    var libros = D().libros || [], obras = (D().obras || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    var conceptos = (D().conceptos || []).slice().sort(function (a, b) { return (a.nombre || '').localeCompare(b.nombre || '', 'es'); });
    var nombreObra = function (id) { var o = (D().obras || []).filter(function (x) { return x.id === id; })[0]; return o ? o.nombre : ''; };
    var h = libros.map(bloqueLibro).join('');
    h += U.grupo(S, 'importar', 'Importar libro', libros.length ? '' : 'Sin libros', '<div id="imp"></div>', !libros.length);
    h += U.grupo(S, 'obras', 'Obras', obras.length, obras.map(function (o) { return U.fila(o.nombre, o.estMin + '–' + o.estMax + ' ep.', ''); }).join(''), false);
    h += U.grupo(S, 'conceptos', 'Conceptos', conceptos.length, conceptos.map(function (c) { return U.fila(c.nombre, (c.obras || []).map(nombreObra).join(', '), ''); }).join(''), false);
    host.innerHTML = h; pintarImportar();
    host.querySelectorAll('details[data-parte][open]').forEach(pintarParte);
  }
  document.addEventListener('toggle', function (ev) {
    var d = ev.target; if (d && d.tagName === 'DETAILS' && d.dataset.parte && d.open) pintarParte(d);
  }, true);

  /* Ficha del episodio: de qué parte del libro sale, con los pasajes en amarillo. */
  function origen(e, el) {
    if (!el) return;
    var fs = e.fuentes || [], ids = [];
    fs.forEach(function (f) { if (ids.indexOf(f.texto) < 0) ids.push(f.texto); });
    var cif = fs.length ? fs.length + ' pasajes' : 'Sin marcar';
    if (!fs.length) { el.innerHTML = U.grupo('episodio', 'origen', 'Texto de origen', cif, '<p class="mut peq nota">Aún no hay pasajes del libro marcados para este episodio.</p>', false); return; }
    el.innerHTML = U.grupo('episodio', 'origen', 'Texto de origen', cif, '<div class="lector">Cargando…</div>', true);
    Promise.all(ids.map(texto)).then(function (docs) {
      var h = fs.map(function (f) { return U.fila(f.idea || 'Pasaje', 'Cap. ' + f.cap, ''); }).join('');
      var vistos = {};
      fs.forEach(function (f) {
        var k = f.texto + '.' + f.cap; if (vistos[k]) return; vistos[k] = 1;
        var d = docs[ids.indexOf(f.texto)], c = d && d.capitulos.filter(function (x) { return x.n === f.cap; })[0];
        if (!c) return; d.id = f.texto;
        var g = 'o.' + e.id + '.' + k;
        h += '<details class="sub" data-ui="episodio" data-g="' + g + '"' + (U.get('episodio', 'g.' + g, false) ? ' open' : '') + '><summary class="fil-r"><span class="t">' + esc(d.titulo + ', capítulo ' + c.n) + '</span><span class="d ac">' + esc(miles(c.palabras) + ' pal.') + '</span></summary>' + cuerpoCapitulo(d, c, numEp(e)) + '</details>';
      });
      var l = el.querySelector('.lector'); if (l) l.innerHTML = h;
    });
  }

  window.WARLIBROS = { biblioteca: biblioteca, origen: origen };
})();
