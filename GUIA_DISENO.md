# Guía de diseño — común a todos los subproyectos con interfaz

El diseñador es uno solo y recuerda lo que decido. Antes de tocar una pantalla, se lee esta guía y se mira cómo está hecho el mismo elemento en otras pantallas. Si no existe en otro sitio, no se inventa.

1. **Seleccionado o marcado** = solo un borde del color de acento, con el fondo normal. Nunca relleno de color ni fondo oscuro.
2. **Sin flechas ni triángulos** (▾ ▸) en filas, **sin emojis** y sin subrayados que no sean enlaces. Lo que se abre se toca en su propio texto y se despliega ahí mismo, debajo, sin ventanas ni botones de «ver ficha».
3. **Móvil primero:**
   - un campo por línea;
   - nada de tablas ni rejillas de varias columnas: cada línea con la etiqueta a la izquierda y el importe a la derecha.
4. **Pastillas** del ancho de su texto, con aire a los lados. Nunca estiradas ni partidas en dos líneas.
5. **Colores con significado:**
   - verde = positivo o ingreso; rojo = negativo o gasto, decidido por el signo;
   - lo neutro, de un solo color;
   - un color no se usa para dos cosas.
6. **Consistencia:**
   - un mismo objeto se enseña con la misma tarjeta en toda la app, reutilizando la función y no una copia;
   - dentro de un grupo, todas las tarjetas son iguales;
   - todas las cabeceras de un mismo tipo llevan lo mismo (p. ej. título, número y total; en el ordenador, además, el desglose).
7. **No añadir** botones, avisos ni controles que no existan ya en otra pantalla o que yo no haya pedido. No repetir apartados: si algo ya está dentro de otro, no va aparte.
8. **Poca altura en el móvil:**
   - lo mínimo por tarjeta, con el texto largo plegado;
   - los filtros plegados, enseñando solo lo elegido;
   - todos los apartados se pueden plegar, y se recuerda cómo se dejaron;
   - no repetir lo que ya dice el título del grupo.
9. **Números:**
   - los totales y resúmenes van sin céntimos;
   - las líneas de un documento, con céntimos;
   - unidades separadas y en minúscula (6 h, 12 m³).
10. **Textos:**
    - siempre empiezan en mayúscula;
    - en registro profesional;
    - nunca expresiones coloquiales ni copiadas de cómo hablo.
11. **Filtros, orden y pestañas** se recuerdan en el servidor, no solo en el navegador.
12. **Lo que se arregla en un sitio** se revisa en todos los equivalentes antes de darlo por hecho.
13. **Antes de publicar**, se ve la pantalla a 390 px con datos reales, y en el ordenador si también se usa ahí, y se comprueba que lo que se despliega, despliega.
14. **Ninguna pantalla se queda «calculando» al entrar:** se enseña lo último calculado y se pone al día por detrás.
15. **Esta guía crece.** Cada vez que diga «esto me gusta» o «esto no» sobre diseño, se añade aquí en el mismo caso y se añade su comprobación a `herramientas/lint_diseno.py` (código) o a `herramientas/auditoria.js` (pantalla real).
