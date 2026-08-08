import * as React from "react";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  /** Strings u objetos {value, label} */
  options?: Array<string | { value: string; label: string }>;
  selectStyle?: React.CSSProperties;
}
export declare function Select(props: SelectProps): JSX.Element;
