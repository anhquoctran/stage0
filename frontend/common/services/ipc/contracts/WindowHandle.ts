export interface WindowHandle {
  readonly label: string;
  setLogicalSize(size: { width: number; height: number }): Promise<void>;
  setPhysicalPosition(position: { x: number; y: number }): Promise<void>;
  show(): Promise<void>;
  setOverlayIcon(bytes?: Uint8Array): Promise<void>;
  setBadgeLabel(label?: string): Promise<void>;
}
