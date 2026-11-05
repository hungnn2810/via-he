using UnityEngine; using UnityEngine.UI; using System.Linq; using System.Reflection;
var game = Object.FindAnyObjectByType<ViaHeOnline.Game>();
var net = (ViaHeOnline.Network)typeof(ViaHeOnline.Game).GetField("_net", BindingFlags.NonPublic|BindingFlags.Instance).GetValue(game);
typeof(ViaHeOnline.Game).GetMethod("OpenLot", BindingFlags.NonPublic|BindingFlags.Instance).Invoke(game, new object[]{0});
var buttons = Object.FindObjectsByType<Button>().Where(x=>x.isActiveAndEnabled).ToList();
var b = buttons.FirstOrDefault(x=>x.GetComponentInChildren<Text>()?.text=="Tưới cây");
if (b!=null) b.onClick.Invoke();
var lot = net.Room.State.lots["0"];
"watered=" + (b!=null) + " secondsLeft=" + (((long)lot.readyAt - net.ServerNow)/1000) + " buttons: " + string.Join(" | ", buttons.Select(x=>x.GetComponentInChildren<Text>()?.text))
