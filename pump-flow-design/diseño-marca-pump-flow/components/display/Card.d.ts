import * as React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** white (sombra), soft (lila), accent (lavanda), dark (morado), outline */
  tone?: "white" | "soft" | "accent" | "dark" | "outline";
  padding?: string;
  children?: React.ReactNode;
}
export declare function Card(props: CardProps): JSX.Element;
