// Searches nested section trees the same way Products.js did for root/subsection lookup.
export function findSectionById(list, id) {
  if (!id) return null;
  const key = String(id);

  for (const section of list || []) {
    if (String(section?.id) === key) return section;

    const subs = section?.subsections || [];
    const found = findSectionById(subs, id);
    if (found) return found;
  }
  return null;
}
