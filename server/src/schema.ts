// Street state synced to every player in the room.
// After editing this file run `npm run schema-cs` to regenerate the C# classes for Unity.
import { Schema, MapSchema, type } from '@colyseus/schema';

export class Player extends Schema {
  @type('string') id = '';
  @type('string') name = '';
  @type('uint16') level = 1;
  @type('float32') x = 0;
  @type('float32') targetX = 0;   // where the player is walking to
  @type('string') outfit = '';    // worn wearable ids: "hat,shirt,pants,acc"
  @type('string') look = '';      // appearance: "gender,hair,brows,lips,cheeks,earrings"; empty until created
  @type('string') vehicle = '';
  @type('string') speech = '';
  @type('float64') speechAt = 0;
  @type('boolean') isOwner = false;
}

export class Stall extends Schema {
  @type('uint8') slot = 0;            // slot on the sidewalk
  @type('float32') x = 0;
  @type('string') productId = '';
  @type('uint16') remaining = 0;      // portions left
  @type('uint32') price = 0;
  @type('string') ownerId = '';       // profile id of the player who opened the stall
  @type('string') ownerName = '';
  @type('string') employeeId = '';    // empty = the owner is selling in person
  @type('string') sellerName = '';
  @type('string') sellerOutfit = '';
  @type('string') sellerLook = '';    // appearance of the seller, same format as Player.look
  @type('string') servingCustomerId = '';
  @type('float64') saleEndsAt = 0;
}

export class Customer extends Schema {
  @type('string') id = '';
  @type('float32') x = 0;
  @type('int8') dir = 1;              // 1 walking right, -1 walking left
  @type('string') wants = '';         // wanted product ids, comma separated
  @type('int8') targetSlot = -1;      // stall slot being approached, -1 = strolling
  @type('string') status = 'walk';    // walk | queue | buy | leave
  @type('uint8') look = 0;            // appearance index for the client
  @type('string') group = '';         // customer group: homemaker | student | tourist
  @type('string') touristLook = '';   // tourists are drawn from player layers
}

export class LotState extends Schema {
  @type('string') crop = '';
  @type('float64') plantedAt = 0;
  @type('float64') readyAt = 0;       // crop ripens or building finishes
  @type('boolean') watered = false;
  @type('string') building = '';
  @type('uint8') level = 0;
  @type('string') recipe = '';
  @type('float64') cookReadyAt = 0;
}

export class StreetState extends Schema {
  @type('string') ownerId = '';
  @type('string') ownerName = '';
  @type('uint16') ownerLevel = 1;
  @type('float32') length = 2000;
  @type('uint8') slotCount = 8;
  @type('uint8') ownerSlots = 2;
  @type('uint32') fame = 0;
  @type('uint8') district = 0;
  @type('string') districtName = '';
  @type('string') event = '';         // active event id
  @type('string') eventName = '';
  @type('float64') eventEndsAt = 0;
  @type('string') eventProducts = '';     // seasonal products on sale, comma separated
  @type('string') eventDecorations = '';  // decorations on sale, comma separated
  @type('string') eventGift = '';         // label of the gift action
  @type('string') communityId = '';
  @type('uint32') communityProgress = 0;
  @type('uint32') communityTarget = 0;
  @type('string') decorations = '';       // decorations the owner has, comma separated
  @type('string') shuttlePlayers = '';    // player ids in the rally, comma separated; "npc" is a neighbour
  @type('string') shuttleTurn = '';
  @type('float64') shuttleDeadline = 0;
  @type('uint16') shuttleScore = 0;
  @type('string') caroBoard = '';         // 81 cells: . X O
  @type('string') caroX = '';
  @type('string') caroO = '';
  @type('string') caroTurn = '';
  @type('string') caroWinner = '';
  @type('uint16') weddingProgress = 0;
  @type('float64') weddingEndsAt = 0;
  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: Stall }) stalls = new MapSchema<Stall>();
  @type({ map: Customer }) customers = new MapSchema<Customer>();
  @type({ map: LotState }) lots = new MapSchema<LotState>();
}
