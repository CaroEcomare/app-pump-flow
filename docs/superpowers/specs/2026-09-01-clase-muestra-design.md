# Agendar clase muestra (público, sin cuenta)

## Contexto

Caro quiere que prospectos (gente que todavía no es alumna) puedan agendar una clase muestra directo desde un link que comparte por WhatsApp/redes, sin necesitar cuenta ni login. Ella define de antemano qué horarios tiene libres para esto, y cuando alguien aparta, quiere enterarse — sin depender de revisar la app a cada rato.

Este spec construye sobre la app ya en producción (`docs/superpowers/specs/2026-08-08-conectar-supabase-design.md` y `docs/superpowers/specs/2026-08-11-cuentas-reservas-v2-design.md`). No repite decisiones ya tomadas ahí (arquitectura sin build, Supabase, RLS, cómo se generan las clases regulares), solo el delta.

## A. Cómo llega la notificación: sincronía con Google Calendar

Cada clase muestra agendada crea un evento en el Google Calendar personal de Caro (el que ya usa a diario), vía una función de servidor (Supabase Edge Function — no existían en este proyecto, es infraestructura nueva) que llama a la API de Google Calendar. La notificación "es gratis": llega como cualquier evento nuevo en su calendario, con el push que ya le manda Google al celular.

- **Conexión**: una sola vez, desde un botón "Conectar Google Calendar" en la vista admin, Caro pasa por la pantalla de permisos de Google. El *refresh token* que resulta se guarda en una tabla nueva (`google_calendar_tokens`), sin ninguna policy de lectura para clientes — solo la Edge Function, corriendo con la service role key, puede leerlo. Nadie desde la app (ni siquiera la admin autenticada) puede leer ese token vía la API normal de Supabase.
- **Prerrequisito manual (antes de poder implementar esta parte)**: Caro necesita crear un proyecto en Google Cloud, habilitar la API de Calendar, y generar credenciales OAuth (client ID + secret). Es una serie de clics en la consola de Google, no requiere saber programar, pero sí es un paso fuera de este repo que ella tiene que hacer una vez. Se le guía paso a paso cuando llegue esa tarea en el plan de implementación.
- **Respaldo**: si la sincronización falla (token vencido, Google caído, etc.), la cita igual queda guardada en `citas_clase_muestra` y visible en la vista admin — nunca se pierde una cita aunque falle la notificación. No hay reintento automático en esta vuelta; si Caro ve una cita sin evento en su calendario, el dato fuente de verdad es la tabla, no el calendario.
- **Por qué no WhatsApp automático**: mandar mensajes de WhatsApp de forma automática (no solo abrir un chat) requiere la API de WhatsApp Business — aprobación de Meta, plantillas de mensaje pre-aprobadas, costo por conversación. Desproporcionado para el volumen de citas de un negocio boutique; queda fuera de alcance.

## B. Disponibilidad: horario fijo semanal

- **`disponibilidad_clase_muestra`**: mismo patrón que la tabla `horarios` de clases regulares — día de la semana + hora de inicio, `activo boolean`. Caro la edita desde la vista admin (agregar/desactivar franjas), una sola vez, no por semana.
- Cada clase muestra dura **1 hora** (fijo, no configurable por franja en esta vuelta).
- **Cálculo de slots libres**: a diferencia de las clases regulares, aquí no se generan filas por adelantado (no hace falta cupo por instancia, cada slot es de una sola persona). Al abrir la pantalla pública, se calculan los próximos 14 días de slots a partir de `disponibilidad_clase_muestra`, quitando los que ya tienen una fila en `citas_clase_muestra` (no cancelada) para esa fecha+hora. Mismo tipo de cálculo que ya existe en `app/lib/status.js` para otras franjas, como función pura con pruebas.

## C. Modelo de datos: citas

**`citas_clase_muestra`**: `id`, `fecha`, `hora`, `nombre` (text), `telefono` (text), `cancelada` (boolean, default false), `created_at`. Sin `alumna_id` — quien agenda no tiene cuenta. RLS: policy de insert para `anon`/`authenticated` con `fecha`/`hora`/`nombre`/`telefono` nada más (mismo patrón que ya existe para que una alumna solo pueda editar su nombre y teléfono: `grant insert (fecha, hora, nombre, telefono) on citas_clase_muestra to anon`); nadie del público puede leer la tabla completa (para no exponer nombres/teléfonos de otras personas) — el público solo necesita saber qué horarios YA NO están libres, no quién los apartó, así que el cálculo de slots ocupados corre en una función `security definer` que expone nada más fecha+hora, no nombre/teléfono. La admin sí puede leer y actualizar todo (`es_admin()`, mismo patrón que las demás tablas).

## D. Flujo público (sin login)

Pantalla nueva, accesible por un link directo — ej. `index.html?agenda=clase-muestra` — que la propia `app.js` revisa al cargar, *antes* de la lógica de sesión/login, para mostrar esta pantalla en vez de la de auth. Mismo estilo visual que "Aparta tu espacio": lista de próximos slots libres (fecha + hora), formulario con nombre y teléfono, botón de confirmar. Al enviar, inserta en `citas_clase_muestra` y muestra una confirmación en pantalla (sin cuenta creada, sin necesidad de guardar nada más en ese momento).

**Cancelación**: fuera de alcance construir un flujo en la app — igual que hoy con las clases regulares pasadas las 12 horas, quien quiera cancelar le escribe a Caro por WhatsApp y ella la borra manualmente desde el admin (ver sección E).

## E. Vista admin

Pestaña nueva en la barra de abajo de la vista admin ("Muestra", junto a "Clases"), con:
- Horario semanal de disponibilidad (agregar/quitar franjas).
- Lista de próximas citas de clase muestra (nombre, teléfono, fecha/hora), con botón para cancelarla (confirmación tipo `confirm()`, mismo patrón que "Cancelar esta clase") — libera el slot y no manda ninguna notificación de cancelación (Caro ya sabe, fue ella quien la borró o alguien le avisó por WhatsApp).
- Botón "Conectar Google Calendar" (una sola vez, ver sección A).

## Fuera de alcance en esta vuelta

- Cancelación por parte del prospecto (solo por WhatsApp directo con Caro, quien la borra desde el admin).
- Reagendar una cita ya hecha (se cancela y se agenda una nueva).
- Recordatorios automáticos antes de la cita (más allá de lo que el propio Google Calendar le muestre a Caro).
- Bloquear slots según lo que ya esté ocupado en el Google Calendar externo de Caro (ej. si tiene una cita personal a esa hora, no se excluye automáticamente — solo se excluyen los slots ya tomados por otra clase muestra).
- Conversión automática de un prospecto agendado en cuenta de alumna — sigue siendo un paso manual de Caro si decide darla de alta después.
