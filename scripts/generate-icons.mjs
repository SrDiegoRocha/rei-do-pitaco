/**
 * Gera os ícones PNG e o favicon do PWA a partir dos SVGs da logo.
 *
 * Fontes:
 *   public/icons/icon.svg           -> icon-192.png, icon-512.png, favicon.ico
 *   public/icons/icon-maskable.svg  -> maskable-512.png
 *
 * Uso (sharp/png-to-ico não ficam salvos no package.json):
 *   npm install --no-save sharp png-to-ico
 *   node scripts/generate-icons.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = join(root, 'public', 'icons');

const iconSvg = await readFile(join(iconsDir, 'icon.svg'));
const maskableSvg = await readFile(join(iconsDir, 'icon-maskable.svg'));

const render = (svg, size) =>
  sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();

// Ícones do manifest
await writeFile(join(iconsDir, 'icon-192.png'), await render(iconSvg, 192));
await writeFile(join(iconsDir, 'icon-512.png'), await render(iconSvg, 512));
await writeFile(join(iconsDir, 'maskable-512.png'), await render(maskableSvg, 512));

// Favicon multi-resolução
const faviconPngs = await Promise.all([16, 32, 48].map((s) => render(iconSvg, s)));
await writeFile(join(root, 'public', 'favicon.ico'), await pngToIco(faviconPngs));

console.log('Ícones gerados: icon-192.png, icon-512.png, maskable-512.png, favicon.ico');
