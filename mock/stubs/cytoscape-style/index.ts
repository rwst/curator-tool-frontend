/* Stub for `ngx-reactome-cytoscape-style` — the app uses only `ReactomeEvent` (accessed as
 * `.type` and `.detail`) and `ReactomeEventTypes` (compared as `event.type !== ...select`).
 * No index signature: `noPropertyAccessFromIndexSignature` would force ['..'] access otherwise. */
export interface ReactomeEvent {
  type: string;
  detail: any;
  renderedPosition: { x: number; y: number };
}

export enum ReactomeEventTypes {
  select = 'select',
  unselect = 'unselect',
  added = 'added',
  removed = 'removed',
}
