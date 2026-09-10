import { href } from '../router';
import { h } from '../util/dom';
import type { ViewContext } from './types';

export function notFoundView({ route, root }: ViewContext): void {
  const path = route.view === 'not-found' ? route.path : '';
  root.appendChild(
    h(
      'section',
      { class: 'not-found' },
      h('h1', null, 'Page not found'),
      h('p', null, 'No view at ', h('code', null, `#/${path}`), '.'),
      h('p', null, h('a', { href: href('overview') }, 'Back to the overview')),
    ),
  );
}
