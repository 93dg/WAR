/* WAR · Núcleo de lectura de libros: convierte las líneas de un PDF en partes, capítulos y párrafos limpios.
   Es una función pura (sin pantalla) para poder probarla fuera del navegador. */
(function (root) {
  'use strict';

  var FIN_FRASE = /[.:?!»;)]$/;
  /* Los resúmenes del editor hablan de «capítulo» o nombran a Aristóteles en tercera persona; el texto de Aristóteles no. */
  function esResumenEditor(p) { return /cap[íi]tulo/i.test(p) || /Aristóteles/.test(p); }

  /* paginas: lista de páginas; cada página, lista de {x, y, str} de pdf.js. */
  function lineasDe(paginas) {
    var lineas = [];
    paginas.forEach(function (items, pi) {
      var filas = [];
      items.forEach(function (it) {
        if (it.y < 60) return;                       // pie de página con el número
        var f = filas.filter(function (r) { return Math.abs(r.y - it.y) < 2; })[0];
        if (!f) { f = { y: it.y, partes: [] }; filas.push(f); }
        f.partes.push(it);
      });
      filas.sort(function (a, b) { return b.y - a.y; });
      filas.forEach(function (f, i) {
        f.partes.sort(function (a, b) { return a.x - b.x; });
        var txt = f.partes.map(function (p) { return p.str; }).join('').replace(/\s+/g, ' ').trim();
        if (!txt) return;
        var ant = filas[i - 1];
        lineas.push({ txt: txt, primera: i === 0, nuevoPar: !!ant && (ant.y - f.y) > 25 });
      });
    });
    return lineas;
  }

  function parsear(paginas, opc) {
    opc = opc || {};
    var lineas = lineasDe(paginas), partes = [], parte = null, cap = null, par = null, fin = false, quitados = 0;
    function cerrarPar() {
      if (par && cap) cap.parrafos.push(par.txt);
      par = null;
    }
    lineas.forEach(function (l) {
      if (fin) return;
      var mp = /^Parte (\d+)\.\s*(.+)$/.exec(l.txt);
      if (mp) { cerrarPar(); parte = { n: +mp[1], titulo: mp[2], capitulos: [] }; partes.push(parte); cap = null; return; }
      var mt = /^Capítulo (\d+)(?:\.\s*(.*))?$/.exec(l.txt);
      if (mt && parte) { cerrarPar(); cap = { n: +mt[1], titulo: mt[2] || '', parrafos: [], enTitulo: true }; parte.capitulos.push(cap); return; }
      if (!cap) return;
      if (cap.enTitulo) { if (!l.nuevoPar && !l.primera && cap.titulo !== '' && !/^[A-ZÁÉÍÓÚ¿¡]/.test(l.txt) && cap.parrafos.length === 0) { cap.titulo += ' ' + l.txt; return; } cap.enTitulo = false; }
      if (/^Aristóteles \(en griego/.test(l.txt)) { cerrarPar(); fin = true; return; }   // biografía final del PDF
      if (par && !l.nuevoPar && !l.primera) { par.txt += ' ' + l.txt; return; }
      if (par && l.primera && !l.nuevoPar && !FIN_FRASE.test(par.txt)) { par.txt += ' ' + l.txt; return; }
      cerrarPar(); par = { txt: l.txt };
    });
    cerrarPar();
    /* Una línea que empieza una página y sigue una frase sin cerrar ya se unió arriba; ahora se quitan los resúmenes del editor. */
    partes.forEach(function (pt) {
      pt.capitulos.forEach(function (c) {
        var ps = c.parrafos.slice(), editor = [];
        c.todos = opc.depurar ? ps.slice() : undefined;
        var primero = opc.depurar ? -1 : ps.findIndex(esResumenEditor);
        if (primero >= 2) { editor = ps.slice(primero); ps = ps.slice(0, primero); }          // resumen al final del capítulo
        else if (primero >= 0) { editor = ps.filter(esResumenEditor); ps = ps.filter(function (p) { return !esResumenEditor(p); }); }   // resumen al principio
        c.quitados = editor.length;
        c.editor = editor;
        quitados += editor.length;
        c.texto = ps.join('\n\n');
        c.palabras = (c.texto.match(/\S+/g) || []).length;
        delete c.parrafos;
      });
      pt.palabras = pt.capitulos.reduce(function (a, c) { return a + c.palabras; }, 0);
    });
    return { partes: partes, quitados: quitados };
  }

  root.WARLIBROSNUCLEO = { parsear: parsear, lineasDe: lineasDe };
  if (typeof module !== 'undefined') module.exports = root.WARLIBROSNUCLEO;
})(typeof window !== 'undefined' ? window : globalThis);
