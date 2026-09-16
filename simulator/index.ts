import 'dotenv/config';
import mqtt from 'mqtt';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const code = process.env.DEVICE_CODE || 'SBOX-DEMO-001';
const c = mqtt.connect(process.env.MQTT_URL || 'mqtt://localhost:1883');
const names: Record<string, string> = { en: 'English', hi: 'Hindi', or: 'Odia', bn: 'Bengali', ta: 'Tamil', te: 'Telugu' };
let subscribed = false;
const heartbeat = setInterval(() => {
  if (c.connected && subscribed) writeFileSync(join(tmpdir(), 'soundbox-ready'), 'ready');
}, 5000);
c.on('connect', () => {
  const topic = `soundbox/${code}/payment`;
  c.subscribe(topic, { qos: 1 }, (error) => {
    if (error) { console.error('Subscription failed', error.message); return; }
    subscribed = true;
    console.log(`Simulator ${code} subscribed to ${topic}`);
  });
});
c.on('close', () => { subscribed = false; });
c.on('message', (_topic, buffer) => {
  try {
    const m = JSON.parse(buffer.toString());
    if (typeof m.message !== 'string' || typeof m.amount !== 'number') throw new Error('Invalid payment message');
    console.log(`\n--------------------------------\nSOUNDBOX PAYMENT RECEIVED\nDevice: ${code}\nAmount: INR ${m.amount}\nLanguage: ${names[m.language] || m.language}\nTransaction: ${m.transactionReference}\nAnnouncement: ${m.message}\n--------------------------------`);
  } catch (error) { console.error('Ignored invalid MQTT message', (error as Error).message); }
});
c.on('error', (error) => console.error('MQTT error', error.message));
async function stop() { clearInterval(heartbeat); await c.endAsync(); }
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
