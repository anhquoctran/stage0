import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createInstance } from 'i18next';

const read = code => JSON.parse(readFileSync(new URL(`../frontend/features/i18n/locales/${code}.json`, import.meta.url)));
async function localized(code) {
  const instance = createInstance();
  await instance.init({ lng: code, fallbackLng: 'en', resources: { [code]: { translation: read(code) }, en: { translation: read('en') } }, interpolation: { escapeValue: false } });
  return instance;
}

test('Russian notification and relative-time plurals use one/few/many and support fractions', async () => {
  const i18n = await localized('ru');
  for (const [count, word] of [[1, 'минуту'], [2, 'минуты'], [5, 'минут'], [21, 'минуту']]) {
    assert.ok(i18n.t('dateTime.minutesAgo', { count }).includes(word));
    const category = new Intl.PluralRules('ru').select(count);
    assert.equal(i18n.t('notifications.unreadCount', { count }), read('ru').notifications[`unreadCount_${category}`].replace('{{count}}', String(count)));
  }
  assert.ok(!i18n.t('reviewFlow.completedBody', { count: 1.5, title: 'MR' }).includes('Created'));
});

test('Arabic resolves all six plural forms locally and preserves generated context', async () => {
  const i18n = await localized('ar'), resource = read('ar');
  const categories = new Set();
  for (const count of [0, 1, 2, 3, 11, 100]) {
    const category = new Intl.PluralRules('ar').select(count); categories.add(category);
    for (const [group, stem] of [['notifications', 'unreadCount'], ['dateTime', 'minutesAgo'], ['reviewFlow', 'completedBody']]) {
      const text = resource[group][`${stem}_${category}`];
      assert.ok(text);
      assert.equal(i18n.t(`${group}.${stem}`, { count, title: 'MR-42' }), text.replace('{{count}}', String(count)).replace('{{title}}', 'MR-42'));
    }
  }
  assert.equal(categories.size, 6);
});

test('formerly placeholder locales have localized welcome, preferences, menu, notifications and review copy', async () => {
  for (const code of ['ar', 'it', 'pt-PT', 'zh-Hant']) {
    const i18n = await localized(code);
    for (const key of ['onboarding.hello.welcome', 'preferences.language.description', 'menu.commands.open_repo', 'notifications.emptyDescription', 'reviewFlow.accepted']) {
      assert.notEqual(i18n.t(key), (await localized('en')).t(key), `${code}: ${key}`);
    }
  }
});
