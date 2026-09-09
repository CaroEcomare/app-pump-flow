import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  /** Mensaje de error; activa borde rosa error */
  error?: string;
  inputStyle?: React.CSSProperties;
}
export declare function Input(props: InputProps): JSX.Element;
