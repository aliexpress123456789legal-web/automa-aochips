/**
 * Spintax and text processing utilities for WhatsApp campaigns
 */

export function resolveSpintax(text: string): string {
  if (!text) return '';
  const spintaxRegex = /\{([^{}]+)\}/g;
  let matches = text.match(spintaxRegex);

  while (matches && matches.length > 0) {
    text = text.replace(spintaxRegex, (_, options) => {
      const choices = options.split('|');
      const randomIndex = Math.floor(Math.random() * choices.length);
      return choices[randomIndex];
    });
    matches = text.match(spintaxRegex);
  }

  return text;
}

export function interpolateVariables(text: string, variables: Record<string, string>): string {
  if (!text) return '';
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    return variables[key] !== undefined ? variables[key] : `{{${key}}}`;
  });
}

export function calculateSpintaxVariations(text: string): number {
  if (!text) return 1;
  const matches = text.match(/\{([^{}]+)\}/g);
  if (!matches) return 1;

  let totalCombinations = 1;
  for (const match of matches) {
    const inner = match.slice(1, -1);
    const options = inner.split('|').filter(Boolean);
    if (options.length > 0) {
      totalCombinations *= options.length;
    }
  }

  return totalCombinations;
}

export interface TokenPart {
  type: 'text' | 'spintax' | 'variable';
  value: string;
}

export function tokenizeMessage(text: string): TokenPart[] {
  if (!text) return [];
  const tokens: TokenPart[] = [];
  const regex = /(\{[^{}]+\})|(\{\{\s*\w+\s*\}\})/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: 'text',
        value: text.slice(lastIndex, match.index),
      });
    }

    if (match[1]) {
      tokens.push({
        type: 'spintax',
        value: match[1],
      });
    } else if (match[2]) {
      tokens.push({
        type: 'variable',
        value: match[2],
      });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({
      type: 'text',
      value: text.slice(lastIndex),
    });
  }

  return tokens;
}

export function cleanPhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function formatPhoneBR(raw: string): string {
  const digits = cleanPhone(raw);
  if (!digits) return '';

  let standard = digits;
  if (!standard.startsWith('55') && (standard.length === 10 || standard.length === 11)) {
    standard = '55' + standard;
  }

  if (standard.length === 13) {
    // 55 11 98765 4321
    return `+${standard.slice(0, 2)} (${standard.slice(2, 4)}) ${standard.slice(4, 9)}-${standard.slice(9)}`;
  } else if (standard.length === 12) {
    // 55 11 8765 4321
    return `+${standard.slice(0, 2)} (${standard.slice(2, 4)}) ${standard.slice(4, 8)}-${standard.slice(8)}`;
  } else if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  } else if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return digits;
}

export function getWhatsAppWebUrl(phone: string, text?: string): string {
  const digits = cleanPhone(phone);
  const formatted = digits.startsWith('55') ? digits : `55${digits}`;
  const base = `https://web.whatsapp.com/send?phone=${formatted}`;
  if (text) {
    return `${base}&text=${encodeURIComponent(text)}`;
  }
  return base;
}
