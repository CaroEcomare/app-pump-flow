import React from "react";

export function Toast({ tone = "exito", children, style }) {
  const tones = {
    exito: { background: "var(--pf-exito-fondo)", color: "var(--pf-exito)" },
    error: { background: "var(--pf-error-fondo)", color: "var(--pf-error)" },
    aviso: { background: "var(--pf-aviso-fondo)", color: "var(--pf-aviso)" },
    info: { background: "var(--pf-lila)", color: "var(--pf-morado)" },
  };
  return (
    <div role="status" style={{
      display: "inline-flex", alignItems: "center", gap: 10,
      font: "var(--text-body-strong)", padding: "14px 22px",
      borderRadius: "var(--radius-pill)", boxShadow: "var(--shadow-float)",
      ...tones[tone], ...style,
    }}>
      {children}
    </div>
  );
}
