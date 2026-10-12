/**
 * ROE BOLET - Formatage & Gestion des Devises
 * Priorité absolue à la Gourde Haïtienne (HTG / G)
 */

export type CurrencyCode = 'HTG' | 'USD' | 'DOP';

export function formatCurrency(
  amount: number | string | null | undefined,
  currency: string = 'HTG',
): string {
  const num = Number(amount || 0);

  if (currency === 'HTG') {
    const formatted = num.toLocaleString('fr-HT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${formatted} G`;
  }

  if (currency === 'USD') {
    return `$${num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  if (currency === 'DOP') {
    return `${num.toLocaleString('es-DO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} RD$`;
  }

  return `${num.toFixed(2)} ${currency}`;
}

export function getCurrencySymbol(currency: string = 'HTG'): string {
  switch (currency) {
    case 'HTG':
      return 'G';
    case 'USD':
      return '$';
    case 'DOP':
      return 'RD$';
    default:
      return currency;
  }
}
