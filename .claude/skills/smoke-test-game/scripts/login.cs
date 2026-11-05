using UnityEngine; using UnityEngine.UI; using System.Linq;
foreach (var k in new[]{"deviceId","name","serverAddress"}) {
  if (PlayerPrefs.HasKey(k) && !PlayerPrefs.HasKey("smoke_backup_"+k)) PlayerPrefs.SetString("smoke_backup_"+k, PlayerPrefs.GetString(k));
}
PlayerPrefs.SetInt("smoke_backup_active", 1);
PlayerPrefs.SetString("deviceId", "smoketest" + System.Guid.NewGuid().ToString("N"));
PlayerPrefs.Save();
var login = GameObject.Find("Login");
var inputs = login.GetComponentsInChildren<InputField>();
inputs[0].text = "Thu Nghiem";
inputs[1].text = "ws://localhost:2568";
var b = login.GetComponentsInChildren<Button>().First();
b.onClick.Invoke();
"clicked " + b.GetComponentInChildren<Text>().text + " inputs=" + inputs.Length
