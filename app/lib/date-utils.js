const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function parseFechaSQL(fechaISO) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function hoyISO(fecha = new Date()) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function esHoy(fechaISO, hoy = new Date()) {
  const fecha = parseFechaSQL(fechaISO);
  return fecha.getFullYear() === hoy.getFullYear()
    && fecha.getMonth() === hoy.getMonth()
    && fecha.getDate() === hoy.getDate();
}

export function formatHora12(horaSQL) {
  const [hStr, mStr] = horaSQL.split(':');
  let h = Number(hStr);
  const m = mStr.padStart(2, '0');
  const sufijo = h >= 12 ? 'pm' : 'am';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${sufijo}`;
}

export function formatDiaMes(fechaISO) {
  const fecha = parseFechaSQL(fechaISO);
  return `${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;
}

export function formatDiaMesConDia(fechaISO) {
  const fecha = parseFechaSQL(fechaISO);
  return `${DIAS[fecha.getDay()]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;
}

export function formatMesAno(fechaISO) {
  const fecha = parseFechaSQL(fechaISO);
  return `${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`;
}

export function formatFechaCompleta(fechaISO) {
  const fecha = parseFechaSQL(fechaISO);
  return `${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`;
}
