using UnityEngine; using UnityEngine.UI; using System.Linq; using System.Reflection; using System.Collections.Generic;
var flags = BindingFlags.NonPublic|BindingFlags.Instance;
var t = typeof(ViaHeOnline.Game);
var game = Object.FindAnyObjectByType<ViaHeOnline.Game>();
var net = (ViaHeOnline.Network)t.GetField("_net", flags).GetValue(game);
var log = new List<string>();
log.Add("start tutorial=" + net.Profile.tutorial + " money=" + net.Profile.money);
var st = net.Room.State;
if (st.stalls.Count == 0) {
  t.GetMethod("OpenStallWindow", flags).Invoke(game, new object[]{0});
  var sells = Object.FindObjectsByType<Button>().Where(x=>x.isActiveAndEnabled && x.GetComponentInChildren<Text>()?.text=="Tự bán").ToList();
  var rows = sells.Select(b => string.Join("/", b.transform.parent.GetComponentsInChildren<Text>().Select(x=>x.text))).ToList();
  log.Add("rows: " + string.Join(" || ", rows));
  var banana = sells.FirstOrDefault(b => b.transform.parent.GetComponentsInChildren<Text>().Any(x=>x.text.StartsWith("Chuối")));
  log.Add("bananaRow=" + (banana!=null));
  if (banana!=null) banana.onClick.Invoke();
}
string.Join("\n", log)
