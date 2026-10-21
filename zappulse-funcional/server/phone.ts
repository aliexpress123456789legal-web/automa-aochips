/** Utilitários de telefone (foco em números brasileiros). */

export function digits(s: string | undefined | null): string {
  return String(s ?? '').replace(/\D/g, '');
}

/** Normaliza para formato internacional apenas dígitos (ex: 5511987654321). */
export function normalizePhone(raw: string | undefined | null): string {
  let d = digits(raw);
  if (!d) return '';
  d = d.replace(/^0+/, '');
  // Número nacional BR (DDD + 8/9 dígitos) → adiciona 55
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return d;
}

/**
 * Chave de comparação tolerante ao 9º dígito brasileiro:
 * DDD + 8 últimos dígitos (ignora o 9 extra e o código do país).
 */
export function phoneKey(raw: string | undefined | null): string {
  let d = digits(raw);
  if (!d) return '';
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.length === 11 && d[2] === '9') d = d.slice(0, 2) + d.slice(3);
  return d.length > 10 ? d.slice(-10) : d;
}

export function formatE164(raw: string | undefined | null): string {
  const n = normalizePhone(raw);
  return n ? '+' + n : '';
}

/** Retorna variantes do número BR (com/sem 9º dígito) para tentar no WhatsApp. */
export function brVariants(n: string): string[] {
  const out = [n];
  if (n.startsWith('55')) {
    const rest = n.slice(2);
    if (rest.length === 11 && rest[2] === '9') out.push('55' + rest.slice(0, 2) + rest.slice(3));
    else if (rest.length === 10) out.push('55' + rest.slice(0, 2) + '9' + rest.slice(2));
  }
  return out;
}
