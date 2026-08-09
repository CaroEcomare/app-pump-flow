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

export function proximaReserva(reservas, hoyISOStr) {
  const futuras = reservas
    .filter((r) => r.fecha >= hoyISOStr)
    .sort((a, b) => (a.fecha === b.fecha
      ? a.hora.localeCompare(b.hora)
      : a.fecha.localeCompare(b.fecha)));
  return futuras[0] ?? null;
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
  if (!asistencia) return 'sin_checkin';
  if (asistencia.confirmada_admin) return 'confirmada';
  if (asistencia.checkin_alumna) return 'pendiente';
  return 'sin_checkin';
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
