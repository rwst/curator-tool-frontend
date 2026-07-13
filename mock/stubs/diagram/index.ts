/* Stub for `ngx-reactome-diagram` — satisfies the app's imports so it builds without the real
 * diagram library (sibling repo ngx-reactome-base). The diagram renders as an inert placeholder;
 * everything else in the UI works. Surface matches exactly what the app uses across
 * pathway-diagram.component.ts + utils/*.ts + app.module.ts:
 *   - DiagramComponent  (selector cr-diagram; inputs usedbId/blockRouterChange; output reactomeEvents$;
 *                        plus the members read/called on the @ViewChild / util `diagram` param)
 *   - DiagramService    (injected into PathwayDiagramValidator — must be a real DI token)
 *   - DIAGRAM_CONFIG_TOKEN  (provided in app.module.ts)
 */
import { Component, EventEmitter, Injectable, InjectionToken, Input, Output } from '@angular/core';

export const DIAGRAM_CONFIG_TOKEN = new InjectionToken<any>('DIAGRAM_CONFIG_TOKEN');

@Injectable({ providedIn: 'root' })
export class DiagramService {
  // Style/type lookup maps the diagram utils read via .get(); empty maps keep the (stubbed,
  // normally-unreached) diagram code path from throwing.
  edgeTypeMap: any = new Map();
  edgeTypeToStr: any = new Map();
  linkClassMap: any = new Map();
  reactionTypeMap: any = new Map();
  nodeTypeMap: any = new Map();
}

@Component({
  selector: 'cr-diagram',
  standalone: true,
  template: `<div style="padding:1rem;color:#8a8f98;font:13px/1.5 sans-serif;border:1px dashed #cbd2d9;border-radius:6px">
    Diagram widget disabled in mock mode.
  </div>`,
})
export class DiagramComponent {
  @Input() usedbId: any;
  @Input() blockRouterChange: any;
  @Output() reactomeEvents$ = new EventEmitter<any>();

  // Members read/called on the @ViewChild instance and on `diagram` params in utils/*.ts.
  cy: any = null;
  cyCompare: any = null;
  diagramId: any = undefined;
  cytoscapeContainer: any = undefined;
  dark: any = false;
  component: any = undefined;
  model: any = undefined;
  service: any = undefined;
  displayNetwork(..._args: any[]): any {}
  loadDiagram(..._args: any[]): any {}
  resetState(..._args: any[]): any {}
  getDiagramService(..._args: any[]): any { return null; }
  applyEvent(..._args: any[]): any {}
  select(..._args: any[]): any {}
  flag(..._args: any[]): any {}
}
