# Sincronía con Google Calendar (clases regulares + clase muestra)

## Contexto

Caro quiere enterarse de los apartados sin tener que revisar la app a cada rato. Después de comparar opciones (WhatsApp automático, correo, Google Calendar), decidió que la notificación viva directo en su Google Calendar — el calendario mismo es el aviso, no un correo o mensaje aparte:

- **Clases regulares**: en cuanto alguien aparta lugar en una clase que todavía no tiene evento en su calendario, se crea uno. Cada apartado o cancelación siguiente actualiza ese mismo evento con el conteo ("Clase Lunes 7pm · 3 de 6"). Si el conteo baja a 0, el evento se borra — así en su calendario solo aparecen las clases que sí tienen gente apuntada.
- **Clase muestra**: cada cita agendada (spec `docs/superpowers/specs/2026-09-01-clase-muestra-design.md`, ya construido) crea un evento de 1 hora con los datos del prospecto. Si Caro cancela la cita desde el admin, el evento se borra.

Este spec construye sobre la app ya en producción y sobre el spec de clase muestra ya mencionado. No repite decisiones ya tomadas ahí, solo el delta: conectar con Google Calendar y mantener los eventos sincronizados.

## A. Conexión con Google Calendar (una sola vez)

- **Prerrequisito manual (antes de poder implementar esta parte)**: Caro necesita crear un proyecto en Google Cloud, habilitar la API de Calendar, y generar credenciales OAuth (client ID + secret). Es una serie de clics en la consola de Google, no requiere saber programar, pero es un paso fuera de este repo que hace una sola vez. Se le guía paso a paso cuando llegue esa tarea en el plan de implementación.
- **Botón "Conectar Google Calendar"** en la vista admin. Es una sola conexión compartida — sirve tanto para las clases regulares como para clase muestra, así que basta con conectarla una vez sin importar en qué pestaña viva el botón (el plan de implementación decide el lugar exacto). La lleva a la pantalla de permisos de Google.
- **Infraestructura nueva**: Supabase Edge Functions (no existían en este proyecto). Dos endpoints:
  - Uno que arma la URL de autorización de Google y redirige ahí.
  - Uno que recibe el código de vuelta de Google, lo cambia por un *refresh token*, lo guarda, y regresa a Caro a la app con un mensaje de éxito.
- **Guardado del token**: tabla nueva `google_calendar_tokens` (un solo renglón). RLS activo sin ninguna policy — nadie puede leerla ni desde el cliente autenticado ni desde el público; solo la Edge Function, que usa la *service role key* (que ignora RLS), puede leer y escribir ahí.

## B. Sincronizar clases regulares (evento por clase, con conteo en vivo)

- **Disparador**: un trigger en `reservas` (`after insert` y `after delete`) llama —vía `pg_net`— a una Edge Function de sincronización, pasándole el `clase_id` afectado y el conteo actual de reservas para esa clase (calculado ahí mismo en SQL, no en la función, para evitar una vuelta extra a la base de datos).
- **Lógica de la Edge Function**, según el conteo recibido y si esa clase ya tiene un evento guardado (`clases.google_event_id`):
  - Sin evento todavía y conteo > 0: crea un evento nuevo en Google Calendar (fecha/hora de la clase, duración según su horario) con título `Clase [día] [hora] · [conteo] de [cupo]`, y guarda el `event_id` que Google regresa en `clases.google_event_id`.
  - Con evento existente y conteo > 0: actualiza el título de ese mismo evento con el conteo nuevo.
  - Con evento existente y conteo = 0 (todos cancelaron): borra el evento en Google Calendar y limpia `clases.google_event_id`.
- **Cancelar la clase completa** (botón "Cancelar esta clase" que ya existe): al borrar todas sus reservas de un jalón, el trigger de `reservas` se dispara una vez por cada una (Postgres lo hace automático en un `delete` de varias filas), así que el conteo baja hasta 0 solo, sin necesitar lógica aparte, y el evento se borra en el mismo camino ya descrito.
- **Límite conocido**: si dos personas apartan lugar en la misma clase casi al mismo instante (milisegundos de diferencia) y esa clase todavía no tiene evento, existe una ventana muy angosta donde ambas peticiones podrían intentar crear el evento por separado, dejando dos eventos para la misma clase en vez de uno. Dado el volumen real (cupo de 6, negocio boutique), se acepta este riesgo en esta vuelta; si llegara a pasar, Caro borra el duplicado a mano desde Google Calendar.

## C. Sincronizar clase muestra (evento por horario, con lista de personas)

**Actualización (2026-09-11):** la clase muestra no es 1 a 1 — pueden agendar varias personas el mismo horario (es una sesión grupal, igual que las clases regulares). Esto cambia dos cosas respecto al diseño original:

1. **Se elimina la restricción de la base de datos** que impedía dos citas activas en la misma `(fecha, hora)` (`citas_clase_muestra_fecha_hora_activa`, en `supabase/actualizaciones.sql`) — esa restricción asumía slots exclusivos de una sola persona, y ya no aplica. No hay cupo máximo por ahora.
2. **Un evento por horario, no por cita** — mismo patrón que la sección B: en vez de crear un evento nuevo por cada prospecto, todas las citas de un mismo `(fecha, hora)` comparten un solo evento en Google Calendar, cuyo título/descripción se actualiza con la lista de nombres conforme se agenda gente.

- **Al agendar**: un trigger en `citas_clase_muestra` (`after insert`) llama a la Edge Function de sincronización, pasándole `fecha`, `hora`, y la lista de nombres+teléfonos de todas las citas activas para ese `(fecha, hora)` (calculada en SQL, igual que el conteo de la sección B). `citas_clase_muestra` no tiene una tabla de "ocurrencias" separada como sí tiene `clases` — así que el `event_id` se guarda repetido en la columna nueva `google_event_id` de cada cita activa que comparte ese `(fecha, hora)` (ver sección D). La Edge Function busca si alguna cita activa de ese `(fecha, hora)` ya trae `google_event_id` y:
  - Sin evento todavía: crea uno nuevo, título `Clase muestra · [día] [hora] · [N] persona(s)`, descripción con la lista de nombres y teléfonos, y guarda el `event_id`.
  - Con evento existente: actualiza título y descripción con la lista completa actualizada.
- **Al cancelar**: el botón "Cancelar" que ya existe en la vista admin marca `cancelada = true` en esa cita; un trigger (`after update`, cuando `cancelada` cambia de `false` a `true`) llama a la Edge Function con la lista actualizada de ese `(fecha, hora)` (sin la persona que se acaba de cancelar):
  - Si quedan personas: actualiza el evento como arriba.
  - Si ya no queda nadie (N = 0): borra el evento en Google Calendar.

## D. Modelo de datos (nuevo, sobre lo que ya existe)

- `clases.google_event_id` (nuevo, `text`, nullable): qué evento de Calendar corresponde a esa clase, si tiene alguno activo.
- `citas_clase_muestra.google_event_id` (nuevo, `text`, nullable): qué evento de Calendar corresponde al horario `(fecha, hora)` de esa cita. Como varias citas pueden compartir horario (sección C), el mismo `event_id` se repite en todas las citas activas de ese `(fecha, hora)`.
- `google_calendar_tokens` (nueva tabla): `refresh_token`, `updated_at`. Un solo renglón; se sobrescribe si Caro vuelve a conectar.

## E. Autenticación entre los triggers y la Edge Function

Los triggers llaman a la Edge Function vía `pg_net.http_post`, mandando la *anon key* del proyecto (la misma que ya está pública en `app/supabase-client.js` — no es un secreto nuevo) como header de autorización, igual que cualquier llamada normal desde el navegador. La Edge Function usa la *service role key* — esa sí guardada como variable de entorno de la función, nunca en el código ni en el SQL — para leer el token de Google y escribir `google_event_id` de vuelta en las tablas.

## F. Manejo de errores

Si la sincronización falla en cualquier punto (token de Google vencido, Google Calendar caído, error de red), el apartado o la cita ya se guardó en la base de datos antes de que el trigger dispare la llamada — nunca se pierde un registro aunque falle Calendar. No hay reintento automático en esta vuelta: si Caro nota que una clase con gente apuntada no tiene evento, el dato real (quién apartó) siempre vive en la app, no en el calendario.

## Fuera de alcance en esta vuelta

- Reintentos automáticos si falla una llamada a Google Calendar.
- Resolver el límite conocido de la sección B (posible evento duplicado en una carrera de apartados simultáneos).
- Cualquier notificación que no sea a través del propio Google Calendar (correo, WhatsApp) — se descartó explícitamente a favor de esta sola vía.
- Reflejar cambios hechos directamente en Google Calendar de vuelta a la app (ej. si Caro borra un evento a mano desde Google, la app no se entera — sigue mostrando la reserva/cita como activa).
- Bloquear horarios de clase muestra según lo que ya esté ocupado en el Google Calendar personal de Caro por otras razones (ya estaba fuera de alcance en el spec anterior, sigue igual).
- Sincronizar retroactivamente clases o citas que ya tenían gente apuntada antes de que Caro conectara su Google Calendar por primera vez — la sincronía aplica solo hacia adelante, desde el momento en que se conecta.
