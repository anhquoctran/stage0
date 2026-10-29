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
  let errors = 0;
  for (const file of localeFiles.filter((name) => name !== 'en.json')) {
    const localeText = await readFile(resolve(localeDirectory, file), 'utf8');
    const locale = JSON.parse(localeText);
    const missing = sourceKeys.filter((key) => getPath(locale, key) === undefined);
    if (missing.length) {
      errors += 1;
      console.error(`${file}: missing ${missing.length} key(s): ${missing.join(', ')}`);
    } else {
      console.log(`${file}: all ${sourceKeys.length} source keys present`);
    }
    const categories = new Intl.PluralRules(file.slice(0, -5)).resolvedOptions().pluralCategories;
    for (const key of leafKeys(locale)) {
      const value = getPath(locale, key);
      const sourceKey = key.replace(/_(zero|one|two|few|many)$/u, '_other');
      const original = getPath(source, key) ?? getPath(source, sourceKey);
      let reason;
      if (typeof value !== 'string' || !value.trim()) reason = 'empty or non-string translation';
      else if (original === undefined) reason = 'unknown translation key';
      else if (JSON.stringify(tokens(value)) !== JSON.stringify(tokens(original))) reason = 'interpolation tokens differ';
      else if (value === original && value.length > 20 && key !== 'menu.commands.open_vscode') reason = 'untranslated English text';
      if (reason) {
        errors++;
        console.error(`${file}: ${key}: ${reason}`);
      }
    }
    for (const key of sourceKeys.filter((key) => key.endsWith('_other'))) {
      for (const category of categories) {
        const variant = key.replace(/_other$/u, `_${category}`);
        if (typeof getPath(locale, variant) !== 'string') {
          errors++;
          console.error(`${file}: missing plural variant ${variant}`);
        }
      }
    }
  }
  if (errors) process.exitCode = 1;
  else console.log('All 14 locales passed: keys, nonempty translations, interpolation and plural categories.');
}

function tokens(value) {
  return [...value.matchAll(/\{\{[^{}]+\}\}|\{[a-zA-Z][a-zA-Z0-9]*\}/gu)]
    .map(([token]) => token).sort();
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
