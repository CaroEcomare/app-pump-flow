import { listarDisponibilidadClaseMuestra, listarSlotsOcupadosClaseMuestra, agendarClaseMuestra } from './data.js';
import { formatDiaMesConDia, formatHora12 } from './lib/date-utils.js';
import { escaparHTML } from './lib/escape.js';
import { slotsDisponiblesClaseMuestra } from './lib/status.js';
import { mostrarErrorCerca } from './ui.js';

export async function montarClaseMuestra({ supabase }) {
  const cont = document.getElementById('clase-muestra-contenido');
  cont.innerHTML = '<div class="muted">Cargando horarios…</div>';
  const [disponibilidad, ocupados] = await Promise.all([
    listarDisponibilidadClaseMuestra(supabase),
    listarSlotsOcupadosClaseMuestra(supabase),
  ]);
  const disponibilidadMapeada = disponibilidad.map((d) => ({ diaSemana: d.dia_semana, hora: d.hora }));
  const slots = slotsDisponiblesClaseMuestra(disponibilidadMapeada, ocupados, new Date());
  renderSlots(supabase, cont, slots);
}

function renderSlots(supabase, cont, slots) {
  if (slots.length === 0) {
    cont.innerHTML = '<div class="muted" style="margin-top:12px">No hay horarios disponibles por ahora. Escríbele a Caro directo.</div>';
    return;
  }
  cont.innerHTML = `
    <div class="muted" style="margin:8px 0 12px">Elige un horario:</div>
    <div id="clase-muestra-slots">
      ${slots.map((s, i) => `<button type="button" class="pillbtn soft slot-clase-muestra" data-i="${i}" style="width:100%;margin-bottom:8px;text-align:left">${escaparHTML(formatDiaMesConDia(s.fecha))} · ${escaparHTML(formatHora12(s.hora))}</button>`).join('')}
    </div>`;
  cont.querySelectorAll('.slot-clase-muestra').forEach((btn) => {
    btn.addEventListener('click', () => renderFormulario(supabase, cont, slots[Number(btn.dataset.i)]));
  });
}

function renderFormulario(supabase, cont, slot) {
  cont.innerHTML = `
    <div class="muted" style="margin-top:8px">${escaparHTML(formatDiaMesConDia(slot.fecha))} · ${escaparHTML(formatHora12(slot.hora))}</div>
    <form id="form-clase-muestra" style="margin-top:12px">
      <label class="field"><span>Nombre</span><input class="input" type="text" name="nombre" required></label>
      <label class="field"><span>Teléfono</span><input class="input" type="tel" name="telefono" required></label>
      <button class="pillbtn" type="submit" style="width:100%;margin-top:16px">Agendar</button>
      <button class="link-suave" type="button" id="btn-otro-horario" style="width:100%;text-align:center">Elegir otro horario</button>
    </form>`;
  document.getElementById('btn-otro-horario').addEventListener('click', () => montarClaseMuestra({ supabase }));
  document.getElementById('form-clase-muestra').addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = e.submitter ?? e.target.querySelector('button[type="submit"]');
    if (boton) boton.disabled = true;
    const formData = new FormData(e.target);
    try {
      await agendarClaseMuestra(supabase, {
        fecha: slot.fecha,
        hora: slot.hora,
        nombre: formData.get('nombre'),
        telefono: formData.get('telefono'),
      });
      cont.innerHTML = `<div class="badge ok" style="display:block;text-align:center;padding:14px;margin-top:12px">¡Listo! Tu clase muestra quedó agendada para ${escaparHTML(formatDiaMesConDia(slot.fecha))} a las ${escaparHTML(formatHora12(slot.hora))}. Caro te espera 🤍</div>`;
    } catch (err) {
      if (boton) boton.disabled = false;
      if (err.code === '23505') {
        mostrarErrorCerca(boton ?? e.target, 'Ese horario acaba de apartarse. Elige otro, por favor 🤍');
        return;
      }
      mostrarErrorCerca(boton ?? e.target, `No se pudo agendar: ${err.message}`);
    }
  });
}
