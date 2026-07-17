export function renderHrmPanel() {
  const article = document.createElement('article');
  article.dataset.feature = 'hrm';
  article.innerHTML = '<h2>HRM</h2><p>Human resources workspace</p>';
  return article;
}
