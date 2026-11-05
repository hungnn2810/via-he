// Checks the dialogue database loading and contextual fallback logic
import { DIALOGUES, getBystanderLine, getCustomerLine } from '../src/dialogues.js';

function check(ok: boolean, msg: string) {
  if (!ok) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✓ ${msg}`);
}

check(Object.keys(DIALOGUES.bystanders).length >= 5, 'Loads bystander dialogue categories');
check(DIALOGUES.customers.invite.length > 0, 'Has customer invite reactions');
check(DIALOGUES.customers.sale.length > 0, 'Has customer sale reactions');
check(DIALOGUES.shouts.length > 0, 'Has street vendor shouts');

const lineDefault = getBystanderLine('npc_cap_man');
check(typeof lineDefault === 'string' && lineDefault.length > 0, 'Retrieves default line for npc_cap_man');

const lineRain = getBystanderLine('npc_cap_man', 'rain');
check(typeof lineRain === 'string' && lineRain.length > 0, 'Retrieves rain contextual line for npc_cap_man');

const inviteLine = getCustomerLine('invite');
check(typeof inviteLine === 'string' && inviteLine.length > 0, 'Retrieves customer invite reaction');

console.log('All dialogue checks passed');

