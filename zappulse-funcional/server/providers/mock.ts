import { db } from '../store';
import { phoneKey } from '../phone';
import { Provider, emitInbound, sleep } from './types';

/** Provedor de teste: nada sai para o WhatsApp. Útil para validar o fluxo inteiro. */
export const mockProvider: Provider = {
  name: 'mock',
  async getState() {
    return { state: 'open' };
  },
  async getQr() {
    return { state: 'open' };
  },
  async sendText(chip, number, text) {
    await sleep(150);
    if (number.endsWith('0000')) return { ok: false, notOnWhatsapp: true, error: 'Número sem WhatsApp (mock)' };
    console.log(`[mock] ${chip.instanceName} → ${number}: ${text.slice(0, 80)}`);
    // Se o destino é outro chip nosso, entrega como mensagem recebida (aquecimento)
    const peer = db.chips.find((c) => c.id !== chip.id && c.phoneNumber && phoneKey(c.phoneNumber) === phoneKey(number));
    if (peer) {
      setTimeout(
        () => emitInbound({ chipId: peer.id, from: (chip.phoneNumber || '').replace(/\D/g, ''), text, messageId: 'mock-' + Date.now() }),
        500
      );
    }
    return { ok: true, messageId: 'mock-' + Date.now() };
  },
  async applyProxy() {
    return { ok: true };
  },
};
