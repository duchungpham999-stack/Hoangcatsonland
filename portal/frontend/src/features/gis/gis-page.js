export function renderGisPanel() {
  const article = document.createElement('article');
  article.dataset.feature = 'gis';
  article.textContent = 'GIS module placeholder';
  return article;
}
