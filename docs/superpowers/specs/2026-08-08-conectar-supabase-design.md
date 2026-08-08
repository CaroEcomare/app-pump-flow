# Conectar la app Pump&Flow a Supabase

## Contexto

El repo `app-pump-flow` tiene una carpeta `Sistema de diseño para marca/` que es el kit de diseño (colores, tipografía, componentes) más un mockup estático de la app en `ui_kits/app/index.html`: dos "teléfonos" (vista alumna y vista admin) con un switch manual para alternar entre ellos, todo con datos de ejemplo fijos en el HTML. El propio `SKILL.md` del kit indica que para producción se deben copiar los assets y construir aparte, no editar el mockup en su lugar.

Las tablas de Supabase ya existen (ver `Sistema de diseño para marca/ui_kits/app/supabase.sql`): `alumnas`, `horarios`, `clases`, `reservas`, `asistencias`, `paquetes`, `valoraciones`, `contenido`, con RLS activo y funciones `es_admin()`, `checa_cupo()` (trigger antes de insertar reserva) y `descuenta_clase()` (trigger que descuenta clase del paquete al confirmar asistencia).

Objetivo: construir la app real (`app-pump-flow`, nombre del repo) que las alumnas y la administradora (Caro) usan de verdad desde el navegador del celular, conectada a Supabase, respetando el lenguaje visual del kit de diseño (colores, tipografía, tarjetas, botones píldora).

## Arquitectura

Sin build step ni framework — HTML/CSS/JS planos, como el mockup actual, usando `@supabase/supabase-js` vía CDN. GitHub Pages sirve el repo directo desde `main`, raíz.

```
app-pump-flow/
├── Sistema de diseño para marca/     ← kit de diseño, sin tocar
├── index.html                         ← login/registro + router por rol
├── app/
│   ├── styles.css                     ← copiado de tokens del kit + estilos de login
│   ├── supabase.js                    ← cliente Supabase (URL + llave pública) y helpers de datos
│   ├── auth.js                        ← registro, login, logout, resolución de rol
│   ├── alumna.js                      ← lógica de la vista alumna
│   └── admin.js                       ← lógica de la vista admin
└── assets/                            ← logo-blanco.png, logo-morado.png (copiados del kit)
```

La URL de Supabase y la llave pública (`sb_publishable_...`) van directo en `app/supabase.js`. Es seguro exponerlas en cliente: la seguridad real la da RLS, ya activo en las tablas.

## Autenticación y ruteo por rol

- **Registro**: correo, contraseña, nombre, teléfono. `supabase.auth.signUp()` crea el usuario; luego se inserta su fila en `alumnas` (permitido por la policy `alta de perfil propio`, `id = auth.uid()`). Supabase manda correo de confirmación por default; hasta confirmarlo no puede iniciar sesión (comportamiento estándar de Supabase, se desactiva desde su dashboard si se desea, no desde el código).
- **Login**: `supabase.auth.signInWithPassword()`. Sesión persiste en el navegador (maneja el cliente de Supabase).
- **Ruteo por rol**: tras login, se lee `alumnas.es_admin` para el usuario actual.
  - `es_admin = false`: entra directo a la vista alumna. Sin acceso a nada de admin, sin switch.
  - `es_admin = true` (solo la cuenta de Caro): entra a la vista admin por default, con un botón de switch (mismo estilo del mockup actual) para alternar a la vista alumna y volver a admin, para que pueda revisar cómo se ve del lado de las alumnas y seguir teniendo acceso completo a admin.
- **Alta de la cuenta admin**: Caro se registra como cualquier alumna desde la app; después entra una vez al Table Editor de Supabase y marca `es_admin = true` en su propia fila de `alumnas`. No se construye flujo de invitación de administradoras (solo hay una).
- **Cerrar sesión**: botón "Cerrar sesión" (estilo `pillbtn soft` o texto morado sin caja) agregado en "Tu espacio" (alumna) y en un lugar equivalente del admin. No existe en el mockup actual; es una adición mínima necesaria.

## Vista alumna

- **Inicio**: "próxima clase" = la reserva futura más próxima (`reservas` + `clases` + `horarios`, `fecha >= hoy`, orden ascendente). Si es hoy, se muestra el botón "Hacer check-in" (inserta `checkin_alumna = now()` en `asistencias`, respetando el unique `(alumna_id, clase_id)`). Si su próxima reserva es otro día, se muestra la tarjeta sin botón de check-in activo. Si no tiene ninguna reserva futura, la tarjeta invita a apartar lugar (CTA hacia la pestaña Clases) en vez de mostrar una clase.
- **Tu paquete** (Inicio y Tu espacio): su fila más reciente en `paquetes` con `activo = true` — clases restantes (`clases_totales - clases_usadas`), próximo pago (`vence`), forma de pago.
- **Aparta tu espacio**: lista clases de las próximas 4 semanas (`clases` con `fecha >= hoy`, `cancelada = false`), con cupo real = `6 - count(reservas de esa clase)`. "Aparto mi espacio" inserta en `reservas`; si el trigger `checa_cupo` la rechaza por estar llena, se muestra un mensaje breve ("Esta clase ya está llena, elige otro horario") en vez de dejarla apartar. No hay lista de espera ("avísame si se libera" queda como está en el mockup, sin funcionalidad, no estaba en el alcance pedido).
- **Contenido**: sin cambios — se queda con los videos de ejemplo fijos en el HTML, no se conecta a la tabla `contenido` en esta vuelta.
- **Tu espacio**: paquete real (igual que en Inicio) + historial real de `asistencias` (join a `clases`/`horarios`), orden descendente. Badge "Confirmada" si `confirmada_admin` no es null; "Pendiente" si hizo check-in pero aún no se confirma.

## Vista administradora (solo Caro)

- **Hoy**: la clase de hoy (si `horarios` tiene una activa hoy) con su lista real de `reservas`, cada una unida a `alumnas` y a su fila (si existe) en `asistencias`. Por alumna:
  - Sin fila en `asistencias`: badge "Sin check-in", con botón "Confirmar" disponible igual (la admin puede confirmar aunque no haya check-in de la alumna).
  - `checkin_alumna` con fecha, `confirmada_admin` null: botón "Confirmar".
  - `confirmada_admin` con fecha: badge "Confirmada".
  - "Confirmar" hace upsert en `asistencias` poniendo `confirmada_admin = now()` (y `checkin_alumna = now()` si estaba null). El descuento del paquete lo hace el trigger `descuenta_clase` ya existente — la app no duplica esa lógica.
- **Pendientes de la semana** (cálculos simples, ajustables después si no calzan con el flujo real de Caro):
  - "Pagos por recibir": alumnas activas sin paquete `activo = true`, o cuyo paquete activo tiene `vence` ya pasado.
  - "Paquetes por vencer": paquete activo con `vence` dentro de los próximos 7 días.
  - "Valoraciones pendientes": alumnas activas que nunca han tenido una fila en `valoraciones`.
- **Alumnas**: lista de todas las `alumnas`, con badge de estado calculado con las mismas reglas de arriba (Al día / Por pagar / Nueva) y "clases usadas de totales" de su paquete activo. Tocar una alumna abre su Ficha.
- **Ficha** (dinámica por alumna, ya no hardcodeada a "Mariana López" como en el mockup):
  - Paquete real, con botón "Activar mes" que abre un formulario corto nuevo (tipo, monto, forma de pago, fecha de pago) — no existía en el mockup, se agrega con el mismo estilo de tarjeta/inputs del kit. Al guardar, crea una nueva fila en `paquetes` con `activo = true` (y desactiva la anterior si seguía activa, para no tener dos paquetes activos a la vez).
  - Valoraciones reales apiladas, más reciente arriba y expandible, igual que el mockup.
  - Asistencias del mes reales.
- **Nueva valoración**: formulario con los 20 campos de la tabla `valoraciones`, mismo estilo visual (inputs/selects del kit de diseño). Al guardar, calcula el siguiente `numero` para esa alumna (`max(numero) + 1`, o `1` si es la primera) y crea la fila.
- **Clases** (admin): mismas próximas 4 semanas con cupos reales. Botón "Abrir clase extra" queda solo visual (no estaba en el alcance de los 5 pedidos); se puede activar en una vuelta futura.

## Generación automática de clases

Función SQL `generar_clases()` (se agrega a Supabase por el SQL Editor, igual que `supabase.sql`): por cada horario `activo = true`, inserta en `clases` las fechas faltantes de las próximas 4 semanas a partir de hoy, usando `on conflict (horario_id, fecha) do nothing` para no duplicar. La app la llama vía RPC cada vez que alguien entra (alumna o admin), así siempre hay 4 semanas de clases por delante sin depender de un cron externo ni de que Caro haga algo manualmente.

## Publicación

GitHub Pages sirviendo desde la rama `main`, raíz del repo. Se activa al terminar de programar y probar, con confirmación explícita de Caro antes de activarlo (es un cambio de configuración del repo).

## Fuera de alcance en esta vuelta

- Conectar la pestaña "Contenido" a la tabla `contenido`.
- Botón "Abrir clase extra" funcional.
- Lista de espera ("avísame si se libera").
- Notificaciones (correo/push) de cualquier tipo.
- Recuperar contraseña (se puede agregar después si hace falta).
