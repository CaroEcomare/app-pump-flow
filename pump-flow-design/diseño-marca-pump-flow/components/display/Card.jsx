import React from "react";

export function Card({ tone = "white", padding = "var(--space-5)", children, style, ...rest }) {
  const tones = {
    white: { background: "var(--surface-card)", boxShadow: "var(--shadow-card)" },
    soft: { background: "var(--pf-lila)", boxShadow: "none" },
    accent: { background: "var(--pf-lavanda)", color: "#fff" },
    dark: { background: "var(--pf-morado)", color: "#fff" },
    outline: { background: "transparent", border: "2px solid var(--border-soft)" },
  };
  return (
    <div {...rest} style={{ borderRadius: "var(--radius-lg)", padding, font: "var(--text-body)", color: "var(--text-body)", ...tones[tone], ...style }}>
      {children}
    </div>
  );
}
