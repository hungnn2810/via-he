using System.Reflection;
var game = UnityEngine.Object.FindAnyObjectByType<ViaHeOnline.Game>();
var net = (ViaHeOnline.Network)typeof(ViaHeOnline.Game).GetField("_net", BindingFlags.NonPublic|BindingFlags.Instance).GetValue(game);
var lot = net.Room.State.lots["0"];
"crop=" + lot.crop + " watered=" + lot.watered + " secondsLeft=" + (((long)lot.readyAt - net.ServerNow)/1000) + " tutorial=" + net.Profile.tutorial + " stamina=" + net.Profile.stamina
