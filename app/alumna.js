import {
  listarClasesProximas, obtenerMisReservas, hacerCheckin,
  apartarLugar, obtenerPaqueteActivo, obtenerMisAsistencias,
} from './data.js';
import { hoyISO, esHoy, formatHora12, formatDiaMesConDia, formatMesAno } from './lib/date-utils.js';
import { proximaReserva, estadoPaquete, estadoAsistenciaBadge, puntosCupo, estadoClase, cupoDisponible } from './lib/status.js';

export async function montarVistaAlumna({ supabase, alumnaId, nombre, onCerrarSesion }) {
  document.getElementById('a-inicio-saludo').textContent = `Hola, ${nombre.split(' ')[0]} 🤍`;

  wireTabs('pantalla-alumna');
  wireLogout('a-espacio', onCerrarSesion);
  wireLogout('a-inicio', null, true);

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
  const proxima = proximaReserva(reservas, hoyISO());
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
        <div class="row"><b style="font:var(--text-h3)">Hipopresivos grupal</b><span class="badge" style="background:#fff">${hoy ? 'Hoy' : formatDiaMesConDia(proxima.fecha)} ${formatHora12(proxima.hora)}</span></div>
        <div style="font:var(--text-small);color:#fff;margin:6px 0 12px">Presencial</div>
        ${hoy ? `<button class="pillbtn" style="background:#fff;color:var(--pf-morado);width:100%" id="btn-checkin">Hacer check-in</button>
        <div id="checkin-hecho" style="display:none;margin-top:10px;font:var(--text-small);color:#fff;text-align:center">Check-in enviado, Caro lo confirma en clase ✨</div>` : ''}
      </div>`;
    if (hoy) {
      document.getElementById('btn-checkin').addEventListener('click', async (e) => {
        e.target.disabled = true;
        await hacerCheckin(supabase, alumnaId, proxima.claseId);
        e.target.style.display = 'none';
        document.getElementById('checkin-hecho').style.display = 'block';
      });
    }
  }

  const estado = estadoPaquete(paquete, hoyISO());
  contPaquete.innerHTML = renderTarjetaPaquete(paquete, estado);
}

async function renderClases(supabase, alumnaId) {
  const [clases, reservas] = await Promise.all([
    listarClasesProximas(supabase),
    obtenerMisReservas(supabase, alumnaId),
  ]);
  const idsReservados = new Set(reservas.map((r) => r.claseId));
  const cont = document.getElementById('a-clases-lista');
  cont.innerHTML = clases.map((c) => {
    const yaReservada = idsReservados.has(c.id);
    const estado = estadoClase(c.cupo, c.reservasCount);
    const puntos = puntosCupo(c.cupo, c.reservasCount)
      .map((ocupado) => `<i class="cupo ${ocupado ? '' : 'libre'}"></i>`).join('');
    const disponibles = cupoDisponible(c.cupo, c.reservasCount);
    let boton;
    if (yaReservada) {
      boton = `<button class="pillbtn soft" style="width:100%" disabled>Tu lugar está apartado ✨</button>`;
    } else if (estado === 'llena') {
      boton = `<button class="pillbtn soft" style="width:100%" disabled>Sin lugares</button>`;
    } else {
      boton = `<button class="pillbtn" style="width:100%" data-clase-id="${c.id}">Aparto mi espacio</button>`;
    }
    return `
      <div class="card" style="${estado === 'llena' && !yaReservada ? 'opacity:.6' : ''}">
        <div class="row"><b style="color:var(--text-title)">${formatDiaMesConDia(c.fecha)}</b>
          <span class="badge ${estado === 'llena' ? 'err' : ''}">${estado === 'llena' ? 'Llena' : formatHora12(c.horarios.hora)}</span></div>
        <div class="cupos">${puntos}</div>
        <div class="muted" style="margin:6px 0 12px">${estado === 'llena' ? 'Sin lugares' : `${disponibles} lugar${disponibles === 1 ? '' : 'es'} disponible${disponibles === 1 ? '' : 's'}`}</div>
        ${boton}
      </div>`;
  }).join('');

  cont.querySelectorAll('button[data-clase-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await apartarLugar(supabase, alumnaId, Number(btn.dataset.claseId));
        await Promise.all([renderClases(supabase, alumnaId), renderInicio(supabase, alumnaId)]);
      } catch (err) {
        btn.disabled = false;
        alert('Esta clase ya está llena, elige otro horario 🤍');
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
        const badge = estadoAsistenciaBadge({ checkin_alumna: a.checkinAlumna, confirmada_admin: a.confirmadaAdmin });
        const texto = badge === 'confirmada' ? 'Confirmada' : badge === 'pendiente' ? 'Pendiente' : 'Sin check-in';
        const clase = badge === 'confirmada' ? 'ok' : badge === 'pendiente' ? 'warn' : '';
        return `<div class="dato"><span>${formatDiaMesConDia(a.fecha)} · ${formatHora12(a.hora)}</span><span class="badge ${clase}">${texto}</span></div>`;
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
      <div class="row"><b style="color:var(--text-title)">Tu paquete</b><span class="badge">Quedan ${restantes} de ${paquete.clases_totales}</span></div>
      <div class="prog"><i style="width:${porcentaje}%"></i></div>
      <div class="muted" style="margin-top:8px">${paquete.vence ? `Tu siguiente pago es el ${formatDiaMesConDia(paquete.vence)}` : ''}</div>
    </div>`;
}

function renderDatosPaquete(paquete, estado) {
  if (estado === 'sin_paquete') {
    return `<b style="color:var(--text-title)">Tu paquete</b><div class="muted" style="margin-top:8px">Aún no tienes un paquete activo.</div>`;
  }
  return `
    <b style="color:var(--text-title)">Tu paquete</b>
    <div class="dato"><span>Clases restantes</span><b>${paquete.clases_totales - paquete.clases_usadas} de ${paquete.clases_totales}</b></div>
    <div class="dato"><span>Último pago</span><b>${paquete.monto ? `$${paquete.monto} · ` : ''}${paquete.fecha_pago ? formatDiaMesConDia(paquete.fecha_pago) : '—'}</b></div>
    <div class="dato"><span>Siguiente pago</span><b>${paquete.vence ? formatDiaMesConDia(paquete.vence) : '—'}</b></div>
    <div class="dato"><span>Forma de pago</span><b>${paquete.forma_pago ?? '—'}</b></div>`;
}

function wireTabs(pantallaId) {
  const pantalla = document.getElementById(pantallaId);
  pantalla.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => {
      pantalla.querySelectorAll('.tab').forEach((x) => x.classList.remove('on'));
      pantalla.querySelectorAll('.screen').forEach((x) => x.classList.remove('active'));
      t.classList.add('on');
      pantalla.querySelector(`#${t.dataset.s}`).classList.add('active');
    });
  });
}

function wireLogout(screenId, onCerrarSesion) {
  if (!onCerrarSesion) return;
  document.getElementById(screenId).querySelector('.btn-logout')?.addEventListener('click', onCerrarSesion);
}
