// 
// THIS FILE HAS BEEN GENERATED AUTOMATICALLY
// DO NOT CHANGE IT MANUALLY UNLESS YOU KNOW WHAT YOU'RE DOING
// 
// GENERATED USING @colyseus/schema 5.0.43
// 

namespace ViaHeOnline.Schema {
	public partial class Stall : global::Colyseus.Schema.Schema {
#if UNITY_5_3_OR_NEWER
		[global::UnityEngine.Scripting.Preserve]
#endif
		public Stall() { }

		[global::Colyseus.Schema.Type(0, "uint8")]
		public byte slot = 0;

		[global::Colyseus.Schema.Type(1, "float32")]
		public double x = 0;

		[global::Colyseus.Schema.Type(2, "string")]
		public string productId = "";

		[global::Colyseus.Schema.Type(3, "uint16")]
		public ushort remaining = 0;

		[global::Colyseus.Schema.Type(4, "uint32")]
		public uint price = 0;

		[global::Colyseus.Schema.Type(5, "string")]
		public string ownerId = "";

		[global::Colyseus.Schema.Type(6, "string")]
		public string ownerName = "";

		[global::Colyseus.Schema.Type(7, "string")]
		public string employeeId = "";

		[global::Colyseus.Schema.Type(8, "string")]
		public string sellerName = "";

		[global::Colyseus.Schema.Type(9, "string")]
		public string sellerOutfit = "";

		[global::Colyseus.Schema.Type(10, "string")]
		public string sellerLook = "";

		[global::Colyseus.Schema.Type(11, "string")]
		public string servingCustomerId = "";

		[global::Colyseus.Schema.Type(12, "float64")]
		public double saleEndsAt = 0;
	}
}
