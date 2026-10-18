#!/usr/bin/env python3
"""Auditoría de pantallas: abre la web REAL a 390 px (móvil) con datos reales, recorre las vistas
y aplica auditoria.js (texto en minúscula al principio, texto corto partido en dos líneas, texto
que se sale, marcado con fondo oscuro, botón de icono con círculo, lupa en medio de su línea).
Solo bloquea lo NUEVO respecto a herramientas/auditoria_baseline.json.
Necesita: pip install playwright && playwright install chromium (o un Chromium ya instalado).
Uso:  python3 herramientas/auditoria_pantallas.py [--todo] [--baseline]
      SOLO=vista python3 herramientas/auditoria_pantallas.py --todo
AJUSTAR: URL, VISTAS y cómo se entra (sesión) para cada proyecto."""
import asyncio, json, os, sys, time, threading, http.server, functools
from playwright.async_api import async_playwright

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUERTO = 8768
# AJUSTAR: página que se audita (se sirve la carpeta del proyecto en local) y vistas.
# Cada vista es un trozo de JS que la abre (clic en su botón, cambio de hash, etc.).
PAGINA = f'http://localhost:{PUERTO}/index.html'   # WAR: se audita index.html
VISTAS = {
    'inicio': "",
    # 'ventas': "document.querySelector('[data-view=ventas]')?.click()",
}
# AJUSTAR: si la web necesita sesión, inyectarla aquí (localStorage, cookie...). Nunca guardar secretos en el repo.
INICIO_SESION_JS = ""
ESPERA_MS = 8000

class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
threading.Thread(target=http.server.ThreadingHTTPServer(("", PUERTO), functools.partial(Q, directory=RAIZ)).serve_forever, daemon=True).start()

AUD = open(os.path.join(RAIZ, 'herramientas', 'auditoria.js'), encoding='utf-8').read()
BASE = os.path.join(RAIZ, 'herramientas', 'auditoria_baseline.json')
DESC = {'minuscula': 'Texto que empieza en minúscula', 'partido': 'Texto corto partido en dos líneas', 'desborda': 'Texto que se sale de la pantalla',
        'circulo': 'Botón de solo icono con círculo o borde alrededor', 'marcado': 'Algo marcado con fondo oscuro (solo borde de color)', 'lupa': 'Lupa que no está en un extremo de su línea'}
NUNCA = ('minuscula', 'marcado', 'circulo', 'lupa')   # estas no se toleran ni aunque vinieran de antes

async def main():
    res, errs = [], []
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=os.environ.get('CHROMIUM') or None)
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True)
        if INICIO_SESION_JS: await ctx.add_init_script(INICIO_SESION_JS)
        for nombre, js in VISTAS.items():
            if os.environ.get('SOLO') and nombre != os.environ['SOLO']: continue
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
            await pg.goto(PAGINA); await pg.wait_for_timeout(ESPERA_MS)
            if js: await pg.evaluate(js); await pg.wait_for_timeout(2500)
            prev, quieto, t0 = -1, 0, time.time()
            while time.time() - t0 < 20:   # espera a que la pantalla deje de cambiar (datos cargados)
                n = await pg.evaluate("document.body.innerText.length"); quieto = quieto + 1 if n == prev else 0
                if quieto >= 3: break
                prev = n; await pg.wait_for_timeout(800)
            for x in await pg.evaluate(AUD): res.append({'vista': nombre, 'regla': x[0], 'txt': x[1]})
            await pg.close()
        await b.close()
    return res, errs

res, errs = asyncio.run(main())
if errs: print('Errores de JavaScript en la página:', errs[:5])
c = {}
for x in res: k = x['vista'] + '|' + x['regla']; c[k] = c.get(k, 0) + 1
if '--todo' in sys.argv:
    for x in res: print(x['regla'], x['vista'], '|', x['txt'])
if '--baseline' in sys.argv:
    json.dump(c, open(BASE, 'w'), indent=0); print('baseline de pantallas guardada:', sum(c.values())); sys.exit(0)
base = json.load(open(BASE)) if os.path.exists(BASE) else {}
malos = [k for k, v in c.items() if v > (0 if k.split('|')[1] in NUNCA else base.get(k, 0))]
if malos or errs:
    print('❌ PANTALLAS: aparece algo nuevo que incumple la guía:')
    for k in malos:
        vi, r = k.split('|'); print(' -', DESC[r], '| vista', vi, '| antes', base.get(k, 0), 'ahora', c[k])
        for x in res:
            if x['vista'] == vi and x['regla'] == r: print('     ·', x['txt'])
    sys.exit(1)
print('✓ Pantallas: nada nuevo que incumpla la guía (por repasar de antes:', len(res), ')')
