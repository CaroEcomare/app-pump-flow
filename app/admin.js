import {
  listarClasesDeHoy, listarReservasDeClase, confirmarAsistencia, cancelarReserva,
  listarAlumnas, obtenerFichaAlumna, activarPaquete, crearValoracion,
  listarClasesProximas, listarPaquetesActivos, listarAlumnaIdsConValoracion,
  actualizarClasesUsadas, crearAlumnaManual, cancelarClase,
  crearHorarioRecurrente, crearClaseEspecial, generarClases,
  marcarAsistenciaManual, borrarAsistencia,
} from './data.js';
import { crearClienteTemporal } from './supabase-client.js';
import { hoyISO, formatHora12, formatDiaMesConDia, formatFechaCompleta } from './lib/date-utils.js';
import { escaparHTML } from './lib/escape.js';
import { wireTabs, mostrarErrorCerca } from './ui.js';
import {
  estadoAsistenciaBadge, estadoPaquete, paqueteVenceEnDias,
  siguienteNumeroValoracion, inicialAvatar, agruparAsistenciasPorPaquete,
} from './lib/status.js';

const CAMPOS_VALORACION = [
  { key: 'edad', label: 'Edad', type: 'number' },
  { key: 'ciclo', label: 'Ciclo', type: 'text' },
  { key: 'partos', label: 'Partos', type: 'text' },
  { key: 'tonicidad_abdominal', label: 'Tonicidad abdominal', type: 'text' },
  { key: 'competencia_abdominal_dedos', label: 'Competencia abdominal (dedos)', type: 'number' },
  { key: 'coactivacion_abdominal', label: 'Co-activación abdominal', type: 'text' },
  { key: 'diastasis_supraumbilical', label: 'Diástasis supraumbilical', type: 'number' },
  { key: 'diastasis_umbilical', label: 'Diástasis umbilical', type: 'number' },
  { key: 'diastasis_infraumbilical', label: 'Diástasis infraumbilical', type: 'number' },
  { key: 'tonicidad_diafragma_izq', label: 'Tonicidad diafragmática cúpula izq.', type: 'text' },
  { key: 'tonicidad_diafragma_der', label: 'Tonicidad diafragmática cúpula der.', type: 'text' },
  { key: 'competencia_perineal', label: 'Competencia perineal', type: 'text' },
  { key: 'perimetro_cintura', label: 'Perímetro de cintura', type: 'number' },
  { key: 'perimetro_ombligo', label: 'Perímetro al ombligo', type: 'number' },
  { key: 'perimetro_bajo_ombligo', label: 'Perímetro abajo de ombligo', type: 'number' },
  { key: 'perimetro_cadera', label: 'Perímetro cadera', type: 'number' },
  { key: 'perimetro_cintura_apnea', label: 'Perímetro cintura con apnea', type: 'number' },
  { key: 'observaciones', label: 'Observaciones', type: 'textarea' },
];

export async function montarVistaAdmin({ supabase, onCerrarSesion }) {
  wireTabs('pantalla-admin');
  document.getElementById('d-hoy').querySelector('.btn-logout')?.addEventListener('click', onCerrarSesion);
  document.getElementById('btn-nueva-alumna-manual')?.addEventListener('click', () => abrirDialogAlumnaManual(supabase));
  document.getElementById('btn-agregar-clase')?.addEventListener('click', () => abrirDialogAgregarClase(supabase));

  // Un solo bloque de consultas para las dos pantallas que lo necesitan.
  const resumen = await cargarResumenAlumnas(supabase);
  await Promise.all([renderHoy(supabase, resumen), renderAlumnas(supabase, resumen), renderClasesAdmin(supabase)]);
  document.getElementById('d-ficha').innerHTML = '<h1>Ficha</h1><div class="muted">Elige a alguien en la pestaña "Alumnado".</div>';
}

function abrirDialogAlumnaManual(supabase) {
  const dialog = document.getElementById('dialog-alumna-manual');
  const body = document.getElementById('dialog-alumna-manual-body');
  body.innerHTML = `
    <h1 style="font:var(--text-h3)">Nueva cuenta manual</h1>
    <form id="form-alumna-manual">
      <label class="field"><span>Nombre</span><input class="input" type="text" name="nombre" required></label>
      <label class="field"><span>Usuario</span><input class="input" type="text" name="username" required pattern="[a-zA-Z0-9_.]+" title="Solo letras, números, puntos y guiones bajos, sin espacios"></label>
      <label class="field"><span>Contraseña</span><input class="input" type="password" name="contrasena" required minlength="6"></label>
      <label class="field"><span>Teléfono</span><input class="input" type="tel" name="telefono"></label>
      <label class="field"><span>¿Viene de otra plataforma?</span>
        <select class="input" name="plataforma">
          <option value="no">No</option>
          <option value="wellhub">Wellhub</option>
          <option value="totalpass">TotalPass</option>
        </select>
      </label>
      <button class="pillbtn" type="submit" style="width:100%;margin-top:16px">Crear cuenta</button>
      <button class="link-suave" type="button" id="btn-cancelar-alumna-manual" style="width:100%;text-align:center">Cancelar</button>
    </form>`;
  document.getElementById('btn-cancelar-alumna-manual').addEventListener('click', () => dialog.close());
  document.getElementById('form-alumna-manual').addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = e.submitter ?? e.target.querySelector('button[type="submit"]');
    if (boton) boton.disabled = true;
    const formData = new FormData(e.target);
    try {
      const clienteTemporal = crearClienteTemporal();
      await crearAlumnaManual(clienteTemporal, {
        nombre: formData.get('nombre'),
        username: formData.get('username'),
        contrasena: formData.get('contrasena'),
        telefono: formData.get('telefono'),
        plataforma: formData.get('plataforma'),
      });
      dialog.close();
      await renderAlumnas(supabase);
    } catch (err) {
      if (boton) boton.disabled = false;
      mostrarErrorCerca(boton ?? e.target, `No se pudo crear la cuenta: ${err.message}`);
    }
  });
  dialog.showModal();
}

// Trae de una sola vez las alumnas, sus paquetes activos y quién ya tiene
// valoración, en tres consultas totales (antes eran ~5 por alumna).
async function cargarResumenAlumnas(supabase) {
  const [todas, paquetes, idsValoradas] = await Promise.all([
    listarAlumnas(supabase),
    listarPaquetesActivos(supabase),
    listarAlumnaIdsConValoracion(supabase),
  ]);
  const paquetePorAlumna = new Map();
  paquetes.forEach((p) => {
    // Vienen ordenados por fecha_pago desc: el primero de cada alumna es el vigente.
    if (!paquetePorAlumna.has(p.alumna_id)) paquetePorAlumna.set(p.alumna_id, p);
  });
  return {
    alumnas: todas.filter((a) => !a.es_admin),
    paquetePorAlumna,
    conValoracion: new Set(idsValoradas),
  };
}

async function renderHoy(supabase, resumen) {
  const [clases, datos] = await Promise.all([
    listarClasesDeHoy(supabase),
    resumen ?? cargarResumenAlumnas(supabase),
  ]);
  const contLista = document.getElementById('d-hoy-lista');
  const contPend = document.getElementById('d-hoy-pendientes');

  if (clases.length === 0) {
    contLista.innerHTML = '<div class="card"><b style="color:var(--text-title)">Hoy no hay clase</b></div>';
  } else {
    const listas = await Promise.all(clases.map((c) => listarReservasDeClase(supabase, c.id)));
    contLista.innerHTML = clases.map((clase, i) => tarjetaPasarLista(clase, listas[i])).join('');
    wirePasarLista(contLista, supabase, () => renderHoy(supabase));
  }

  const hoy = hoyISO();
  let pagosPorRecibir = 0;
  let paquetesPorVencer = 0;
  let valoracionesPendientes = 0;
  datos.alumnas.forEach((a) => {
    const paquete = datos.paquetePorAlumna.get(a.id) ?? null;
    if (estadoPaquete(paquete, hoy) !== 'al_dia') pagosPorRecibir += 1;
    if (paqueteVenceEnDias(paquete, hoy)) paquetesPorVencer += 1;
    if (!datos.conValoracion.has(a.id)) valoracionesPendientes += 1;
  });
  contPend.innerHTML = `
    <div class="card">
      <b style="color:var(--text-title)">Pendientes de la semana</b>
      <div class="dato"><span>Pagos por recibir</span><b>${pagosPorRecibir} persona${pagosPorRecibir === 1 ? '' : 's'}</b></div>
      <div class="dato"><span>Paquetes por vencer</span><b>${paquetesPorVencer} persona${paquetesPorVencer === 1 ? '' : 's'}</b></div>
      <div class="dato"><span>Valoraciones pendientes</span><b>${valoracionesPendientes} persona${valoracionesPendientes === 1 ? '' : 's'}</b></div>
    </div>`;
}

function etiquetaPlataforma(plataforma) {
  if (plataforma === 'wellhub') return 'Wellhub';
  if (plataforma === 'totalpass') return 'TotalPass';
  return '';
}

function tarjetaPasarLista(clase, reservas, etiqueta, opciones = {}) {
  const confirmadas = reservas.filter((r) => r.asistencia?.confirmada_admin).length;
  const titulo = etiqueta ?? `Pasar lista · ${formatHora12(clase.hora)}`;
  return `
    <div class="card">
      <div class="row" style="margin-bottom:4px"><b style="color:var(--text-title)">${escaparHTML(titulo)}</b><span class="badge">${confirmadas} de ${reservas.length}</span></div>
      ${clase.alumnaAsignada ? `<div style="margin-bottom:6px"><span class="badge">Personal · ${escaparHTML(clase.alumnaAsignada.nombre)}</span></div>` : ''}
      ${opciones.mostrarCancelarClase ? `<button class="link-suave cancelar-clase" data-clase-id="${escaparHTML(clase.id)}" style="padding:4px 0;margin-bottom:6px">Cancelar esta clase</button>` : ''}
      ${reservas.length === 0 ? '<div class="muted">Nadie ha apartado lugar todavía</div>' : reservas.map((r) => {
        const badge = estadoAsistenciaBadge(r.asistencia);
        const acciones = badge === 'confirmada'
          ? '<span class="badge ok">Confirmada</span>'
          : `<div style="display:flex;gap:6px">
              <button class="pillbtn valida" data-alumna-id="${escaparHTML(r.alumnaId)}" data-clase-id="${escaparHTML(clase.id)}" style="padding:7px 14px;min-height:36px;font-size:13px">Confirmar</button>
              <button class="pillbtn soft rechaza" data-alumna-id="${escaparHTML(r.alumnaId)}" data-clase-id="${escaparHTML(clase.id)}" style="padding:7px 14px;min-height:36px;font-size:13px">Cancelar</button>
            </div>`;
        const etiquetaOrigen = etiquetaPlataforma(r.plataforma);
        return `<div class="dato"><div style="display:flex;align-items:center;gap:10px"><span class="avatar" style="width:34px;height:34px;font-size:13px">${escaparHTML(inicialAvatar(r.nombre))}</span>${escaparHTML(r.nombre)}${etiquetaOrigen ? ` <span class="badge">${escaparHTML(etiquetaOrigen)}</span>` : ''}</div>${acciones}</div>`;
      }).join('')}
    </div>`;
}

// Confirmar/cancelar la asistencia de una alumna en una clase: se usa
// tanto en "Hoy" como en "Clases", así que la lógica vive en un solo lugar.
function wirePasarLista(cont, supabase, alRenderizar) {
  cont.querySelectorAll('.valida').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await confirmarAsistencia(supabase, btn.dataset.alumnaId, Number(btn.dataset.claseId));
        await alRenderizar();
      } catch (err) {
        btn.disabled = false;
        mostrarErrorCerca(btn.closest('.dato') ?? btn, `No se pudo confirmar: ${err.message}`);
      }
    });
  });
  cont.querySelectorAll('.rechaza').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await cancelarReserva(supabase, btn.dataset.alumnaId, Number(btn.dataset.claseId));
        await alRenderizar();
      } catch (err) {
        btn.disabled = false;
        mostrarErrorCerca(btn.closest('.dato') ?? btn, `No se pudo cancelar: ${err.message}`);
      }
    });
  });
}

async function renderAlumnas(supabase, resumen) {
  const datos = resumen ?? await cargarResumenAlumnas(supabase);
  const hoy = hoyISO();
  const cont = document.getElementById('d-alumnas-lista');
  const filas = datos.alumnas.map((a) => {
    const paquete = datos.paquetePorAlumna.get(a.id) ?? null;
    const estado = estadoPaquete(paquete, hoy);
    const badgeTexto = estado === 'al_dia' ? 'Al día' : estado === 'por_pagar' ? 'Por pagar' : 'Nueva';
    const badgeClase = estado === 'al_dia' ? 'ok' : estado === 'por_pagar' ? 'err' : 'warn';
    const progreso = paquete ? `${escaparHTML(paquete.clases_usadas)} de ${escaparHTML(paquete.clases_totales)} clases` : 'Sin paquete activo';
    const etiquetaOrigen = etiquetaPlataforma(a.plataforma);
    return `
      <div class="card row alumna-fila" data-alumna-id="${escaparHTML(a.id)}" style="cursor:pointer">
        <span class="avatar">${escaparHTML(inicialAvatar(a.nombre))}</span>
        <div style="flex:1"><b style="color:var(--text-title)">${escaparHTML(a.nombre)}</b>${etiquetaOrigen ? ` <span class="badge">${escaparHTML(etiquetaOrigen)}</span>` : ''}<div class="muted">${progreso}</div></div>
        <span class="badge ${badgeClase}">${badgeTexto}</span>
      </div>`;
  });
  cont.innerHTML = filas.join('') || '<div class="muted">Aún no tienes alumnado registrado</div>';
  cont.querySelectorAll('.alumna-fila').forEach((fila) => {
    fila.addEventListener('click', () => {
      renderFicha(supabase, fila.dataset.alumnaId);
      document.querySelector('#pantalla-admin .tab[data-s="d-ficha"]').click();
    });
  });
}

async function renderFicha(supabase, alumnaId) {
  const { alumna, paquete, valoraciones, asistencias, paquetes } = await obtenerFichaAlumna(supabase, alumnaId);
  const estado = estadoPaquete(paquete, hoyISO());
  const cont = document.getElementById('d-ficha');
  const etiquetaOrigen = etiquetaPlataforma(alumna.plataforma);
  cont.innerHTML = `
    <h1>${escaparHTML(alumna.nombre)}${etiquetaOrigen ? ` <span class="badge">${escaparHTML(etiquetaOrigen)}</span>` : ''}</h1>
    <div class="muted">En Pump&Flow desde ${escaparHTML(formatFechaCompleta(alumna.fecha_alta))}</div>

    <div class="card">
      <div class="row"><b style="color:var(--text-title)">Paquete</b><button class="pillbtn soft" id="btn-activar-paquete" style="padding:7px 16px;min-height:36px;font-size:13px">Activar mes</button></div>
      ${estado === 'sin_paquete'
        ? '<div class="muted" style="margin-top:8px">Sin paquete activo</div>'
        : `<div class="dato"><span>Clases restantes</span><b>${escaparHTML(paquete.clases_totales - paquete.clases_usadas)} de ${escaparHTML(paquete.clases_totales)}</b></div>
           <div class="dato"><span>Último pago</span><b>${paquete.monto ? `$${escaparHTML(paquete.monto)} · ` : ''}${escaparHTML(paquete.forma_pago ?? '')} · ${paquete.fecha_pago ? escaparHTML(formatDiaMesConDia(paquete.fecha_pago)) : '—'}</b></div>
           <div class="dato"><span>Siguiente pago</span><b>${paquete.vence ? escaparHTML(formatDiaMesConDia(paquete.vence)) : '—'}</b></div>
           <form id="form-clases-usadas" class="row" style="margin-top:10px;gap:8px">
             <label class="field" style="flex:1;margin-top:0"><span>Clases usadas</span><input class="input" type="number" min="0" name="clasesUsadas" value="${escaparHTML(paquete.clases_usadas)}"></label>
             <button class="pillbtn soft" type="submit" style="padding:7px 16px;min-height:36px;font-size:13px;align-self:flex-end">Guardar</button>
           </form>
           <button class="link-suave" id="btn-marcar-asistencia-manual" style="padding:4px 0;margin-top:8px">+ Marcar asistencia de un día pasado</button>`}
    </div>

    <div class="card">
      <div class="row" style="margin-bottom:2px"><b style="color:var(--text-title)">Valoraciones</b><button class="pillbtn" id="btn-nueva-valoracion" style="padding:7px 16px;min-height:36px;font-size:13px">+ Nueva valoración</button></div>
      <div class="muted" style="margin-bottom:10px">${valoraciones.length} registrada${valoraciones.length === 1 ? '' : 's'} · la más reciente arriba</div>
      ${valoraciones.map((v, i) => renderValoracion(v, i, alumna.nombre)).join('') || '<div class="muted">Sin valoraciones todavía</div>'}
    </div>

    <div class="card">
      <b style="color:var(--text-title)">Asistencias</b>
      ${agruparAsistenciasPorPaquete(asistencias, paquetes).map((g) => renderGrupoAsistencias(g)).join('') || '<div class="muted">Sin asistencias todavía</div>'}
    </div>`;

  cont.querySelectorAll('.acc').forEach((btn) => {
    btn.addEventListener('click', () => {
      const body = btn.nextElementSibling;
      body.style.display = body.style.display === 'none' ? 'block' : 'none';
    });
  });
  cont.querySelectorAll('.btn-borrar-asistencia').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Borrar esta clase? Si estaba confirmada, se le regresa a su paquete.')) return;
      btn.disabled = true;
      try {
        await borrarAsistencia(supabase, Number(btn.dataset.asistenciaId));
        await renderFicha(supabase, alumnaId);
      } catch (err) {
        btn.disabled = false;
        mostrarErrorCerca(btn, `No se pudo borrar: ${err.message}`);
      }
    });
  });
  document.getElementById('btn-nueva-valoracion').addEventListener('click', () => abrirDialogValoracion(supabase, alumnaId, valoraciones));
  document.getElementById('btn-activar-paquete').addEventListener('click', () => abrirDialogPaquete(supabase, alumnaId));
  document.getElementById('btn-marcar-asistencia-manual')?.addEventListener('click', () => abrirDialogAsistenciaManual(supabase, alumnaId));

  const formClasesUsadas = document.getElementById('form-clases-usadas');
  formClasesUsadas?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = e.submitter ?? e.target.querySelector('button[type="submit"]');
    if (boton) boton.disabled = true;
    const formData = new FormData(e.target);
    try {
      await actualizarClasesUsadas(supabase, paquete.id, Number(formData.get('clasesUsadas')));
      await renderFicha(supabase, alumnaId);
    } catch (err) {
      if (boton) boton.disabled = false;
      mostrarErrorCerca(boton ?? e.target, `No se pudo guardar: ${err.message}`);
    }
  });
}

function renderValoracion(v, index, nombreAlumna) {
  const esReciente = index === 0;
  const filas = CAMPOS_VALORACION.filter((c) => c.key !== 'observaciones')
    .map((c) => `<div class="dato"><span>${c.label}</span><b>${v[c.key] === null || v[c.key] === undefined ? '—' : escaparHTML(v[c.key])}</b></div>`).join('');
  return `
    <div style="border:2px solid var(--border-soft);border-radius:var(--radius-md);overflow:hidden;margin-bottom:10px">
      <button class="acc" style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:8px;background:var(--pf-lila-fondo);border:none;padding:12px 14px;cursor:pointer;font:var(--text-body-strong);font-size:14px;color:var(--text-title);text-align:left;min-height:44px">
        Valoración ${escaparHTML(v.numero)} · ${escaparHTML(formatFechaCompleta(v.fecha))}<span class="badge ${esReciente ? 'ok' : ''}">${esReciente ? 'Reciente' : 'Ver'}</span>
      </button>
      <div class="acc-body" style="display:none;padding:4px 14px 12px">
        <div class="dato"><span>Nombre</span><b>${escaparHTML(nombreAlumna)}</b></div>
        ${filas}
        <div class="dato" style="display:block"><span>Observaciones</span><div style="margin-top:4px;color:var(--text-body)">${v.observaciones ? escaparHTML(v.observaciones) : '—'}</div></div>
      </div>
    </div>`;
}

function renderGrupoAsistencias(grupo) {
  const titulo = grupo.paquete
    ? `Paquete desde ${escaparHTML(formatDiaMesConDia(grupo.paquete.fecha_pago))}`
    : 'Antes de tener paquete registrado';
  const filas = grupo.asistencias.map((a) => {
    const badge = estadoAsistenciaBadge({ confirmada_admin: a.confirmadaAdmin });
    const texto = badge === 'confirmada' ? 'Confirmada' : 'Pendiente';
    const clase = badge === 'confirmada' ? 'ok' : 'warn';
    return `<div class="dato">
      <span>${escaparHTML(formatDiaMesConDia(a.fecha))} · ${escaparHTML(formatHora12(a.hora))}</span>
      <span style="display:flex;align-items:center;gap:10px">
        <span class="badge ${clase}">${texto}</span>
        <button class="link-suave btn-borrar-asistencia" data-asistencia-id="${escaparHTML(a.id)}" style="padding:0;color:var(--pf-error)">Borrar</button>
      </span>
    </div>`;
  }).join('');
  return `
    <div style="border:2px solid var(--border-soft);border-radius:var(--radius-md);overflow:hidden;margin-bottom:10px">
      <button class="acc" style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:8px;background:var(--pf-lila-fondo);border:none;padding:12px 14px;cursor:pointer;font:var(--text-body-strong);font-size:14px;color:var(--text-title);text-align:left;min-height:44px">
        ${titulo}<span class="badge">${grupo.asistencias.length} clase${grupo.asistencias.length === 1 ? '' : 's'}</span>
      </button>
      <div class="acc-body" style="display:none;padding:4px 14px 12px">${filas}</div>
    </div>`;
}

function abrirDialogValoracion(supabase, alumnaId, valoraciones) {
  const dialog = document.getElementById('dialog-valoracion');
  const body = document.getElementById('dialog-valoracion-body');
  const numero = siguienteNumeroValoracion(valoraciones);
  body.innerHTML = `
    <h1 style="font:var(--text-h3)">Nueva valoración</h1>
    <form id="form-valoracion">
      <label class="field"><span>Fecha</span><input class="input" type="date" name="fecha" value="${hoyISO()}" required></label>
      ${CAMPOS_VALORACION.map((c) => `
        <label class="field"><span>${c.label}</span>
          ${c.type === 'textarea'
            ? `<textarea class="textarea" name="${c.key}"></textarea>`
            : `<input class="input" type="${c.type}" name="${c.key}" ${c.type === 'number' ? 'step="0.1"' : ''}>`}
        </label>`).join('')}
      <button class="pillbtn" type="submit" style="width:100%;margin-top:16px">Guardar valoración</button>
      <button class="link-suave" type="button" id="btn-cancelar-valoracion" style="width:100%;text-align:center">Cancelar</button>
    </form>`;
  document.getElementById('btn-cancelar-valoracion').addEventListener('click', () => dialog.close());
  document.getElementById('form-valoracion').addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = e.submitter ?? e.target.querySelector('button[type="submit"]');
    if (boton) boton.disabled = true;
    const formData = new FormData(e.target);
    const campos = { fecha: formData.get('fecha') };
    CAMPOS_VALORACION.forEach((c) => {
      const valor = formData.get(c.key);
      campos[c.key] = c.type === 'number' ? (valor === '' ? null : Number(valor)) : (valor || null);
    });
    try {
      await crearValoracion(supabase, alumnaId, campos, numero);
      dialog.close();
      await renderFicha(supabase, alumnaId);
    } catch (err) {
      if (boton) boton.disabled = false;
      mostrarErrorCerca(boton ?? e.target, `No se pudo guardar la valoración: ${err.message}`);
    }
  });
  dialog.showModal();
}

function abrirDialogAsistenciaManual(supabase, alumnaId) {
  const dialog = document.getElementById('dialog-asistencia-manual');
  const body = document.getElementById('dialog-asistencia-manual-body');
  body.innerHTML = `
    <h1 style="font:var(--text-h3)">Marcar asistencia de un día pasado</h1>
    <form id="form-asistencia-manual">
      <label class="field"><span>Fecha</span><input class="input" type="date" name="fecha" value="${hoyISO()}" max="${hoyISO()}" required></label>
      <button class="pillbtn" type="submit" style="width:100%;margin-top:16px">Marcar asistencia</button>
      <button class="link-suave" type="button" id="btn-cancelar-asistencia-manual" style="width:100%;text-align:center">Cancelar</button>
    </form>`;
  document.getElementById('btn-cancelar-asistencia-manual').addEventListener('click', () => dialog.close());
  document.getElementById('form-asistencia-manual').addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = e.submitter ?? e.target.querySelector('button[type="submit"]');
    if (boton) boton.disabled = true;
    const formData = new FormData(e.target);
    try {
      await marcarAsistenciaManual(supabase, alumnaId, formData.get('fecha'));
      dialog.close();
      await renderFicha(supabase, alumnaId);
    } catch (err) {
      if (boton) boton.disabled = false;
      mostrarErrorCerca(boton ?? e.target, `No se pudo marcar la asistencia: ${err.message}`);
    }
  });
  dialog.showModal();
}

function abrirDialogPaquete(supabase, alumnaId) {
  const dialog = document.getElementById('dialog-paquete');
  const body = document.getElementById('dialog-paquete-body');
  body.innerHTML = `
    <h1 style="font:var(--text-h3)">Activar mes</h1>
    <form id="form-paquete">
      <label class="field"><span>Tipo</span>
        <select class="input" name="tipo" id="paquete-tipo">
          <option value="grupal">Grupal (8 clases)</option>
          <option value="personal">Personal (10 clases)</option>
        </select>
      </label>
      <label class="field"><span>Clases totales</span><input class="input" type="number" name="clasesTotales" id="paquete-clases-totales" value="8" required></label>
      <label class="field"><span>Monto</span><input class="input" type="number" name="monto" step="0.01" required></label>
      <label class="field"><span>Forma de pago</span>
        <select class="input" name="formaPago">
          <option value="transferencia">Transferencia</option>
          <option value="efectivo">Efectivo</option>
        </select>
      </label>
      <label class="field"><span>Fecha de pago</span><input class="input" type="date" name="fechaPago" value="${hoyISO()}" required></label>
      <label class="field"><span>Vence</span><input class="input" type="date" name="vence" required></label>
      <button class="pillbtn" type="submit" style="width:100%;margin-top:16px">Activar paquete</button>
      <button class="link-suave" type="button" id="btn-cancelar-paquete" style="width:100%;text-align:center">Cancelar</button>
    </form>`;
  document.getElementById('btn-cancelar-paquete').addEventListener('click', () => dialog.close());
  document.getElementById('paquete-tipo').addEventListener('change', (e) => {
    document.getElementById('paquete-clases-totales').value = e.target.value === 'personal' ? 10 : 8;
  });
  document.getElementById('form-paquete').addEventListener('submit', async (e) => {
    e.preventDefault();
    // Deshabilitar antes del await evita que un doble click cree dos paquetes activos.
    const boton = e.submitter ?? e.target.querySelector('button[type="submit"]');
    if (boton) boton.disabled = true;
    const formData = new FormData(e.target);
    try {
      await activarPaquete(supabase, alumnaId, {
        tipo: formData.get('tipo'),
        clasesTotales: Number(formData.get('clasesTotales')),
        monto: Number(formData.get('monto')),
        formaPago: formData.get('formaPago'),
        fechaPago: formData.get('fechaPago'),
        vence: formData.get('vence'),
      });
      dialog.close();
      await renderFicha(supabase, alumnaId);
    } catch (err) {
      if (boton) boton.disabled = false;
      mostrarErrorCerca(boton ?? e.target, `No se pudo activar el paquete: ${err.message}`);
    }
  });
  dialog.showModal();
}

async function renderClasesAdmin(supabase) {
  const clases = await listarClasesProximas(supabase);
  const listas = await Promise.all(clases.map((c) => listarReservasDeClase(supabase, c.id)));
  const cont = document.getElementById('d-clases-lista');
  cont.innerHTML = clases.map((c, i) => tarjetaPasarLista(
    c,
    listas[i],
    `${formatDiaMesConDia(c.fecha)} · ${formatHora12(c.hora)}`,
    { mostrarCancelarClase: true },
  )).join('') || '<div class="muted">No hay clases próximas todavía</div>';

  wirePasarLista(cont, supabase, () => renderClasesAdmin(supabase));

  cont.querySelectorAll('.cancelar-clase').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Cancelar esta clase? A quien ya la tenía apartada se le quita el lugar y no se le cobra.')) return;
      btn.disabled = true;
      try {
        await cancelarClase(supabase, Number(btn.dataset.claseId));
        await renderClasesAdmin(supabase);
      } catch (err) {
        btn.disabled = false;
        mostrarErrorCerca(btn, `No se pudo cancelar la clase: ${err.message}`);
      }
    });
  });
}

async function abrirDialogAgregarClase(supabase) {
  const dialog = document.getElementById('dialog-agregar-clase');
  const body = document.getElementById('dialog-agregar-clase-body');
  const alumnado = (await listarAlumnas(supabase)).filter((a) => !a.es_admin);
  body.innerHTML = `
    <h1 style="font:var(--text-h3)">Agregar clase</h1>
    <form id="form-agregar-clase">
      <label class="field"><span>Tipo</span>
        <select class="input" name="tipo" id="clase-tipo">
          <option value="recurrente">Cada semana</option>
          <option value="especial">Solo esta vez (especial)</option>
        </select>
      </label>
      <label class="field" id="campo-dia-semana"><span>Día de la semana</span>
        <select class="input" name="diaSemana">
          <option value="0">Domingo</option>
          <option value="1">Lunes</option>
          <option value="2">Martes</option>
          <option value="3">Miércoles</option>
          <option value="4">Jueves</option>
          <option value="5">Viernes</option>
          <option value="6">Sábado</option>
        </select>
      </label>
      <label class="field" id="campo-fecha" style="display:none"><span>Fecha</span><input class="input" type="date" name="fecha"></label>
      <label class="field"><span>Hora</span><input class="input" type="time" name="hora" required></label>
      <label class="field"><span>¿Para quién es?</span>
        <select class="input" name="alumnaId" id="clase-para-quien">
          <option value="">Todas (grupal)</option>
          ${alumnado.map((a) => `<option value="${escaparHTML(a.id)}">${escaparHTML(a.nombre)}</option>`).join('')}
        </select>
      </label>
      <label class="field"><span>Cupo</span><input class="input" type="number" name="cupo" id="clase-cupo" value="6" min="1" required></label>
      <button class="pillbtn" type="submit" style="width:100%;margin-top:16px">Agregar</button>
      <button class="link-suave" type="button" id="btn-cancelar-agregar-clase" style="width:100%;text-align:center">Cancelar</button>
    </form>`;
  document.getElementById('btn-cancelar-agregar-clase').addEventListener('click', () => dialog.close());
  document.getElementById('clase-tipo').addEventListener('change', (e) => {
    const esEspecial = e.target.value === 'especial';
    document.getElementById('campo-dia-semana').style.display = esEspecial ? 'none' : 'grid';
    document.getElementById('campo-fecha').style.display = esEspecial ? 'grid' : 'none';
    document.getElementById('campo-fecha').querySelector('input').required = esEspecial;
  });
  document.getElementById('clase-para-quien').addEventListener('change', (e) => {
    if (e.target.value) document.getElementById('clase-cupo').value = 1;
  });
  document.getElementById('form-agregar-clase').addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = e.submitter ?? e.target.querySelector('button[type="submit"]');
    if (boton) boton.disabled = true;
    const formData = new FormData(e.target);
    const tipo = formData.get('tipo');
    const alumnaId = formData.get('alumnaId') || null;
    try {
      if (tipo === 'recurrente') {
        await crearHorarioRecurrente(supabase, {
          diaSemana: Number(formData.get('diaSemana')),
          hora: formData.get('hora'),
          cupo: Number(formData.get('cupo')),
          alumnaId,
        });
        await generarClases(supabase);
      } else {
        await crearClaseEspecial(supabase, {
          fecha: formData.get('fecha'),
          hora: formData.get('hora'),
          cupo: Number(formData.get('cupo')),
          alumnaId,
        });
      }
      dialog.close();
      await renderClasesAdmin(supabase);
    } catch (err) {
      if (boton) boton.disabled = false;
      mostrarErrorCerca(boton ?? e.target, `No se pudo agregar la clase: ${err.message}`);
    }
  });
  dialog.showModal();
}
