#!/bin/bash
# Espera a que GitHub Pages (Actions) publique el commit y dice si la web ya está al día.
# Uso: ./herramientas/estado_publicacion.sh [SHA] [segundos_max]   — necesita GITHUB_TOKEN en el entorno
# Regla: nunca se dice «publicado» sin que esto termine en ✓.
SHA=${1:-$(git rev-parse HEAD)}; MAX=${2:-240}
REPO=$(git remote get-url origin | sed -E 's#.*github.com[:/]##; s#\.git$##')
FIN=$(( $(date +%s) + MAX ))
while true; do
  R=$(curl -s -m 20 -H "Authorization: Bearer ${GITHUB_TOKEN}" "https://api.github.com/repos/${REPO}/actions/runs?per_page=10" | python3 -c "
import json,sys
d=json.load(sys.stdin); sha=sys.argv[1]
rs=[r for r in d.get('workflow_runs',[]) if r['head_sha'].startswith(sha[:7])]
print('%s %s' % (rs[0]['status'], rs[0]['conclusion']) if rs else 'sin_publicacion None')" "$SHA")
  case "$R" in
    "completed success") echo "✓ Web publicada con ${SHA:0:7}"; exit 0;;
    completed*) echo "✗ La publicación de ${SHA:0:7} falló ($R)"; exit 2;;
  esac
  [ $(date +%s) -ge $FIN ] && { echo "… ${SHA:0:7} sigue esperando ($R)"; exit 1; }
  sleep 15
done
