using UnityEngine; using UnityEngine.UI; using System.Linq; using System.Reflection;
var game = Object.FindAnyObjectByType<ViaHeOnline.Game>();
var net = (ViaHeOnline.Network)typeof(ViaHeOnline.Game).GetField("_net", BindingFlags.NonPublic|BindingFlags.Instance).GetValue(game);
var p = net?.Profile;
var texts = Object.FindObjectsByType<Text>().Where(t=>t.isActiveAndEnabled && t.text!="").Select(t=>t.text.Replace("\n"," ")).Take(45);
var st = net?.Room?.State;
"profile=" + (p==null?"null":$"money={p.money} tutorial={p.tutorial} level={p.level} appearance={(p.appearance!=null)}") + " stalls=" + (st?.stalls?.Count) + " customers=" + (st?.customers?.Count) + " lots=" + (st?.lots?.Count) + "\n" + string.Join(" | ", texts)
