# Asistente de WAR (sin IA)

El asistente no usa IA ni claves. Su motor es local (js/asistente.js) y aprende de datos que enseña Claude en el chat. Solo el ejecutor central escribe, y solo tras confirmar.

Datos (tabla war_docs, coleccion):
- asistente_reglas: {nombre, tipo (tarea|nota|estado|cierre|consulta), patron (expresión regular sobre el texto en minúsculas y sin acentos), datos (por ejemplo {"titulo":"$1","categoria":"Libros"}), activa}
- asistente_vocab: {palabra, campo:"categoria", valor} (se aprende solo al corregir el tipo de una tarea; Claude también puede añadirlas)
- asistente_peticiones: historial de cada petición
- asistente_entradas: cola de lo subido, para que Claude la revise
- notas: notas guardadas desde el asistente

Cada conversación: leer asistente_entradas pendientes y las peticiones con tareas «sinentender»; enseñar reglas nuevas con execute_sql (insert en war_docs) y marcar las entradas como verificadas con un campo resultado.
