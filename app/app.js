import { supabase } from './supabase-client.js';
import { obtenerSesionActual, asegurarPerfil, cerrarSesion, registrar, iniciarSesionConIdentificador } from './auth.js';
import { generarClases, procesarAsistenciasPasadas } from './data.js';
import { montarVistaAlumna } from './alumna.js';
import { montarVistaAdmin } from './admin.js';

const pantallaAuth = document.getElementById('pantalla-auth');
const pantallaAlumna = document.getElementById('pantalla-alumna');
const pantallaAdmin = document.getElementById('pantalla-admin');
const switchVistas = document.getElementById('switch-vistas');

function mostrarPantalla(id) {
  pantallaAuth.classList.remove('on');
  pantallaAlumna.classList.remove('on');
  pantallaAdmin.classList.remove('on');
  document.getElementById(id).classList.add('on');
}

async function entrarConSesion(session) {
  const perfil = await asegurarPerfil(session.user);
  generarClases(supabase).catch((err) => console.warn('No se pudieron generar clases:', err.message));
  procesarAsistenciasPasadas(supabase).catch((err) => console.warn('No se pudieron procesar asistencias pasadas:', err.message));

  if (perfil.es_admin) {
    switchVistas.style.display = 'flex';
    await montarVistaAlumna({ supabase, alumnaId: perfil.id, nombre: perfil.nombre, onCerrarSesion: manejarLogout });
    await montarVistaAdmin({ supabase, onCerrarSesion: manejarLogout });
    mostrarPantalla('pantalla-admin');
  } else {
    switchVistas.style.display = 'none';
    await montarVistaAlumna({ supabase, alumnaId: perfil.id, nombre: perfil.nombre, onCerrarSesion: manejarLogout });
    mostrarPantalla('pantalla-alumna');
  }
}

async function manejarLogout() {
  await cerrarSesion();
  // Recargar limpia el DOM ya renderizado (nombres, paquetes, pendientes),
  // oculta el switch de vistas y evita listeners duplicados al volver a montar.
  location.reload();
}

switchVistas.querySelectorAll('button').forEach((btn) => {
  btn.addEventListener('click', () => {
    switchVistas.querySelectorAll('button').forEach((b) => b.classList.remove('on'));
    btn.classList.add('on');
    mostrarPantalla(btn.dataset.pantalla);
  });
});

document.getElementById('switch-auth').querySelectorAll('button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#switch-auth button').forEach((b) => b.classList.remove('on'));
    btn.classList.add('on');
    document.getElementById('form-login').style.display = btn.dataset.modo === 'login' ? 'block' : 'none';
    document.getElementById('form-registro').style.display = btn.dataset.modo === 'registro' ? 'block' : 'none';
  });
});

document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('login-error');
  errorEl.style.display = 'none';
  try {
    const { session } = await iniciarSesionConIdentificador({
      identificador: document.getElementById('login-identificador').value,
      contrasena: document.getElementById('login-contrasena').value,
    });
    await entrarConSesion(session);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  }
});

document.getElementById('form-registro').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('registro-error');
  errorEl.style.display = 'none';
  try {
    const { session } = await registrar({
      correo: document.getElementById('registro-correo').value,
      contrasena: document.getElementById('registro-contrasena').value,
      nombre: document.getElementById('registro-nombre').value,
      telefono: document.getElementById('registro-telefono').value,
      plataforma: document.getElementById('registro-plataforma').value,
    });
    e.target.reset();
    // Normalmente la sesión llega lista y se entra directo. Solo viene vacía
    // si en Supabase sigue encendida la confirmación por correo; en ese caso
    // avisamos en vez de tronar al leer session.user.
    if (!session) {
      errorEl.textContent = 'Tu cuenta se creó. Revisa tu correo para confirmarla y luego inicia sesión.';
      errorEl.style.display = 'block';
      return;
    }
    await entrarConSesion(session);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  }
});

try {
  const sesion = await obtenerSesionActual();
  if (sesion) {
    await entrarConSesion(sesion);
  } else {
    mostrarPantalla('pantalla-auth');
  }
} catch (err) {
  switchVistas.style.display = 'none';
  mostrarPantalla('pantalla-auth');
  alert(`No pudimos abrir tu sesión: ${err.message}\n\nRecarga la página, por favor 🤍`);
}
