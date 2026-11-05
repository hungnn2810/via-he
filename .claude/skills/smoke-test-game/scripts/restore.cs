using UnityEngine;
var log = "";
foreach (var k in new[]{"deviceId","name","serverAddress"}) {
  var b = "smoke_backup_" + k;
  if (PlayerPrefs.HasKey(b)) { PlayerPrefs.SetString(k, PlayerPrefs.GetString(b)); PlayerPrefs.DeleteKey(b); log += k + " restored; "; }
  else { PlayerPrefs.DeleteKey(k); log += k + " removed (had no earlier value); "; }
}
PlayerPrefs.DeleteKey("smoke_backup_active");
PlayerPrefs.Save();
log + "name=" + PlayerPrefs.GetString("name") + " server=" + PlayerPrefs.GetString("serverAddress", "(default)") + " deviceIsTest=" + PlayerPrefs.GetString("deviceId").StartsWith("smoketest")
