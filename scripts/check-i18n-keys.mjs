import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const localeDirectory = resolve(root, 'frontend/features/i18n/locales');
const localeFiles = (await readdir(localeDirectory)).filter((name) => name.endsWith('.json')).sort();
const expectedLocales = [
  'ar.json', 'de.json', 'en.json', 'es.json', 'fr.json', 'it.json', 'ja.json', 'ko.json',
  'pt-BR.json', 'pt-PT.json', 'ru.json', 'vi.json', 'zh-Hans.json', 'zh-Hant.json',
].sort();

if (localeFiles.length !== 14 || localeFiles.some((name, index) => name !== expectedLocales[index])) {
  console.error(`Expected exactly 14 locale files; found: ${localeFiles.join(', ')}`);
  process.exitCode = 1;
} else {
  const sourceText = await readFile(resolve(localeDirectory, 'en.json'), 'utf8');
  const source = JSON.parse(sourceText);
  const sourceKeys = leafKeys(source);
  const placeholders = new Set(['zh-Hant.json', 'it.json', 'pt-PT.json', 'ar.json']);
  let errors = 0;
  for (const file of localeFiles.filter((name) => name !== 'en.json')) {
    const localeText = await readFile(resolve(localeDirectory, file), 'utf8');
    const locale = JSON.parse(localeText);
    if (placeholders.has(file) && localeText !== sourceText) {
      errors += 1;
      console.error(`${file}: placeholder must remain an exact copy of en.json`);
    }
    const missing = sourceKeys.filter((key) => getPath(locale, key) === undefined);
    if (missing.length) {
      errors += 1;
      console.error(`${file}: missing ${missing.length} key(s): ${missing.join(', ')}`);
    } else {
      console.log(`${file}: all ${sourceKeys.length} source keys present`);
    }
  }
  if (errors) process.exitCode = 1;
  else console.log('Locale key check passed.');
}

function leafKeys(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === 'object' && !Array.isArray(child)
      ? leafKeys(child, path)
      : [path];
  });
}

function getPath(value, path) {
  return path.split('.').reduce((current, part) => {
    if (!current || typeof current !== 'object' || !Object.hasOwn(current, part)) return undefined;
    return current[part];
  }, value);
}
