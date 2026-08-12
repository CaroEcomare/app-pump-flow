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

export function reservasFuturas(reservas, hoyISOStr) {
  return reservas
    .filter((r) => r.fecha >= hoyISOStr)
    .sort((a, b) => (a.fecha === b.fecha
      ? a.hora.localeCompare(b.hora)
      : a.fecha.localeCompare(b.fecha)));
}

export function proximaReserva(reservas, hoyISOStr) {
  return reservasFuturas(reservas, hoyISOStr)[0] ?? null;
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
