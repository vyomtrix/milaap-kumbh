export function formatZone(zoneName: string): string {
  const match = zoneName.match(/\d+/);
  return match ? `Zone ${match[0]}` : zoneName;
}