import React from "react";

export function Checkbox({ label, checked, onChange, disabled, style }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: disabled ? "not-allowed" : "pointer", font: "var(--text-body)", color: "var(--text-body)", opacity: disabled ? 0.5 : 1, ...style }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} style={{ display: "none" }} />
      <span style={{
        width: 24, height: 24, borderRadius: 8, flexShrink: 0,
        background: checked ? "var(--pf-lavanda)" : "#fff",
        border: `2px solid ${checked ? "var(--pf-lavanda)" : "var(--border-strong)"}`,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontSize: 15, transition: "background var(--transition-fast)",
        boxSizing: "border-box",
      }}>{checked ? "✓" : ""}</span>
      {label}
    </label>
  );
}
