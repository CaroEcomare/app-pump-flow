import React from "react";

export function Dialog({ open, onClose, title, children, actions }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(62,47,82,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 24 }}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{
        background: "#fff", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-float)",
        padding: "var(--space-6)", maxWidth: 440, width: "100%", font: "var(--text-body)", color: "var(--text-body)",
      }}>
        {title && <h2 style={{ font: "var(--text-h2)", color: "var(--text-title)", margin: "0 0 12px" }}>{title}</h2>}
        <div>{children}</div>
        {actions && <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>{actions}</div>}
      </div>
    </div>
  );
}
