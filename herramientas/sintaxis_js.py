# Comprueba que todos los <script> de las páginas y los .js propios se leen sin errores de sintaxis (un error deja la web en blanco).
# Lo llama publicar.sh. Necesita node.
import re, subprocess, sys, tempfile, os
raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGINAS = ['index.html']          # AJUSTAR
CARPETAS_JS = ['js', 'herramientas']  # AJUSTAR
malos = []
def revisar(codigo, nombre):
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as t: t.write(codigo); n = t.name
    r = subprocess.run(['node', '-e', "new Function(require('fs').readFileSync(process.argv[1],'utf8'))", n], capture_output=True, text=True); os.unlink(n)
    if r.returncode: malos.append(nombre + ': ' + (r.stderr.strip().splitlines() or ['?'])[-1][:200])
for f in PAGINAS:
    p = os.path.join(raiz, f)
    if not os.path.exists(p): continue
    s = open(p, encoding='utf-8').read()
    for i, m in enumerate(re.finditer(r'<script(?![^>]*src)(?![^>]*type="(?:application/ld\+json|text/template|module)")[^>]*>([\s\S]*?)</script>', s)):
        revisar(m.group(1), f'{f} script {i}')
for d in CARPETAS_JS:
    dd = os.path.join(raiz, d)
    if not os.path.isdir(dd): continue
    for f in os.listdir(dd):
        if f.endswith('.js') and f != 'auditoria.js':
            revisar(open(os.path.join(dd, f), encoding='utf-8').read(), f'{d}/{f}')
if malos:
    print('❌ JavaScript con errores de sintaxis:'); [print(' -', x) for x in malos]; sys.exit(1)
print('✓ JavaScript sin errores de sintaxis')
