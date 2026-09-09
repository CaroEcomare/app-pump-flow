import React from "react";

const styles = {
  base: {
    font: "var(--text-button)",
    fontFamily: "var(--font-body)",
    border: "none",
    borderRadius: "var(--radius-pill)",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    transition: "background var(--transition-fast), transform var(--transition-fast)",
  },
  sizes: {
    sm: { padding: "8px 18px", fontSize: 14, minHeight: 36 },
    md: { padding: "12px 26px", fontSize: 16, minHeight: 44 },
    lg: { padding: "16px 34px", fontSize: 18, minHeight: 52 },
  },
  variants: {
    primary: { background: "var(--pf-lavanda)", color: "var(--text-on-accent)" },
    secondary: { background: "transparent", color: "var(--pf-morado)", boxShadow: "inset 0 0 0 2px var(--pf-lavanda)" },
    dark: { background: "var(--pf-morado)", color: "#fff" },
    onDark: { background: "#fff", color: "var(--pf-morado)" },
    ghost: { background: "transparent", color: "var(--pf-morado)" },
  },
};

export function Button({ variant = "primary", size = "md", disabled, children, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const hoverBg = { primary: "var(--pf-lavanda-hover)", dark: "var(--pf-morado-hover)", onDark: "var(--pf-lila)", secondary: "var(--pf-lila-fondo)", ghost: "var(--pf-lila-fondo)" }[variant];
  return (
    <button
      {...rest}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{
        ...styles.base,
        ...styles.sizes[size],
        ...styles.variants[variant],
        ...(hover && !disabled ? { background: hoverBg } : null),
        ...(press && !disabled ? { transform: "scale(0.98)", boxShadow: "var(--shadow-press)" } : null),
        ...(disabled ? { opacity: 0.45, cursor: "not-allowed" } : null),
        ...style,
      }}
    >
      {children}
    </button>
  );
}
