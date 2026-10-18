# ARRANQUE — leer antes de hacer nada (cualquier chat, cualquier modelo)

Subproyecto: **war** · Base: **Supabase qtnqupcfgooazjzkpmtx (DGP)** (tablas con prefijo `war_`) · Web: **GitHub 93dg/war**, publicada con GitHub Pages en **https://93dg.github.io/war/**

Cómo funcionamos: Claude trabaja con el conector de Supabase (datos y memoria del método) y con el repositorio de GitHub (la web). El chat no es memoria. Ver ARQUITECTURA.md.

La memoria de este proyecto vive en la base de datos, no en el chat. Si el chat es nuevo, largo o resumido, da igual: se sigue esto.

1. **Abrir caso:**
   - `select preparar_tarea('war', 'orden', array['Sección'], 'ejecucion');`
   - Leer la salida ENTERA y llamar a `confirmar_guia(caso_id, clave, reglas que aplican)`.
2. **Antes de tocar una sección:** `select memoria_seccion(caso_id, 'Sección');`. Leerla entera.
3. **Seguridad del 80 %:** por debajo, una sola pregunta con la propuesta escrita.
4. **Bandeja en cada mensaje:** `select bandeja('war');`. Decir al final si hay algo que hacer.
5. **Escribir datos:** antes, `set local metodo.caso_id = '<caso_id>';`.
6. **Lo que digo se guarda en el mismo turno:** `anotar_hecho(tema, hecho, palabras)`. Si es un patrón, también `anotar_regla(...)`.
7. **Nunca enviar nada en mi nombre** sin enseñar el borrador y mi «sí».
8. **Publicar:** `./herramientas/publicar.sh VERSION "mensaje" CASO_ID`. Después, `cerrar_tarea(...)`.
9. **Cada respuesta termina** con `VX.YY · Método v1.0 · WAR`.

Reglas propias de este subproyecto (además de las comunes):
- WAR significa Web AR: la web de la serie «Aristóteles, filosofía para las noches».
- Técnica cero: todo lo que se escribe debe entenderlo cualquiera, incluso un niño. Solo citas cortas y sencillas; el episodio puede acabar con una frase para pensar o dormir.
- Los datos de la web viven en tablas `war_*` del Supabase DGP. En la web solo la clave pública; ningún secreto en el repositorio.
- El contenido de la serie ya existente (obras, conceptos, episodio 1) está en el artefacto privado de claude.ai y se migrará a `war_*` cuando se decida el modelo de acceso.
