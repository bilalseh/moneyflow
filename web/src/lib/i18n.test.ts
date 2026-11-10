import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { CATEGORY_IDS } from '@moneyflow/shared';

import { translations } from '@/lib/i18n';

type Tree = Record<string, unknown>;

function flatten(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    value !== null && typeof value === 'object'
      ? flatten(value as Tree, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

/** Strip i18next plural suffixes so "months_one" and "months_other" both count as "months". */
const base = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, '');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !name.includes('.test.') ? [path] : [];
  });
}

const en = new Set(flatten(translations.en).map(base));
const ar = new Set(flatten(translations.ar).map(base));

describe('translations', () => {
  it('English and Arabic define exactly the same keys', () => {
    expect([...en].filter((k) => !ar.has(k))).toEqual([]);
    expect([...ar].filter((k) => !en.has(k))).toEqual([]);
  });

  it('every literal t() key used in the source exists', () => {
    const root = join(import.meta.dirname, '..');
    const used = new Set<string>();
    for (const file of sourceFiles(root)) {
      for (const match of readFileSync(file, 'utf8').matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) {
        if (match[1]) used.add(match[1]);
      }
    }
    expect(used.size).toBeGreaterThan(50);
    expect([...used].filter((k) => !en.has(k)).sort()).toEqual([]);
  });

  it('has a label for every category', () => {
    for (const id of CATEGORY_IDS) expect(en.has(`categories.${id}`)).toBe(true);
  });

  it('never uses an em dash', () => {
    const all = JSON.stringify(translations);
    expect(all.includes('—')).toBe(false);
  });
});
