export function renderIdsPanel() {
  const article = document.createElement('article');
  article.dataset.feature = 'ids';
  article.textContent = 'IDS module placeholder';
  return article;
}
