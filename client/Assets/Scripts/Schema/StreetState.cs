// 
// THIS FILE HAS BEEN GENERATED AUTOMATICALLY
// DO NOT CHANGE IT MANUALLY UNLESS YOU KNOW WHAT YOU'RE DOING
// 
// GENERATED USING @colyseus/schema 5.0.43
// 

namespace ViaHeOnline.Schema {
	public partial class StreetState : global::Colyseus.Schema.Schema {
#if UNITY_5_3_OR_NEWER
		[global::UnityEngine.Scripting.Preserve]
#endif
		public StreetState() { }

		[global::Colyseus.Schema.Type(0, "string")]
		public string ownerId = "";

		[global::Colyseus.Schema.Type(1, "string")]
		public string ownerName = "";

		[global::Colyseus.Schema.Type(2, "uint16")]
		public ushort ownerLevel = 1;

		[global::Colyseus.Schema.Type(3, "float32")]
		public double length = 2000;

		[global::Colyseus.Schema.Type(4, "uint8")]
		public byte slotCount = 8;

		[global::Colyseus.Schema.Type(5, "uint8")]
		public byte ownerSlots = 2;

		[global::Colyseus.Schema.Type(6, "uint32")]
		public uint fame = 0;

		[global::Colyseus.Schema.Type(7, "uint8")]
		public byte district = 0;

		[global::Colyseus.Schema.Type(8, "string")]
		public string districtName = "";

		[global::Colyseus.Schema.Type(9, "boolean")]
		public bool isPublic = false;

		[global::Colyseus.Schema.Type(10, "uint16")]
		public ushort shard = 0;

		[global::Colyseus.Schema.Type(11, "string")]
		public string @event = "";

		[global::Colyseus.Schema.Type(12, "string")]
		public string eventName = "";

		[global::Colyseus.Schema.Type(13, "float64")]
		public double eventEndsAt = 0;

		[global::Colyseus.Schema.Type(14, "string")]
		public string eventProducts = "";

		[global::Colyseus.Schema.Type(15, "string")]
		public string eventDecorations = "";

		[global::Colyseus.Schema.Type(16, "string")]
		public string eventGift = "";

		[global::Colyseus.Schema.Type(17, "string")]
		public string dayPhase = "";

		[global::Colyseus.Schema.Type(18, "string")]
		public string dayPhaseName = "";

		[global::Colyseus.Schema.Type(19, "uint16")]
		public ushort gameMinute = 0;

		[global::Colyseus.Schema.Type(20, "string")]
		public string weather = "";

		[global::Colyseus.Schema.Type(21, "string")]
		public string weatherName = "";

		[global::Colyseus.Schema.Type(22, "string")]
		public string weatherDialogue = "";

		[global::Colyseus.Schema.Type(23, "float64")]
		public double weatherEndsAt = 0;

		[global::Colyseus.Schema.Type(24, "string")]
		public string skyBoost = "";

		[global::Colyseus.Schema.Type(25, "string")]
		public string communityId = "";

		[global::Colyseus.Schema.Type(26, "uint32")]
		public uint communityProgress = 0;

		[global::Colyseus.Schema.Type(27, "uint32")]
		public uint communityTarget = 0;

		[global::Colyseus.Schema.Type(28, "string")]
		public string decorations = "";

		[global::Colyseus.Schema.Type(29, "string")]
		public string shuttlePlayers = "";

		[global::Colyseus.Schema.Type(30, "string")]
		public string shuttleTurn = "";

		[global::Colyseus.Schema.Type(31, "float64")]
		public double shuttleDeadline = 0;

		[global::Colyseus.Schema.Type(32, "uint16")]
		public ushort shuttleScore = 0;

		[global::Colyseus.Schema.Type(33, "string")]
		public string caroBoard = "";

		[global::Colyseus.Schema.Type(34, "string")]
		public string caroX = "";

		[global::Colyseus.Schema.Type(35, "string")]
		public string caroO = "";

		[global::Colyseus.Schema.Type(36, "string")]
		public string caroTurn = "";

		[global::Colyseus.Schema.Type(37, "string")]
		public string caroWinner = "";

		[global::Colyseus.Schema.Type(38, "uint16")]
		public ushort weddingProgress = 0;

		[global::Colyseus.Schema.Type(39, "float64")]
		public double weddingEndsAt = 0;

		[global::Colyseus.Schema.Type(40, "map", typeof(global::Colyseus.Schema.MapSchema<Player>))]
		public global::Colyseus.Schema.MapSchema<Player> players = new global::Colyseus.Schema.MapSchema<Player>();

		[global::Colyseus.Schema.Type(41, "map", typeof(global::Colyseus.Schema.MapSchema<Stall>))]
		public global::Colyseus.Schema.MapSchema<Stall> stalls = new global::Colyseus.Schema.MapSchema<Stall>();

		[global::Colyseus.Schema.Type(42, "map", typeof(global::Colyseus.Schema.MapSchema<Customer>))]
		public global::Colyseus.Schema.MapSchema<Customer> customers = new global::Colyseus.Schema.MapSchema<Customer>();

		[global::Colyseus.Schema.Type(43, "map", typeof(global::Colyseus.Schema.MapSchema<LotState>))]
		public global::Colyseus.Schema.MapSchema<LotState> lots = new global::Colyseus.Schema.MapSchema<LotState>();
	}
}
