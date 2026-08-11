# Cuentas manuales, flujo de reservas y rediseño de Inicio (v2)

## Contexto

Caro va a empezar a usar la app con alumnado real que ya toma clases con ella (algunos vía Wellhub/TotalPass), y necesita poder darlos de alta ella misma con usuario y contraseña, sin depender de que tengan o revisen un correo. También quiere replicar el flujo de reservas/cancelación/asistencia de una app de referencia (Nessty) que ya usan plataformas como Wellhub/TotalPass para gestionar clases: apartar lugar, cancelar con anticipación, y que la clase se descuente del paquete al confirmarse la asistencia (manual o automáticamente si ya pasó la fecha).

Este spec construye sobre la app ya en producción (`docs/superpowers/specs/2026-08-08-conectar-supabase-design.md` y su plan). No repite decisiones ya tomadas ahí (arquitectura sin build, Supabase, RLS), solo el delta.

## A. Cuentas: login con usuario, alta manual, lenguaje neutro

- **Confirmación de correo**: se desactiva por completo en el proyecto de Supabase (Authentication → Providers → Email → "Confirm email" en off). Aplica tanto a quien se registra solo con correo como a las cuentas que Caro cree manualmente. Quien se registra por correo queda con sesión iniciada de inmediato (ya no hace falta el mensaje de "revisa tu correo").
- **`alumnas.username`**: columna nueva, `text unique`, opcional (nula para quien se registró con correo y nunca necesitó usuario).
- **Alta manual (nueva pantalla en admin)**: formulario con nombre, usuario, contraseña (la define Caro), teléfono, plataforma (No/Wellhub/TotalPass). Al guardar:
  - Se genera un correo interno invisible y único (ej. `<username>@alumnado.pumpflow.app`) que nunca se usa para enviar nada, solo para satisfacer el requisito técnico de Supabase de que cada cuenta tenga un correo.
  - La creación usa un cliente de Supabase aparte y temporal (no el que ya tiene la sesión de Caro activa), para que crear la cuenta de alguien más no cierre ni reemplace la sesión de Caro en su propio navegador.
  - Al terminar, la cuenta queda activa de inmediato (sin confirmación pendiente), y Caro le puede compartir el usuario y la contraseña a esa persona en persona o por WhatsApp.
- **Login**: un solo campo "Correo o usuario" + contraseña.
  - Si el valor contiene `@`, se usa como correo directo.
  - Si no, se resuelve primero contra `alumnas.username` (vía una función de Supabase que solo expone el correo interno correspondiente a ese usuario, nada más de la tabla) y se inicia sesión con ese correo resuelto.
  - Si el usuario no existe, mismo mensaje de error genérico que una contraseña incorrecta (no se revela cuáles usuarios existen).
- **Lenguaje**: "Alumnado" reemplaza a "Alumnas" en títulos y textos generales de la vista admin (pestaña, encabezados, conteos). Los nombres propios de cada persona no cambian.

## B. Flujo de reservas, cancelación y asistencia

Reemplaza el check-in que hacía la propia alumna. Nuevo ciclo de vida de una reserva:

1. **Aparta tu lugar**: inserta en `reservas` (igual que hoy), baja el cupo visible para todos de inmediato.
2. **No podré asistir** (cancelar): visible mientras falten 12 horas o más para la clase. Borra la fila de `reservas` (libera el cupo). Debajo del botón, siempre visible: "Puedes cancelar hasta 12 horas antes de tu clase". Pasadas las 12 horas, el botón desaparece (ya no se puede cancelar sola; si de verdad no puede llegar, lo resuelve con Caro directamente).
3. **Confirmar asistencia** (ya existe, lo usa Caro el día de la clase): pone `confirmada_admin`, dispara el descuento del paquete (trigger ya existente).
4. **Auto-descuento**: si la clase ya pasó de hora y nadie canceló ni Caro confirmó, una función corre en cuanto alguien abre la app (mismo patrón que ya genera las clases automáticamente) y marca esas reservas como asistencia confirmada, descontando el paquete igual. Así ninguna reserva queda "sin resolver" para siempre.

**Ventana para apartar**: el alumnado puede apartar lugar en cualquier clase que ocurra dentro de los próximos 7 días (ya no se muestran las 4 semanas completas para reservar, solo la semana que sigue), hasta 1 hora antes de que empiece. Dentro de esa última hora, en vez del botón de apartar aparece "Mándame mensaje para verificar disponibilidad" (WhatsApp directo a Caro, con la clase y hora ya escritas en el mensaje).

La vista de administradora (pestaña "Clases", panorama de cupos) no cambia su horizonte de 4 semanas — la ventana de 1 semana aplica solo a lo que ve y puede reservar el alumnado.

## C. Ajuste manual de clases usadas

En la Ficha de cada persona, junto a los datos de su paquete activo, un campo numérico con "Clases usadas" editable y un botón de guardar. Permite a Caro corregir el conteo cuando activa el paquete de alguien que ya traía clases tomadas de antes (fuera de la app). No cambia `clases_totales` ni ninguna otra cosa del paquete, solo `clases_usadas`.

## D. Rediseño de "Inicio" (vista alumna)

Orden de arriba a abajo:

1. **Clase de hoy**: igual que ahora, tarjeta destacada si tiene una reserva para hoy (sin botón de check-in, ya no aplica).
2. **Tus próximas reservas**: lista de TODAS sus reservas futuras (no solo la más próxima), cada una con fecha, hora, y su botón "No podré asistir" si todavía faltan 12+ horas.
3. **Tu paquete**: igual que ahora.
4. **Contáctame**: botón que abre WhatsApp directo con Caro (mismo número que ya usa la landing del kit de diseño: 44 31 33 11 46).
5. **Súmate a la comunidad**: botón que abre el grupo de WhatsApp de la comunidad (`https://chat.whatsapp.com/L3UWcyfbMScFiHUd9fhu5h?s=cl&p=i&ilr=0`).

Se quita el "Tip de hoy" fijo que había antes en Inicio para no saturar la pantalla (ya no aporta tanto frente a lo nuevo). La pestaña "Clases" sigue siendo donde se apartan lugares nuevos (con la ventana de 1 semana / 1 hora del bloque B); "Inicio" pasa a ser el resumen de lo que ya tiene reservado, más las dos formas de contacto.

## Fuera de alcance en esta vuelta

- Edición o recuperación de contraseña para cuentas manuales (Caro la resetea directamente en Supabase si hace falta, como hoy).
- Notificaciones automáticas (WhatsApp/correo/push) de recordatorio o de cancelación.
- Historial visible de clases canceladas (se borran, no quedan registradas).
- Cambiar el "Contáctame"/"Súmate a la comunidad" desde la vista admin (los números/links quedan fijos en el código; si cambian, se piden como ajuste aparte).
