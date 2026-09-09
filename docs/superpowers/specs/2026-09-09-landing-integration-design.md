# Integración del landing (pump-flow) en app-pump-flow

## Contexto

Hoy existen tres piezas separadas de la marca Pump&Flow:

1. **app-pump-flow** (este repo) — la app real de reservas: login, vista alumna (inicio, clases, contenido, tu espacio) y vista admin (hoy, alumnado, ficha, clases, clase muestra). Usa Supabase como backend. Se publica con GitHub Pages en `caroecomare.github.io/app-pump-flow/`.
2. **pump-flow** (repo separado `CaroEcomare/pump-flow`) — landing público de marketing: 4 páginas estáticas (`index.html`, `clases.html`, `curso.html`, `personales.html`) que comparten un sistema de diseño (`pump-flow-design/diseño-marca-pump-flow/`). Se publica en `caroecomare.github.io/pump-flow/`.
3. **pump-flow-app** (carpeta local sin git) — un mazo de 100 tarjetas de afirmaciones en React ("Mazo CaroFluye"). **Pausado por decisión del usuario**, fuera de alcance de este trabajo.

El objetivo de este trabajo es fusionar 1 y 2 en un solo repo con un flujo claro: el landing público capta y dirige a las prospectas/alumnas hacia la app real para agendar su clase de introducción o iniciar sesión.

## Alcance

Incluye:
- Traer el código de las 4 páginas del landing y su carpeta de diseño a `app-pump-flow`, con el landing ocupando la raíz del repo.
- Mover el `index.html` actual de la app (login + vistas alumna/admin) a `portal/index.html`, ajustando sus rutas relativas.
- Conectar los CTAs del landing a los flujos reales de la app ya existentes (`?agenda=clase-muestra` para la clase muestra, y el login normal para "reserva tu clase").
- Rellenar el placeholder de contenido de `personales.html` con la oferta real.
- Blindar el link público de clase muestra que la admin ya pudo haber compartido (`admin.js:662`), para que no se rompa al mover la raíz.

No incluye (explícitamente fuera de alcance, por decisión del usuario):
- El mazo de tarjetas `pump-flow-app` — queda pausado, no se toca.
- Un sistema de disponibilidad/calendario para clases personales (no existe hoy en el backend; requeriría tabla nueva en Supabase y UI de admin). Por ahora "Clases personales" sigue usando WhatsApp.
- El repo viejo `CaroEcomare/pump-flow` en GitHub — se deja tal cual, publicado en paralelo. Si más adelante se quiere redirigir o archivar, es una tarea aparte.
- Migrar el historial de git del repo `pump-flow` — se trae el código como copia limpia, no merge de historiales.

## Estructura de archivos resultante

```
app-pump-flow/
├── index.html                              NUEVO — landing (antes en repo pump-flow)
├── clases.html                             NUEVO
├── curso.html                              NUEVO
├── personales.html                         NUEVO
├── pump-flow-design/
│   └── diseño-marca-pump-flow/...          NUEVO — CSS, imágenes y ui_kits/web/image-slot.js que usa el landing
├── portal/
│   └── index.html                          MOVIDO desde la raíz (era el index.html de la app)
├── app/                                    sin cambios (app.js, admin.js, alumna.js, clase-muestra.js, data.js, auth.js, ui.js, styles.css, lib/)
├── assets/                                 sin cambios (logo-blanco.png, logo-morado.png, los usa portal/)
├── supabase/                               sin cambios
└── docs/                                   sin cambios
```

`portal/index.html` mantiene exactamente el mismo contenido que el `index.html` actual, solo con las rutas relativas corregidas: `app/styles.css` → `../app/styles.css`, `assets/logo-morado.png` → `../assets/logo-morado.png`, `app/app.js` → `../app/app.js`.

## Cambios de contenido/comportamiento por página

### Las 4 páginas del landing (index, clases, curso, personales)

El botón del nav `Reserva tu clase ✨` (hoy apunta a WhatsApp) cambia en las **4 páginas** para apuntar a `portal/` (pantalla de login/crear cuenta). Es el único cambio compartido por las 4.

### `index.html`

El botón del hero **"Agenda tu primera clase de introducción ✨"** (hoy WhatsApp) cambia a `portal/index.html?agenda=clase-muestra`, para ser consistente con el mismo flujo que en Clases.

### `clases.html`

La sección de precios, que hoy tiene un solo botón "Agendar por WhatsApp ✨", se reemplaza por dos botones:
- **"Agenda tu introducción ✨"** → `portal/index.html?agenda=clase-muestra`
- **"Reserva tu clase ✨"** → `portal/index.html`

### `personales.html`

El párrafo placeholder ("Aquí va la explicación... Edita este texto con tu descripción 🤍") se reemplaza con la oferta real: **10 sesiones por $2,500, incluye valoración**. El botón "Agendar por WhatsApp ✨" se mantiene igual (no hay calendario de disponibilidad para personales todavía — ver "No incluye" arriba).

### `curso.html`

Sin cambios de contenido; solo el botón del nav como se describe arriba.

## Salvaguarda: link público de clase muestra ya compartido

`app/admin.js:662` genera un link para compartir: `${location.origin}${location.pathname}?agenda=clase-muestra`. Hoy ese link apunta a la raíz del repo (donde vivía la app). Al mover la app a `portal/`, cualquier link ya compartido con prospectas dejaría de abrir el calendario y en su lugar cargaría el landing.

Para evitarlo, el nuevo `index.html` (landing) incluye un script mínimo al inicio del `<body>` que detecta `location.search` con `agenda=clase-muestra` y hace `location.replace('portal/index.html' + location.search)`, preservando cualquier parámetro. Si no está ese parámetro, el landing se muestra normal.

Este script se agrega **solo** en el `index.html` del landing (la raíz es el único lugar donde pudo haber apuntado el link viejo).

## Pendiente operativo del lado del usuario (no es código)

Para que "Agenda tu introducción" muestre fechas reales, la admin necesita cargar disponibilidad de clase muestra desde su panel (`d-muestra` en `portal/index.html`, ya existe). Si no hay slots cargados, `clase-muestra.js` simplemente no listará horarios — no es un error, pero conviene que la usuaria lo sepa antes de anunciar el link.

## Testing

Verificación manual sirviendo el repo con un servidor estático local (`python3 -m http.server`, o `npx serve`):
1. `/` carga el landing (no la app).
2. Los 4 nav "Reserva tu clase" llevan a `/portal/` y ahí carga la pantalla de login sin errores de rutas rotas (CSS, logo, JS).
3. Desde `/portal/`, login/registro sigue funcionando igual que antes (regresión).
4. `/clases.html` → botón "Agenda tu introducción" abre `/portal/index.html?agenda=clase-muestra` y muestra la pantalla de clase muestra (aunque esté vacía de horarios).
5. `/?agenda=clase-muestra` (simulando un link viejo ya compartido) redirige automáticamente a `/portal/index.html?agenda=clase-muestra`.
6. `/personales.html` muestra el texto nuevo de precio y el botón de WhatsApp sigue funcionando.
7. `npm test` (los tests existentes de `app/lib/*.test.js`) sigue pasando sin cambios, ya que no se tocó esa carpeta.
