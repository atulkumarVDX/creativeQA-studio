export type MainUnitLinkedItem = {
  id: string;
  mainUnit: string;
};

export function orderByMainUnitArtboards<T extends MainUnitLinkedItem>(artboards: string[], items: readonly T[]): T[] {
  const byMainUnit = new Map<string, T[]>();
  for (const item of items) {
    const key = item.mainUnit.trim().toLowerCase();
    byMainUnit.set(key, [...(byMainUnit.get(key) || []), item]);
  }

  const seen = new Set<string>();
  return artboards.flatMap(name => byMainUnit.get(name.trim().toLowerCase()) || [])
    .filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
}
