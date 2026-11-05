using UnityEngine; using UnityEngine.UI; using System.Linq; using System.Reflection;
var game = Object.FindAnyObjectByType<ViaHeOnline.Game>();
typeof(ViaHeOnline.Game).GetMethod("OpenLot", BindingFlags.NonPublic|BindingFlags.Instance).Invoke(game, new object[]{0});
var buttons = Object.FindObjectsByType<Button>().Where(x=>x.isActiveAndEnabled).ToList();
var labels = string.Join(" | ", buttons.Select(x=>x.GetComponentInChildren<Text>()?.text));
var free = buttons.FirstOrDefault(x=>x.GetComponentInChildren<Text>()?.text=="Miễn phí");
if (free!=null) free.onClick.Invoke();
"free=" + (free!=null) + " buttons: " + labels
