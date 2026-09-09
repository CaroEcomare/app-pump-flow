import React from "react";

export function Input({ label, hint, error, style, inputStyle, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <label style={{ display: "grid", gap: 6, font: "var(--text-small)", color: "var(--text-body)", ...style }}>
      {label && <span style={{ font: "var(--text-body-strong)", fontSize: 14, color: "var(--text-title)" }}>{label}</span>}
      <input
        {...rest}
        onFocus={(e) => { setFocus(true); rest.onFocus && rest.onFocus(e); }}
        onBlur={(e) => { setFocus(false); rest.onBlur && rest.onBlur(e); }}
        style={{
          font: "var(--text-body)", color: "var(--text-body)",
          padding: "12px 18px", minHeight: 48, boxSizing: "border-box",
          borderRadius: "var(--radius-pill)", outline: "none",
          border: `2px solid ${error ? "var(--pf-error)" : focus ? "var(--focus-ring)" : "var(--border-soft)"}`,
          background: "#fff", transition: "border-color var(--transition-fast)",
          width: "100%", ...inputStyle,
        }}
      />
      {error ? <span style={{ color: "var(--pf-error)", fontSize: 12 }}>{error}</span>
        : hint ? <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{hint}</span> : null}
    </label>
  );
}
