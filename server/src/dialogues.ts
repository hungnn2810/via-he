// Context-aware street dialogues loaded from server/data/dialogues.json with fallback defaults.
// Player-facing text stays in Vietnamese as per AGENTS.md.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface BystanderDialogues {
  default: string[];
  [context: string]: string[];
}

export interface CustomerDialogues {
  invite: string[];
  sale: string[];
  leave: string[];
}

export interface DialogueDatabase {
  bystanders: Record<string, BystanderDialogues>;
  customers: CustomerDialogues;
  shouts: string[];
}

const DEFAULT_DIALOGUES: DialogueDatabase = {
  bystanders: {
    npc_cap_man: {
      default: ['Hôm nay phố đông ghê!', 'Bán đắt hàng nha bà con!', 'Cà phê sáng chưa anh em?'],
    },
    npc_girl: {
      default: ['Nóng quá, thèm ly trà đá!', 'Có gì ngon không anh chị ơi?'],
    },
    npc_worker: {
      default: ['Đường này đào hoài chưa xong!', 'Nghỉ tay chút đã.'],
    },
    npc_firefighter: {
      default: ['Dọn hàng nhớ tắt bếp than nha!', 'Phố này an toàn lắm!'],
    },
    npc_old_man: {
      default: ['Ngày xưa phố này vắng lắm...', 'Ông còn miếng đất, mua không?'],
    },
  },
  customers: {
    invite: ['Bán nhanh cho chị nhé!', 'Trông ngon đấy, cho một phần!'],
    sale: ['Cảm ơn nhé, đắt hàng!', 'Ngon lắm, mai lại ghé!'],
    leave: ['Đang vội quá, tí quay lại!', 'Hôm nay ăn cơm nhà rồi.'],
  },
  shouts: [
    'Ai bánh mì Sài Gòn đặc ruột thơm bơ nào...',
    'Bắp xào bơ, ngô nướng nóng hổi đê!',
  ],
};

const DATA_FILE = path.join(process.env.DATA_DIR || path.resolve('data'), 'dialogues.json');

export function loadDialogues(): DialogueDatabase {
  if (!existsSync(DATA_FILE)) return DEFAULT_DIALOGUES;
  try {
    return JSON.parse(readFileSync(DATA_FILE, 'utf8')) as DialogueDatabase;
  } catch {
    console.error('dialogues.json is not valid JSON, using defaults');
    return DEFAULT_DIALOGUES;
  }
}

export const DIALOGUES = loadDialogues();

// Selects a line for an NPC given their id and current street event (e.g. 'rain', 'hot_sun', 'rush_hour')
export function getBystanderLine(npcId: string, eventId?: string): string {
  const npc = DIALOGUES.bystanders[npcId];
  if (!npc) return '';
  const lines = (eventId && npc[eventId]) ? npc[eventId] : (npc.default || []);
  if (!lines.length) return '';
  return lines[Math.floor(Math.random() * lines.length)];
}

// Selects a line for a customer event ('invite' | 'sale' | 'leave')
export function getCustomerLine(kind: keyof CustomerDialogues): string {
  const pool = DIALOGUES.customers[kind] || [];
  if (!pool.length) return '';
  return pool[Math.floor(Math.random() * pool.length)];
}

