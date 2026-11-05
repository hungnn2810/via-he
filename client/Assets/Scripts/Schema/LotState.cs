// 
// THIS FILE HAS BEEN GENERATED AUTOMATICALLY
// DO NOT CHANGE IT MANUALLY UNLESS YOU KNOW WHAT YOU'RE DOING
// 
// GENERATED USING @colyseus/schema 5.0.43
// 

namespace ViaHeOnline.Schema {
	public partial class LotState : global::Colyseus.Schema.Schema {
#if UNITY_5_3_OR_NEWER
		[global::UnityEngine.Scripting.Preserve]
#endif
		public LotState() { }

		[global::Colyseus.Schema.Type(0, "string")]
		public string crop = "";

		[global::Colyseus.Schema.Type(1, "float64")]
		public double plantedAt = 0;

		[global::Colyseus.Schema.Type(2, "float64")]
		public double readyAt = 0;

		[global::Colyseus.Schema.Type(3, "boolean")]
		public bool watered = false;

		[global::Colyseus.Schema.Type(4, "string")]
		public string building = "";

		[global::Colyseus.Schema.Type(5, "uint8")]
		public byte level = 0;

		[global::Colyseus.Schema.Type(6, "string")]
		public string recipe = "";

		[global::Colyseus.Schema.Type(7, "float64")]
		public double cookReadyAt = 0;
	}
}
