export function createFeatureShell(name) {
  const section = document.createElement('section');
  section.dataset.feature = name;
  return section;
}
