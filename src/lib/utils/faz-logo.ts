export const LOGO_VIEWBOX = '126 88 300 340';
export const LOGO_F_PATH = 'M244 404 V200 Q244 126 320 126 Q342 126 358 134';
export const LOGO_TICK_PATH = 'M164 264 L222 312 L330 226';
export const LOGO_F_WIDTH = 56;
export const LOGO_TICK_WIDTH = 48;
export const LOGO_GAP_WIDTH = 88;

export type LogoColors = { background: string; letter: string; tick: string };

export const BRAND_COLORS: LogoColors = {
  background: '#2f2f2f',
  letter: '#f4efe6',
  tick: '#e39a7c',
};

export function fazIconSvg(colors: LogoColors): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">',
    '<mask id="gap" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">',
    '<rect width="512" height="512" fill="#fff"/>',
    `<path d="${LOGO_TICK_PATH}" fill="none" stroke="#000" stroke-width="${LOGO_GAP_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>`,
    '</mask>',
    `<rect width="512" height="512" rx="96" fill="${colors.background}"/>`,
    `<path d="${LOGO_F_PATH}" fill="none" stroke="${colors.letter}" stroke-width="${LOGO_F_WIDTH}" stroke-linecap="round" mask="url(#gap)"/>`,
    `<path d="${LOGO_TICK_PATH}" fill="none" stroke="${colors.tick}" stroke-width="${LOGO_TICK_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>`,
    '</svg>',
  ].join('');
}

export function svgDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
