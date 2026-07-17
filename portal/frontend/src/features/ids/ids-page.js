export function renderIdsPanel() {
  const article = document.createElement('article');
  article.dataset.feature = 'ids';
  article.innerHTML = '<h2>IDS</h2><p>Security detection workspace</p>';
  return article;
}
