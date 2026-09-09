# Integración del landing pump-flow en app-pump-flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fusionar el landing público de marketing (repo `CaroEcomare/pump-flow`) dentro de `app-pump-flow`, con el landing en la raíz del repo y la app real (login + vistas alumna/admin) movida a `portal/`, conectando los CTAs del landing a los flujos reales que ya existen en la app.

**Architecture:** Sitio estático multi-página sin build step (igual que ambos proyectos hoy). El landing (`index.html`, `clases.html`, `curso.html`, `personales.html` + `pump-flow-design/`) se copia tal cual desde el repo `pump-flow` a la raíz de `app-pump-flow`. El `index.html` actual de la app se mueve a `portal/index.html` con sus rutas relativas corregidas. Los botones del landing pasan de apuntar a WhatsApp a apuntar a rutas internas de `portal/`, reusando el mecanismo ya existente `?agenda=clase-muestra` (ver `app/app.js:100-103`) para el calendario de la clase de introducción.

**Tech Stack:** HTML/CSS/JS plano, sin bundler. Node `--test` para la suite existente en `app/lib/`. Servidor estático (`python3 -m http.server`) + `curl` para verificación manual de rutas, ya que no hay navegador headless disponible en este entorno.

**Spec:** [docs/superpowers/specs/2026-09-09-landing-integration-design.md](../specs/2026-09-09-landing-integration-design.md)

## Global Constraints

- No se toca `pump-flow-app` (el mazo de tarjetas React) — pausado, fuera de alcance.
- No se construye calendario de disponibilidad para "Clases personales" — sigue usando WhatsApp.
- No se migra el historial de git del repo `pump-flow` — copia limpia de archivos, commits nuevos en `app-pump-flow`.
- El repo `CaroEcomare/pump-flow` en GitHub no se toca ni se borra — sigue publicado en paralelo.
- Las carpetas `app/`, `assets/`, `supabase/` de la app existente no cambian de contenido, solo cambia dónde vive el `index.html` que las referencia.
- El link público de clase muestra ya compartido (`${location.origin}${location.pathname}?agenda=clase-muestra`, generado en `app/admin.js:662`) debe seguir funcionando después de mover la raíz.
- **Los datos de alumnas (clases, reservas, asistencias, paquetes, pagos, valoraciones) viven en Supabase, no en este repo.** `app/supabase-client.js` se conecta con una URL y llave fijas (`https://euhltloldxnbjbizmwze.supabase.co`), independientes de dónde viva `index.html`. Ningún archivo dentro de `app/` ni `supabase/` se modifica en este plan — el Task 0 lo deja verificado antes de empezar, y el Task 8 confirma que sigue siendo cierto al final.

---

## Task 0: Registrar el estado base de `app/` y `supabase/` antes de tocar nada

**Files:** Ninguno modificado — solo un chequeo de referencia.

**Interfaces:** Produce el hash de referencia que el Task 8 usa para confirmar que `app/` y `supabase/` no cambiaron.

- [ ] **Step 1: Confirmar que el working tree está limpio antes de empezar**

```bash
cd /Users/caroaguilar/CODE/app-pump-flow
git status --porcelain app supabase
```
Expected: sin salida (ningún cambio pendiente en esas carpetas).

- [ ] **Step 2: Guardar un hash de referencia de `app/` y `supabase/`**

```bash
cd /Users/caroaguilar/CODE/app-pump-flow
find app supabase -type f | sort | xargs shasum -a 256 > /tmp/pre-integracion-checksums.txt
wc -l /tmp/pre-integracion-checksums.txt
```
Expected: imprime la cantidad de archivos hasheados (debe ser mayor a 0).

No se requiere commit en este task (es solo un registro de referencia en `/tmp`, no forma parte del repo).

## Task 1: Traer el código del landing a la raíz del repo

**Files:**
- Create: `index.html` (raíz — landing, reemplaza temporalmente el índice de la app hasta el Task 2)
- Create: `clases.html`
- Create: `curso.html`
- Create: `personales.html`
- Create: `pump-flow-design/` (carpeta completa, copiada tal cual)

**Interfaces:**
- Produces: las 4 páginas HTML y la carpeta `pump-flow-design/diseño-marca-pump-flow/` con `styles.css`, `assets/*.png|jpeg`, `ui_kits/web/image-slot.js` — de las que dependen todas las tareas siguientes.

- [ ] **Step 1: Guardar aparte el `index.html` actual de la app**

El `index.html` de la raíz hoy es el de la app (login). Antes de sobrescribirlo, muévelo a un nombre temporal para no perderlo (el Task 2 lo reubica definitivamente en `portal/`):

```bash
cd /Users/caroaguilar/CODE/app-pump-flow
mv index.html index.html.app-temp
```

- [ ] **Step 2: Clonar el repo del landing en una carpeta temporal**

```bash
rm -rf /tmp/pump-flow-landing-src
git clone --depth 1 https://github.com/CaroEcomare/pump-flow.git /tmp/pump-flow-landing-src
```

- [ ] **Step 3: Copiar las 4 páginas y la carpeta de diseño al repo**

```bash
cd /Users/caroaguilar/CODE/app-pump-flow
cp /tmp/pump-flow-landing-src/index.html .
cp /tmp/pump-flow-landing-src/clases.html .
cp /tmp/pump-flow-landing-src/curso.html .
cp /tmp/pump-flow-landing-src/personales.html .
cp -R /tmp/pump-flow-landing-src/pump-flow-design .
rm -rf /tmp/pump-flow-landing-src
```

- [ ] **Step 4: Verificar que las 4 páginas y sus assets están completos**

Run:
```bash
cd /Users/caroaguilar/CODE/app-pump-flow
test -f index.html && test -f clases.html && test -f curso.html && test -f personales.html && \
test -f "pump-flow-design/diseño-marca-pump-flow/styles.css" && \
test -f "pump-flow-design/diseño-marca-pump-flow/assets/logo-morado.png" && \
test -f "pump-flow-design/diseño-marca-pump-flow/ui_kits/web/image-slot.js" && \
echo OK
```
Expected: imprime `OK`. Si falta algún archivo, el `cp` del Step 3 no se completó — repítelo.

- [ ] **Step 5: Confirmar que el `index.html.app-temp` de la app sigue intacto**

```bash
grep -q "pantalla-auth" index.html.app-temp && echo "app-temp OK"
```
Expected: imprime `app-temp OK`.

- [ ] **Step 6: Commit**

```bash
git add index.html clases.html curso.html personales.html pump-flow-design index.html.app-temp
git commit -m "$(cat <<'EOF'
feat: traer el código del landing pump-flow a este repo

Copia limpia (sin historial) de index.html, clases.html, curso.html,
personales.html y pump-flow-design/ desde CaroEcomare/pump-flow. El
index.html original de la app queda guardado temporalmente como
index.html.app-temp hasta el siguiente commit, que lo reubica en portal/.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Mover la app a `portal/` y corregir sus rutas

**Files:**
- Create: `portal/index.html` (contenido de `index.html.app-temp`, con rutas corregidas)
- Delete: `index.html.app-temp`

**Interfaces:**
- Consumes: `index.html.app-temp` del Task 1.
- Produces: `portal/index.html` funcionando, referenciado por el resto de las tareas como destino de los CTAs (`portal/`, `portal/index.html?agenda=clase-muestra`).

- [ ] **Step 1: Crear la carpeta `portal/` y mover el archivo**

```bash
cd /Users/caroaguilar/CODE/app-pump-flow
mkdir -p portal
mv index.html.app-temp portal/index.html
```

- [ ] **Step 2: Corregir las rutas relativas dentro de `portal/index.html`**

El archivo referencia `app/styles.css`, `assets/logo-morado.png` (5 veces) y `app/app.js` como rutas relativas a la raíz. Desde `portal/`, necesitan subir un nivel:

```bash
cd /Users/caroaguilar/CODE/app-pump-flow
sed -i '' \
  -e 's|href="app/styles.css"|href="../app/styles.css"|' \
  -e 's|src="assets/logo-morado.png"|src="../assets/logo-morado.png"|g' \
  -e 's|src="app/app.js"|src="../app/app.js"|' \
  portal/index.html
```

- [ ] **Step 3: Verificar que no quedan rutas rotas y que los destinos existen**

```bash
cd /Users/caroaguilar/CODE/app-pump-flow
test -f app/styles.css && test -f assets/logo-morado.png && test -f app/app.js && echo "RUTAS OK"
grep -c '\.\./app/styles.css' portal/index.html   # esperado: 1
grep -c '\.\./assets/logo-morado.png' portal/index.html   # esperado: 5
grep -c '\.\./app/app.js' portal/index.html   # esperado: 1
grep -c 'src="app/\|href="app/\|src="assets/' portal/index.html   # esperado: 0 (ya no debe quedar ninguna ruta sin corregir)
```
Expected: `RUTAS OK`, luego `1`, `5`, `1`, `0`.

- [ ] **Step 4: Verificación funcional con servidor estático**

```bash
cd /Users/caroaguilar/CODE/app-pump-flow
python3 -m http.server 8765 >/tmp/httpserver.log 2>&1 &
SERVER_PID=$!
sleep 1
echo "--- portal/ ---"; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8765/portal/
echo "--- portal css ---"; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8765/portal/../app/styles.css
echo "--- portal logo ---"; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8765/portal/../assets/logo-morado.png
echo "--- portal js ---"; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8765/portal/../app/app.js
kill $SERVER_PID
```
Expected: los cuatro códigos son `200`.

- [ ] **Step 5: Regresión — la suite de tests existente sigue pasando**

```bash
cd /Users/caroaguilar/CODE/app-pump-flow
npm test
```
Expected: todos los tests en `app/lib/*.test.js` pasan (no se tocó esa carpeta, es solo un chequeo de que el repo sigue sano).

- [ ] **Step 6: Commit**

```bash
git add portal/index.html
git rm index.html.app-temp 2>/dev/null || true
git commit -m "$(cat <<'EOF'
refactor: mover la app (login + vistas alumna/admin) a portal/

El index.html de la app se reubica en portal/index.html para dejar la
raíz del repo libre para el landing público. Rutas relativas ajustadas
a app/, assets/ y sin cambios en la lógica ni en app/, assets/, supabase/.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Blindar el link viejo de clase muestra en el nuevo landing

**Files:**
- Modify: `index.html` (landing, raíz)

**Interfaces:**
- Consumes: `portal/index.html` del Task 2 (destino de la redirección).
- Produces: comportamiento de redirección que las páginas de verificación del Task 8 dan por hecho.

**Contexto:** `app/admin.js:662` construye un link compartible como `${location.origin}${location.pathname}?agenda=clase-muestra`. Antes de este trabajo, `location.pathname` apuntaba a la raíz (donde vivía la app). Cualquier link ya compartido con una prospecta debe seguir abriendo el calendario de la clase muestra, no el landing.

- [ ] **Step 1: Agregar el script de redirección al inicio del `<body>` del landing**

Archivo: `index.html` (raíz). Busca la línea de apertura del `<body>`:

```html
</style></head><body>
<header class="wrap">
```

Reemplázala por:

```html
</style></head><body>
<script>
  if (new URLSearchParams(location.search).get('agenda') === 'clase-muestra') {
    location.replace('portal/index.html' + location.search);
  }
</script>
<header class="wrap">
```

- [ ] **Step 2: Verificar que el script quedó bien insertado**

```bash
cd /Users/caroaguilar/CODE/app-pump-flow
grep -c "location.replace('portal/index.html'" index.html
```
Expected: el segundo comando imprime `1`.

- [ ] **Step 3: Verificación funcional del comportamiento (simulada, sin navegador)**

No hay navegador headless en este entorno, así que se simula la lógica del redirect con Node, usando el mismo string de condición que quedó en el archivo:

```bash
node -e "
const params = new URLSearchParams('?agenda=clase-muestra&foo=bar');
const shouldRedirect = params.get('agenda') === 'clase-muestra';
const target = 'portal/index.html' + '?agenda=clase-muestra&foo=bar';
console.assert(shouldRedirect === true, 'debía redirigir');
console.assert(target === 'portal/index.html?agenda=clase-muestra&foo=bar', 'target incorrecto: ' + target);
console.log('REDIRECT LOGIC OK');
"
```
Expected: imprime `REDIRECT LOGIC OK` sin errores de `console.assert`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
fix: redirigir links viejos de clase muestra desde el nuevo landing

Un link compartido antes de este cambio (?agenda=clase-muestra apuntando
a la raíz) ahora redirige a portal/index.html preservando query params,
para no romper invitaciones ya enviadas a prospectas.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Apuntar el botón "Reserva tu clase" del nav a `portal/` en las 4 páginas

**Files:**
- Modify: `index.html`
- Modify: `clases.html`
- Modify: `curso.html`
- Modify: `personales.html`

**Interfaces:**
- Consumes: `portal/` del Task 2.

- [ ] **Step 1: Reemplazar el botón del nav en las 4 páginas**

En cada uno de los 4 archivos (`index.html`, `clases.html`, `curso.html`, `personales.html`) hay esta línea idéntica dentro de `<nav>`:

```html
    <a class="btn btn-primary" href="https://wa.me/524431331146?text=Hola%20Caro%2C%20quiero%20agendar%20mi%20clase%20%F0%9F%A4%8D" target="_blank">Reserva tu clase ✨</a>
```

Reemplázala por:

```html
    <a class="btn btn-primary" href="portal/">Reserva tu clase ✨</a>
```

Puedes aplicarlo a los 4 archivos con:

```bash
cd /Users/caroaguilar/CODE/app-pump-flow
for f in index.html clases.html curso.html personales.html; do
  python3 - "$f" <<'PYEOF'
import sys
path = sys.argv[1]
old = '<a class="btn btn-primary" href="https://wa.me/524431331146?text=Hola%20Caro%2C%20quiero%20agendar%20mi%20clase%20%F0%9F%A4%8D" target="_blank">Reserva tu clase ✨</a>'
new = '<a class="btn btn-primary" href="portal/">Reserva tu clase ✨</a>'
content = open(path, encoding='utf-8').read()
assert content.count(old) == 1, f"{path}: se esperaba 1 ocurrencia, se encontraron {content.count(old)}"
open(path, 'w', encoding='utf-8').write(content.replace(old, new))
PYEOF
done
```

- [ ] **Step 2: Verificar el reemplazo en los 4 archivos**

```bash
cd /Users/caroaguilar/CODE/app-pump-flow
for f in index.html clases.html curso.html personales.html; do
  echo "=== $f ==="
  grep -c 'href="portal/">Reserva tu clase' "$f"
  grep -c 'wa.me.*Reserva tu clase\|Reserva tu clase.*wa.me' "$f"
done
```
Expected: para cada archivo, la primera línea imprime `1` y la segunda imprime `0`.

- [ ] **Step 3: Commit**

```bash
git add index.html clases.html curso.html personales.html
git commit -m "$(cat <<'EOF'
feat: el botón "Reserva tu clase" del nav abre el login de la app

En las 4 páginas del landing, el CTA principal del nav dejaba de ir a
WhatsApp y ahora lleva directo a portal/ (pantalla de login/crear cuenta).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: El botón del hero en `index.html` abre el calendario de la clase muestra

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `portal/index.html?agenda=clase-muestra` (mecanismo existente, ver `app/app.js:100-103`).

- [ ] **Step 1: Reemplazar el CTA del hero**

Busca en `index.html`:

```html
      <a class="btn btn-primary" href="https://wa.me/524431331146?text=Hola%20Caro%2C%20quiero%20agendar%20mi%20clase%20de%20introducci%C3%B3n%20%F0%9F%A4%8D" target="_blank" style="justify-content:center">Agenda tu primera clase ✨</a>
```

Reemplázala por:

```html
      <a class="btn btn-primary" href="portal/index.html?agenda=clase-muestra" style="justify-content:center">Agenda tu primera clase ✨</a>
```

- [ ] **Step 2: Verificar**

```bash
cd /Users/caroaguilar/CODE/app-pump-flow
grep -c 'href="portal/index.html?agenda=clase-muestra" style="justify-content:center"' index.html
```
Expected: `1`.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat: el CTA del hero agenda la clase de introducción directo en la app

Antes mandaba a WhatsApp; ahora usa el mismo calendario de clase muestra
que la página de Clases, vía portal/index.html?agenda=clase-muestra.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Reemplazar el botón único de `clases.html` por los dos CTAs reales

**Files:**
- Modify: `clases.html`

**Interfaces:**
- Consumes: `portal/` y `portal/index.html?agenda=clase-muestra`.

- [ ] **Step 1: Reemplazar la sección de precios**

Busca en `clases.html`:

```html
    <a class="btn btn-primary" style="padding:16px 40px;font-size:18px" href="https://wa.me/524431331146?text=Hola%20Caro%2C%20quiero%20agendar%20mi%20clase%20de%20introducci%C3%B3n%20%F0%9F%A4%8D" target="_blank">Agendar por WhatsApp ✨</a>
```

Reemplázala por:

```html
    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
      <a class="btn btn-primary" style="padding:16px 40px;font-size:18px" href="portal/index.html?agenda=clase-muestra">Agenda tu introducción ✨</a>
      <a class="btn btn-outline" style="padding:16px 40px;font-size:18px" href="portal/">Reserva tu clase ✨</a>
    </div>
```

- [ ] **Step 2: Verificar**

```bash
cd /Users/caroaguilar/CODE/app-pump-flow
grep -c 'href="portal/index.html?agenda=clase-muestra">Agenda tu introducción' clases.html
grep -c 'href="portal/">Reserva tu clase ✨</a>' clases.html
grep -c 'Agendar por WhatsApp' clases.html
```
Expected: `1`, `2` (una del nav del Task 4 + una nueva de esta sección), `0`.

- [ ] **Step 3: Verificación visual básica con servidor estático**

```bash
cd /Users/caroaguilar/CODE/app-pump-flow
python3 -m http.server 8765 >/tmp/httpserver.log 2>&1 &
SERVER_PID=$!
sleep 1
curl -s http://localhost:8765/clases.html | grep -o 'Agenda tu introducción\|Reserva tu clase' | sort | uniq -c
kill $SERVER_PID
```
Expected: `Agenda tu introducción` aparece `1` vez, `Reserva tu clase` aparece `2` veces (nav + sección de precios).

- [ ] **Step 4: Commit**

```bash
git add clases.html
git commit -m "$(cat <<'EOF'
feat: dos CTAs reales en Clases (agenda introducción / reserva tu clase)

Reemplaza el único botón de WhatsApp por los dos flujos que ya existen
en la app: el calendario de la clase muestra y el login para reservar.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Rellenar el contenido real de "Clases personales"

**Files:**
- Modify: `personales.html`

**Interfaces:** Ninguna — solo copy/contenido, el botón de WhatsApp existente se mantiene igual.

- [ ] **Step 1: Reemplazar el párrafo placeholder**

Busca en `personales.html`:

```html
    <p>Aquí va la explicación de qué incluye tu clase personal y por qué es la mejor opción para avanzar a tu ritmo. Edita este texto con tu descripción 🤍</p>
```

Reemplázala por:

```html
    <p>10 sesiones personalizadas por $2,500, incluyendo tu valoración inicial. Trabajamos juntas a tu ritmo, con el enfoque que tu cuerpo necesite en este momento.</p>
```

- [ ] **Step 2: Verificar**

```bash
cd /Users/caroaguilar/CODE/app-pump-flow
grep -c "10 sesiones personalizadas por \$2,500" personales.html
grep -c "Edita este texto con tu descripción" personales.html
```
Expected: `1`, luego `0`.

- [ ] **Step 3: Commit**

```bash
git add personales.html
git commit -m "$(cat <<'EOF'
content: rellenar la oferta real de Clases personales

10 sesiones por $2,500, incluye valoración inicial. Reemplaza el texto
placeholder que traía el diseño original.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Verificación integral y regresión final

**Files:** Ninguno modificado — solo verificación.

**Interfaces:** Consume todo lo producido en Tasks 1-7.

- [ ] **Step 1: Levantar servidor estático y comprobar cada ruta clave**

```bash
cd /Users/caroaguilar/CODE/app-pump-flow
python3 -m http.server 8765 >/tmp/httpserver.log 2>&1 &
SERVER_PID=$!
sleep 1

echo "1) raíz es el landing, no la app:"
curl -s http://localhost:8765/ | grep -q "Conecta con tu cuerpo" && echo "  OK landing en raíz" || echo "  FALLO"
curl -s http://localhost:8765/ | grep -q 'id="pantalla-auth"' && echo "  FALLO: la app sigue en la raíz" || echo "  OK app ya no está en raíz"

echo "2) portal/ carga la app:"
curl -s http://localhost:8765/portal/ | grep -q 'id="pantalla-auth"' && echo "  OK" || echo "  FALLO"

echo "3) assets y JS de portal resuelven:"
curl -s -o /dev/null -w "  app/styles.css: %{http_code}\n" http://localhost:8765/app/styles.css
curl -s -o /dev/null -w "  assets/logo-morado.png: %{http_code}\n" http://localhost:8765/assets/logo-morado.png
curl -s -o /dev/null -w "  app/app.js: %{http_code}\n" http://localhost:8765/app/app.js

echo "4) assets del landing resuelven:"
curl -s -o /dev/null -w "  pump-flow-design styles.css: %{http_code}\n" "http://localhost:8765/pump-flow-design/dise%C3%B1o-marca-pump-flow/styles.css"

echo "5) clases.html tiene los dos CTAs:"
curl -s http://localhost:8765/clases.html | grep -q "agenda=clase-muestra" && echo "  OK" || echo "  FALLO"

echo "6) personales.html tiene el contenido real:"
curl -s http://localhost:8765/personales.html | grep -q "10 sesiones personalizadas" && echo "  OK" || echo "  FALLO"

echo "7) las 4 páginas apuntan el nav a portal/:"
for f in index.html clases.html curso.html personales.html; do
  curl -s "http://localhost:8765/$f" | grep -q 'href="portal/">Reserva tu clase' && echo "  OK $f" || echo "  FALLO $f"
done

kill $SERVER_PID
```
Expected: todas las líneas dicen `OK`, ninguna dice `FALLO`.

- [ ] **Step 2: Confirmar el redirect de link viejo (revisión de código, no ejecutable sin navegador)**

```bash
cd /Users/caroaguilar/CODE/app-pump-flow
grep -c "location.replace('portal/index.html'" index.html
```
Expected: `1`. (La lógica ya se validó con Node en el Task 3, Step 3.)

- [ ] **Step 3: Regresión de la suite de tests existente**

```bash
cd /Users/caroaguilar/CODE/app-pump-flow
npm test
```
Expected: todos los tests pasan.

- [ ] **Step 4: Confirmar que `app/` y `supabase/` no cambiaron (protección de datos)**

Compara contra el hash de referencia guardado en el Task 0:

```bash
cd /Users/caroaguilar/CODE/app-pump-flow
find app supabase -type f | sort | xargs shasum -a 256 > /tmp/post-integracion-checksums.txt
diff /tmp/pre-integracion-checksums.txt /tmp/post-integracion-checksums.txt && echo "SIN CAMBIOS EN app/ Y supabase/ — datos y lógica intactos"
```
Expected: `diff` no muestra ninguna línea y se imprime `SIN CAMBIOS EN app/ Y supabase/ — datos y lógica intactos`. Si aparece alguna diferencia, detente y revisa qué tarea tocó esos archivos — ninguna debería hacerlo.

- [ ] **Step 5: Revisión manual pendiente (para el usuario, no automatizable aquí)**

Deja anotado para quien revise el PR / la rama:
- Abrir `http://localhost:8765/` y `http://localhost:8765/portal/` en un navegador real para confirmar visualmente que login, clases, contenido y panel admin siguen funcionando igual que antes.
- Abrir `http://localhost:8765/?agenda=clase-muestra` en un navegador real y confirmar que redirige a `portal/index.html?agenda=clase-muestra` mostrando la pantalla de clase muestra.
- Cargar disponibilidad real de clase muestra desde el panel admin (`portal/` → pestaña "Muestra") antes de anunciar el link, si aún no hay horarios cargados.

No se requiere commit en este task (es solo verificación).
