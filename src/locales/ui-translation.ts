// ----------------------------------------------------------------------

const THAI_PATTERN = /[ก-๙]/;
const PLACEHOLDER_PATTERN = /__ISCORE_VAR_(\d+)__/g;

type UiTranslationCatalog = {
  exact: Record<string, string>;
  templates: { source: string; target: string; placeholders: number }[];
};

export type UiTextTranslator = (value: string) => string;

function normalize(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function loadUiTextTranslator(): Promise<UiTextTranslator> {
  const catalog = (await import('./langs/en/ui.generated.json')).default as UiTranslationCatalog;

  const templateMatchers = catalog.templates
    .filter(({ source, target }) => source && target && !source.includes('<'))
    .map(({ source, target }) => {
      const parts = source.split(/__ISCORE_VAR_\d+__/);
      const pattern = parts.map(escapeRegExp).join('(.+?)');
      return { target, regex: new RegExp(`^${pattern}$`) };
    });

  return (value: string) => {
    if (!THAI_PATTERN.test(value)) return value;

    const normalized = normalize(value);
    const exact = catalog.exact[normalized as keyof typeof catalog.exact];

    if (exact) {
      const leading = value.match(/^\s*/)?.[0] ?? '';
      const trailing = value.match(/\s*$/)?.[0] ?? '';
      return `${leading}${exact}${trailing}`;
    }

    for (const matcher of templateMatchers) {
      const match = normalized.match(matcher.regex);
      if (!match) continue;

      return matcher.target.replace(PLACEHOLDER_PATTERN, (_, index: string) => {
        const captured = match[Number(index) + 1];
        return captured ?? '';
      });
    }

    return value;
  };
}
