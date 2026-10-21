import { Chip, ProviderName, db } from '../store';
import { Provider } from './types';
import { mockProvider } from './mock';
import { evolutionProvider } from './evolution';
import { baileysProvider } from './baileys';

export function providerFor(chip: Pick<Chip, 'provider'>): Provider {
  const name: ProviderName = chip.provider || db.settings.defaultProvider;
  if (name === 'evolution') return evolutionProvider;
  if (name === 'mock') return mockProvider;
  return baileysProvider;
}

export * from './types';
