# Guía de diseño y formato

Reglas decididas por el usuario corrigiendo pantallas. No son sugerencias: se cumplen todas, en todas las pantallas. Lo que más le molesta: el espacio desperdiciado, lo mal acabado y los textos largos o repetidos. Antes de tocar una pantalla se lee esta guía y se mira cómo está hecho el mismo elemento en otras. Si no existe en otro sitio, no se inventa.

## 1. Espacio: poca altura y poco scroll
- Móvil primero (iPhone). Todo cabe a 390 px, sin desbordar ni scroll lateral.
- Densidad: lo mínimo por tarjeta y por fila. Sin márgenes ni rellenos generosos, tarjetas altas, botones anchos ni cajas grandes para un dato.
- Una línea por dato: etiqueta a la izquierda y valor a la derecha. Una fila plegada enseña solo título y cifra; el resto, al desplegar.
- Un campo por línea en los formularios del móvil.
- Sin tablas en el móvil: tarjetas o filas. Tabla solo con pocos datos a lo ancho.
- Todo apartado se puede plegar y se recuerda cómo se dejó.
- Los filtros salen plegados, enseñando solo lo elegido en una pastilla («Plazo 1M»); al abrirla, opciones en línea.
- Nada de menús, pestañas o selectores de más. Si una opción equivale a otra, sobra una.
- En el ordenador se aprovecha el ancho; nunca se ve roto ni estirado.

## 2. Textos
- Cortos y profesionales; siempre empiezan en mayúscula; nada coloquial ni copiado de cómo habla el usuario.
- Sin repetir: el nombre de una sección no se repite dentro de ella (título grande, descripción, panel, botones). Lo que dice el título de un grupo no se repite en cada tarjeta. Un dato que sale en una fila no sale en otra.
- Sin relleno («Aquí puedes ver…», «Pulsa para…») ni descripciones bajo los títulos.
- Ningún texto partido en dos líneas si debería caber en una (título, pastilla, cifra con unidad). Si no cabe, se acorta.
- Botones con palabras justas: «Editar», «Quitar», «Pagado». Nada de «Ver» delante.

## 3. Elementos visuales
- Sin emojis en ningún sitio. Iconos en SVG.
- Sin flechas ni triángulos en filas, y sin subrayados. Lo tocable se distingue por el color de acento.
- Seleccionado o marcado = solo un borde del color de acento, fondo normal. Nunca relleno.
- Ningún botón de acción relleno de acento. Todos con borde, fondo claro y mismo aspecto.
- Dentro de las tarjetas, sin botones grandes: las acciones van como una palabra en color de acento y negrita.
- Botones de icono: solo el SVG en color de acento, sin círculo ni caja.
- Pastillas del ancho de su texto, con aire a los lados; nunca estiradas ni partidas; sin puntitos dentro.
- Formas con curvas: cajas, tarjetas y botones redondeados.
- Lo que se abre se despliega ahí mismo, debajo de su fila. Sin ventanas encima ni «Ver ficha», salvo necesidad real.

## 4. Colores y números
- Los colores tienen significado: verde = positivo o bueno; rojo = negativo, gasto o deuda, por el signo. Lo neutro, de un solo color. Un color nunca vale para dos cosas.
- Los números llevan color.
- Totales y resúmenes sin céntimos; importes concretos con céntimos.
- Formato español: 1.234,56 €, fechas dd/mm.
- Unidades separadas y en minúscula: 6 h, 12 m³.
- Periodos cortos: 1S, 1M, 2M, 3M, 1A, Todos.
- Gráficos grandes y rellenos, con todos los datos dentro (nombre, cifra, %). Nada de anillos pobres.

## 5. Consistencia (lo más importante)
- Un mismo objeto se enseña siempre con la misma tarjeta, reutilizando el componente o función.
- Dentro de un grupo, todas las tarjetas son iguales. Las cabeceras del mismo tipo llevan lo mismo (título, número y total; en ordenador, además, el desglose).
- Todos los filtros funcionan igual: el mismo componente de pastilla plegable, con las mismas abreviaturas.
- Lo que se arregla en una pantalla se arregla en todas las equivalentes antes de darlo por hecho: se piensa para la familia de pantallas.
- No repetir apartados: un dato vive en un solo sitio y los demás lo leen de ahí.
- No inventar elementos que no existan en otra pantalla o que no se hayan pedido. Antes de añadir algo a una tarjeta, mirar lo que ya trae y sustituirlo, no dejar los dos.
- No cambiar ni quitar lo que estaba bien sin que se pida.
- Los botones y pestañas no se mueven de sitio al marcarlos.

## 6. Comportamiento
- Sin zoom al escribir en el móvil: cajas de texto a 16 px como mínimo. La pantalla no cambia de tamaño al salir el teclado.
- Intro en una caja de texto es cambio de línea, no enviar. Se envía con el botón.
- Cada sección recuerda cómo se dejó (pestaña, filtros, orden, apartados plegados), mejor en el servidor.
- Lo que se ve al cargar ya es lo definitivo: nada que aparezca y se esconda, nada «calculando»; se enseña lo último y se actualiza por detrás.
- Ligera y rápida, sin parches de esconder cosas viejas bajo las nuevas.
- Lo que llega se ve al momento, sin recargar.
- Guardar nunca cambia de sección.
- Todo archivo se ve dentro de la web (PDF, imágenes, Excel); descargar es un extra.
- «Seleccionar todos» no va dentro de los filtros: solo aparece cuando ya hay algo marcado, en su propia línea encima de la lista.

## 7. Cómo trabajar con el usuario en diseño
- Antes de un cambio grande: dos o tres líneas con lo entendido y esperar su «sí».
- No actuar por debajo del 80 % de seguridad: una sola pregunta con la propuesta escrita.
- Si pide opciones, una cosa bien pensada, no cinco.
- Una cruz o tachón sobre algo en una captura significa quitarlo, no mejorarlo.
- Antes de enseñar, comprobarlo en pantalla real a 390 px y en el ordenador, con datos reales: que nada se sale, nada se parte y lo que se despliega, despliega.
- Todo gusto o «esto no» se añade aquí en el momento y, si se puede, con su comprobación automática en `herramientas/lint_diseno.py` (código) o `herramientas/auditoria.js` (pantalla real). La publicación se bloquea si se incumple.
