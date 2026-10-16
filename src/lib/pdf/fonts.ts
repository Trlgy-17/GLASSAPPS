import { Font } from '@react-pdf/renderer';
import path from 'path';

let fontsRegistered = false;

export function registerFonts() {
  if (fontsRegistered) return;

  const isServer = typeof window === 'undefined';
  const getSrc = (file: string) =>
    isServer
      ? path.resolve(process.cwd(), 'public/fonts', file)
      : `/fonts/${file}`;

  try {
    Font.register({
      family: 'PlusJakartaSans',
      fonts: [
        { src: getSrc('plus-jakarta-sans-latin-400-normal.woff'), fontWeight: 400 },
        { src: getSrc('plus-jakarta-sans-latin-500-normal.woff'), fontWeight: 500 },
        { src: getSrc('plus-jakarta-sans-latin-600-normal.woff'), fontWeight: 600 },
        { src: getSrc('plus-jakarta-sans-latin-700-normal.woff'), fontWeight: 700 },
        { src: getSrc('plus-jakarta-sans-latin-800-normal.woff'), fontWeight: 800 },
      ],
    });
    fontsRegistered = true;
  } catch (err) {
    console.warn('Font registration warning:', err);
  }
}
