// Character creator modal: gender and facial appearance picker with live portrait preview.
// Used on first login before entering the street. All player-facing text is in Vietnamese.
using System;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace ViaHeOnline
{
    public class CharacterCreator : UiModal
    {
        class PartPicker
        {
            public string Key;
            public string Label;
            public int Count;
            public int Value;
            public TextMeshProUGUI Display;
        }

        string _gender = "male";
        LookOptions _options;
        readonly List<PartPicker> _parts = new List<PartPicker>();
        RectTransform _previewBox;
        Action<Dictionary<string, object>> _onDone;
        UiTextButton _maleBtn, _femaleBtn;

        public static CharacterCreator Show(LookOptions options, Action<Dictionary<string, object>> onDone)
        {
            var modal = MakeModal<CharacterCreator>("TẠO NHÂN VẬT", new Vector2(860f, 560f), Theme.Skin.Blue, closable: false);
            modal._options = options ?? new LookOptions { hair = 4, brows = 4, lips = 4, cheeks = 3, earrings = 4 };
            modal._onDone = onDone;
            modal.Build();
            modal.Open();
            return modal;
        }

        void Build()
        {
            SetTitle("TẠO NHÂN VẬT");

            _parts.Clear();
            _parts.Add(new PartPicker { Key = "hair", Label = "Kiểu tóc", Count = Mathf.Max(1, _options.hair) });
            _parts.Add(new PartPicker { Key = "brows", Label = "Lông mày", Count = Mathf.Max(1, _options.brows) });
            _parts.Add(new PartPicker { Key = "lips", Label = "Môi", Count = Mathf.Max(1, _options.lips) });
            _parts.Add(new PartPicker { Key = "cheeks", Label = "Má", Count = Mathf.Max(1, _options.cheeks) });
            _parts.Add(new PartPicker { Key = "earrings", Label = "Khuyên tai", Count = Mathf.Max(1, _options.earrings) });

            // Layout Body: two columns (Left: Preview, Right: Pickers + Submit)
            var h = Body.gameObject.AddComponent<HorizontalLayoutGroup>();
            h.spacing = Theme.Space4;
            h.padding = new RectOffset((int)Theme.Space3, (int)Theme.Space3, (int)Theme.Space2, (int)Theme.Space2);
            h.childControlWidth = true;
            h.childControlHeight = true;
            h.childForceExpandWidth = false;
            h.childForceExpandHeight = true;

            // Left Column: Preview panel
            var leftCol = Ui.Rect("LeftColumn", Body);
            var leftLe = leftCol.gameObject.AddComponent<LayoutElement>();
            leftLe.minWidth = leftLe.preferredWidth = 320f;

            var previewCard = Ui.Img(leftCol, "PreviewCard", Theme.PanelSprite(Theme.Skin.Amber));
            Ui.Stretch(previewCard.rectTransform);

            _previewBox = Ui.Rect("PortraitHolder", previewCard.transform);
            Ui.Stretch(_previewBox, Theme.Space4, Theme.Space4, Theme.Space4, Theme.Space4);

            // Right Column: Controls
            var rightCol = Ui.Rect("RightColumn", Body);
            var rightLe = rightCol.gameObject.AddComponent<LayoutElement>();
            rightLe.minWidth = 440f;
            rightLe.flexibleWidth = 1f;

            var v = rightCol.gameObject.AddComponent<VerticalLayoutGroup>();
            v.spacing = Theme.Space2;
            v.padding = new RectOffset((int)Theme.Space2, (int)Theme.Space2, (int)Theme.Space1, (int)Theme.Space1);
            v.childControlWidth = true;
            v.childControlHeight = false;
            v.childForceExpandWidth = true;
            v.childForceExpandHeight = false;

            // Gender toggle row
            var genderRow = Ui.Rect("GenderRow", rightCol);
            genderRow.sizeDelta = new Vector2(0f, 48f);
            var gh = genderRow.gameObject.AddComponent<HorizontalLayoutGroup>();
            gh.spacing = Theme.Space3;
            gh.childControlWidth = true;
            gh.childControlHeight = true;

            _maleBtn = UiTextButton.Create(genderRow, "Nam", Theme.Btn.Blue);
            _maleBtn.Clicked += () => SetGender("male");

            _femaleBtn = UiTextButton.Create(genderRow, "Nữ", Theme.Btn.Red);
            _femaleBtn.Clicked += () => SetGender("female");

            // Part picker rows
            foreach (var part in _parts)
            {
                var p = part;
                var row = Ui.Rect("Row_" + p.Key, rightCol);
                row.sizeDelta = new Vector2(0f, 46f);
                var rowBg = row.gameObject.AddComponent<Image>();
                Ui.SetSprite(rowBg, Theme.RowSprite());

                var rh = row.gameObject.AddComponent<HorizontalLayoutGroup>();
                rh.spacing = Theme.Space2;
                rh.padding = new RectOffset((int)Theme.Space3, (int)Theme.Space3, 4, 4);
                rh.childControlWidth = false;
                rh.childControlHeight = true;
                rh.childAlignment = TextAnchor.MiddleCenter;

                var label = Ui.Label(row, p.Label, Theme.TextMd, Theme.TextDark, TextAlignmentOptions.MidlineLeft);
                var labelLe = label.gameObject.AddComponent<LayoutElement>();
                labelLe.minWidth = 150f;
                labelLe.flexibleWidth = 1f;

                var prevBtn = UiTextButton.Create(row, "<", Theme.Btn.Gray);
                var prevLe = prevBtn.Rect.gameObject.AddComponent<LayoutElement>();
                prevLe.minWidth = prevLe.preferredWidth = 48f;
                prevBtn.Clicked += () =>
                {
                    p.Value = (p.Value + p.Count - 1) % p.Count;
                    Redraw();
                };

                p.Display = Ui.Label(row, "", Theme.TextSm, Theme.TextDark, TextAlignmentOptions.Midline);
                var dispLe = p.Display.gameObject.AddComponent<LayoutElement>();
                dispLe.minWidth = dispLe.preferredWidth = 60f;

                var nextBtn = UiTextButton.Create(row, ">", Theme.Btn.Gray);
                var nextLe = nextBtn.Rect.gameObject.AddComponent<LayoutElement>();
                nextLe.minWidth = nextLe.preferredWidth = 48f;
                nextBtn.Clicked += () =>
                {
                    p.Value = (p.Value + 1) % p.Count;
                    Redraw();
                };
            }

            // Space
            var spacer = Ui.Rect("Spacer", rightCol);
            spacer.sizeDelta = new Vector2(0f, 6f);

            // Submit Button
            var submitRt = Ui.Rect("SubmitHolder", rightCol);
            submitRt.sizeDelta = new Vector2(0f, 54f);
            var submitBtn = UiTextButton.Create(submitRt, "VÀO PHỐ", Theme.Btn.Green);
            Ui.Stretch(submitBtn.Rect);
            submitBtn.Clicked += OnSubmit;

            UpdateGenderButtons();
            Redraw();
        }

        void SetGender(string gender)
        {
            if (_gender == gender) return;
            _gender = gender;
            UpdateGenderButtons();
            Redraw();
        }

        void UpdateGenderButtons()
        {
            if (_maleBtn != null) _maleBtn.Interactable = _gender != "male";
            if (_femaleBtn != null) _femaleBtn.Interactable = _gender != "female";
        }

        string CurrentLook()
        {
            int val(string key) => _parts.Find(p => p.Key == key)?.Value ?? 0;
            return $"{_gender},{val("hair")},{val("brows")},{val("lips")},{val("cheeks")},{val("earrings")}";
        }

        void Redraw()
        {
            foreach (var p in _parts)
            {
                if (p.Display) p.Display.text = $"{p.Value + 1}/{p.Count}";
            }
            if (_previewBox)
            {
                Character.FillPortrait(_previewBox, CurrentLook());
            }
        }

        void OnSubmit()
        {
            var message = new Dictionary<string, object>
            {
                ["gender"] = _gender,
            };
            foreach (var p in _parts)
            {
                message[p.Key] = p.Value;
            }
            Close();
            _onDone?.Invoke(message);
        }
    }
}
