// First-run screen: pick a gender and face parts, with a live preview. The choice is permanent until the barber arrives.
using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace ViaHeOnline
{
    public static class CharacterCreator
    {
        class Part
        {
            public string Key, Label;
            public int Count, Value;
            public Text Display;
        }

        public static void Show(Transform canvas, LookOptions options, Action<Dictionary<string, object>> onDone)
        {
            // An older server may not send the option counts; fall back to the shipped sprite counts
            options ??= new LookOptions { hair = 4, brows = 4, lips = 4, cheeks = 3, earrings = 4 };
            var root = UIBuilder.Box(canvas, "CharacterCreator");
            UIBuilder.Fill(root);
            root.gameObject.AddComponent<Image>().color = Draw.Hex("#5ec2f2");

            var ribbon = UIBuilder.Place(UIBuilder.Image(root, "ui_ribbon").rectTransform, new Vector2(0.5f, 1), new Vector2(0, -10), new Vector2(520, 92), new Vector2(0.5f, 1));
            var title = UIBuilder.Text(ribbon, "TẠO NHÂN VẬT", 34, Color.white, TextAnchor.MiddleCenter, true);
            UIBuilder.Fill(title.rectTransform); title.rectTransform.offsetMin = new Vector2(0, 16);

            var previewPanel = UIBuilder.Image(root, "ui_panel").rectTransform;
            UIBuilder.Place(previewPanel, new Vector2(0.5f, 0.5f), new Vector2(-250, -40), new Vector2(380, 540), new Vector2(0.5f, 0.5f));
            var preview = UIBuilder.Box(previewPanel, "Preview");
            UIBuilder.Fill(preview, 40);

            var panel = UIBuilder.Image(root, "ui_panel").rectTransform;
            UIBuilder.Place(panel, new Vector2(0.5f, 0.5f), new Vector2(210, -40), new Vector2(500, 540), new Vector2(0.5f, 0.5f));
            var v = panel.gameObject.AddComponent<VerticalLayoutGroup>();
            v.padding = new RectOffset(28, 28, 28, 24); v.spacing = 8;
            v.childControlWidth = true; v.childControlHeight = true; v.childForceExpandHeight = false;

            string gender = "male";
            var parts = new List<Part>
            {
                new Part { Key = "hair", Label = "Kiểu tóc", Count = options.hair },
                new Part { Key = "brows", Label = "Lông mày", Count = options.brows },
                new Part { Key = "lips", Label = "Môi", Count = options.lips },
                new Part { Key = "cheeks", Label = "Má", Count = options.cheeks },
                new Part { Key = "earrings", Label = "Khuyên tai", Count = options.earrings },
            };
            int Value(string key) => parts.Find(p => p.Key == key).Value;
            string Look() => $"{gender},{Value("hair")},{Value("brows")},{Value("lips")},{Value("cheeks")},{Value("earrings")}";

            void Redraw()
            {
                foreach (var p in parts) p.Display.text = $"{p.Value + 1}/{p.Count}";
                Character.FillPortrait(preview, Look());
            }

            var genderRow = UIBuilder.Row(panel, 66, false).transform;
            UIBuilder.Button(genderRow, "Nam", () => { gender = "male"; Redraw(); }, "blue", 24);
            UIBuilder.Button(genderRow, "Nữ", () => { gender = "female"; Redraw(); }, "red", 24);

            foreach (var part in parts)
            {
                var p = part;
                var row = UIBuilder.Row(panel, 60).transform;
                UIBuilder.Label(row, p.Label, 22);
                UIBuilder.Button(row, "<", () => { p.Value = (p.Value + p.Count - 1) % p.Count; Redraw(); }, "orange", 26).GetComponent<LayoutElement>().minWidth = 60;
                p.Display = UIBuilder.Text(row, "", 20, UIBuilder.TextDark, TextAnchor.MiddleCenter);
                var le = p.Display.gameObject.AddComponent<LayoutElement>();
                le.minWidth = 56;
                UIBuilder.Button(row, ">", () => { p.Value = (p.Value + 1) % p.Count; Redraw(); }, "orange", 26).GetComponent<LayoutElement>().minWidth = 60;
            }

            var start = UIBuilder.Button(panel, "VÀO PHỐ", () =>
            {
                var message = new Dictionary<string, object> { ["gender"] = gender };
                foreach (var p in parts) message[p.Key] = p.Value;
                UnityEngine.Object.Destroy(root.gameObject);
                onDone(message);
            }, "green", 26);
            start.GetComponent<LayoutElement>().minHeight = 64;

            Redraw();
        }
    }
}
