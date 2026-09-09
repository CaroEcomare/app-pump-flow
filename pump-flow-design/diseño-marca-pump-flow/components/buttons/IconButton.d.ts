import * as React from "react";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Texto accesible obligatorio */
  label: string;
  variant?: "soft" | "accent" | "ghost";
  /** Diámetro en px, mínimo 44 en móvil */
  size?: number;
  children?: React.ReactNode;
}
export declare function IconButton(props: IconButtonProps): JSX.Element;
