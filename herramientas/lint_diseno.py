#!/usr/bin/env python3
"""Control de diseño (GUIA_DISENO.md). publicar.sh lo ejecuta antes de cada publicación.
Solo bloquea lo NUEVO: lo que ya existía se guarda en herramientas/lint_baseline.json (para ir repasándolo).
Regla del método: cada vez que el usuario diga «esto no» sobre diseño, se añade aquí su comprobación.
Uso:  python3 herramientas/lint_diseno.py            (comprueba)
      python3 herramientas/lint_diseno.py --todo     (lista todo lo encontrado)
      python3 herramientas/lint_diseno.py --baseline (guarda lo actual como punto de partida; solo al instalar)"""
import re, sys, json, os
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# AJUSTAR: ficheros del proyecto que se revisan
FICHEROS = ['index.html', 'js/voces.js']
BASE = os.path.join(RAIZ, 'herramientas', 'lint_baseline.json')
FLECHAS = '▾▴▸◂▼▲►◄▶◀⌄⌃›‹'
REGLAS = [
 ('flecha', 'Sin flechas ni triángulos en filas', re.compile('[' + FLECHAS + ']')),
 ('emoji', 'Sin emojis en la interfaz', re.compile('[\U0001F300-\U0001FAFF☀-⛿✀-✔✖-➿]')),
 ('subrayado', 'Sin subrayados que no sean enlaces', re.compile(r'text-decoration\s*:\s*underline|<u[ >]|border-bottom\s*:\s*[^;"}]*dotted', re.I)),
]
# Textos de la interfaz en registro profesional: nunca copiar cómo habla el usuario al dar instrucciones (AJUSTAR la lista)
COLOQUIAL = re.compile(r"\b(?:me toca|te toca|nos toca|cosas|de golpe|un montón|mogollón|follón|chapuz\w*|joder|coño|put[oa]s?|mierda|curro|guay|cutre|o sea|ya te digo)\b", re.I)
COMENT = re.compile(r'(^|[^:])//.*$|/\*.*?\*/|<!--.*?-->')
CSS_BLOQUE = re.compile(r'([^{};<>]{1,200})\{([^{}]{1,500})\}')
SEL = re.compile(r'(?<![\w-])(?:on|active|sel|selected|checked|activo|marcado)(?![\w-])|:checked', re.I)
# AJUSTAR: color de acento del proyecto
FONDO_ACENTO = re.compile(r'(?<![\w-])background(?:-color)?\s*:\s*(?:var\(--accent\)|var\(--orange\)|var\(--bronce\)|orange)(?![\w-])', re.I)

def relleno_en_seleccionado(txt, f):
    out = []
    for m in CSS_BLOQUE.finditer(txt):
        sel, cuerpo = m.group(1), m.group(2)
        if SEL.search(sel) and FONDO_ACENTO.search(cuerpo):
            out.append({'f': f, 'regla': 'relleno-en-seleccionado', 'txt': re.sub(r'\s+', ' ', sel)[-120:]})
    return out

def coloquial(txt, f):
    out = []
    for linea in txt.split('\n'):
        s = COMENT.sub(r'\1', linea)
        if 'base64,' in s: continue
        for m in COLOQUIAL.finditer(s):
            out.append({'f': f, 'regla': 'texto-coloquial', 'txt': s.strip()[max(0, m.start() - 60):m.end() + 60]})
    return out

def hallazgos():
    out = []
    for f in FICHEROS:
        ruta = os.path.join(RAIZ, f)
        if not os.path.exists(ruta): continue
        txt = open(ruta, encoding='utf-8').read()
        out += relleno_en_seleccionado(txt, f) + coloquial(txt, f)
        for linea in txt.split('\n'):
            for clave, _, rx in REGLAS:
                if rx.search(linea):
                    out.append({'f': f, 'regla': clave, 'txt': re.sub(r'\s+', ' ', linea.strip())[:160]})
    return out

def cuenta(h):
    c = {}
    for x in h: c[x['f'] + '|' + x['regla']] = c.get(x['f'] + '|' + x['regla'], 0) + 1
    return c

DESC = {c: d for c, d, _ in REGLAS}
DESC['texto-coloquial'] = 'Texto coloquial: escríbelo en registro profesional'
DESC['relleno-en-seleccionado'] = 'Seleccionado = SOLO borde de color, nunca relleno'

if __name__ == '__main__':
    h = hallazgos(); c = cuenta(h)
    if '--baseline' in sys.argv:
        json.dump(c, open(BASE, 'w'), indent=0); print('baseline guardada:', len(h)); sys.exit(0)
    if '--todo' in sys.argv:
        for x in h: print(x['regla'], x['f'], x['txt'])
    base = json.load(open(BASE)) if os.path.exists(BASE) else {}
    malos = [k for k, v in c.items() if v > base.get(k, 0)]
    if malos:
        print('❌ DISEÑO: se ha AÑADIDO algo que incumple la guía (lint_diseno.py --todo para ver dónde):')
        for k in malos:
            f, r = k.split('|'); print(' -', DESC[r], '| %s | antes %d, ahora %d' % (f, base.get(k, 0), c[k]))
        sys.exit(1)
    print('✓ Diseño: nada nuevo que incumpla la guía (por repasar de antes:', len(h), ')')
