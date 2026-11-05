// 
// THIS FILE HAS BEEN GENERATED AUTOMATICALLY
// DO NOT CHANGE IT MANUALLY UNLESS YOU KNOW WHAT YOU'RE DOING
// 
// GENERATED USING @colyseus/schema 5.0.43
// 

namespace ViaHeOnline.Schema {
	public partial class Player : global::Colyseus.Schema.Schema {
#if UNITY_5_3_OR_NEWER
		[global::UnityEngine.Scripting.Preserve]
#endif
		public Player() { }

		[global::Colyseus.Schema.Type(0, "string")]
		public string id = "";

		[global::Colyseus.Schema.Type(1, "string")]
		public string name = "";

		[global::Colyseus.Schema.Type(2, "uint16")]
		public ushort level = 1;

		[global::Colyseus.Schema.Type(3, "float32")]
		public double x = 0;

		[global::Colyseus.Schema.Type(4, "float32")]
		public double targetX = 0;

		[global::Colyseus.Schema.Type(5, "string")]
		public string outfit = "";

		[global::Colyseus.Schema.Type(6, "string")]
		public string look = "";

		[global::Colyseus.Schema.Type(7, "string")]
		public string vehicle = "";

		[global::Colyseus.Schema.Type(8, "string")]
		public string speech = "";

		[global::Colyseus.Schema.Type(9, "float64")]
		public double speechAt = 0;

		[global::Colyseus.Schema.Type(10, "boolean")]
		public bool isOwner = false;
	}
}
