import type { Dataset } from '../data/types';
import type { Route } from '../router';

export interface ViewContext {
  ds: Dataset;
  route: Route;
  /** Container to render into (already emptied). */
  root: HTMLElement;
}

export type View = (ctx: ViewContext) => void | Promise<void>;
