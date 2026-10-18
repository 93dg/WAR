#!/bin/bash
# Publicar con el MÉTODO. Uso: ./herramientas/publicar.sh V1.05 "qué cambia" CASO_ID
# No se publica nada que no respalde un caso abierto con la guía confirmada, la memoria
# de lo que se toca consultada y la versión objetivo igual a la que se publica.
# Ajustado para WAR (Supabase DGP, clave pública anon). Antes: SUPABASE_URL, SUPABASE_ANON_KEY (clave pública, nunca la de servicio), dónde se pinta la versión y cómo se publica.
set -e
VERSION=$1; MSG=$2; CASO_ID=$3
SUPABASE_URL="${SUPABASE_URL:-https://qtnqupcfgooazjzkpmtx.supabase.co}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0bnF1cGNmZ29vYXpqemtwbXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3Njc5MTMsImV4cCI6MjEwNDM0MzkxM30.Hty-9YdAoscBBi4Ic3nCrY1aZEWU4pIkx3jMNNXhWOw}"

if [ -z "$VERSION" ] || [ -z "$MSG" ] || [ -z "$CASO_ID" ]; then
  echo "Uso: ./herramientas/publicar.sh V1.XX 'mensaje' CASO_ID"; exit 1; fi
# Versión Vmayor.NN: tras X.99 va (X+1).00, nunca X.100
if ! echo "$VERSION" | grep -qE '^V[0-9]+\.[0-9]{2}$'; then
  echo "❌ Versión inválida '$VERSION' (formato Vmayor.NN)"; exit 1; fi

CHECK=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/verificar_publicacion" \
  -H "apikey: ${SUPABASE_ANON_KEY}" -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" -H "Content-Type: application/json" \
  -d "{\"p_caso_id\":\"${CASO_ID}\",\"p_version\":\"${VERSION}\"}")
if ! echo "$CHECK" | grep -qE '"ok":[[:space:]]*true'; then echo "❌ El método bloqueó la publicación: $CHECK"; exit 1; fi
echo "✓ Caso ${CASO_ID} abierto, guía confirmada, versión ${VERSION}"

python3 herramientas/sintaxis_js.py   || { echo "❌ Bloqueado: error de sintaxis"; exit 1; }
python3 herramientas/lint_diseno.py   || { echo "❌ Bloqueado: incumple la guía de diseño"; exit 1; }
if [ -f herramientas/auditoria_pantallas.py ] && [ "${SIN_AUDITORIA:-0}" != "1" ]; then
  python3 herramientas/auditoria_pantallas.py || { echo "❌ Bloqueado por la auditoría de pantallas"; exit 1; }
fi

# AJUSTAR: dónde se muestra la versión en la web (un elemento con id="version")
python3 - "$VERSION" <<'PY'
import re, sys, os
v = sys.argv[1]
for f in ['index.html']:
    if not os.path.exists(f): continue
    s = open(f, encoding='utf-8').read()
    s = re.sub(r'(id="version"[^>]*>)V[\d.]+(<)', r'\g<1>' + v + r'\2', s)
    open(f, 'w', encoding='utf-8').write(s)
print('Versión puesta en la web:', v)
PY

git add -A
git diff --cached --quiet || git commit -m "${VERSION} — ${MSG}"
git push origin HEAD

curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/marcar_version_publicada" \
  -H "apikey: ${SUPABASE_ANON_KEY}" -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" -H "Content-Type: application/json" \
  -d "{\"p_caso_id\":\"${CASO_ID}\",\"p_version\":\"${VERSION}\"}"; echo
# Nunca decir «publicado» sin comprobar que la web ya está al día
[ -x herramientas/estado_publicacion.sh ] && ./herramientas/estado_publicacion.sh "$(git rev-parse HEAD)" 240 || true
echo "Ahora: cerrar_tarea(caso, resultado, cambios, pruebas, aprendizaje)."
