let currentTheme = $state('light');

const THEME_KEY = 'theme';

export function getThemeState() {
  return {
    get current() {
      return currentTheme;
    },
  };
}

export function applyTheme(name: string): void {
  document.documentElement.setAttribute('data-theme', name);
  localStorage.setItem(THEME_KEY, name);
  currentTheme = name;
  requestAnimationFrame(updateThemeColorMeta);
}

export function initTheme(): void {
  const saved = localStorage.getItem(THEME_KEY);
  if (!saved) return;
  document.documentElement.setAttribute('data-theme', saved);
  currentTheme = saved;
  requestAnimationFrame(updateThemeColorMeta);
}

function updateThemeColorMeta(): void {
  const layoutEl = document.getElementById('layout') ?? document.body;
  const computed = getComputedStyle(layoutEl).backgroundColor;

  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }

  meta.setAttribute('content', computed);
}
