import { supabase } from './supabase-client.js';
import { crearPerfilAlumna, obtenerPerfil, obtenerPerfilOpcional } from './data.js';

export async function registrar({ correo, contrasena, nombre, telefono, plataforma }) {
  const { data, error } = await supabase.auth.signUp({
    email: correo,
    password: contrasena,
    options: { data: { nombre, telefono, plataforma } },
  });
  if (error) throw error;
  return data;
}

export async function iniciarSesion({ correo, contrasena }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: correo, password: contrasena });
  if (error) throw error;
  return data;
}

export async function cerrarSesion() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function obtenerSesionActual() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function asegurarPerfil(user) {
  let perfil = await obtenerPerfilOpcional(supabase, user.id);
  if (!perfil) {
    await crearPerfilAlumna(supabase, {
      id: user.id,
      nombre: user.user_metadata?.nombre ?? '',
      telefono: user.user_metadata?.telefono ?? '',
      plataforma: user.user_metadata?.plataforma ?? 'no',
    });
    perfil = await obtenerPerfil(supabase, user.id);
  }
  return perfil;
}
