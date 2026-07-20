/** Busca tolerante a acentos/caixa: "sao" encontra "Sao Paulo" e vice-versa. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** True se algum dos campos contem o termo (ambos normalizados). */
export function matchesSearchTerm(
  term: string,
  ...fields: Array<string | null | undefined>
): boolean {
  const needle = normalizeSearchText(term);
  if (!needle) return true;
  return fields.some((f) => !!f && normalizeSearchText(f).includes(needle));
}
