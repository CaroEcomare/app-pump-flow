# Pump&Flow — Design System

**Pump&Flow** (@Caro_fluye) es la marca de Caro: clases de hipopresivos y entrenamiento de suelo pélvico, presenciales y en línea. Lema: "Más que solo hipopresivos".

**Audiencia:** mujeres de 25–40 años. Puede estar en posparto, o buscar un momento de calma y conexión con su cuerpo. Suele trabajar en oficina y no es muy activa. Busca trabajar su abdomen y prevenir incontinencia.

**Productos:**
1. **Página web** — landing de venta para captar alumnas, agendar/reservar clases y vender cursos en línea.
2. **App móvil** — videos de ejercicio, venta de cursos y producto, tips, reserva de clases, consulta de paquete. (En desarrollo: generador de clases de wunda.)

**Fuentes de este sistema:** PDF de propuesta de marca `uploads/Pump and flow propuesta 2.pdf` (paleta, tipografías, versiones de logo) + logo PNG subido por Caro + respuestas directas de Caro sobre tono y comunicación.

---

## CONTENT FUNDAMENTALS

**Tono:** cercano y motivador, como una amiga entrenadora. Divertido y desenfadado, pero nunca burlón con el cuerpo de nadie. Habla de **tú**, siempre.

**Reglas duras (de Caro):**
- ❌ NUNCA estructuras de comparación "no es esto… es esto otro". Se afirma en positivo directamente.
- ❌ NUNCA guiones medios (—) en el copy. Usar comas, puntos o dos puntos.
- ✅ Emojis con moderación, solo estos y similares: 🤍 ✨ 🧘🏽‍♀️

**Estilo de copy:**
- Frases cortas, en positivo, orientadas a beneficio: "Evitar pérdida de orina", "Reducir perímetro de cintura", "Mejorar tránsito intestinal".
- Beneficios concretos y sin eufemismos: la marca habla claro de incontinencia, tránsito intestinal y orgasmos. Directa pero cálida, nunca clínica ni fría.
- Títulos en mayúsculas para claims cortos: "MÁS QUE SOLO HIPOPRESIVOS". El resto en sentence case.
- Invita, no presiona: "Estas clases son para ti si buscas:" (el CTA parte de la necesidad de ella).
- Verbos de acción y cuidado: mejorar, reducir, aumentar, conectar, fluir.

**Ejemplos de voz:**
- ✅ "Tu primera clase es para conocerte. Ven como estés 🤍"
- ✅ "Reserva tu lugar, tu abdomen te lo va a agradecer ✨"
- ❌ "No es un gym… es una experiencia" (comparación prohibida)
- ❌ "Entrena duro — sin excusas" (guion medio + tono agresivo)

---

## VISUAL FOUNDATIONS

**Paleta (5 colores del PDF):** rosa claro `#EFB2E0`, rosa `#EAA1DC`, lila claro `#E3C7FA`, lavanda `#AA9DED`, morado `#584472`. El morado es el color de texto y contraste; la lavanda es el acento de acción (botones primarios); los rosas y lilas son fondos y superficies suaves. Nunca negro puro: el texto oscuro es morado (`--text-body: #3E2F52`, derivado).

**Fondos:** planos, de un solo color de la paleta (lila fondo `#F5EEFD` para páginas; bloques lavanda o morado para secciones destacadas). Sin gradientes, sin texturas, sin imágenes de fondo. El contraste se hace alternando bloques de color.

**Tipografía:** display redonda y juguetona (Neighbor Bold Italic; sustituto temporal Baloo 2) solo para títulos grandes y el logo. Poppins para todo lo demás. IvyEpic Thin (sustituto Poppins 300) para detalles finos opcionales.

**Formas:** TODO es redondeado. Radios generosos (12–40px, píldoras para botones y chips). El PDF usa "burbujas" apiladas de bordes muy redondos como contenedores de lista, y círculos/semicírculos decorativos en lavanda. Motivo decorativo permitido: círculo con anillo grueso lavanda.

**Botones:** píldora (radius 999). Primario: lavanda con texto blanco. Secundario: borde lavanda sobre claro. Sobre fondos oscuros: blanco con texto morado. Hover: un paso más oscuro (`--pf-lavanda-hover`). Press: leve escala 0.98 + sombra interna.

**Sombras:** suaves y con tinte morado (`rgba(88,68,114,…)`), nunca gris/negro. Cards: sombra tenue + radio grande, sin borde o con borde lila suave.

**Animación:** transiciones cortas (150–250ms ease). Fades y desplazamientos suaves; nada de rebotes agresivos. La marca es calma, fluye.

**Imágenes:** fotografía cálida y real de mujeres entrenando/respirando, luz natural, tonos que armonicen con lila/rosa. Nada de stock agresivo de gym. (Sin fotos en las fuentes; usar placeholders hasta recibir material real.)

**Layout:** centrado, generoso en aire, una idea por bloque. Contenido angosto (max ~680px de texto) sobre fondos amplios.

---

## ICONOGRAPHY

No hay set de iconos propio en las fuentes. Se adopta **Lucide** (CDN) por su trazo redondeado y amable, grosor 2, esquinas redondas, en color morado o lavanda según fondo. Emojis permitidos como acento emocional en copy: 🤍 ✨ 🧘🏽‍♀️ (nunca como iconos de UI). Sin iconos rellenos ni angulosos.

**Logo:** lettering "Pump & Flow" con "@Caro_fluye" debajo. Archivos en `assets/`: `logo-blanco.png` (para fondos de color) y `logo-morado.png` (para fondos claros). Versiones de una línea existen en el PDF pero no como archivo suelto. Zona de respeto: alto de la "P" alrededor. Nunca recolorear fuera de blanco/morado/rosa claro sobre morado.

---

## Índice

- `styles.css` — entrada global (importa todos los tokens)
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `fonts.css`
- `assets/` — `logo-blanco.png`, `logo-morado.png`
- `guidelines/` — specimen cards de fundamentos
- `components/buttons/` — Button, IconButton
- `components/forms/` — Input, Select, Checkbox, Radio, Switch
- `components/display/` — Card, Badge, Tag, Tabs
- `components/feedback/` — Dialog, Toast, Tooltip
- `ui_kits/web/` — landing de venta (index.html)
- `ui_kits/app/` — app móvil (index.html)
- `SKILL.md` — para usar este sistema en Claude Code

**Intentional additions:** set estándar de componentes (no había inventario en las fuentes, solo brand guidelines); iconos Lucide por CDN.

**Pendientes:** archivos de fuentes Neighbor e IvyEpic (Caro los subirá; hoy hay sustitutos de Google Fonts), fotografía real de marca, versiones horizontales del logo como archivo.
