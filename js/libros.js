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
  /* Clase del dato: acento si lo usa el episodio actual (o cualquiera en Biblioteca), otro color si solo lo usan otros. */
  function claseUso(us, act) { return !us.length ? '' : (!act || us.some(function (u) { return u.ep === act; })) ? ' ac' : ' otro'; }

  /* Texto del capítulo con los pasajes en amarillo, como con rotulador. */
  function htmlTexto(texto, rangos, act) {
    var off = 0;
    return texto.split('\n\n').map(function (p) {
      var ini = off, fin = off + p.length; off = fin + 2;
      var cortes = rangos.filter(function (r) { return r.fin > ini && r.ini < fin; }).map(function (r) {
        return { ep: r.ep, a: Math.max(r.ini, ini) - ini, b: Math.min(r.fin, fin) - ini, t: 'Episodio ' + r.ep + (r.idea ? ': ' + r.idea : '') };
      }).sort(function (x, y) { return x.a - y.a; });
      var out = '', pos = 0;
      cortes.forEach(function (c) {
        if (c.a < pos) c.a = pos;
        if (c.b <= c.a) return;
        out += esc(p.slice(pos, c.a)) + '<mark class="' + (act && c.ep !== act ? 'otro' : 'rot') + '" title="' + esc(c.t) + '">' + esc(p.slice(c.a, c.b)) + '</mark>';
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

  function cuerpoCapitulo(doc, c, act) {
    return '<div class="texto">' + htmlTexto(c.texto, usos(doc.id, c.n), act) + '</div>';
  }
  /* x = { sec: dónde se recuerda el plegado, act: número del episodio que se resalta (0 en Biblioteca), pref: prefijo de claves } */
  function atrX(x) { return ' data-ui="' + x.sec + '" data-act="' + (x.act || 0) + '" data-pref="' + esc(x.pref || '') + '"'; }
  function filaCapitulo(doc, c, x) {
    var us = usos(doc.id, c.n), et = etiquetaEps(us), g = x.pref + 'c.' + doc.id + '.' + c.n;
    var usa = x.act && us.some(function (u) { return u.ep === x.act; });
    return '<details class="sub n3" data-g="' + g + '"' + atrX(x) + (U.get(x.sec, 'g.' + g, !!usa) ? ' open' : '') + '><summary class="fil-r"><span class="t">' + esc('Capítulo ' + c.n + (c.titulo ? '. ' + c.titulo : '')) +
      '</span><span class="d' + claseUso(us, x.act) + '">' + esc((et ? et + ' · ' : '') + miles(c.palabras) + ' pal.') + '</span></summary>' + cuerpoCapitulo(doc, c, x.act) + '</details>';
  }
  function pintarParte(det) {
    var id = det.dataset.parte, cont = det.querySelector('.lector'), x = { sec: det.dataset.ui, act: +det.dataset.act || 0, pref: det.dataset.pref || '' };
    if (!cont || cont.dataset.listo) return;
    cont.textContent = 'Cargando…';
    texto(id).then(function (d) {
      if (!d) { cont.innerHTML = '<p class="mut peq" style="padding:8px 14px">No se pudo leer el texto.</p>'; return; }
      d.id = id; cont.dataset.listo = '1';
      cont.innerHTML = d.capitulos.map(function (c) { return filaCapitulo(d, c, x); }).join('');
    });
  }

  function filaParte(libro, p, x) {
    var id = libro.id + '-l' + p.n, us = usos(id), et = etiquetaEps(us), g = x.pref + 'p.' + id;
    var usa = x.act && us.some(function (u) { return u.ep === x.act; });
    return '<details class="sub n2" data-g="' + g + '"' + atrX(x) + ' data-parte="' + id + '"' + (U.get(x.sec, 'g.' + g, !!usa) ? ' open' : '') + '><summary class="fil-r"><span class="t">' + esc('Libro ' + romano(p.n)) +
      '</span><span class="d' + claseUso(us, x.act) + '">' + esc((et ? et + ' · ' : '') + p.capitulos + ' cap. · ' + miles(p.palabras) + ' pal.') + '</span></summary><div class="lector"></div></details>';
  }
  function norm(t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
  function libroDe(o) { return (D().libros || []).filter(function (l) { return l.obraId === o.id || norm(l.titulo) === norm(o.nombre); })[0]; }
  function filaObra(o, x) {
    x = x || { sec: S, act: 0, pref: '' };
    var l = libroDe(o);
    if (!l) return U.fila(o.nombre, o.estMin + '–' + o.estMax + ' ep.', '');
    var pal = l.partes.reduce(function (a, p) { return a + p.palabras; }, 0), usados = l.partes.filter(function (p) { return usos(l.id + '-l' + p.n).length; }).length, g = x.pref + 'obra.' + o.id;
    return '<details class="sub n1" data-g="' + g + '"' + atrX(x) + (U.get(x.sec, 'g.' + g, true) ? ' open' : '') + '><summary class="fil-r"><span class="t">' + esc(o.nombre) + '</span><span class="d ac">' + esc(usados + ' de ' + l.partes.length + ' libros en episodios') + '</span></summary>' +
      '<p class="mut peq nota">' + esc(l.autor + ' · ' + miles(pal) + ' palabras. ' + (l.nota || '')) + '</p>' + l.partes.map(function (p) { return filaParte(l, p, x); }).join('') + '</details>';
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
      guardar();
    }).catch(function (e) { estado = 'No se pudo leer el PDF: ' + (e.message || e); pintarImportar(); });
  }
  function guardar() {
    if (!pend) return;
    var p = pend, hoy = new Date().toISOString(), i = 0;
    var libro = { titulo: p.titulo, autor: p.autor, archivo: p.archivo, importado: hoy, nota: 'Se han quitado los resúmenes del editor; en los libros que no son el primero la limpieza es automática y aproximada.',
      partes: p.res.partes.map(function (pt) { return { n: pt.n, titulo: pt.titulo, capitulos: pt.capitulos.length, palabras: pt.palabras, caps: pt.capitulos.map(function (c) { return c.palabras; }) }; }) };
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
    var pal = pend ? pend.res.partes.reduce(function (a, p) { return a + p.palabras; }, 0) : 0;
    var txt = pend ? pend.res.partes.length + ' libros · ' + miles(pal) + ' pal.' + (estado ? ' · ' + estado : '') : estado;
    c.innerHTML = '<span class="t mut peq">' + esc(txt) + '</span>' + U.accion('Importar libro', 'data-lib-imp="1"') + '<input id="imp-file" type="file" accept="application/pdf" hidden>';
  }

  function biblioteca(el) {
    host = el; pintar();
    el.onclick = function (ev) {
      var b = ev.target.closest('button[data-lib-imp]'); if (b) { var f = document.getElementById('imp-file'); if (f) f.click(); }
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
    var h = '<div class="fil-r" id="imp"></div>';
    h += U.grupo(S, 'obras', 'Obras', obras.length, obras.map(function (o) { return filaObra(o); }).join(''), true);
    h += U.grupo(S, 'conceptos', 'Conceptos', conceptos.length, conceptos.map(function (c) { return U.fila(c.nombre, (c.obras || []).map(nombreObra).join(', '), ''); }).join(''), false);
    host.innerHTML = h; pintarImportar();
    host.querySelectorAll('details[data-parte][open]').forEach(pintarParte);
  }
  document.addEventListener('toggle', function (ev) {
    var d = ev.target; if (d && d.tagName === 'DETAILS' && d.dataset.parte && d.open) pintarParte(d);
  }, true);

  /* Ficha del episodio: la misma vista que Biblioteca como acceso directo; este episodio en amarillo y los demás en otro color. */
  function origen(e, el) {
    if (!el) return;
    var fs = e.fuentes || [], cif = fs.length ? clasificar(e).linea.split(' · ')[0] : 'Sin marcar';
    var o = (D().obras || []).filter(function (x) { return x.id === e.obraId; })[0], x = { sec: 'episodio', act: numEp(e), pref: 'o.' + e.id + '.' };
    var cuerpo = (o && libroDe(o)) ? '<p class="mut peq nota">' + esc(fs.length ? clasificar(e).linea : 'Aún no hay tramo del libro marcado para este episodio') + '. En amarillo, este episodio; en azul, los demás.</p>' + filaObra(o, x) : '<p class="mut peq nota">Este episodio aún no tiene un libro subido en Biblioteca.</p>';
    el.innerHTML = U.grupo('episodio', 'origen', 'Texto de origen', cif, cuerpo, true);
    el.querySelectorAll('details[data-parte][open]').forEach(pintarParte);
  }

  /* Clasificación del episodio por libro: título, capítulos de donde sale y porcentaje aproximado del libro. */
  function clasificar(e) {
    var fs = e.fuentes || [];
    if (!fs.length) return { libro: nombreDeObra(e) || 'Sin libro', linea: e.pasajes || '' };
    var id = String(fs[0].texto).split('-l')[0], lib = (D().libros || []).filter(function (x) { return x.id === id; })[0];
    var caps = fs.map(function (f) { return f.cap; }), mn = Math.min.apply(null, caps), mx = Math.max.apply(null, caps);
    var partes = {}; fs.forEach(function (f) { partes[f.texto] = 1; });
    var ps = Object.keys(partes).map(function (k) { return 'Libro ' + romano(+k.split('-l')[1]); }).join(' y ');
    var linea = ps + ', ' + (mn === mx ? 'cap. ' + mn : 'caps. ' + mn + ' a ' + mx);
    if (lib) {
      var tot = lib.partes.reduce(function (a, p) { return a + p.palabras; }, 0), pal = 0;
      Object.keys(partes).forEach(function (k) {
        var n = +k.split('-l')[1], pt = lib.partes.filter(function (x) { return x.n === n; })[0], cs = fs.filter(function (f) { return f.texto === k; }).map(function (f) { return f.cap; });
        if (!pt) return;
        if (pt.caps) { for (var c = Math.min.apply(null, cs); c <= Math.max.apply(null, cs); c++) pal += pt.caps[c - 1] || 0; }
        else pal += fs.filter(function (f) { return f.texto === k; }).reduce(function (a, f) { return a + (f.fin - f.ini); }, 0) / 6;
      });
      if (tot) linea += ' · ' + (Math.round(pal / tot * 1000) / 10).toString().replace('.', ',') + ' % del libro';
    }
    return { libro: lib ? lib.titulo : (nombreDeObra(e) || 'Sin libro'), linea: linea };
  }
  function nombreDeObra(e) { var o = (D().obras || []).filter(function (x) { return x.id === e.obraId; })[0]; return o ? o.nombre : ''; }
  function romano(n) { return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] || String(n); }
  window.WARLIBROS = { biblioteca: biblioteca, origen: origen, clasificar: clasificar };
})();
