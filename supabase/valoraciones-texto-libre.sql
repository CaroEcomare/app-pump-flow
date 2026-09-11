-- ============================================
-- Valoraciones: campos de medidas ahora son texto libre
-- ============================================
-- Antes, varios campos de la valoración solo aceptaban números (edad,
-- diástasis, perímetros, etc.). Ahora aceptan cualquier texto, sin
-- límite de longitud, para poder anotar observaciones además de la
-- cifra si hace falta. Los valores que ya tenías guardados se
-- convierten a texto tal cual (no se pierde nada).
-- Pega este archivo completo en el SQL Editor de Supabase y córrelo.

alter table valoraciones alter column edad type text using edad::text;
alter table valoraciones alter column competencia_abdominal_dedos type text using competencia_abdominal_dedos::text;
alter table valoraciones alter column diastasis_supraumbilical type text using diastasis_supraumbilical::text;
alter table valoraciones alter column diastasis_umbilical type text using diastasis_umbilical::text;
alter table valoraciones alter column diastasis_infraumbilical type text using diastasis_infraumbilical::text;
alter table valoraciones alter column perimetro_cintura type text using perimetro_cintura::text;
alter table valoraciones alter column perimetro_ombligo type text using perimetro_ombligo::text;
alter table valoraciones alter column perimetro_bajo_ombligo type text using perimetro_bajo_ombligo::text;
alter table valoraciones alter column perimetro_cadera type text using perimetro_cadera::text;
alter table valoraciones alter column perimetro_cintura_apnea type text using perimetro_cintura_apnea::text;
