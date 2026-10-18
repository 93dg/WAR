# Cómo funcionamos: Claude → Supabase → GitHub

Todo el trabajo pasa por Claude. Claude tiene acceso a la base de datos, que es el cerebro y la memoria, y desde ahí se construye y publica la web en GitHub. No hay servidores propios ni programas instalados en ningún ordenador.

```
 Yo (móvil o PC, por chat o por dictado)
      │
      ▼
 Claude  ── proyecto en claude.ai, con sus documentos, y sesiones de código en la nube
      │      conectores: Supabase, GitHub, Gmail, Drive… (lo que haga falta en cada subproyecto)
      ▼
 Supabase  ── LA BASE: datos de cada subproyecto + memoria del método (casos, reglas, hechos, tareas, reportes)
      │       funciones SQL, disparadores que hacen el trabajo solos, funciones edge para lo que necesita servidor
      ▼
 GitHub  ── un repositorio por cada subproyecto con web; la web es estática (HTML + JS)
             y se publica con GitHub Pages en cada «git push»; la web lee y escribe en Supabase
```

## 1. Claude

- Trabaja dentro de un **proyecto de claude.ai**. Los documentos del proyecto (ARRANQUE, METODO, GUIA_DISENO) los lee cualquier chat nuevo.
- Para programar usa **sesiones de código en la nube**: clona el repositorio, edita, prueba y publica.
- Habla con la base de datos por el **conector de Supabase**: ejecutar SQL, desplegar funciones edge, crear migraciones.
- Otros conectores según el subproyecto (Gmail, Drive, Calendar…). Antes de hacer algo a mano, mira si un conector lo hace.
- Claude no guarda nada importante en el chat. Lo que importa va a Supabase (memoria) o al repositorio (código).

## 2. Supabase: la base

- **Un único proyecto de Supabase** con:
  - las tablas del método (`sql/01_metodo.sql`), compartidas por todos los subproyectos;
  - las tablas de datos de cada subproyecto. Para que no se mezclen, cada subproyecto lleva el prefijo de su clave (p. ej. `conta_movimientos`, `tienda_pedidos`) o su propio esquema.
- **La lógica vive en la base, no en la web.** Funciones SQL y disparadores hacen el trabajo solos: cerrar tareas cuando se cumple su vínculo, avisar de duplicados, calcular totales. Así la web y Claude ven siempre lo mismo.
- **Funciones edge** para lo que necesita servidor: leer el correo, enviar un correo (solo con mi «sí»), llamar a una API externa. Cada función se protege con su propia clave, guardada en una tabla de claves, nunca en el código.
- **Almacenamiento** para documentos. Lo sensible (certificados, contratos, datos personales) va en almacenamiento privado, con enlaces que caducan.
- **Seguridad:**
  - la web usa solo la clave pública (anon), con políticas RLS;
  - la clave de servicio no sale nunca de Supabase ni de las funciones edge;
  - ningún secreto va en el repositorio ni en el chat.
- **Candado del método:** cuando escribe Claude (por el conector, que entra como `mgmt-api`), la base exige un caso abierto con la guía confirmada y guarda el antes y el después. La web, usada por personas, no se ve afectada.

## 3. GitHub: la web

- **Un repositorio por subproyecto** que tenga interfaz, publicado con **GitHub Pages**. Es web estática: `index.html` y sus `.js`, con Supabase como servidor.
- Se instala como app en el móvil (PWA: `manifest.json` y `sw.js`), sin tienda de aplicaciones.
- **Publicar** es siempre `./herramientas/publicar.sh VERSION "mensaje" CASO_ID`, que:
  1. comprueba en Supabase que el caso está abierto, con la guía confirmada y la versión correcta;
  2. pasa los controles: sintaxis, guía de diseño y pantallas reales a 390 px;
  3. pone la versión en la web, hace commit y `git push`;
  4. marca la versión publicada en Supabase;
  5. espera a que GitHub Pages termine. Hasta entonces no se dice «publicado».
- La versión se ve en la propia web, para saber qué hay publicado.
- La dirección de la web no se da a terceros si la app es privada.

## 4. En el día a día

- Yo escribo o dicto en el chat. También puedo reportar desde la propia web, con el botón de reporte, que guarda texto y captura en `reportes`.
- Claude abre caso, lee la memoria, trabaja sobre Supabase y el repositorio, comprueba, publica y cierra el caso con lo aprendido.
- En cada mensaje, Claude mira la bandeja (`bandeja('clave')`): reportes, tareas que vencen, casos abiertos y, si el subproyecto los tiene, correos o datos pendientes.
