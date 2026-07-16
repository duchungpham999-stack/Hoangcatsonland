import { renderIdsPanel } from '../ids/ids-page.js';
import { renderHrmPanel } from '../hrm/hrm-page.js';
import { renderGisPanel } from '../gis/gis-page.js';

export function renderDashboard() {
  const section = document.createElement('section');
  section.dataset.feature = 'portal-dashboard';
  section.replaceChildren(renderIdsPanel(), renderHrmPanel(), renderGisPanel());
  return section;
}
