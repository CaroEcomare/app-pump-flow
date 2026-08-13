import {
  listarClasesProximas, obtenerMisReservas, apartarLugar, cancelarReserva,
  obtenerPaqueteActivo, obtenerMisAsistencias,
} from './data.js';
import { hoyISO, esHoy, formatHora12, formatDiaMesConDia } from './lib/date-utils.js';
import {
  reservasFuturas, proximaReserva, estadoPaquete, estadoAsistenciaBadge,
  puntosCupo, estadoClase, cupoDisponible, puedeApartar, puedeCancelar,
} from './lib/status.js';
import { escaparHTML } from './lib/escape.js';
import { wireTabs, mostrarErrorCerca } from './ui.js';

const SEMANAS_PARA_RESERVAR = 1;

export async function montarVistaAlumna({ supabase, alumnaId, nombre, onCerrarSesion }) {
  const primerNombre = (nombre ?? '').trim().split(' ')[0] || 'aquí';
  document.getElementById('a-inicio-saludo').textContent = `Hola, ${primerNombre} 🤍`;

  wireTabs('pantalla-alumna');
  wireLogout('a-espacio', onCerrarSesion);

  await Promise.all([
    renderInicio(supabase, alumnaId),
    renderClases(supabase, alumnaId),
    renderEspacio(supabase, alumnaId),
  ]);
}

async function renderInicio(supabase, alumnaId) {
  const [reservas, paquete] = await Promise.all([
    obtenerMisReservas(supabase, alumnaId),
    obtenerPaqueteActivo(supabase, alumnaId),
  ]);
  const proxima = proximaReserva(reservas);
  const contProxima = document.getElementById('a-inicio-proxima-clase');
  const contPaquete = document.getElementById('a-inicio-paquete');

  if (!proxima) {
    contProxima.innerHTML = `
      <div class="card" style="background:var(--pf-lavanda);color:#fff">
        <b style="font:var(--text-h3)">Aún no tienes clase apartada</b>
        <div style="font:var(--text-small);margin:6px 0 12px">Ve a "Clases" y aparta tu espacio para tu próxima sesión.</div>
      </div>`;
  } else {
    const hoy = esHoy(proxima.fecha);
    contProxima.innerHTML = `
      <div class="card" style="background:var(--pf-lavanda);color:#fff">
        <div class="row"><b style="font:var(--text-h3)">Hipopresivos grupal</b><span class="badge" style="background:#fff">${hoy ? 'Hoy' : escaparHTML(formatDiaMesConDia(proxima.fecha))} ${escaparHTML(formatHora12(proxima.hora))}</span></div>
        <div style="font:var(--text-small);color:#fff;margin:6px 0 12px">Presencial</div>
      </div>`;
  }

  await renderMisReservas(supabase, alumnaId);

  const estado = estadoPaquete(paquete, hoyISO());
  contPaquete.innerHTML = renderTarjetaPaquete(paquete, estado);
}

async function renderMisReservas(supabase, alumnaId) {
  const reservas = await obtenerMisReservas(supabase, alumnaId);
  const futuras = reservasFuturas(reservas);
  const cont = document.getElementById('a-inicio-mis-reservas');

  if (futuras.length === 0) {
    cont.innerHTML = '';
    return;
  }

  cont.innerHTML = `
    <div class="card">
      <b style="color:var(--text-title)">Tus próximas reservas</b>
      ${futuras.map((r) => {
        const puedeCancelarEsta = puedeCancelar(r.fecha, r.hora);
        return `
          <div class="dato">
            <span>${escaparHTML(formatDiaMesConDia(r.fecha))} · ${escaparHTML(formatHora12(r.hora))}</span>
            ${puedeCancelarEsta
              ? `<button class="pillbtn soft cancelar-reserva" data-clase-id="${escaparHTML(r.claseId)}" style="padding:7px 16px;min-height:36px;font-size:13px">No podré asistir</button>`
              : ''}
          </div>`;
      }).join('')}
      <div class="muted" style="margin-top:8px">Puedes cancelar hasta 12 horas antes de tu clase</div>
    </div>`;

  cont.querySelectorAll('.cancelar-reserva').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await cancelarReserva(supabase, alumnaId, Number(btn.dataset.claseId));
        await Promise.all([renderInicio(supabase, alumnaId), renderClases(supabase, alumnaId)]);
      } catch (err) {
        btn.disabled = false;
        mostrarErrorCerca(btn, `No se pudo cancelar: ${err.message}`);
      }
    });
  });
}

async function renderClases(supabase, alumnaId) {
  const [clasesVisibles, reservas] = await Promise.all([
    listarClasesProximas(supabase, SEMANAS_PARA_RESERVAR),
    obtenerMisReservas(supabase, alumnaId),
  ]);
  // Si tiene al menos una clase personal asignada, solo ve esas (nada de
  // grupales); si no tiene ninguna, ve las grupales de siempre. Las clases
  // de alguien más nunca llegan aquí, eso ya lo bloquea RLS en Supabase.
  const tienePersonales = clasesVisibles.some((c) => c.alumnaAsignada?.id === alumnaId);
  const clases = tienePersonales
    ? clasesVisibles.filter((c) => c.alumnaAsignada?.id === alumnaId)
    : clasesVisibles;
  const idsReservados = new Set(reservas.map((r) => r.claseId));
  const cont = document.getElementById('a-clases-lista');
  cont.innerHTML = clases.map((c) => {
    const yaReservada = idsReservados.has(c.id);
    const estado = estadoClase(c.cupo, c.reservasCount);
    const puntos = puntosCupo(c.cupo, c.reservasCount)
      .map((ocupado) => `<i class="cupo ${ocupado ? '' : 'libre'}"></i>`).join('');
    const disponibles = cupoDisponible(c.cupo, c.reservasCount);
    const dentroDeVentana = puedeApartar(c.fecha, c.hora);
    let boton;
    if (yaReservada) {
      boton = puedeCancelar(c.fecha, c.hora)
        ? `<button class="pillbtn soft cancelar-desde-clases" style="width:100%" data-clase-id="${escaparHTML(c.id)}">Cancelar</button>`
        : `<button class="pillbtn soft" style="width:100%" disabled>Tu lugar está apartado ✨</button>`;
    } else if (estado === 'llena') {
      boton = `<button class="pillbtn soft" style="width:100%" disabled>Sin lugares</button>`;
    } else if (!dentroDeVentana) {
      const mensaje = encodeURIComponent(`Hola Caro, quiero checar disponibilidad para la clase del ${formatDiaMesConDia(c.fecha)} a las ${formatHora12(c.hora)} 🤍`);
      boton = `<a class="pillbtn soft" style="width:100%;text-align:center;text-decoration:none;display:block;box-sizing:border-box" href="https://wa.me/524431331146?text=${mensaje}" target="_blank">Mándame mensaje para verificar disponibilidad</a>`;
    } else {
      boton = `<button class="pillbtn apartar-clase" style="width:100%" data-clase-id="${escaparHTML(c.id)}">Aparto mi espacio</button>`;
    }
    return `
      <div class="card" style="${estado === 'llena' && !yaReservada ? 'opacity:.6' : ''}">
        <div class="row"><b style="color:var(--text-title)">${escaparHTML(formatDiaMesConDia(c.fecha))}</b>
          <span class="badge ${estado === 'llena' ? 'err' : ''}">${estado === 'llena' ? 'Llena' : escaparHTML(formatHora12(c.hora))}</span></div>
        <div class="cupos">${puntos}</div>
        <div class="muted" style="margin:6px 0 12px">${estado === 'llena' ? 'Sin lugares' : `${disponibles} lugar${disponibles === 1 ? '' : 'es'} disponible${disponibles === 1 ? '' : 's'}`}</div>
        ${boton}
      </div>`;
  }).join('') || '<div class="muted">Aún no hay clases programadas, vuelve pronto 🤍</div>';

  cont.querySelectorAll('.cancelar-desde-clases').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await cancelarReserva(supabase, alumnaId, Number(btn.dataset.claseId));
        await Promise.all([renderClases(supabase, alumnaId), renderInicio(supabase, alumnaId)]);
      } catch (err) {
        btn.disabled = false;
        mostrarErrorCerca(btn, `No se pudo cancelar: ${err.message}`);
      }
    });
  });

  cont.querySelectorAll('.apartar-clase').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await apartarLugar(supabase, alumnaId, Number(btn.dataset.claseId));
        await Promise.all([renderClases(supabase, alumnaId), renderInicio(supabase, alumnaId)]);
      } catch (err) {
        btn.disabled = false;
        const yaLlena = /llena/i.test(err.message);
        mostrarErrorCerca(btn, yaLlena ? 'Esta clase ya está llena, elige otro horario 🤍' : `No se pudo apartar tu lugar: ${err.message}`);
      }
    });
  });
}

async function renderEspacio(supabase, alumnaId) {
  const [paquete, asistencias] = await Promise.all([
    obtenerPaqueteActivo(supabase, alumnaId),
    obtenerMisAsistencias(supabase, alumnaId),
  ]);
  const estado = estadoPaquete(paquete, hoyISO());
  document.getElementById('a-espacio-paquete').innerHTML = `<div class="card">${renderDatosPaquete(paquete, estado)}</div>`;
  document.getElementById('a-espacio-asistencias').innerHTML = `
    <div class="card">
      <b style="color:var(--text-title)">Tus asistencias</b>
      ${asistencias.length === 0 ? '<div class="muted" style="margin-top:8px">Aún no tienes asistencias registradas</div>' : asistencias.map((a) => {
        const badge = estadoAsistenciaBadge({ confirmada_admin: a.confirmadaAdmin });
        const texto = badge === 'confirmada' ? 'Confirmada' : 'Pendiente';
        const clase = badge === 'confirmada' ? 'ok' : 'warn';
        return `<div class="dato"><span>${escaparHTML(formatDiaMesConDia(a.fecha))} · ${escaparHTML(formatHora12(a.hora))}</span><span class="badge ${clase}">${texto}</span></div>`;
      }).join('')}
    </div>`;
}

function renderTarjetaPaquete(paquete, estado) {
  if (estado === 'sin_paquete') {
    return `<div class="card"><b style="color:var(--text-title)">Tu paquete</b><div class="muted" style="margin-top:8px">Aún no tienes un paquete activo. Pregúntale a Caro para activarlo.</div></div>`;
  }
  const restantes = paquete.clases_totales - paquete.clases_usadas;
  const porcentaje = Math.round((restantes / paquete.clases_totales) * 100);
  return `
    <div class="card">
      <div class="row"><b style="color:var(--text-title)">Tu paquete</b><span class="badge">Quedan ${escaparHTML(restantes)} de ${escaparHTML(paquete.clases_totales)}</span></div>
      <div class="prog"><i style="width:${Number(porcentaje) || 0}%"></i></div>
      <div class="muted" style="margin-top:8px">${paquete.vence ? `Tu siguiente pago es el ${escaparHTML(formatDiaMesConDia(paquete.vence))}` : ''}</div>
    </div>`;
}

function renderDatosPaquete(paquete, estado) {
  if (estado === 'sin_paquete') {
    return `<b style="color:var(--text-title)">Tu paquete</b><div class="muted" style="margin-top:8px">Aún no tienes un paquete activo.</div>`;
  }
  return `
    <b style="color:var(--text-title)">Tu paquete</b>
    <div class="dato"><span>Clases restantes</span><b>${escaparHTML(paquete.clases_totales - paquete.clases_usadas)} de ${escaparHTML(paquete.clases_totales)}</b></div>
    <div class="dato"><span>Último pago</span><b>${paquete.monto ? `$${escaparHTML(paquete.monto)} · ` : ''}${paquete.fecha_pago ? escaparHTML(formatDiaMesConDia(paquete.fecha_pago)) : '—'}</b></div>
    <div class="dato"><span>Siguiente pago</span><b>${paquete.vence ? escaparHTML(formatDiaMesConDia(paquete.vence)) : '—'}</b></div>
    <div class="dato"><span>Forma de pago</span><b>${paquete.forma_pago ? escaparHTML(paquete.forma_pago) : '—'}</b></div>`;
}

function wireLogout(screenId, onCerrarSesion) {
  if (!onCerrarSesion) return;
  document.getElementById(screenId).querySelector('.btn-logout')?.addEventListener('click', onCerrarSesion);
}
