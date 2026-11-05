// Neighbour stories: five fictional neighbours, each with five short quests. Text is player-facing, so it stays Vietnamese.
// Quests never expire. Finishing one or giving a liked gift raises friendship.
import { BALANCE } from './data.js';
import { GameError, type Profile } from './profile.js';

export type QuestType = 'give' | 'harvest' | 'sell' | 'cook' | 'visit' | 'help' | 'build' | 'deliver';

export interface Quest {
  text: string;
  type: QuestType;
  item?: string;   // give: what to bring; cook and harvest: only this item counts; deliver: only this order kind counts (near, far, bulk)
  target: number;
}

export interface Neighbour {
  id: string;
  name: string;
  portrait: string;
  likes: string;
  reward: string;  // what friendship 5 unlocks
  quests: Quest[];
}

export const NEIGHBOURS: Neighbour[] = [
  {
    id: 'leader', name: 'Bác tổ trưởng', portrait: 'npc_leader', likes: 'iced_tea', reward: 'Giảm 10% giá xây công trình',
    quests: [
      { text: 'Bãi đất này bỏ không lâu lắm rồi. Cháu thu hoạch thử 2 luống cho bác xem đất còn tốt không.', type: 'harvest', target: 2 },
      { text: 'Phố phải có mái nhà mới ra phố. Cháu dựng một công trình đầu tiên đi.', type: 'build', target: 1 },
      { text: 'Một mình thì buồn lắm. Cháu sang thăm một phố khác cho biết hàng xóm.', type: 'visit', target: 1 },
      { text: 'Xóm mình phải giúp nhau. Cháu tưới giúp vườn một nhà nhé.', type: 'help', target: 1 },
      { text: 'Giờ bác tin xóm này sẽ đông vui. Cháu bán 30 phần hàng để cả xóm thấy phố đã sống lại.', type: 'sell', target: 30 },
    ],
  },
  {
    id: 'tea_seller', name: 'Bà bán nước', portrait: 'npc_tea_seller', likes: 'banana_soup', reward: 'Công thức Chè gia truyền',
    quests: [
      { text: 'Ngày xưa nồi chè của bà thơm cả đầu ngõ. Cháu mang cho bà 10 nải chuối nhé.', type: 'give', item: 'banana', target: 10 },
      { text: 'Bà quên mất công thức rồi. Cháu trồng thêm đậu xanh, thu 1 luống mang về đây.', type: 'harvest', item: 'mung_bean', target: 1 },
      { text: 'Thử nấu một mẻ chè chuối ở Bếp nhà xem nào.', type: 'cook', item: 'banana_soup', target: 1 },
      { text: 'Vị gần đúng rồi. Mang bà 8 phần chè chuối để bà nếm từng mẻ.', type: 'give', item: 'banana_soup', target: 8 },
      { text: 'Nhớ ra rồi! Nấu thêm 3 mẻ nữa, bà sẽ truyền lại công thức cho cháu.', type: 'cook', item: 'banana_soup', target: 3 },
    ],
  },
  {
    id: 'driver', name: 'Chú xe ôm', portrait: 'npc_driver', likes: 'banh_mi', reward: 'Mở khóa xe máy cũ',
    quests: [
      { text: 'Chú chạy xe cả đời, đói meo rồi. Cháu cho chú 5 ổ chuối chiên lót dạ.', type: 'give', item: 'fried_banana', target: 5 },
      { text: 'Chiếc xe cũ của chú cần tiền sửa. Cháu bán 20 phần hàng rồi chú kể tiếp.', type: 'sell', target: 20 },
      { text: 'Hồi trẻ chú chở khách đi khắp các phố. Cháu ghé thử 2 phố khác xem sao.', type: 'visit', target: 2 },
      { text: 'Bạn chú cần chuối chở đi xa. Mang cho chú 15 nải.', type: 'give', item: 'banana', target: 15 },
      { text: 'Xe sửa xong rồi! Bán thêm 30 phần nữa, chú nhượng lại cho cháu.', type: 'sell', target: 30 },
    ],
  },
  {
    id: 'grocer', name: 'Cô chủ tạp hóa', portrait: 'npc_grocer', likes: 'fried_banana', reward: 'Giảm 15% giá giống',
    quests: [
      { text: 'Khách dạo này vắng quá. Cháu mua giống rồi thu 3 luống giúp cô có đơn nhập hàng.', type: 'harvest', target: 3 },
      { text: 'Nghe nói sắp có siêu thị. Cô cần 10 nải chuối để bán rẻ giữ khách.', type: 'give', item: 'banana', target: 10 },
      { text: 'Cháu nấu 2 mẻ món bất kỳ để cô bày cạnh quầy thử.', type: 'cook', target: 2 },
      { text: 'Khách quay lại rồi! Cháu bán 25 phần cho tiệm cô có tiếng.', type: 'sell', target: 25 },
      { text: 'Cô muốn tặng hàng xóm. Mang 10 phần chuối chiên đến đây nhé.', type: 'give', item: 'fried_banana', target: 10 },
    ],
  },
  {
    id: 'shipper', name: 'Anh shipper', portrait: 'npc_shipper', likes: 'fresh_cane', reward: 'Đơn hàng lớn thưởng cao hơn',
    quests: [
      { text: 'Giao hàng cả ngày khát quá. Có nước mía không em? Cho anh 3 ly.', type: 'give', item: 'fresh_cane', target: 3 },
      { text: 'Anh đang gom tiền mở cửa hàng. Em bán 20 phần giúp anh có thêm khách quen.', type: 'sell', target: 20 },
      { text: 'Em có xe đạp chưa? Gửi thử một đơn gần để anh xem em chạy có vững không.', type: 'deliver', item: 'near', target: 1 },
      { text: 'Có khách đặt món chế biến ở xa. Em gửi một đơn xa, anh chỉ đường cho.', type: 'deliver', item: 'far', target: 1 },
      { text: 'Sắp đủ tiền rồi! Gửi anh 10 phần bánh chuối nướng để khai trương.', type: 'give', item: 'banana_cake', target: 10 },
    ],
  },
];

const neighbourState = (profile: Profile, id: string) => (profile.neighbours[id] ??= { points: 0, quests: 0, progress: 0, giftDay: 0 });
export const friendship = (profile: Profile, id: string) => Math.min(5, Math.floor((profile.neighbours[id]?.points ?? 0) / BALANCE.friendshipPointsPerLevel));

// Counts an action toward every neighbour's current quest
export function questEvent(profile: Profile, type: QuestType, item: string, amount = 1) {
  for (const n of NEIGHBOURS) {
    const state = neighbourState(profile, n.id);
    const quest = n.quests[state.quests];
    if (!quest || quest.type !== type || (quest.item && quest.item !== item)) continue;
    state.progress = Math.min(quest.target, state.progress + amount);
  }
}

// Hands in the current quest; for a "give" quest this takes the items. Returns the XP to grant.
export function finishQuest(profile: Profile, id: string, take: (item: string, amount: number) => void) {
  const n = NEIGHBOURS.find((x) => x.id === id);
  if (!n) throw new GameError('Không có hàng xóm này');
  const state = neighbourState(profile, id);
  const quest = n.quests[state.quests];
  if (!quest) throw new GameError('Đã xong hết chuyện của người này');
  if (quest.type === 'give') take(quest.item!, quest.target);
  else if (state.progress < quest.target) throw new GameError('Việc này chưa xong');
  state.quests++;
  state.progress = 0;
  state.points += BALANCE.friendshipPointsPerLevel;
  profile.money += BALANCE.questMoney;
  return BALANCE.questXp;
}

export function giveNeighbourGift(profile: Profile, id: string, day: number, take: (item: string, amount: number) => void) {
  const n = NEIGHBOURS.find((x) => x.id === id);
  if (!n) throw new GameError('Không có hàng xóm này');
  const state = neighbourState(profile, id);
  if (state.giftDay === day) throw new GameError('Hôm nay đã tặng người này rồi');
  take(n.likes, 1);
  state.giftDay = day;
  state.points += 1;
}
