import React from "react";

export function IconButton({ label, variant = "soft", size = 44, children, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const variants = {
    soft: { background: "var(--pf-lila)", color: "var(--pf-morado)" },
    accent: { background: "var(--pf-lavanda)", color: "#fff" },
    ghost: { background: "transparent", color: "var(--pf-morado)" },
  };
  const hoverBg = { soft: "var(--pf-lila-claro, var(--pf-lila))", accent: "var(--pf-lavanda-hover)", ghost: "var(--pf-lila-fondo)" }[variant];
  return (
    <button
      aria-label={label}
      {...rest}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: size, height: size, borderRadius: "50%", border: "none", cursor: "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        transition: "background var(--transition-fast)",
        ...variants[variant],
        ...(hover ? { background: hoverBg } : null),
        ...style,
      }}
    >
      {children}
    </button>
  );
}
