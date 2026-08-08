import React from "react";

export function Tooltip({ text, children }) {
  const [show, setShow] = React.useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span role="tooltip" style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
          background: "var(--pf-morado)", color: "#fff", font: "var(--text-caption)",
          padding: "6px 14px", borderRadius: "var(--radius-pill)", whiteSpace: "nowrap", zIndex: 50,
        }}>{text}</span>
      )}
    </span>
  );
}
