/**
 * Ajuste de cor para legibilidade (contraste WCAG) contra o fundo do tema.
 *
 * Problema: a cor principal de um time pode ficar quase invisível como texto
 * quando é escura num tema escuro (preto sobre preto) ou clara num tema claro
 * (branco sobre branco). Em vez de contornos (que parecem datados), nudamos a
 * luminância da cor — clareando no tema escuro, escurecendo no tema claro —
 * até atingir contraste suficiente, preservando o matiz ao máximo.
 */

type Rgb = [number, number, number];

function parseHex(hex: string): Rgb | null {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return null;
  return [r, g, b];
}

function toHex([r, g, b]: Rgb): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance([r, g, b]: Rgb): number {
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

function contrastRatio(l1: number, l2: number): number {
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

// Luminância aproximada das superfícies de cada tema (bg-surface/elevated).
const DARK_SURFACE_LUM = 0.045;
const LIGHT_SURFACE_LUM = 0.95;
// Texto grande/bold: WCAG AA pede 3:1; usamos folga para ficar confortável.
const MIN_CONTRAST = 3.5;

/**
 * Retorna uma versão da cor legível como texto sobre a superfície do tema.
 * Se a cor não puder ser parseada, devolve-a inalterada.
 */
export function readableAccent(hex: string, isDark: boolean): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;

  const bgLum = isDark ? DARK_SURFACE_LUM : LIGHT_SURFACE_LUM;
  const target: Rgb = isDark ? [255, 255, 255] : [0, 0, 0];

  if (contrastRatio(relativeLuminance(rgb), bgLum) >= MIN_CONTRAST) {
    return toHex(rgb);
  }

  for (let t = 0.1; t < 1; t += 0.1) {
    const candidate = mix(rgb, target, t);
    if (contrastRatio(relativeLuminance(candidate), bgLum) >= MIN_CONTRAST) {
      return toHex(candidate);
    }
  }
  return toHex(target);
}
