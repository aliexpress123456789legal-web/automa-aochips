import assert from 'node:assert/strict';
const root = process.argv[2];
const { db, uid, saveNow } = await import(root + '/server/store.ts');
const eng = await import(root + '/server/engine.ts');
const { phoneKey, normalizePhone } = await import(root + '/server/phone.ts');
const { renderMessage } = await import(root + '/server/spintax.ts');

// spintax + variáveis
const m = renderMessage('{Olá|Oi}, {{name}} de {{city}}!', { name: 'Ana Souza', city: 'Salvador' });
assert.match(m, /^(Olá|Oi), Ana Souza de Salvador!$/);
assert.equal(renderMessage('Oi {{first_name}}', { name: 'Ana Souza' }), 'Oi Ana');
assert.equal(phoneKey('+55 (71) 98765-4321'), phoneKey('7187654321'));
assert.equal(normalizePhone('(71) 98765-4321'), '5571987654321');

db.settings.window.enabled = false;
const mk = (name: string, status: string, phone: string) => ({
  id: uid(), instanceName: name, phoneNumber: phone, apiKey: '', status, trustScore: 90, maxMsgsPerHour: 3,
  warmingTargetDays: 21, totalSent: 0, totalFailed: 0, lastSyncAt: '', provider: 'mock', connection: 'open',
  consecutiveFailures: 0, warmDates: {}, createdAt: '',
});
const a: any = mk('a', 'active', '+5571900000001'); const b: any = mk('b', 'active', '+5571900000002');
db.chips.push(a, b);
db.templates.push({ id: 't1', title: 't', category: 'prospecting', content: 'Oi {{name}}', updatedAt: '' });
db.batches.push({ id: 'b1', name: 'L', status: 'active', templateId: 't1', category: 'prospecting', intervalSeconds: 10, assignedChipIds: [], createdAt: '' });
for (const [i, p] of ['71988880001','71988880002','71988880003','71988880004','71988880005','71988880006','7198888-0000'].entries())
  db.leads.push({ id: uid(), batchId: 'b1', name: 'Lead' + i, city: 'X', phone: normalizePhone(p), status: 'pending', attempts: 0, createdAt: '' });

for (let i = 0; i < 8; i++) { await eng.tick({ force: true }); }
const sent = db.leads.filter((l: any) => l.status === 'sent');
console.log('enviados', sent.length, 'falhas', db.leads.filter((l: any) => l.status === 'failed').length);
assert.equal(sent.length, 6, 'limite 3/h por chip × 2 chips = 6');
// respeita limite por hora: tentando mais um → nenhum chip disponível
db.leads.push({ id: uid(), batchId: 'b1', name: 'Extra', city: '', phone: '5571988889999', status: 'pending', attempts: 0, createdAt: '' });
await eng.tick({ force: true });
assert.equal(db.leads.filter((l: any) => l.status === 'sent').length, 6);
assert.ok(a.totalSent + b.totalSent === 6);

// resposta de lead
const lead = sent[0];
await eng.handleInbound({ chipId: lead.agentId, from: lead.phone, text: 'Quanto custa?', messageId: 'x1' });
assert.equal(db.leads.find((l: any) => l.id === lead.id).status, 'replied');
assert.equal(db.responses[0].responseSentiment, 'pricing');
assert.equal(db.responses[0].leadId, lead.id);
// duplicada ignorada
await eng.handleInbound({ chipId: lead.agentId, from: lead.phone, text: 'Quanto custa?', messageId: 'x1' });
assert.equal(db.responses.length, 1);
// opt-out
const l2 = sent[1];
await eng.handleInbound({ chipId: l2.agentId, from: l2.phone, text: 'PARAR', messageId: 'x2' });
assert.equal(db.leads.find((l: any) => l.id === l2.id).status, 'opt_out');
// resposta rápida
const rr = await eng.replyToResponse(db.responses[0].id, 'Claro!');
assert.ok(rr.ok); assert.equal(db.responses.find((r: any) => r.id === db.responses[0].id).status, 'attended');
console.log('OK');
saveNow(); process.exit(0);
