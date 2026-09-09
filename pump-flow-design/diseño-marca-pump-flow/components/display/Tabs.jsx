import React from "react";

export function Tabs({ tabs = [], value, onChange, style }) {
  return (
    <div role="tablist" style={{ display: "inline-flex", gap: 4, background: "var(--pf-lila-fondo)", borderRadius: "var(--radius-pill)", padding: 4, ...style }}>
      {tabs.map((t) => {
        const key = t.value ?? t;
        const active = key === value;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange && onChange(key)}
            style={{
              font: "var(--text-small)", fontWeight: 600, cursor: "pointer",
              padding: "10px 22px", borderRadius: "var(--radius-pill)", border: "none",
              background: active ? "#fff" : "transparent",
              color: "var(--pf-morado)",
              boxShadow: active ? "var(--shadow-card)" : "none",
              transition: "background var(--transition-fast)",
            }}
          >
            {t.label ?? t}
          </button>
        );
      })}
    </div>
  );
}
