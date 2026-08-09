import { hoyISO } from './lib/date-utils.js';

export async function crearPerfilAlumna(supabase, { id, nombre, telefono }) {
  const { error } = await supabase.from('alumnas').insert({ id, nombre, telefono });
  if (error) throw error;
}

export async function obtenerPerfil(supabase, userId) {
  const { data, error } = await supabase
    .from('alumnas')
    .select('id, nombre, telefono, es_admin, fecha_alta')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function obtenerPerfilOpcional(supabase, userId) {
  const { data, error } = await supabase
    .from('alumnas')
    .select('id, nombre, telefono, es_admin, fecha_alta')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listarClasesProximas(supabase, semanas = 4) {
  const hoy = hoyISO();
  const limite = new Date();
  limite.setDate(limite.getDate() + semanas * 7);
  const { data, error } = await supabase
    .from('clases')
    .select('id, fecha, cupo, horario_id, horarios(hora), reservas(id)')
    .eq('cancelada', false)
    .gte('fecha', hoy)
    .lte('fecha', hoyISO(limite))
    .order('fecha', { ascending: true });
  if (error) throw error;
  return data.map((c) => ({ ...c, reservasCount: c.reservas.length }));
}

export async function obtenerMisReservas(supabase, alumnaId) {
  const { data, error } = await supabase
    .from('reservas')
    .select('id, clase_id, clases(fecha, horarios(hora))')
    .eq('alumna_id', alumnaId);
  if (error) throw error;
  return data.map((r) => ({
    reservaId: r.id,
    claseId: r.clase_id,
    fecha: r.clases.fecha,
    hora: r.clases.horarios.hora,
  }));
}

export async function hacerCheckin(supabase, alumnaId, claseId) {
  const { error } = await supabase
    .from('asistencias')
    .upsert(
      { alumna_id: alumnaId, clase_id: claseId, checkin_alumna: new Date().toISOString() },
      { onConflict: 'alumna_id,clase_id' },
    );
  if (error) throw error;
}

export async function apartarLugar(supabase, alumnaId, claseId) {
  const { error } = await supabase.from('reservas').insert({ alumna_id: alumnaId, clase_id: claseId });
  if (error) throw error;
}

export async function obtenerPaqueteActivo(supabase, alumnaId) {
  const { data, error } = await supabase
    .from('paquetes')
    .select('*')
    .eq('alumna_id', alumnaId)
    .eq('activo', true)
    .order('fecha_pago', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function obtenerMisAsistencias(supabase, alumnaId) {
  const { data, error } = await supabase
    .from('asistencias')
    .select('id, checkin_alumna, confirmada_admin, clases(fecha, horarios(hora))')
    .eq('alumna_id', alumnaId)
    .order('id', { ascending: false });
  if (error) throw error;
  return data.map((a) => ({
    id: a.id,
    checkinAlumna: a.checkin_alumna,
    confirmadaAdmin: a.confirmada_admin,
    fecha: a.clases.fecha,
    hora: a.clases.horarios.hora,
  }));
}

export async function listarAlumnas(supabase) {
  const { data, error } = await supabase
    .from('alumnas')
    .select('id, nombre, telefono, fecha_alta, es_admin')
    .order('nombre', { ascending: true });
  if (error) throw error;
  return data;
}

export async function obtenerClaseDeHoy(supabase) {
  const { data, error } = await supabase
    .from('clases')
    .select('id, fecha, horarios(hora)')
    .eq('fecha', hoyISO())
    .eq('cancelada', false)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listarReservasDeClase(supabase, claseId) {
  const [{ data: reservas, error: e1 }, { data: asistencias, error: e2 }] = await Promise.all([
    supabase.from('reservas').select('id, alumna_id, alumnas(nombre)').eq('clase_id', claseId),
    supabase.from('asistencias').select('alumna_id, checkin_alumna, confirmada_admin').eq('clase_id', claseId),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const asistenciaPorAlumna = new Map(asistencias.map((a) => [a.alumna_id, a]));
  return reservas.map((r) => ({
    alumnaId: r.alumna_id,
    nombre: r.alumnas.nombre,
    asistencia: asistenciaPorAlumna.get(r.alumna_id) ?? null,
  }));
}

export async function confirmarAsistencia(supabase, alumnaId, claseId) {
  const { error } = await supabase
    .from('asistencias')
    .upsert(
      { alumna_id: alumnaId, clase_id: claseId, confirmada_admin: new Date().toISOString() },
      { onConflict: 'alumna_id,clase_id' },
    );
  if (error) throw error;
}

export async function listarValoraciones(supabase, alumnaId) {
  const { data, error } = await supabase
    .from('valoraciones')
    .select('*')
    .eq('alumna_id', alumnaId)
    .order('numero', { ascending: false });
  if (error) throw error;
  return data;
}

export async function crearValoracion(supabase, alumnaId, campos, numero) {
  const { error } = await supabase.from('valoraciones').insert({ alumna_id: alumnaId, numero, ...campos });
  if (error) throw error;
}

export async function obtenerFichaAlumna(supabase, alumnaId) {
  const [alumna, paquete, valoraciones, asistencias] = await Promise.all([
    obtenerPerfil(supabase, alumnaId),
    obtenerPaqueteActivo(supabase, alumnaId),
    listarValoraciones(supabase, alumnaId),
    obtenerMisAsistencias(supabase, alumnaId),
  ]);
  return { alumna, paquete, valoraciones, asistencias };
}

export async function activarPaquete(supabase, alumnaId, { tipo, clasesTotales, monto, formaPago, fechaPago, vence }) {
  const paqueteAnterior = await obtenerPaqueteActivo(supabase, alumnaId);
  if (paqueteAnterior) {
    const { error } = await supabase.from('paquetes').update({ activo: false }).eq('id', paqueteAnterior.id);
    if (error) throw error;
  }
  const { error } = await supabase.from('paquetes').insert({
    alumna_id: alumnaId,
    tipo,
    clases_totales: clasesTotales,
    clases_usadas: 0,
    monto,
    forma_pago: formaPago,
    fecha_pago: fechaPago,
    vence,
    activo: true,
  });
  if (error) throw error;
}

export async function generarClases(supabase) {
  const { error } = await supabase.rpc('generar_clases');
  if (error) throw error;
}
