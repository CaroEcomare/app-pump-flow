import React from "react";

export function Radio({ label, checked, onChange, name, value, disabled, style }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: disabled ? "not-allowed" : "pointer", font: "var(--text-body)", color: "var(--text-body)", opacity: disabled ? 0.5 : 1, ...style }}>
      <input type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={onChange} style={{ display: "none" }} />
      <span style={{
        width: 24, height: 24, borderRadius: "50%", flexShrink: 0, boxSizing: "border-box",
        border: `2px solid ${checked ? "var(--pf-lavanda)" : "var(--border-strong)"}`,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        transition: "border-color var(--transition-fast)",
      }}>
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: checked ? "var(--pf-lavanda)" : "transparent", transition: "background var(--transition-fast)" }} />
      </span>
      {label}
    </label>
  );
}
