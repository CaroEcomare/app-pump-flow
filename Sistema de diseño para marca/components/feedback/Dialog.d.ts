import * as React from "react";

export interface DialogProps {
  open?: boolean;
  onClose?: () => void;
  title?: string;
  children?: React.ReactNode;
  /** Botones del pie (usa Button) */
  actions?: React.ReactNode;
}
export declare function Dialog(props: DialogProps): JSX.Element | null;
