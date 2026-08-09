// Helpers de interfaz compartidos entre la vista de alumna y la de admin.
// Viven fuera de app/lib/ porque tocan el DOM (app/lib/ es lógica pura con pruebas).

export function wireTabs(pantallaId) {
  const pantalla = document.getElementById(pantallaId);
  if (!pantalla) return;
  pantalla.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => {
      pantalla.querySelectorAll('.tab').forEach((x) => x.classList.remove('on'));
      pantalla.querySelectorAll('.screen').forEach((x) => x.classList.remove('active'));
      t.classList.add('on');
      pantalla.querySelector(`#${t.dataset.s}`).classList.add('active');
    });
  });
}

// Muestra un mensaje de error visible justo después del control que falló.
// Usa textContent (nunca innerHTML) para que el mensaje del servidor no
// pueda inyectar HTML.
export function mostrarErrorCerca(elemento, mensaje) {
  if (!elemento || !elemento.insertAdjacentElement) {
    alert(mensaje);
    return;
  }
  let caja = elemento.nextElementSibling;
  if (!caja || !caja.classList.contains('error-inline')) {
    caja = document.createElement('div');
    caja.className = 'badge err error-inline';
    caja.style.marginTop = '10px';
    elemento.insertAdjacentElement('afterend', caja);
  }
  caja.textContent = mensaje;
  caja.style.display = 'block';
}

export function limpiarErrorCerca(elemento) {
  const caja = elemento?.nextElementSibling;
  if (caja && caja.classList.contains('error-inline')) caja.remove();
}
