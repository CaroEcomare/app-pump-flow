import { parseFechaSQL } from './date-utils.js';

export function cupoDisponible(cupoTotal, reservasCount) {
  return Math.max(0, cupoTotal - reservasCount);
}

export function puntosCupo(cupoTotal, reservasCount) {
  const ocupados = Math.min(reservasCount, cupoTotal);
  return Array.from({ length: cupoTotal }, (_, i) => i < ocupados);
}

export function estadoClase(cupoTotal, reservasCount) {
  return reservasCount >= cupoTotal ? 'llena' : 'disponible';
}

export function reservasFuturas(reservas, ahora = new Date()) {
  return reservas
    .filter((r) => horasHastaClase(r.fecha, r.hora, ahora) > 0)
    .sort((a, b) => (a.fecha === b.fecha
      ? a.hora.localeCompare(b.hora)
      : a.fecha.localeCompare(b.fecha)));
}

export function proximaReserva(reservas, ahora = new Date()) {
  return reservasFuturas(reservas, ahora)[0] ?? null;
}

export function estadoPaquete(paquete, hoyISOStr) {
  if (!paquete || !paquete.activo) return 'sin_paquete';
  if (paquete.vence && paquete.vence < hoyISOStr) return 'por_pagar';
  return 'al_dia';
}

export function paqueteVenceEnDias(paquete, hoyISOStr, dias = 7) {
  if (!paquete || !paquete.activo || !paquete.vence) return false;
  const hoy = parseFechaSQL(hoyISOStr);
  const vence = parseFechaSQL(paquete.vence);
  const limite = new Date(hoy);
  limite.setDate(limite.getDate() + dias);
  return vence >= hoy && vence <= limite;
}

export function estadoAsistenciaBadge(asistencia) {
  return asistencia?.confirmada_admin ? 'confirmada' : 'pendiente';
}

export function horasHastaClase(fecha, hora, ahora = new Date()) {
  const [h, m] = hora.split(':').map(Number);
  const inicio = parseFechaSQL(fecha);
  inicio.setHours(h, m, 0, 0);
  return (inicio.getTime() - ahora.getTime()) / (1000 * 60 * 60);
}

export function puedeApartar(fecha, hora, ahora = new Date()) {
  return horasHastaClase(fecha, hora, ahora) >= 1;
}

export function puedeCancelar(fecha, hora, ahora = new Date()) {
  return horasHastaClase(fecha, hora, ahora) >= 12;
}

export function siguienteNumeroValoracion(valoraciones) {
  if (!valoraciones.length) return 1;
  return Math.max(...valoraciones.map((v) => v.numero)) + 1;
}

export function tieneValoraciones(valoraciones) {
  return valoraciones.length > 0;
}

export function inicialAvatar(nombre) {
  return (nombre?.trim()?.[0] ?? '?').toUpperCase();
}

// Une cada asistencia con el paquete que estaba activo en esa fecha (el de
// fecha_pago más reciente que no la rebase), asumiendo que un paquete cubre
// desde su fecha_pago hasta que empieza el siguiente. Grupos más recientes
// primero; lo anterior al primer paquete cae en un grupo aparte (paquete: null).
export function agruparAsistenciasPorPaquete(asistencias, paquetes) {
  const ordenados = paquetes
    .filter((p) => p.fecha_pago)
    .slice()
    .sort((a, b) => a.fecha_pago.localeCompare(b.fecha_pago));

  const grupos = ordenados.map((paquete, i) => {
    const siguiente = ordenados[i + 1];
    return {
      paquete,
      asistencias: asistencias.filter((a) => a.fecha >= paquete.fecha_pago
        && (!siguiente || a.fecha < siguiente.fecha_pago)),
    };
  }).reverse();

  const sinPaquete = ordenados.length
    ? asistencias.filter((a) => a.fecha < ordenados[0].fecha_pago)
    : asistencias.slice();
  if (sinPaquete.length) grupos.push({ paquete: null, asistencias: sinPaquete });

  return grupos;
}
