// Platform families reconcile source naming differences without inventing data.
// Only families present in the warehouse are offered in the dropdown.
const FAMILIES: Record<string, string[]> = {
  Meta: ['Meta', 'Meta Ads', 'Facebook', 'Facebook Ads', 'Instagram', 'Instagram Ads'],
  LinkedIn: ['LinkedIn', 'LinkedIn Ads'],
  X: ['X', 'X Ads', 'Twitter', 'Twitter Ads'],
  'Google Ads': ['Google', 'Google Ads', 'Google AdWords', 'AdWords'],
  YouTube: ['YouTube', 'YouTube Ads'],
  TikTok: ['TikTok', 'TikTok Ads'],
  Pinterest: ['Pinterest', 'Pinterest Ads'],
  Reddit: ['Reddit', 'Reddit Ads'],
  Snapchat: ['Snapchat', 'Snapchat Ads'],
  'The Trade Desk': ['The Trade Desk', 'Trade Desk', 'TTD'],
  'SFMC Email': ['SFMC Email', 'Salesforce Marketing Cloud'],
};

export function canonicalPlatform(value: string): string {
  const trimmed = value.trim();
  return Object.entries(FAMILIES).find(([, aliases]) => aliases.some(alias => alias.toLowerCase() === trimmed.toLowerCase()))?.[0] ?? trimmed;
}
export function platformAliases(value: string): string[] {
  const name = canonicalPlatform(value);
  return (Object.hasOwn(FAMILIES, name) ? FAMILIES[name] : [value.trim()]).map(alias => alias.toLowerCase());
}
export function platformOptions(values: (string | null | undefined)[]): string[] {
  const names = new Map<string, string>();
  for (const value of values) {
    if (!value?.trim()) continue;
    const name = canonicalPlatform(value);
    if (!names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}
