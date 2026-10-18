// Gör om det enfils-bygget (dist-artifact/index.html) till en sida som kan
// publiceras som förhandsvisning: plattformen lägger själv till doctype,
// <head> och <body>, så de tas bort här tillsammans med favicon-länken.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const html = readFileSync('dist-artifact/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];

const cleanedHead = head
  .replace(/<meta charset[^>]*>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '')
  .replace(/<link rel="icon"[^>]*>/i, '')
  .replace(/<title>[^<]*<\/title>/, '<title>cad-apa demo</title>')
  .trim();

// Titeln ska ligga först i filen.
const title = cleanedHead.match(/<title>[\s\S]*?<\/title>/)[0];
const rest = cleanedHead.replace(title, '');

mkdirSync('artifact', { recursive: true });
writeFileSync('artifact/cad-apa.html', `${title}\n${rest}\n${body.trim()}\n`);
console.log('artifact/cad-apa.html', Math.round(Buffer.byteLength(readFileSync('artifact/cad-apa.html')) / 1024), 'kB');
