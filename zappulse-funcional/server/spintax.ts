/**
 * Renderização de mensagens no servidor.
 * IMPORTANTE: variáveis {{nome}} são interpoladas ANTES do spintax {a|b},
 * senão o regex do spintax comeria as chaves das variáveis.
 */

function stripBraces(v: string): string {
  return v.replace(/[{}|]/g, '');
}

export function interpolate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) =>
    vars[k] !== undefined ? stripBraces(vars[k]) : ''
  );
}

export function resolveSpintax(text: string): string {
  const re = /\{([^{}]+)\}/g;
  let out = text;
  for (let i = 0; i < 20 && re.test(out); i++) {
    re.lastIndex = 0;
    out = out.replace(re, (_, opts: string) => {
      const c = opts.split('|');
      return c[Math.floor(Math.random() * c.length)];
    });
    re.lastIndex = 0;
  }
  return out;
}

export function renderMessage(template: string, vars: Record<string, string>): string {
  const firstName = (vars.name || '').trim().split(/\s+/)[0] || '';
  const v = { ...vars, first_name: firstName, primeiro_nome: firstName, nome: vars.name || '' };
  return resolveSpintax(interpolate(template, v)).replace(/[ \t]{2,}/g, ' ').trim();
}
