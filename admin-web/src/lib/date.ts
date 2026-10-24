/**
 * Utilitaires de synchronisation horaire officielle en Heure d'Haïti (America/Port-au-Prince)
 */

export function formatHaitiDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'America/Port-au-Prince',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);
}

export function formatHaitiTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'America/Port-au-Prince',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatHaitiDateOnly(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'America/Port-au-Prince',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function getHaitiHour(date: string | Date | null | undefined = new Date()): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Port-au-Prince',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(d);
  const hourPart = parts.find((p) => p.type === 'hour');
  const h = hourPart ? parseInt(hourPart.value, 10) : 0;
  return h === 24 ? 0 : h;
}
