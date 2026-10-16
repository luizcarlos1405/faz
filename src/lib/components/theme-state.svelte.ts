import { fazIconSvg, svgDataUri } from '$lib/utils/faz-logo';

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
  requestAnimationFrame(syncThemeChrome);
}

export function initTheme(): void {
  const saved = localStorage.getItem(THEME_KEY);
  if (!saved) {
    requestAnimationFrame(updateFavicon);
    return;
  }
  document.documentElement.setAttribute('data-theme', saved);
  currentTheme = saved;
  requestAnimationFrame(syncThemeChrome);
}

function syncThemeChrome(): void {
  updateThemeColorMeta();
  updateFavicon();
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

function toHex(cssColor: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return cssColor;
  ctx.fillStyle = cssColor;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function updateFavicon(): void {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) return;

  const styles = getComputedStyle(document.documentElement);
  const color = (name: string) => toHex(styles.getPropertyValue(name).trim());

  link.href = svgDataUri(
    fazIconSvg({
      background: color('--color-base-100'),
      letter: color('--color-base-content'),
      tick: color('--color-primary'),
    }),
  );
}
