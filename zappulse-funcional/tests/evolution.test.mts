import assert from 'node:assert/strict';
import http from 'node:http';
const root = process.argv[2];
const calls: string[] = [];
let mode = 'v2';
const srv = http.createServer((req, res) => {
  let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => {
    calls.push(`${req.method} ${req.url} ${req.headers.apikey}`);
    const j = (code: number, o: any) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.url!.startsWith('/instance/connectionState/novo')) return j(404, { message: 'nope' });
    if (req.url!.startsWith('/instance/connectionState/')) return j(200, { instance: { state: 'open' } });
    if (req.url === '/instance/create') return j(201, { instance: { instanceName: 'novo' } });
    if (req.url!.startsWith('/instance/connect/')) return j(200, { base64: 'AAAA', pairingCode: 'ABCD1234' });
    if (req.url!.startsWith('/message/sendText/')) {
      const body = JSON.parse(b);
      if (body.number.endsWith('0000')) return j(400, { status: 400, response: { message: [{ jid: body.number + '@s.whatsapp.net', exists: false, number: body.number }] } });
      if (mode === 'v1' && body.text !== undefined) return j(400, { response: { message: ['textMessage is required'] } });
      if (mode === 'v1' && !body.textMessage) return j(400, {});
      return j(201, { key: { id: 'MSG1' } });
    }
    if (req.url === '/instance/fetchInstances') return j(200, [{ name: 'a', connectionStatus: 'open' }]);
    j(404, {});
  });
}).listen(0);
await new Promise((r) => srv.once('listening', r));
const port = (srv.address() as any).port;
const { db } = await import(root + '/server/store.ts');
const { evolutionProvider, evolutionPing } = await import(root + '/server/providers/evolution.ts');
db.settings.evolution = { baseUrl: `http://127.0.0.1:${port}/`, globalToken: 'GLOBAL' };
const chip: any = { instanceName: 'inst1', apiKey: '', provider: 'evolution' };

assert.equal((await evolutionProvider.getState(chip)).state, 'open');
let r = await evolutionProvider.sendText(chip, '5571988880001', 'oi', 100);
assert.equal(r.ok, true); assert.equal(r.messageId, 'MSG1');
r = await evolutionProvider.sendText(chip, '5571988880000', 'oi', 100);
assert.equal(r.ok, false); assert.equal(r.notOnWhatsapp, true);
mode = 'v1';
r = await evolutionProvider.sendText(chip, '5571988880001', 'oi', 100);
assert.equal(r.ok, true, 'fallback v1: ' + JSON.stringify(r));
const q = await evolutionProvider.getQr({ ...chip, instanceName: 'novo' });
assert.match(q.qr!, /^data:image\/png;base64,AAAA/); assert.equal(q.pairingCode, 'ABCD1234');
assert.ok(calls.some((c) => c.startsWith('POST /instance/create')), 'cria instância inexistente');
assert.ok(calls.every((c) => c.endsWith('GLOBAL')), 'apikey enviada');
const ping = await evolutionPing(); assert.equal(ping.connected, true);
// servidor fora do ar
srv.close(); srv.closeAllConnections?.();
const down = await evolutionProvider.sendText(chip, '5571988880001', 'oi', 100);
assert.equal(down.ok, false); assert.equal(down.connectionError, true); console.log('erro offline:', down.error);
const dping = await evolutionPing(); assert.equal(dping.connected, false);
console.log('EVOLUTION OK'); process.exit(0);
