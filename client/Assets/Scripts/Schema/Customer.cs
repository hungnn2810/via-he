// 
// THIS FILE HAS BEEN GENERATED AUTOMATICALLY
// DO NOT CHANGE IT MANUALLY UNLESS YOU KNOW WHAT YOU'RE DOING
// 
// GENERATED USING @colyseus/schema 5.0.43
// 

namespace ViaHeOnline.Schema {
	public partial class Customer : global::Colyseus.Schema.Schema {
#if UNITY_5_3_OR_NEWER
		[global::UnityEngine.Scripting.Preserve]
#endif
		public Customer() { }

		[global::Colyseus.Schema.Type(0, "string")]
		public string id = "";

		[global::Colyseus.Schema.Type(1, "float32")]
		public double x = 0;

		[global::Colyseus.Schema.Type(2, "int8")]
		public sbyte dir = 1;

		[global::Colyseus.Schema.Type(3, "string")]
		public string wants = "";

		[global::Colyseus.Schema.Type(4, "int8")]
		public sbyte targetSlot = -1;

		[global::Colyseus.Schema.Type(5, "string")]
		public string status = "walk";

		[global::Colyseus.Schema.Type(6, "uint8")]
		public byte look = 0;

		[global::Colyseus.Schema.Type(7, "string")]
		public string group = "";

		[global::Colyseus.Schema.Type(8, "string")]
		public string touristLook = "";

		[global::Colyseus.Schema.Type(9, "string")]
		public string regularId = "";
	}
}
