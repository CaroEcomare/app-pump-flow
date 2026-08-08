import * as React from "react";

export interface ToastProps {
  tone?: "exito" | "error" | "aviso" | "info";
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Toast(props: ToastProps): JSX.Element;
