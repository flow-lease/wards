export function mapToRecord<T>(map: Map<string, T>): Record<string, T> {
  return Object.fromEntries(map);
}
