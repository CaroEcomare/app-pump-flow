import React from "react";

export function Badge({ tone = "accent", children, style }) {
  const tones = {
    accent: { background: "var(--pf-lavanda)", color: "#fff" },
    soft: { background: "var(--pf-lila)", color: "var(--pf-morado)" },
    rosa: { background: "var(--pf-rosa)", color: "var(--pf-morado)" },
    exito: { background: "var(--pf-exito-fondo)", color: "var(--pf-exito)" },
    error: { background: "var(--pf-error-fondo)", color: "var(--pf-error)" },
    aviso: { background: "var(--pf-aviso-fondo)", color: "var(--pf-aviso)" },
  };
  return (
    <span style={{ font: "var(--text-caption)", fontWeight: 600, padding: "4px 12px", borderRadius: "var(--radius-pill)", display: "inline-flex", alignItems: "center", gap: 4, ...tones[tone], ...style }}>
      {children}
    </span>
  );
}
