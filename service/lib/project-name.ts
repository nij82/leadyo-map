/** Keep notice-specific resupply wording out of the site's project name. */
export function displayProjectName(name: string): string {
  const cleaned = name
    .replace(/\s*(?:\(\s*불법행위\s*재공급\s*\)|불법행위\s*재공급)\s*$/u, "")
    .trimEnd();
  return cleaned || name;
}
