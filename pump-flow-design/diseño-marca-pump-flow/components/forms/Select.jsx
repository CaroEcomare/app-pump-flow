import React from "react";

export function Select({ label, options = [], style, selectStyle, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <label style={{ display: "grid", gap: 6, font: "var(--text-small)", color: "var(--text-body)", ...style }}>
      {label && <span style={{ font: "var(--text-body-strong)", fontSize: 14, color: "var(--text-title)" }}>{label}</span>}
      <div style={{ position: "relative" }}>
        <select
          {...rest}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            font: "var(--text-body)", color: "var(--text-body)", appearance: "none",
            padding: "12px 44px 12px 18px", minHeight: 48, width: "100%", boxSizing: "border-box",
            borderRadius: "var(--radius-pill)", outline: "none", background: "#fff",
            border: `2px solid ${focus ? "var(--focus-ring)" : "var(--border-soft)"}`,
            transition: "border-color var(--transition-fast)", cursor: "pointer", ...selectStyle,
          }}
        >
          {options.map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
        </select>
        <span style={{ position: "absolute", right: 18, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--pf-lavanda)" }}>▾</span>
      </div>
    </label>
  );
}
