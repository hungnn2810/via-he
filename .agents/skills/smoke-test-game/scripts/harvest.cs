using System.Reflection;
var flags = BindingFlags.NonPublic|BindingFlags.Instance;
var game = UnityEngine.Object.FindAnyObjectByType<ViaHeOnline.Game>();
var net = (ViaHeOnline.Network)typeof(ViaHeOnline.Game).GetField("_net", flags).GetValue(game);
var left = ((long)net.Room.State.lots["0"].readyAt - net.ServerNow)/1000;
typeof(ViaHeOnline.Game).GetMethod("OpenLot", flags).Invoke(game, new object[]{0});
"secondsLeftAtTap=" + left
