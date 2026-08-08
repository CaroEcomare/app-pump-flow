import React from "react";

export function Tag({ selected, onClick, children, style }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        font: "var(--text-small)", fontWeight: 500, cursor: "pointer",
        padding: "8px 18px", borderRadius: "var(--radius-pill)", border: "none",
        background: selected ? "var(--pf-morado)" : hover ? "var(--pf-lila)" : "var(--pf-lila-fondo)",
        color: selected ? "#fff" : "var(--pf-morado)",
        transition: "background var(--transition-fast)",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
