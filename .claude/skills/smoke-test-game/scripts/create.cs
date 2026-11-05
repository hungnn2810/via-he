using UnityEngine; using UnityEngine.UI; using System.Linq;
var root = GameObject.Find("CharacterCreator");
var b = root.GetComponentsInChildren<Button>().Last();
b.onClick.Invoke();
"clicked " + b.GetComponentInChildren<Text>().text
