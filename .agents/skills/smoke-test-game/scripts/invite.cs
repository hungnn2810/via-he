using UnityEngine; using System.Linq; using System.Reflection; using System.Collections.Generic;
var flags = BindingFlags.NonPublic|BindingFlags.Instance;
var game = Object.FindAnyObjectByType<ViaHeOnline.Game>();
var net = (ViaHeOnline.Network)typeof(ViaHeOnline.Game).GetField("_net", flags).GetValue(game);
var st = net.Room.State;
var list = new List<ViaHeOnline.Schema.Customer>();
st.customers.ForEach((k, c) => list.Add(c));
var wanting = list.Where(c => c.wants.Split(',').Contains("banana") && (c.status == "walk")).ToList();
var target = wanting.FirstOrDefault();
var text = "customers=" + list.Count + " wantBanana=" + wanting.Count + " wants=" + string.Join(";", list.Select(c=>c.wants+":"+c.status));
if (target != null) {
  net.Send("move", new Dictionary<string, object> { ["x"] = target.x });
  net.Send("inviteCustomer", new Dictionary<string, object> { ["customerId"] = target.id });
  text += " invited=" + target.id;
}
string stall = "";
st.stalls.ForEach((k, s) => stall += s.productId + " remaining=" + s.remaining + " serving=" + s.servingCustomerId + " ");
text + "\nstall: " + stall + "\nmoney=" + net.Profile.money + " tutorial=" + net.Profile.tutorial + " xp=" + net.Profile.xp
