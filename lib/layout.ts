export type LayoutWidth = "half" | "full";

export type LayoutItem = {
  id: string;
  width: LayoutWidth;
};

export const defaultLayouts: Record<string, LayoutItem[]> = {
  dashboard: [
    { id: "broadcast", width: "full" },
    { id: "openAthlete", width: "half" },
    { id: "doneCheckins", width: "half" },
    { id: "missingCheckins", width: "half" },
    { id: "latestCheckins", width: "half" },
    { id: "latestMessages", width: "half" },
  ],
  coach: [
    { id: "checkins", width: "half" },
    { id: "plans", width: "half" },
    { id: "messages", width: "full" },
    { id: "weightChart", width: "half" },
    { id: "compareCheckins", width: "half" },
    { id: "athleteSettings", width: "full" },
  ],
  athlete: [
    { id: "plans", width: "half" },
    { id: "newCheckin", width: "half" },
    { id: "messages", width: "full" },
    { id: "weightChart", width: "half" },
    { id: "myCheckins", width: "half" },
  ],
};

export function normalizeLayout(
  pageKey: string,
  incoming: LayoutItem[] | null | undefined
): LayoutItem[] {
  const defaults = defaultLayouts[pageKey] || [];

  if (!incoming || !Array.isArray(incoming) || incoming.length === 0) {
    return defaults;
  }

  const safeIncoming = incoming.filter(
    (item) =>
      item &&
      typeof item.id === "string" &&
      (item.width === "half" || item.width === "full")
  );

  const defaultIds = new Set(defaults.map((d) => d.id));

  const cleaned = safeIncoming.filter((item) => defaultIds.has(item.id));

  const missing = defaults.filter(
    (def) => !cleaned.some((item) => item.id === def.id)
  );

  return [...cleaned, ...missing];
}

export function moveItemUp(layout: LayoutItem[], id: string): LayoutItem[] {
  const index = layout.findIndex((item) => item.id === id);
  if (index <= 0) return layout;
  const copy = [...layout];
  [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
  return copy;
}

export function moveItemDown(layout: LayoutItem[], id: string): LayoutItem[] {
  const index = layout.findIndex((item) => item.id === id);
  if (index === -1 || index >= layout.length - 1) return layout;
  const copy = [...layout];
  [copy[index], copy[index + 1]] = [copy[index + 1], copy[index]];
  return copy;
}

export function toggleItemWidth(layout: LayoutItem[], id: string): LayoutItem[] {
  return layout.map((item) =>
    item.id === id
      ? { ...item, width: item.width === "half" ? "full" : "half" }
      : item
  );
}

export function getLayoutItemWidthClass(width: LayoutWidth): string {
  return width === "full" ? "span-2" : "";
}

export function sortSectionsByLayout<T extends { id: string }>(
  sections: T[],
  layout: LayoutItem[]
): T[] {
  const map = new Map(sections.map((section) => [section.id, section]));
  const ordered: T[] = [];

  for (const item of layout) {
    const found = map.get(item.id);
    if (found) ordered.push(found);
  }

  for (const section of sections) {
    if (!ordered.some((s) => s.id === section.id)) {
      ordered.push(section);
    }
  }

  return ordered;
}