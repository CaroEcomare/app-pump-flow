import * as React from "react";

/**
 * Botón píldora de Pump&Flow.
 * @startingPoint section="Componentes" subtitle="Botón píldora en 5 variantes" viewport="700x260"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary (lavanda), secondary (borde), dark (morado), onDark (blanco sobre color), ghost */
  variant?: "primary" | "secondary" | "dark" | "onDark" | "ghost";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  children?: React.ReactNode;
}
export declare function Button(props: ButtonProps): JSX.Element;
