export function construirResumenClaseMuestra(personas) {
  const n = personas.length;
  const titulo = `Clase muestra · ${n} persona${n === 1 ? '' : 's'}`;
  const descripcion = personas
    .map((p) => `${p.nombre}${p.telefono ? ` · ${p.telefono}` : ''}`)
    .join('\n');
  return { titulo, descripcion };
}

export function decidirAccionCalendario({ eventoExistente, cantidadPersonas }) {
  if (cantidadPersonas === 0) return eventoExistente ? 'borrar' : 'ninguna';
  return eventoExistente ? 'actualizar' : 'crear';
}

// Arma fecha-hora SIN zona horaria (ej. "2026-09-15T18:15:00"), para
// usarse junto con timeZone: 'America/Mexico_City' en la API de Google
// Calendar. Aritmética en un espacio UTC "de mentiras" solo para sumar
// la hora sin que el motor de JS interprete ninguna zona horaria real.
export function construirRangoEvento(fecha, hora) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const [h, m, s] = hora.split(':').map(Number);
  const inicioUTC = new Date(Date.UTC(anio, mes - 1, dia, h, m, s || 0));
  const finUTC = new Date(inicioUTC.getTime() + 60 * 60 * 1000);
  const formatear = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  };
  return { inicio: formatear(inicioUTC), fin: formatear(finUTC) };
}
