export function renderGisPanel() {
  const article = document.createElement('article');
  article.dataset.feature = 'gis';
  article.innerHTML = '<h2>GIS</h2><p>Geospatial operations workspace</p>';
  return article;
}
