import { describe, expect, it } from 'vitest';
import { BRAND_COLORS, LOGO_TICK_PATH, fazIconSvg, svgDataUri } from '../faz-logo';

describe('fazIconSvg', () => {
  it('paints the tile, letter and tick with the given colors', () => {
    const svg = fazIconSvg({ background: '#111111', letter: '#eeeeee', tick: '#ff0000' });
    expect(svg).toContain('fill="#111111"');
    expect(svg).toContain('stroke="#eeeeee"');
    expect(svg).toContain('stroke="#ff0000"');
  });

  it('cuts the letter where the tick crosses it', () => {
    const svg = fazIconSvg(BRAND_COLORS);
    expect(svg).toContain(`<path d="${LOGO_TICK_PATH}" fill="none" stroke="#000"`);
    expect(svg).toContain('mask="url(#gap)"');
  });
});

describe('svgDataUri', () => {
  it('encodes the svg so it is safe inside a url', () => {
    const uri = svgDataUri('<svg fill="#fff"/>');
    expect(uri.startsWith('data:image/svg+xml,')).toBe(true);
    expect(uri).not.toContain('#');
    expect(decodeURIComponent(uri.slice('data:image/svg+xml,'.length))).toBe('<svg fill="#fff"/>');
  });
});
