// Product catalog, wearables, and game balance constants.
// Money is in dong (đ). The server decides every game rule; the client only displays.

export type ProductCategory = 'snack' | 'drink' | 'toy' | 'goods';

export interface Product {
  id: string;
  name: string;
  unlockLevel: number;
  cost: number;        // purchase cost per portion
  price: number;       // selling price per portion
  sellSeconds: number; // time to serve one customer
  xp: number;
  homegrown?: boolean; // comes from the garden store instead of being bought as stock
  seasonal?: boolean;  // only sold while an event lists it
  category: ProductCategory; // UI tab: snack, drink, toy; goods = groceries and clothes
}

export const PRODUCTS: Product[] = [
  { id: 'banana',       name: 'Chuối',     unlockLevel: 1,  cost: 0,     price: 12000, sellSeconds: 3, xp: 2, homegrown: true, category: 'snack' },
  { id: 'iced_tea',     name: 'Trà đá',    unlockLevel: 1,  cost: 1000,  price: 3000,  sellSeconds: 2, xp: 1, category: 'drink' },
  { id: 'grandma_soup', name: 'Chè gia truyền', unlockLevel: 1, cost: 0, price: 50000, sellSeconds: 3, xp: 6, homegrown: true, category: 'snack' },
  { id: 'banh_chung',   name: 'Bánh chưng', unlockLevel: 1, cost: 30000, price: 60000, sellSeconds: 5, xp: 5, seasonal: true, category: 'snack' },
  { id: 'sugarcane_juice', name: 'Nước mía', unlockLevel: 1, cost: 5000, price: 12000, sellSeconds: 2, xp: 2, seasonal: true, category: 'drink' },
  { id: 'moon_cake',    name: 'Bánh nướng', unlockLevel: 1, cost: 25000, price: 55000, sellSeconds: 5, xp: 5, seasonal: true, category: 'snack' },
  { id: 'fried_banana', name: 'Chuối chiên', unlockLevel: 2, cost: 0, price: 20000, sellSeconds: 3, xp: 3, homegrown: true, category: 'snack' },
  { id: 'banh_mi',      name: 'Bánh mì',   unlockLevel: 2,  cost: 7000,  price: 15000, sellSeconds: 3, xp: 2, category: 'snack' },
  { id: 'sticky_rice',  name: 'Xôi',       unlockLevel: 2,  cost: 6000,  price: 14000, sellSeconds: 3, xp: 2, category: 'snack' },
  { id: 'banana_soup',  name: 'Chè chuối', unlockLevel: 3, cost: 0, price: 30000, sellSeconds: 3, xp: 4, homegrown: true, category: 'snack' },
  { id: 'popsicle',     name: 'Kem que',   unlockLevel: 3,  cost: 4000,  price: 10000, sellSeconds: 2, xp: 2, category: 'snack' },
  { id: 'soap_bubbles', name: 'Bong bóng xà phòng', unlockLevel: 3, cost: 3000, price: 9000, sellSeconds: 2, xp: 2, category: 'toy' },
  { id: 'fresh_cane',   name: 'Nước mía tươi', unlockLevel: 4, cost: 0, price: 18000, sellSeconds: 2, xp: 3, homegrown: true, category: 'drink' },
  { id: 'sweet_soup',   name: 'Chè',       unlockLevel: 4,  cost: 8000,  price: 20000, sellSeconds: 3, xp: 3, category: 'snack' },
  { id: 'rambutan',     name: 'Chôm chôm', unlockLevel: 5,  cost: 15000, price: 35000, sellSeconds: 4, xp: 4, category: 'snack' },
  { id: 'pinwheel',     name: 'Chong chóng', unlockLevel: 5, cost: 7000, price: 22000, sellSeconds: 3, xp: 3, category: 'toy' },
  { id: 'banana_cake',  name: 'Bánh chuối nướng', unlockLevel: 6, cost: 0, price: 45000, sellSeconds: 4, xp: 6, homegrown: true, category: 'snack' },
  { id: 'tofu_noodles', name: 'Bún đậu',   unlockLevel: 6,  cost: 20000, price: 45000, sellSeconds: 5, xp: 5, category: 'snack' },
  { id: 'plastic_sandals', name: 'Dép nhựa', unlockLevel: 7, cost: 25000, price: 55000, sellSeconds: 5, xp: 5, category: 'goods' },
  { id: 'fresh_milk',   name: 'Sữa tươi',  unlockLevel: 8,  cost: 9000,  price: 22000, sellSeconds: 2, xp: 3, category: 'drink' },
  { id: 't_shirt',      name: 'Áo thun in hình', unlockLevel: 9, cost: 60000, price: 109000, sellSeconds: 7, xp: 6, category: 'goods' },
  { id: 'flowers',      name: 'Hoa tươi',  unlockLevel: 10, cost: 25000, price: 60000, sellSeconds: 5, xp: 6, category: 'goods' },
];
export const getProduct = (id: string) => PRODUCTS.find((p) => p.id === id);

// Customer groups: each group shops for its own products
export const CUSTOMER_GROUPS: Record<string, string[]> = {
  homemaker: ['banana', 'sticky_rice', 'rambutan', 'tofu_noodles', 'flowers', 'banh_chung', 'moon_cake', 'banana_soup', 'banana_cake', 'grandma_soup'],
  student: ['iced_tea', 'popsicle', 'banh_mi', 'sweet_soup', 'fresh_milk', 'sugarcane_juice', 'fried_banana', 'fresh_cane'],
  // groupOfProduct returns the first group listing a product, so the order above wins: popsicle and iced tea stay student,
  // and the homemaker items below only make shopper customers want them as a second item
  kid: ['soap_bubbles', 'pinwheel', 'popsicle', 'iced_tea'],
  shopper: ['plastic_sandals', 't_shirt', 'banana', 'sticky_rice', 'rambutan', 'tofu_noodles', 'flowers'],
};
export const TOURIST = 'tourist'; // tourists buy anything and pay more; they only come to famous streets
export const groupOfProduct = (id: string) => Object.keys(CUSTOMER_GROUPS).find((g) => CUSTOMER_GROUPS[g].includes(id)) ?? 'student';

// Character creator: number of options per face part. Sprites are named part_index, e.g. hair_male_2 or brows_1.
export const LOOK_OPTIONS = { hair: 4, brows: 4, lips: 4, cheeks: 3, earrings: 4 };

// Sprite name of a wearable = `${slot}_${id}` (e.g. hat_conical)
export type WearSlot = 'hat' | 'shirt' | 'pants' | 'acc';
export const WEAR_SLOTS: WearSlot[] = ['hat', 'shirt', 'pants', 'acc'];

export interface Wearable {
  id: string;
  name: string;
  slot: WearSlot;
  price: number;
  unlockLevel: number;
  moneyPct: number; // % bonus on sales revenue
  xpPct: number;
  charm: number;    // added to the Charm stat (attracts customers)
}

export const WEARABLES: Wearable[] = [
  { id: 'conical',    name: 'Nón lá',           slot: 'hat',   price: 20000,  unlockLevel: 1, moneyPct: 0, xpPct: 2, charm: 3 },
  { id: 'helmet',     name: 'Mũ bảo hiểm xanh', slot: 'hat',   price: 50000,  unlockLevel: 2, moneyPct: 1, xpPct: 0, charm: 2 },
  { id: 'cap',        name: 'Mũ lưỡi trai',     slot: 'hat',   price: 120000, unlockLevel: 4, moneyPct: 2, xpPct: 2, charm: 6 },
  { id: 'tank_top',   name: 'Áo ba lỗ',         slot: 'shirt', price: 30000,  unlockLevel: 1, moneyPct: 1, xpPct: 0, charm: 1 },
  { id: 'floral',     name: 'Áo sơ mi hoa',     slot: 'shirt', price: 150000, unlockLevel: 3, moneyPct: 3, xpPct: 0, charm: 8 },
  { id: 'ao_dai',     name: 'Áo dài',           slot: 'shirt', price: 400000, unlockLevel: 6, moneyPct: 5, xpPct: 3, charm: 15 },
  { id: 'jeans',      name: 'Quần jean',        slot: 'pants', price: 80000,  unlockLevel: 2, moneyPct: 1, xpPct: 1, charm: 3 },
  { id: 'khaki',      name: 'Quần kaki',        slot: 'pants', price: 200000, unlockLevel: 5, moneyPct: 3, xpPct: 1, charm: 6 },
  { id: 'sunglasses', name: 'Kính râm',         slot: 'acc',   price: 100000, unlockLevel: 3, moneyPct: 0, xpPct: 4, charm: 5 },
  { id: 'speaker',    name: 'Loa kẹo kéo',      slot: 'acc',   price: 500000, unlockLevel: 7, moneyPct: 6, xpPct: 2, charm: 10 },
];
export const getWearable = (id: string) => WEARABLES.find((w) => w.id === id);

export const SURNAMES = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Ngô'];
export const GIVEN_NAMES = ['Lan', 'Hùng', 'Mai', 'Tuấn', 'Hoa', 'Nam', 'Thảo', 'Dũng', 'Linh', 'Phúc', 'Hà', 'Sơn', 'Trang', 'Long', 'My'];

export type BuildingType = 'tea_shop' | 'store' | 'kitchen' | 'grocery' | 'barber' | 'stage' | 'cafe';

export interface Building {
  name: string;
  cost: number;
  buildSeconds: number;
  unlockLevel: number;
  maxLevel: number;
  incomePerHour: number; // per building level
  needsFame?: number;
  fame?: number;         // one-time points when finished
}

export const BUILDINGS: Record<BuildingType, Building> = {
  store:    { name: 'Kho nhỏ',      cost: 300000,   buildSeconds: 120,  unlockLevel: 1, maxLevel: 3, incomePerHour: 0 },
  kitchen:  { name: 'Bếp nhà',      cost: 400000,   buildSeconds: 120,  unlockLevel: 2, maxLevel: 1, incomePerHour: 0 },
  tea_shop: { name: 'Quán trà đá',  cost: 500000,   buildSeconds: 300,  unlockLevel: 1, maxLevel: 3, incomePerHour: 40000 },
  grocery:  { name: 'Tiệm tạp hóa', cost: 1500000,  buildSeconds: 1800, unlockLevel: 3, maxLevel: 3, incomePerHour: 100000 },
  cafe:     { name: 'Quán cà phê', cost: 1200000,  buildSeconds: 1800, unlockLevel: 4, maxLevel: 3, incomePerHour: 80000 },
  barber:   { name: 'Tiệm cắt tóc', cost: 3000000,  buildSeconds: 3600, unlockLevel: 5, maxLevel: 3, incomePerHour: 150000 },
  stage:    { name: 'Sân khấu xóm', cost: 20000000, buildSeconds: 7200, unlockLevel: 8, maxLevel: 1, incomePerHour: 0, needsFame: 200, fame: 100 },
};

export const DAILY_TASKS = [
  { id: 'harvest', name: 'Thu hoạch 2 ô đất', target: 2 },
  { id: 'sell', name: 'Bán 10 phần hàng', target: 10 },
  { id: 'visit', name: 'Ghé một phố khác', target: 1 },
  { id: 'regular', name: 'Đón khách quen', target: 3 },
];

// Street decorations are sold only during their event and kept forever
export const DECORATIONS = [
  { id: 'peach_tree', name: 'Cây đào', price: 200000 },
  { id: 'flower_basket', name: 'Giỏ hoa', price: 80000 },
  { id: 'summer_fair', name: 'Cờ hội chợ hè', price: 100000 },
  { id: 'star_lantern', name: 'Đèn ông sao', price: 100000 },
  { id: 'xmas_tree', name: 'Cây thông', price: 200000 },
];

export const DISTRICTS: { name: string; cost: number; unlockLevel: number; needsFame?: number; growPct?: number; customerPct?: number; touristPct?: number }[] = [
  { name: 'Bãi đất', cost: 0, unlockLevel: 1 },
  { name: 'Ven sông', cost: 1500000, unlockLevel: 5, growPct: 10 },
  { name: 'Gần chợ', cost: 8000000, unlockLevel: 10, customerPct: 20 },
  { name: 'Phố cổ', cost: 30000000, unlockLevel: 15, needsFame: 300, touristPct: 30 },
];

export const CROPS: Record<string, { name: string; unlockLevel: number; seedCost: number; seconds: number; yield: number }> = {
  banana: { name: 'Chuối', unlockLevel: 1, seedCost: 10000, seconds: 1800, yield: 5 },
  mung_bean: { name: 'Đậu xanh', unlockLevel: 2, seedCost: 8000, seconds: 1200, yield: 6 },
  sugarcane: { name: 'Mía', unlockLevel: 4, seedCost: 12000, seconds: 2400, yield: 4 },
};

export const RECIPES: Record<string, { name: string; unlockLevel: number; inputs: Record<string, number>; seconds: number; output: string; yield: number; needsFriend?: string }> = {
  fried_banana: { name: 'Chuối chiên', unlockLevel: 2, inputs: { banana: 2 }, seconds: 300, output: 'fried_banana', yield: 3 },
  banana_soup: { name: 'Chè chuối', unlockLevel: 3, inputs: { banana: 2, mung_bean: 1 }, seconds: 600, output: 'banana_soup', yield: 4 },
  fresh_cane: { name: 'Nước mía tươi', unlockLevel: 4, inputs: { sugarcane: 1 }, seconds: 300, output: 'fresh_cane', yield: 3 },
  banana_cake: { name: 'Bánh chuối nướng', unlockLevel: 6, inputs: { banana: 3, sugarcane: 1 }, seconds: 1200, output: 'banana_cake', yield: 4 },
  grandma_soup: { name: 'Chè gia truyền', unlockLevel: 1, inputs: { banana: 2, mung_bean: 2 }, seconds: 900, output: 'grandma_soup', yield: 4, needsFriend: 'tea_seller' },
};

export const PROFESSIONS: Record<string, { name: string; bonusPct: number; help: string }> = {
  chef: { name: 'Đầu bếp', bonusPct: 20, help: 'Nấu giúp' },
  gardener: { name: 'Nhà vườn', bonusPct: 0, help: 'Bón phân giúp' },
  trader: { name: 'Thương lái', bonusPct: 5, help: 'Mở sạp chung' },
};

export const VEHICLES: Record<string, { name: string; price: number; speedPct: number; capacity: number; rank: number; needsFriend?: string }> = {
  walk: { name: 'Đi bộ', price: 0, speedPct: 100, capacity: 5, rank: 0 },
  bicycle: { name: 'Xe đạp', price: 300000, speedPct: 130, capacity: 10, rank: 1 },
  motorbike: { name: 'Xe máy cũ', price: 2000000, speedPct: 170, capacity: 20, rank: 2, needsFriend: 'driver' },
  cargo_trike: { name: 'Xe ba gác', price: 6000000, speedPct: 130, capacity: 50, rank: 3 },
};

export const ORDER_KINDS: Record<string, { name: string; quantity: number; seconds: number; bonusPct: number; minVehicleRank: number; processedOnly?: boolean }> = {
  near: { name: 'Đơn gần', quantity: 5, seconds: 1800, bonusPct: 20, minVehicleRank: 1 },
  far: { name: 'Đơn xa', quantity: 10, seconds: 7200, bonusPct: 40, minVehicleRank: 2, processedOnly: true },
  bulk: { name: 'Đơn lớn', quantity: 30, seconds: 28800, bonusPct: 60, minVehicleRank: 3 },
};

export const MEETING_CHOICES = [
  { id: 'rush_hour', name: 'Tối thứ Sáu đông khách' },
  { id: 'hot_sun', name: 'Tối thứ Sáu trà đá bán chạy' },
  { id: 'tourist_group', name: 'Tối thứ Sáu đón du khách' },
];

export const TRAITS = ['quick', 'smooth', 'gardener', 'gossip'] as const;
export type Trait = typeof TRAITS[number];

export const FAME = {
  visit: 5, help: 2, salesPerPoint: 100000, maxSalesPerDay: 50, maxVisitorsPerDay: 20,
  minVisitorLevel: 2, touristsAt: 100, seasonDecorationAt: 100,
};
export const SEASON_DAYS = 28;

export const NPC_STREETS = [
  { id: 'npc-street-1', name: 'Phố Hoa Sữa', products: ['iced_tea', 'banh_mi', 'sticky_rice'] },
  { id: 'npc-street-2', name: 'Phố Cây Bàng', products: ['banana', 'popsicle', 'sweet_soup'] },
  { id: 'npc-street-3', name: 'Phố Bờ Sông', products: ['iced_tea', 'rambutan', 'tofu_noodles'] },
];

export const BALANCE = {
  startingMoney: 500000,
  lotsPerDistrict: 4,        // build lots; the sidewalk slots are counted separately
  startingFreeSeeds: 4,      // the first banana crop is free
  baseTraffic: 0.4,          // an empty field draws few customers
  trafficPerBuilding: 0.2,
  maxTraffic: 1.2,
  demolishRefundPct: 50,
  firstCropSeconds: 180,
  secondCropSeconds: 600,    // banana crops planted during the guided first session
  waterCutPct: 20,           // watering removes this % of the remaining growing time
  storeCapacity: 40,         // items of all kinds the store holds
  harvestXp: 5,
  storePerLevel: 40,
  groceryDiscountPct: 20,
  incomeCapHours: 8,
  buildXp: 50,
  barberCost: 50000,         // part goes to the barber's owner when used on someone else's street
  baseWage: 5000,
  wagePerStat: 100,
  dailyTaskMoney: 20000,
  dailyTaskXp: 15,
  maxFriends: 50,
  helpReward: 5000,
  professionLevel: 5,
  professionRanks: [50, 200],  // work needed for rank 2 and 3
  friendshipPointsPerLevel: 3,
  questMoney: 30000,
  questXp: 30,
  ordersOnBoard: 3,
  orderBoardHours: 2,
  playerOrderMaxPct: 150,      // a player order pays at most this % of retail
  playerOrdersPerDay: 5,
  playerOrderHours: 24,
  activityRewardsPerDay: 3,
  shuttleSeconds: 2.2,
  caroWinMoney: 20000,
  weddingGoal: 100,
  weddingReward: 30000,
  weddingCooldownDays: 7,
  giftReward: 10000,
  generousDonorAt: 100,      // bunches given to a community goal for a title
  touristPricePct: 150,
  gardenerCutPct: 15,
  streetEventEverySeconds: 600,
  slotsPerStreet: 8,         // stall slots on one street
  ownerSlots: 2,             // slots 0..ownerSlots-1 are reserved for the street owner
  streetLength: 2000,        // world units
  firstSlotX: 220,
  lastSlotMargin: 220,
  sidewalkFeePct: 10,        // the owner gets this % of visitors' revenue
  playerSpeed: 300,          // units / second
  maxStamina: 20,            // stamina spent on inviting customers
  staminaRegenSeconds: 6,    // regain 1 stamina every ... seconds
  inviteRange: 250,          // max distance to invite a customer
  customerSpawnSeconds: 2.5, // on average one customer enters every ... seconds
  maxCustomers: 14,
  maxEmployees: 6,
  baseStallCapacity: 20,     // max portions per stall, plus a bonus from Strength
  maxLogEntries: 30,
};

export const xpToLevelUp = (level: number) => Math.round(100 * Math.pow(level, 1.5));
export const maxEmployeesForLevel = (level: number) => Math.min(BALANCE.maxEmployees, 1 + Math.floor(level / 3));
export const hireCost = (charm: number, skill: number, strength: number) => 20000 + (charm + skill + strength) * 1500;
