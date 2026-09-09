import { useState, useEffect, useCallback } from "react";

/* ─────────────────────────────────────────────
   PALETA & TOKENS
───────────────────────────────────────────── */
const C = {
  bg: "#f5eef8",
  bgCard: "#ffffff",
  back1: "#6b3fa0",
  back2: "#8b52c8",
  pink: "#e040a0",
  pinkLight: "#f472c0",
  purple: "#7c4dbb",
  purpleLight: "#b07de0",
  lilac: "#c9a8f0",
  lilacLight: "#e8d5ff",
  text: "#2d1b4e",
  textMid: "#6b4a8a",
  textLight: "#a07cc0",
  stripe1: "#e8b4d8",
  stripe2: "#c4a0e8",
  white: "#ffffff",
};

/* ─────────────────────────────────────────────
   100 TARJETAS — 4 BLOQUES
───────────────────────────────────────────── */
const bloques = [
  {
    nombre: "Conexión",
    color: C.pink,
    colorLight: "#fce4f4",
    icon: "✦",
    tarjetas: [
      { frase: "Tu cuerpo no es un obstáculo; es tu vehículo sagrado.", ritual: "Cierra los ojos. Coloca una mano en tu pecho y otra en tu abdomen. Visualiza tu pulso como una luz dorada que recorre cada centímetro de tu piel. Siente cómo cada latido te ancla a la vida." },
      { frase: "Agradece este espacio de silencio que te has regalado hoy.", ritual: "Cierra los ojos. Haz una inhalación profunda y, al exhalar, imagina que sueltas una maleta pesada. Quédate en la quietud por tres respiraciones completas, disfrutando del vacío." },
      { frase: "Tu postura cuenta la historia de quien eres. Honra esa historia.", ritual: "Cierra los ojos. Al inhalar, imagina un hilo invisible tirando de la coronilla hacia el cielo, alargando tu columna. Siente cómo tu historia se expande y se llena de dignidad con cada vértebra que separas." },
      { frase: "Hoy tu cuerpo hizo su mejor esfuerzo. Acéptalo con ternura.", ritual: "Cierra los ojos. Acaricia suavemente tus hombros con las manos cruzadas. Al exhalar, suelta cualquier juicio sobre tu desempeño hoy y repítete: \"Estoy bien exactamente así\"." },
      { frase: "Respira profundamente: estás aquí, estás presente, estás viva.", ritual: "Cierra los ojos. Sigue el camino del aire desde la nariz hasta tus pulmones. Imagina que el aire es paz líquida que llena cada rincón de tu ser. Al exhalar, siente cómo tus pies se funden con el suelo." },
      { frase: "Tu centro es tu lugar más seguro.", ritual: "Cierra los ojos. Lleva toda tu atención a tu zona abdominal. Imagina un pequeño sol cálido naciendo en tu ombligo que se expande por todo tu cuerpo, protegiéndote e iluminándote." },
      { frase: "Tu cuerpo sabe cómo sanar; solo necesita tu permiso.", ritual: "Cierra los ojos. Identifica cualquier zona de tensión. Al exhalar, imagina que envías luz curativa a esa zona y repite: \"Doy permiso a mi cuerpo para relajarse y sanar\". Siente cómo la mandíbula se afloja." },
      { frase: "Menos tensión muscular, más intención espiritual.", ritual: "Cierra los ojos. Relaja conscientemente los dedos de las manos y suelta los puños. Al inhalar, visualiza tu intención principal para hoy, y al exhalar, envíala al mundo sin esfuerzo." },
      { frase: "Tu cuerpo es la casa donde vives. Trátalo con dulzura extrema.", ritual: "Cierra los ojos. Dibuja una sonrisa muy pequeña y suave en tu rostro. Siente cómo esa sonrisa relaja tus ojos, tus mejillas y todo tu cuerpo interno." },
      { frase: "Agradece la infinita capacidad de moverte y expandirte.", ritual: "Cierra los ojos. Inhala profundamente expandiendo tus costillas. Imagina que eres un árbol centenario abriendo sus ramas. Al exhalar, agradece la flexibilidad de tu tronco y raíces." },
      { frase: "Eres un sistema perfecto en constante funcionamiento.", ritual: "Cierra los ojos. Coloca las manos sobre tus costillas inferiores. Siente cómo se abren al inhalar y cómo se cierran al exhalar. Conecta con la complejidad y perfección de tu propia biología." },
      { frase: "La fuerza no siempre es dura; a veces, la fuerza es fluir como el agua.", ritual: "Cierra los ojos. Imagina que estás inmersa en un río cálido. Al inhalar, siente cómo el agua te sostiene. Al exhalar, suelta cualquier rigidez y deja que la corriente te lleve suavemente." },
      { frase: "Escucha lo que tu cuerpo susurra cuando tu mente calla.", ritual: "Cierra los ojos. Escucha el sonido de tu propia respiración. Concéntrate en la pausa entre la exhalación y la inhalación. En ese silencio, busca tu propia voz interior." },
      { frase: "Cada exhalación es una oportunidad de soltar lo que ya no sirve.", ritual: "Cierra los ojos. Inhala profundo y al exhalar, hazlo con fuerza por la boca, imaginando que expulsas humo gris que representa tus dudas y tensiones." },
      { frase: "Hoy te regalaste una conexión profunda. Ese es tu mayor logro.", ritual: "Cierra los ojos. Pon una mano sobre tu corazón. Siente el calor y agradécete a ti misma en voz baja: \"Gracias por este tiempo\"." },
      { frase: "Tus pies sostienen tu vida. Agradéceles su firmeza.", ritual: "Cierra los ojos. Presiona los dedos de tus pies contra el suelo. Imagina que raíces poderosas crecen desde tus talones hacia el centro de la tierra, anclándote y dándote seguridad." },
      { frase: "Tu capacidad pulmonar es tu capacidad de vivir con plenitud.", ritual: "Cierra los ojos. Inhala lo más profundo que puedas, imaginando que tus pulmones son globos dorados. Retén el aire un segundo y exhala muy lento, disfrutando de la expansión." },
      { frase: "Eres más que tus pensamientos; eres tu presencia física.", ritual: "Cierra los ojos. Imagina una luz blanca que escanea tu cuerpo desde la cabeza hasta los pies. Siente la realidad de tu piel, tus músculos y tus huesos en este preciso momento." },
      { frase: "La calma es un músculo que has entrenado hoy con dedicación.", ritual: "Cierra los ojos. Imagina que estás flotando en una piscina de agua tibia bajo un sol suave. Siente cómo cada músculo de tu cuerpo se relaja completamente, disfrutando de la ingravidez." },
      { frase: "Gracias, cuerpo, por aguantar y sostener todo mi mundo.", ritual: "Cierra los ojos. Abrázate a ti misma fuertemente. Siente la solidez de tu propia contención. Al exhalar, repite mentalmente: \"Gracias por cuidarme\"." },
      { frase: "No fuerces, permite. La apertura llega sola.", ritual: "Cierra los ojos. Al inhalar, imagina que tus hombros son pesados y caen lejos de tus orejas. Visualiza un candado abriéndose suavemente en tu pecho." },
      { frase: "Tu respiración es el puente entre tu mente y tu ser más profundo.", ritual: "Cierra los ojos. Cuenta 4 tiempos al inhalar y 6 tiempos al exhalar. Concéntrate en la textura del aire al entrar y salir, sintiendo cómo tu mente se calma con cada ciclo." },
      { frase: "Hoy has vuelto a ti, el lugar más seguro.", ritual: "Cierra los ojos. Imagina que estás entrando en un santuario íntimo dentro de ti misma. Al exhalar, siente la paz de estar \"en casa\" y respira esa seguridad." },
      { frase: "Honra tu propio ritmo; nadie más tiene tu camino.", ritual: "Cierra los ojos. Imagina que estás caminando sola por un sendero hermoso. Siente cómo tu paso es firme y confiado, sin prisa. Respira el alivio de no tener que competir con nadie." },
      { frase: "Eres un universo entero respirando y expandiéndose.", ritual: "Cierra los ojos. Al inhalar, visualiza que todo tu cuerpo se expande como una nebulosa. Al exhalar, siente cómo te concentras en un punto de luz en tu centro." },
    ],
  },
  {
    nombre: "Dirección",
    color: C.purple,
    colorLight: "#ede0ff",
    icon: "◎",
    tarjetas: [
      { frase: "El camino no tiene que ser lineal para ser correcto.", ritual: "Cierra los ojos. Dibuja círculos suaves con tus caderas, sintiendo cómo la flexibilidad te permite adaptarte a las curvas de la vida." },
      { frase: "Confía: ya estás exactamente donde necesitas estar.", ritual: "Cierra los ojos. Visualiza tu situación actual como un campo fértil. Siente la tierra bajo tus pies y confía en que las semillas que has plantado germinarán a su debido tiempo." },
      { frase: "Tu meta es importante, pero tu paz es el destino final.", ritual: "Cierra los ojos. Imagina tu objetivo final como una estrella lejana. Al exhalar, suelta cualquier ansiedad por alcanzarla y concéntrate en la paz de este momento." },
      { frase: "Lo que buscas, también te está buscando a ti.", ritual: "Cierra los ojos. Al inhalar, abre los brazos como si estuvieras lista para recibir un regalo. Imagina que lo que deseas está volando hacia ti." },
      { frase: "No aceleres el proceso; el fruto madura a su debido tiempo.", ritual: "Cierra los ojos. Visualiza un árbol cargado de frutas verdes. Imagina el sol brillando sobre él, sabiendo que el tiempo hará su trabajo." },
      { frase: "Tienes todo lo necesario dentro de ti para lograrlo.", ritual: "Cierra los ojos. Aprieta suavemente tus muslos, sintiendo la fuerza de tus piernas. Visualiza esa fuerza convirtiéndose en determinación." },
      { frase: "El mapa para tu futuro está escrito dentro de ti.", ritual: "Cierra los ojos. Pon una mano en tu pecho. Al exhalar, confía en tu intuición y repite mentalmente: \"Sé lo que tengo que hacer\"." },
      { frase: "Todo se acomoda cuando tú estás bien contigo misma.", ritual: "Cierra los ojos. Relaja el entrecejo y suelta los hombros. Imagina que eres una pieza de un rompecabezas que encaja perfectamente en su lugar." },
      { frase: "Confía siempre en tu propia brújula interna.", ritual: "Cierra los ojos. Imagina una aguja magnética flotando en tu centro. Visualízala apuntando hacia tu verdadero norte, y siente la seguridad de seguir esa dirección." },
      { frase: "La paciencia es una forma profunda de amor propio.", ritual: "Cierra los ojos. Inhala muy lento, disfrutando de cada segundo del proceso. Al exhalar, suelta la prisa y abraza el momento presente." },
      { frase: "No te rindas jamás; solo ajusta la estrategia si es necesario.", ritual: "Cierra los ojos. Ajusta tu postura, erguida y segura. Imagina que eres un capitán ajustando las velas de su barco para seguir navegando." },
      { frase: "Tu intuición es tu guía más sabia y siempre está activa.", ritual: "Cierra los ojos. Hazte una pregunta sencilla. Quédate en silencio y escucha la primera respuesta que surja de tu interior, sin juzgarla." },
      { frase: "El verdadero éxito es hacer lo que amas con constancia.", ritual: "Cierra los ojos. Sonríe pensando en el proyecto que más te ilusiona. Siente cómo esa alegría se expande por todo tu cuerpo." },
      { frase: "Estás construyendo algo que trasciende lo inmediato.", ritual: "Cierra los ojos. Visualiza tu trabajo como una piedra en un gran edificio. Siente el orgullo de estar creando algo duradero." },
      { frase: "No temas al error; es solo un dato más para mejorar.", ritual: "Cierra los ojos. Exhala profundo, soltando el juicio sobre ti misma. Imagina que un error es solo una señal en el camino que te dice: \"Inténtalo de otra forma\"." },
      { frase: "Cada día es una nueva iteración de ti misma.", ritual: "Cierra los ojos. Al inhalar, imagina que te llenas de nuevas posibilidades. Al exhalar, suelta la versión de ayer y abraza la de hoy." },
      { frase: "Confía en el ritmo natural de tu propia evolución.", ritual: "Cierra los ojos. Deja caer la cabeza suavemente y relaja el cuello. Imagina que eres una oruga transformándote en mariposa, confiando en el proceso." },
      { frase: "Lo que te apasiona es tu verdadero propósito.", ritual: "Cierra los ojos. Pon una mano en tu plexo solar, el centro de tu poder. Siente el fuego de tu pasión brillando y dándote dirección." },
      { frase: "Este no es un camino en solitario; es una caminata compartida.", ritual: "Cierra los ojos. Imagina a las personas que te apoyan caminando a tu lado. Siente el calor de su presencia y agradece su compañía." },
      { frase: "Todo obstáculo es una oportunidad de diseño creativo.", ritual: "Cierra los ojos. Inhala imaginando que estás absorbiendo una solución. Al exhalar, imagina que el problema se disuelve en aire." },
      { frase: "Eres la arquitecta de tu propia realidad.", ritual: "Cierra los ojos. Visualiza cómo quieres que sea tu día de mañana. Crea una imagen mental clara y detallada de ese bienestar." },
      { frase: "Deja de buscar afuera lo que ya habita dentro de ti.", ritual: "Cierra los ojos. Pon ambas manos sobre tu corazón. Imagina que estás buscando un tesoro escondido y lo encuentras en tu interior." },
      { frase: "Tu camino es único y sagrado; no lo compares con el de nadie.", ritual: "Cierra los ojos. Respira sabiendo que eres suficiente exactamente como eres. Imagina que estás protegida por una burbuja que te aísla de las comparaciones." },
      { frase: "La acción imperfecta es infinitamente mejor que la inacción perfecta.", ritual: "Cierra los ojos. Mueve un dedo de la mano con decisión. Visualiza cómo ese pequeño movimiento es el primer paso hacia tu meta." },
      { frase: "Vas muy bien. Vas a tu propio ritmo. Vas exactamente a tiempo.", ritual: "Cierra los ojos. Asiente con la cabeza firmemente, reafirmando esta verdad. Siente cómo la seguridad se instala en tu cuerpo." },
    ],
  },
  {
    nombre: "Presencia",
    color: "#5b7ec4",
    colorLight: "#dde8ff",
    icon: "◇",
    tarjetas: [
      { frase: "La calma es tu superpoder más grande.", ritual: "Cierra los ojos. Al inhalar, imagina que respiras aire de color azul claro, que representa la paz. Al exhalar, expulsa aire de color rojo, que representa el estrés." },
      { frase: "Desconéctate del mundo externo para conectar con el tuyo.", ritual: "Cierra los ojos. Imagina que estás bajando el volumen de todos los ruidos que te rodean. Quédate en el silencio interior por cinco respiraciones profundas." },
      { frase: "Respira profundamente. No hay nada más que tengas que hacer ahora.", ritual: "Cierra los ojos. Suelta completamente el control sobre tu respiración y deja que el cuerpo respire solo. Quédate en la observación pura." },
      { frase: "La paz mental es un hábito que se entrena diariamente.", ritual: "Cierra los ojos. Relaja conscientemente los músculos de la cara, especialmente la frente y el área alrededor de los ojos. Siente la suavidad." },
      { frase: "Permítete quedarte un segundo más en esta calma profunda.", ritual: "Cierra los ojos. Quédate completamente inmóvil por 10 segundos. Siente la pesadez de tu cuerpo y la quietud de tu mente." },
      { frase: "El ruido de afuera no tiene poder para tocar tu centro.", ritual: "Cierra los ojos. Imagina una burbuja protectora de luz plateada a tu alrededor. Escucha los ruidos como si estuvieran muy lejos, sin que te afecten." },
      { frase: "Acepta plenamente lo que es; deja ir lo que fue.", ritual: "Cierra los ojos. Exhala profundamente, imaginando que estás soltando el pasado. Al inhalar, respira la aceptación de este momento tal como es." },
      { frase: "Tu mente merece vacaciones; dáselas ahora.", ritual: "Cierra los ojos. Imagina que tus pensamientos son nubes flotando en el cielo. No te enganches a ninguno, solo déjalos pasar." },
      { frase: "Menos estímulos externos, más conexión con tu esencia.", ritual: "Cierra los ojos. Mira el espacio oscuro detrás de tus párpados. Imagina que estás descendiendo a un sótano cálido y tranquilo dentro de ti." },
      { frase: "La quietud es el espacio sagrado donde nacen las grandes ideas.", ritual: "Cierra los ojos y escucha el silencio absoluto. Imagina que tu mente es un lienzo en blanco listo para recibir una nueva inspiración." },
      { frase: "No tienes que resolver todo el mundo hoy.", ritual: "Cierra los ojos. Suelta la lista de tareas pendientes. Imagina que las dejas en una caja fuera de tu espacio de calma por unos momentos." },
      { frase: "Permítete el lujo de no hacer absolutamente nada.", ritual: "Cierra los ojos. Suelta la tensión de las manos. Imagina que eres una piedra en el fondo del río, sin necesidad de moverte." },
      { frase: "Tu paz interna no es negociable; protégela con firmeza.", ritual: "Cierra los ojos. Al inhalar, pon límites amorosos. Al exhalar, siente cómo tu espacio personal se respeta y se fortalece." },
      { frase: "Respira. La tormenta siempre pasa y el sol vuelve a salir.", ritual: "Cierra los ojos. Siente tus pies firmes en la tierra. Imagina que eres una montaña sólida resistiendo el viento y la lluvia." },
      { frase: "Tu bienestar es la base sagrada de todo lo demás.", ritual: "Cierra los ojos. Toca tu abdomen, reconociendo tu centro de poder y vitalidad. Respira la importancia de cuidar este templo." },
      { frase: "La vida sucede en los espacios vacíos entre respiraciones.", ritual: "Cierra los ojos. Nota la pequeña pausa entre la inhalación y la exhalación, y entre la exhalación y la inhalación. Habita ese espacio." },
      { frase: "Hoy elegiste paz sobre el caos. Quédatela.", ritual: "Cierra los ojos. Mantén una sonrisa interna. Imagina que estás envolviendo esa paz en un papel de regalo y guardándola en tu corazón." },
      { frase: "No eres tus pendientes; eres tu presencia física.", ritual: "Cierra los ojos. Separa conscientemente tus hombros de tus orejas. Siente cómo la tensión se derrite y queda tu presencia pura." },
      { frase: "La calma es el lenguaje sagrado del alma.", ritual: "Cierra los ojos. Escucha atentamente los sonidos de tu habitación, sin juzgarlos. Imagina que cada sonido es una nota de una melodía pacífica." },
      { frase: "Desacelera tu ritmo. El mundo puede esperar un momento.", ritual: "Cierra los ojos. Mueve una mano muy, muy lento. Siente la resistencia del aire y la suavidad del movimiento." },
      { frase: "Eres un refugio seguro para ti misma.", ritual: "Cierra los ojos. Abrázate fuertemente. Al exhalar, siente cómo te proteges y te cuidas en este momento de calma." },
      { frase: "Deja que el silencio profundo te llene por completo.", ritual: "Cierra los ojos y quédate en silencio total por un minuto entero, escuchando tu propia respiración y latidos." },
      { frase: "Todo está bien en este instante preciso.", ritual: "Cierra los ojos. Afloja conscientemente la mandíbula. Imagina que la luz del sol te calienta y te relaja por completo." },
      { frase: "Tu energía es infinitamente valiosa; no la gastes en dudas.", ritual: "Cierra los ojos. Inhala seguridad e imaginación. Al exhalar, suelta cualquier duda y concéntrate en tu potencial." },
      { frase: "Respira profundamente: estás a salvo en este momento.", ritual: "Cierra los ojos. Siente cómo el aire llena tu pecho de una sensación de protección y seguridad. Confía en la vida." },
    ],
  },
  {
    nombre: "Amor Propio",
    color: "#c0507a",
    colorLight: "#ffe0ec",
    icon: "♡",
    tarjetas: [
      { frase: "Te mereces la misma amabilidad que le das a los demás.", ritual: "Cierra los ojos. Imagina que te estás dando un abrazo a ti misma. Date una palmada suave en el hombro." },
      { frase: "Eres suficiente, exactamente como estás hoy.", ritual: "Cierra los ojos. Inhala profundo y al exhalar, repite mentalmente: \"Soy suficiente\". Siente la verdad de estas palabras en tu cuerpo." },
      { frase: "Perdónate por lo que no sabías antes; hiciste lo mejor que pudiste.", ritual: "Cierra los ojos. Exhala la culpa. Imagina que estás soltando un peso que te impedía avanzar." },
      { frase: "Eres el proyecto más importante y sagrado de tu vida.", ritual: "Cierra los ojos. Haz una reverencia a tu propio ser, reconociendo tu valor y potencial." },
      { frase: "Ámate profunda y sinceramente, incluso en tus días de caos.", ritual: "Cierra los ojos. Pon una mano en tu corazón y otra en tu abdomen. Siente el amor fluyendo entre tus manos." },
      { frase: "Tu valor no depende jamás de tus resultados externos.", ritual: "Cierra los ojos. Sonríe sin motivo. Imagina que estás brillando con tu propia luz, independientemente de lo que pase afuera." },
      { frase: "Gracias de corazón por dedicarte este tiempo.", ritual: "Cierra los ojos. Acaricia suavemente tus brazos. Agradécete a ti misma por este acto de amor propio." },
      { frase: "Eres una obra en construcción constante. Disfruta el proceso.", ritual: "Cierra los ojos. Inhala curiosidad e imaginación. Imagina que estás creando la mejor versión de ti misma." },
      { frase: "No te compares con nadie más; tú eres tu única competencia.", ritual: "Cierra los ojos. Mira hacia adelante con decisión. Imagina que estás corriendo tu propia carrera, sin rivales." },
      { frase: "Celebra todas tus pequeñas victorias diarias.", ritual: "Cierra los ojos. Piensa en algo bueno que hayas hecho hoy, por pequeño que sea, y sonríe." },
      { frase: "Date permiso para ser vulnerable y auténtica.", ritual: "Cierra los ojos. Suelta la tensión del pecho. Imagina que te estás quitando una máscara y mostrando tu verdadero ser." },
      { frase: "Eres digna de calma, paz y bienestar.", ritual: "Cierra los ojos. Respira profundo y lento, imaginando que estás absorbiendo bienestar. Siente cómo te mereces esta paz." },
      { frase: "Eres increíblemente capaz, mucho más de lo que crees.", ritual: "Cierra los ojos. Siente tu fuerza interna brillando como un diamante. Confía en tu potencial." },
      { frase: "Tu mayor amor debe ser hacia ti misma.", ritual: "Cierra los ojos. Susúrrate suavemente: \"Estoy aquí\". Siente la comodidad de ser tu propia compañía." },
      { frase: "No te dejes jamás para después; eres una prioridad.", ritual: "Cierra los ojos. Haz una inhalación consciente, imaginando que estás poniéndote en primer lugar." },
      { frase: "Tus necesidades importan; atiéndelas con amor.", ritual: "Cierra los ojos. Identifica qué necesitas ahora y dáselo con ternura, sin culpa." },
      { frase: "Eres luz para los demás, pero también debes serlo para ti.", ritual: "Cierra los ojos. Visualiza una luz brillando en tu centro y extendiéndose por todo tu cuerpo, iluminándote." },
      { frase: "Hablarte bien es un acto de rebeldía y amor.", ritual: "Cierra los ojos. Di \"gracias\" en voz alta, dirigiéndote a ti misma con cariño y respeto." },
      { frase: "Confía en tu propio criterio, incluso si otros no lo comparten.", ritual: "Cierra los ojos. Asiente con seguridad, reafirmando tu confianza en tu intuición y decisiones." },
      { frase: "Eres la arquitecta de tu propio bienestar.", ritual: "Cierra los ojos. Ajusta tu postura, erguida y segura, imaginando que estás construyendo tu felicidad." },
      { frase: "Gracias de corazón por elegirte hoy, una y otra vez.", ritual: "Cierra los ojos. Inhala agradecimiento e imaginación. Siente cómo te mereces este amor propio." },
      { frase: "Tu felicidad es tu responsabilidad sagrada.", ritual: "Cierra los ojos. Elige un pensamiento feliz y concéntrate en la alegría que te produce." },
      { frase: "Eres magia pura, aunque a veces lo olvides.", ritual: "Cierra los ojos y sonríe. Siente la chispa de la vida brillando en tu interior." },
      { frase: "Hoy lo hiciste increíble, sin importar los resultados.", ritual: "Cierra los ojos. Date un pequeño masaje en el cuello, reconociendo tu esfuerzo y dedicación." },
      { frase: "Tu esencia es paz y amor incondicional.", ritual: "Cierra los ojos. Inhala profundo y al exhalar, imagina que estás expandiendo paz y amor por todo el universo." },
    ],
  },
];

// Aplanar todas las tarjetas con metadata de bloque
const todasLasTarjetas = bloques.flatMap((b, bi) =>
  b.tarjetas.map((t, ti) => ({ ...t, bloqueIdx: bi, bloque: b.nombre, color: b.color, colorLight: b.colorLight, id: `${bi}-${ti}` }))
);

/* ─────────────────────────────────────────────
   SVG — Forma ondulada (como las cartas físicas)
───────────────────────────────────────────── */
function WavyCardShape({ width = 300, height = 420, fill = "#fff", border = "#e0b0d0", className = "", style = {} }) {
  // Clip path con bordes ondulados izquierda y derecha
  const id = `wavy-${Math.random().toString(36).slice(2, 7)}`;
  const waves = 6;
  const amp = 10;
  const waveH = height / waves;

  // Puntos del lado izquierdo (ondulado) de arriba a abajo
  let leftPath = `M ${amp} 0 `;
  for (let i = 0; i < waves; i++) {
    const y1 = i * waveH + waveH * 0.25;
    const y2 = i * waveH + waveH * 0.75;
    const y3 = (i + 1) * waveH;
    leftPath += `C 0 ${y1}, 0 ${y2}, ${amp} ${y3} `;
  }
  // Lado derecho (ondulado) de abajo a arriba
  let rightPath = `L ${width - amp} ${height} `;
  for (let i = waves - 1; i >= 0; i--) {
    const y1 = i * waveH + waveH * 0.75;
    const y2 = i * waveH + waveH * 0.25;
    const y3 = i * waveH;
    rightPath += `C ${width} ${y1}, ${width} ${y2}, ${width - amp} ${y3} `;
  }
  rightPath += "Z";

  const d = leftPath + rightPath;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", width: "100%", height: "100%", ...style }}
      className={className}
    >
      <defs>
        <filter id={`shadow-${id}`} x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="8" stdDeviation="16" floodColor="rgba(120,60,180,0.18)" />
        </filter>
      </defs>
      <path d={d} fill={fill} stroke={border} strokeWidth="1.5" filter={`url(#shadow-${id})`} />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   COMPONENTE CARTA — con flip animado
───────────────────────────────────────────── */
function Carta({ tarjeta, flipped, onFlip }) {
  const bloque = bloques[tarjeta.bloqueIdx];

  return (
    <div
      onClick={onFlip}
      style={{
        perspective: "1400px",
        cursor: "pointer",
        width: "100%",
        maxWidth: 320,
        height: 460,
        margin: "0 auto",
        userSelect: "none",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transition: "transform 0.75s cubic-bezier(0.35, 0.1, 0.25, 1.3)",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* ── DORSO ── */}
        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden" }}>
          <div style={{ position: "relative", width: "100%", height: "100%" }}>
            <WavyCardShape fill={bloque.color} border={bloque.color} />
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 18,
            }}>
              {/* Rayas decorativas horizontales como en las cartas físicas */}
              <div style={{ width: "62%", display: "flex", flexDirection: "column", gap: 6 }}>
                {[...Array(5)].map((_, i) => (
                  <div key={i} style={{
                    height: 6, borderRadius: 3,
                    background: "rgba(255,255,255,0.22)",
                  }} />
                ))}
              </div>
              <div style={{
                fontFamily: "'Nunito', sans-serif",
                fontSize: 28,
                fontWeight: 800,
                color: "rgba(255,255,255,0.9)",
                letterSpacing: "0.04em",
                textShadow: "0 2px 12px rgba(0,0,0,0.18)",
              }}>
                Flow
              </div>
              <div style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.55)",
                fontFamily: "'Nunito', sans-serif",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}>
                Toca para revelar
              </div>
            </div>
          </div>
        </div>

        {/* ── FRENTE ── */}
        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
          <div style={{ position: "relative", width: "100%", height: "100%" }}>
            <WavyCardShape fill="#ffffff" border={tarjeta.color + "55"} />
            {/* Stripe superior de color */}
            <div style={{
              position: "absolute",
              top: 0, left: "10%", right: "10%",
              height: 10,
              background: `linear-gradient(90deg, ${tarjeta.color}99, ${tarjeta.color}, ${tarjeta.color}99)`,
              borderRadius: "0 0 6px 6px",
            }} />
            {/* Stripe inferior de color */}
            <div style={{
              position: "absolute",
              bottom: 0, left: "10%", right: "10%",
              height: 10,
              background: `linear-gradient(90deg, ${tarjeta.color}99, ${tarjeta.color}, ${tarjeta.color}99)`,
              borderRadius: "6px 6px 0 0",
            }} />

            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "space-between",
              padding: "28px 26px 24px",
            }}>
              {/* Badge bloque */}
              <div style={{
                background: tarjeta.colorLight,
                border: `1.5px solid ${tarjeta.color}44`,
                borderRadius: 20,
                padding: "5px 14px",
                fontSize: 11,
                fontFamily: "'Nunito', sans-serif",
                fontWeight: 700,
                color: tarjeta.color,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}>
                {bloque.icon} {tarjeta.bloque}
              </div>

              {/* Frase principal */}
              <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "12px 0" }}>
                <p style={{
                  fontFamily: "'Nunito', sans-serif",
                  fontSize: 19,
                  fontWeight: 700,
                  lineHeight: 1.5,
                  color: C.text,
                  textAlign: "center",
                  margin: 0,
                }}>
                  {tarjeta.frase}
                </p>
              </div>

              {/* Divisor */}
              <div style={{
                width: "100%",
                height: 1,
                background: `linear-gradient(90deg, transparent, ${tarjeta.color}66, transparent)`,
                margin: "4px 0 12px",
              }} />

              {/* Micro-ritual */}
              <div style={{
                background: tarjeta.colorLight,
                borderRadius: 12,
                padding: "12px 14px",
                width: "100%",
              }}>
                <p style={{
                  fontSize: 10,
                  fontFamily: "'Nunito', sans-serif",
                  fontWeight: 800,
                  color: tarjeta.color,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  margin: "0 0 5px",
                }}>
                  Micro-ritual
                </p>
                <p style={{
                  fontFamily: "'Nunito', sans-serif",
                  fontSize: 12.5,
                  lineHeight: 1.6,
                  color: C.textMid,
                  margin: 0,
                }}>
                  {tarjeta.ritual}
                </p>
              </div>

              {/* Marca */}
              <p style={{
                fontFamily: "'Nunito', sans-serif",
                fontSize: 11,
                fontWeight: 800,
                color: tarjeta.color,
                letterSpacing: "0.12em",
                margin: "10px 0 0",
                opacity: 0.6,
              }}>
                PUMP & FLOW
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   APP PRINCIPAL
───────────────────────────────────────────── */
export default function App() {
  const [bloqueActivo, setBloqueActivo] = useState(null); // null = aleatorio de todo
  const [pool, setPool] = useState([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [animSalida, setAnimSalida] = useState(false);
  const [mostrarRitual, setMostrarRitual] = useState(false);

  // Mezcla aleatoria
  const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

  useEffect(() => {
    const src = bloqueActivo === null
      ? todasLasTarjetas
      : todasLasTarjetas.filter(t => t.bloqueIdx === bloqueActivo);
    setPool(shuffle(src));
    setIdx(0);
    setFlipped(false);
    setMostrarRitual(false);
  }, [bloqueActivo]);

  const tarjetaActual = pool[idx] || todasLasTarjetas[0];

  const siguiente = useCallback(() => {
    if (animSalida) return;
    setAnimSalida(true);
    setFlipped(false);
    setMostrarRitual(false);
    setTimeout(() => {
      setIdx(i => (i + 1) % pool.length);
      setAnimSalida(false);
    }, 350);
  }, [animSalida, pool.length]);

  const anterior = useCallback(() => {
    if (animSalida) return;
    setAnimSalida(true);
    setFlipped(false);
    setMostrarRitual(false);
    setTimeout(() => {
      setIdx(i => (i - 1 + pool.length) % pool.length);
      setAnimSalida(false);
    }, 350);
  }, [animSalida, pool.length]);

  const bloqueSel = bloqueActivo !== null ? bloques[bloqueActivo] : null;
  const progreso = pool.length > 0 ? Math.round(((idx + 1) / pool.length) * 100) : 0;

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(160deg, #f8eeff 0%, #fde8f4 40%, #ebe0ff 100%)`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      fontFamily: "'Nunito', sans-serif",
      position: "relative",
      overflowX: "hidden",
    }}>
      {/* Import Nunito */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #d4a0e8; border-radius: 2px; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeOut { from { opacity:1; transform:translateY(0) scale(1); } to { opacity:0; transform:translateY(-12px) scale(0.97); } }
        @keyframes pulse { 0%,100%{transform:scale(1);} 50%{transform:scale(1.06);} }
      `}</style>

      {/* Círculos decorativos de fondo */}
      <div style={{ position:"fixed", top:-80, right:-60, width:260, height:260, borderRadius:"50%", background:"rgba(224,64,160,0.07)", pointerEvents:"none", zIndex:0 }} />
      <div style={{ position:"fixed", bottom:-60, left:-40, width:200, height:200, borderRadius:"50%", background:"rgba(124,77,187,0.08)", pointerEvents:"none", zIndex:0 }} />

      <div style={{ width:"100%", maxWidth:440, padding:"0 20px 48px", position:"relative", zIndex:1 }}>

        {/* ── HEADER ── */}
        <div style={{ textAlign:"center", padding:"36px 0 20px" }}>
          <p style={{ fontSize:10, letterSpacing:"0.3em", color:C.textLight, textTransform:"uppercase", margin:"0 0 6px", fontWeight:800 }}>
            Pump & Flow
          </p>
          <h1 style={{ fontSize:30, color:C.text, margin:0, fontWeight:900, lineHeight:1.2 }}>
            Conexión Interna
          </h1>
          <p style={{ fontSize:14, color:C.textMid, margin:"6px 0 0", fontWeight:600 }}>
            Mazo CaroFluye · {todasLasTarjetas.length} tarjetas
          </p>
        </div>

        {/* ── FILTROS POR BLOQUE ── */}
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center", marginBottom:28 }}>
          <button
            onClick={() => setBloqueActivo(null)}
            style={{
              padding:"7px 16px",
              borderRadius:20,
              border:`2px solid ${bloqueActivo === null ? C.purple : "transparent"}`,
              background: bloqueActivo === null ? C.lilacLight : "rgba(255,255,255,0.6)",
              color: bloqueActivo === null ? C.purple : C.textMid,
              fontFamily:"'Nunito', sans-serif",
              fontSize:12,
              fontWeight:800,
              cursor:"pointer",
              transition:"all 0.2s",
              letterSpacing:"0.04em",
            }}
          >
            ✦ Todas
          </button>
          {bloques.map((b, i) => (
            <button
              key={i}
              onClick={() => setBloqueActivo(i)}
              style={{
                padding:"7px 16px",
                borderRadius:20,
                border:`2px solid ${bloqueActivo === i ? b.color : "transparent"}`,
                background: bloqueActivo === i ? b.colorLight : "rgba(255,255,255,0.6)",
                color: bloqueActivo === i ? b.color : C.textMid,
                fontFamily:"'Nunito', sans-serif",
                fontSize:12,
                fontWeight:800,
                cursor:"pointer",
                transition:"all 0.2s",
              }}
            >
              {b.icon} {b.nombre}
            </button>
          ))}
        </div>

        {/* ── CARTA ── */}
        <div style={{
          animation: animSalida ? "fadeOut 0.3s ease forwards" : "fadeIn 0.45s ease",
        }}>
          <Carta
            tarjeta={tarjetaActual}
            flipped={flipped}
            onFlip={() => setFlipped(f => !f)}
          />
        </div>

        {/* ── HINT ── */}
        {!flipped && (
          <p style={{
            textAlign:"center", fontSize:12, color:C.textLight,
            fontWeight:700, letterSpacing:"0.08em", margin:"16px 0 0",
            animation:"fadeIn 0.4s ease",
          }}>
            Toca la carta para revelarla
          </p>
        )}

        {/* ── BOTONES NAVEGACIÓN ── */}
        <div style={{ display:"flex", gap:12, justifyContent:"center", marginTop:24, flexWrap:"wrap" }}>
          <button
            onClick={anterior}
            style={{
              width:48, height:48,
              borderRadius:"50%",
              border:"2px solid rgba(180,120,220,0.3)",
              background:"rgba(255,255,255,0.7)",
              color:C.textMid,
              fontSize:20,
              cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center",
              transition:"all 0.2s",
              backdropFilter:"blur(4px)",
            }}
            onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,1)"}
            onMouseLeave={e => e.currentTarget.style.background="rgba(255,255,255,0.7)"}
          >‹</button>

          <button
            onClick={siguiente}
            style={{
              flex:1,
              maxWidth:180,
              height:48,
              borderRadius:24,
              border:"none",
              background:`linear-gradient(135deg, ${tarjetaActual.color}, ${tarjetaActual.color}bb)`,
              color:"#fff",
              fontFamily:"'Nunito', sans-serif",
              fontSize:14,
              fontWeight:800,
              cursor:"pointer",
              letterSpacing:"0.04em",
              boxShadow:`0 6px 24px ${tarjetaActual.color}44`,
              transition:"all 0.2s",
            }}
            onMouseEnter={e => e.currentTarget.style.transform="scale(1.03)"}
            onMouseLeave={e => e.currentTarget.style.transform="scale(1)"}
          >
            Nueva carta ✦
          </button>

          <button
            onClick={() => { setPool(p => shuffle(p)); setIdx(0); setFlipped(false); setMostrarRitual(false); }}
            title="Mezclar"
            style={{
              width:48, height:48,
              borderRadius:"50%",
              border:"2px solid rgba(180,120,220,0.3)",
              background:"rgba(255,255,255,0.7)",
              color:C.textMid,
              fontSize:18,
              cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center",
              transition:"all 0.2s",
              backdropFilter:"blur(4px)",
            }}
            onMouseEnter={e => { e.currentTarget.style.background="rgba(255,255,255,1)"; e.currentTarget.style.transform="rotate(180deg)"; }}
            onMouseLeave={e => { e.currentTarget.style.background="rgba(255,255,255,0.7)"; e.currentTarget.style.transform="rotate(0deg)"; }}
          >⟳</button>
        </div>

        {/* ── BARRA DE PROGRESO ── */}
        <div style={{ marginTop:24 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ fontSize:11, color:C.textLight, fontWeight:700, letterSpacing:"0.08em" }}>
              {bloqueSel ? bloqueSel.nombre : "Mazo completo"}
            </span>
            <span style={{ fontSize:11, color:C.textLight, fontWeight:700 }}>
              {idx + 1} / {pool.length}
            </span>
          </div>
          <div style={{ height:5, background:"rgba(180,120,220,0.15)", borderRadius:3 }}>
            <div style={{
              height:"100%",
              width:`${progreso}%`,
              background:`linear-gradient(90deg, ${tarjetaActual.color}, ${tarjetaActual.color}88)`,
              borderRadius:3,
              transition:"width 0.4s ease",
            }} />
          </div>
        </div>

        {/* ── STATS POR BLOQUE ── */}
        <div style={{
          display:"grid", gridTemplateColumns:"repeat(2, 1fr)",
          gap:10, marginTop:24,
        }}>
          {bloques.map((b, i) => (
            <button
              key={i}
              onClick={() => setBloqueActivo(bloqueActivo === i ? null : i)}
              style={{
                background:"rgba(255,255,255,0.65)",
                border:`1.5px solid ${bloqueActivo === i ? b.color : "rgba(200,160,230,0.25)"}`,
                borderRadius:14,
                padding:"12px 14px",
                cursor:"pointer",
                textAlign:"left",
                backdropFilter:"blur(6px)",
                transition:"all 0.2s",
              }}
              onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.9)"}
              onMouseLeave={e => e.currentTarget.style.background="rgba(255,255,255,0.65)"}
            >
              <div style={{ fontSize:16, marginBottom:2 }}>{b.icon}</div>
              <div style={{ fontSize:12, fontWeight:800, color:b.color }}>{b.nombre}</div>
              <div style={{ fontSize:11, color:C.textLight, fontWeight:600 }}>{b.tarjetas.length} cartas</div>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}
