/* WAR · Prompts de Suno: varios para probar, con estado (Probando, Me gusta, Descartado), copiar y editar. Viven dentro del texto para Suno del episodio. */
(function () {
  'use strict';
  var W = window.WAR, U = window.WARUI, esc = W.esc, edit = null, aviso = '', repintar = function () {};
  var ESTADOS = ['Probando', 'Me gusta', 'Descartado'];

  function lista() { return (W.datos().prompts || []).slice().sort(function (a, b) { return (a.creado || '') < (b.creado || '') ? -1 : 1; }); }
  function porId(id) { return lista().filter(function (p) { return p.id === id; })[0]; }
  function clase(e) { return e === 'Me gusta' ? ' bien' : e === 'Descartado' ? ' venc' : ''; }

  function guardar(p) {
    var d = Object.assign({}, p); delete d.id;
    return W.sb.from('war_docs').upsert({ coleccion: 'prompts', id: p.id, datos: d, actualizado: new Date().toISOString() }).then(function (r) {
      if (r && r.error) throw new Error(r.error.message);
      var L = W.datos().prompts = (W.datos().prompts || []).filter(function (x) { return x.id !== p.id; }); L.push(p);
    });
  }
  function quitar(id) {
    return W.sb.from('war_docs').delete().eq('coleccion', 'prompts').eq('id', id).then(function (r) {
      if (r && r.error) throw new Error(r.error.message);
      W.datos().prompts = (W.datos().prompts || []).filter(function (x) { return x.id !== id; });
    });
  }

  function formulario() {
    return '<div class="fil-c" style="margin:0 14px"><label for="pr-n">Nombre</label><input id="pr-n" value="' + esc(edit.nombre) + '"></div>' +
      '<div class="fil-c" style="margin:0 14px"><label for="pr-t">Prompt</label><textarea id="pr-t" rows="7">' + esc(edit.texto) + '</textarea></div>' +
      '<div class="fil-c" style="margin:0 14px"><label for="pr-o">Nota</label><input id="pr-o" value="' + esc(edit.nota) + '"></div>' +
      '<div class="fil-c" style="margin:0 14px"><label for="pr-e">Estado</label><select id="pr-e">' + ESTADOS.map(function (e) { return '<option' + (e === edit.estado ? ' selected' : '') + '>' + e + '</option>'; }).join('') + '</select></div>' +
      '<div class="fil-r">' + U.accion('Guardar', 'data-pr="guardar"') + U.accion('Cancelar', 'data-pr="cancelar"') + '</div>';
  }
  function filaPrompt(p) {
    return '<details class="sub"><summary class="fil-r"><span class="t">' + esc(p.nombre) + '</span><span class="d' + clase(p.estado) + '">' + esc(p.estado) + '</span>' + U.accion('Copiar', 'data-pr="copiar" data-id="' + esc(p.id) + '"') + '</summary>' +
      '<div class="cuerpo">' + esc(p.texto) + (p.nota ? '\n\n' + esc(p.nota) : '') + '</div>' +
      '<div class="fil-r">' + U.accion('Editar', 'data-pr="editar" data-id="' + esc(p.id) + '"') + U.accion('Quitar', 'data-pr="quitar" data-id="' + esc(p.id) + '"') + '</div></details>';
  }
  /* Contenido de los prompts para el apartado Texto para Suno. */
  function html() {
    var L = lista();
    if (edit) return formulario() + (aviso ? '<p class="mut peq nota">' + esc(aviso) + '</p>' : '');
    return L.map(filaPrompt).join('') + '<div class="fil-r">' + (L.length ? '' : '<span class="t mut">Sin prompts</span>') + U.accion('Añadir', 'data-pr="nuevo"') + '</div>' + (aviso ? '<p class="mut peq nota">' + esc(aviso) + '</p>' : '');
  }
  function copiar(txt, b) {
    function ok() { b.textContent = 'Copiado'; setTimeout(function () { b.textContent = 'Copiar'; }, 1500); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, fallback); else fallback();
    function fallback() {
      var t = document.createElement('textarea'); t.value = txt; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); ok(); } catch (e) { b.textContent = 'No se pudo copiar'; } document.body.removeChild(t);
    }
  }

  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-pr]'); if (!b || !b.closest('#suno')) return;
    ev.preventDefault(); ev.stopPropagation(); aviso = '';
    var a = b.dataset.pr, p = b.dataset.id ? porId(b.dataset.id) : null;
    if (a === 'copiar' && p) { copiar(p.texto, b); return; }
    if (a === 'nuevo') edit = { id: 'p' + Date.now(), nombre: 'Prompt ' + (lista().length + 1), texto: '', nota: '', estado: 'Probando', creado: new Date().toISOString() };
    else if (a === 'editar' && p) edit = Object.assign({}, p);
    else if (a === 'cancelar') edit = null;
    else if (a === 'guardar') {
      edit.nombre = document.getElementById('pr-n').value.trim() || edit.nombre; edit.texto = document.getElementById('pr-t').value.trim();
      edit.nota = document.getElementById('pr-o').value.trim(); edit.estado = document.getElementById('pr-e').value;
      if (!edit.texto) { aviso = 'Escribe o pega el prompt.'; repintar(); return; }
      var e = edit; edit = null;
      guardar(e).then(repintar).catch(function (x) { edit = e; aviso = 'No se pudo guardar: ' + (x.message || x); repintar(); });
      return;
    } else if (a === 'quitar' && p) { quitar(p.id).then(repintar).catch(function (x) { aviso = 'No se pudo quitar: ' + (x.message || x); repintar(); }); return; }
    repintar();
  }, true);

  window.WARPROMPTS = { html: html, alRepintar: function (f) { repintar = f; }, reiniciar: function () { edit = null; aviso = ''; } };
})();
