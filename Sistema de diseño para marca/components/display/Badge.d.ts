import * as React from "react";

export interface BadgeProps {
  tone?: "accent" | "soft" | "rosa" | "exito" | "error" | "aviso";
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Badge(props: BadgeProps): JSX.Element;
