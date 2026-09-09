import React from "react";

export function Switch({ label, checked, onChange, disabled, style }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: disabled ? "not-allowed" : "pointer", font: "var(--text-body)", color: "var(--text-body)", opacity: disabled ? 0.5 : 1, ...style }}>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={onChange} style={{ display: "none" }} />
      <span style={{
        width: 48, height: 28, borderRadius: "var(--radius-pill)", flexShrink: 0, position: "relative",
        background: checked ? "var(--pf-lavanda)" : "var(--border-soft)",
        transition: "background var(--transition-base)",
      }}>
        <span style={{
          position: "absolute", top: 3, left: checked ? 23 : 3, width: 22, height: 22,
          borderRadius: "50%", background: "#fff", boxShadow: "var(--shadow-card)",
          transition: "left var(--transition-base)",
        }} />
      </span>
      {label}
    </label>
  );
}
