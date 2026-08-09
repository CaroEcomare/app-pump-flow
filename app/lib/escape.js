// Escapa texto que viene de la base de datos antes de meterlo en un
// template string que se asigna a innerHTML. Sin esto, el nombre que
// escribe una alumna al registrarse se ejecutaría como HTML/JS en la
// sesión de la administradora.
export function escaparHTML(valor) {
  if (valor === null || valor === undefined) return '';
  return String(valor)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
