// Character creator modal: gender and facial appearance picker with live character preview,
// caricature pedestal, and randomize button. All player-facing copy is in Vietnamese.
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
        int _previewStep = 0; // 0 = idle, 1 = step1, 2 = step2

        public static CharacterCreator Show(LookOptions options, Action<Dictionary<string, object>> onDone)
        {
            var modal = MakeModal<CharacterCreator>("TẠO NHÂN VẬT", new Vector2(880f, 570f), Theme.Skin.Blue, closable: false);
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
            _parts.Add(new PartPicker { Key = "lips", Label = "Khuôn miệng", Count = Mathf.Max(1, _options.lips) });
            _parts.Add(new PartPicker { Key = "cheeks", Label = "Chi tiết má", Count = Mathf.Max(1, _options.cheeks) });
            _parts.Add(new PartPicker { Key = "earrings", Label = "Khuyên tai", Count = Mathf.Max(1, _options.earrings) });

            // Layout Body: two columns (Left: Pedestal Preview, Right: Pickers + Randomize + Submit)
            var h = Body.gameObject.AddComponent<HorizontalLayoutGroup>();
            h.spacing = Theme.Space4;
            h.padding = new RectOffset((int)Theme.Space3, (int)Theme.Space3, (int)Theme.Space2, (int)Theme.Space2);
            h.childControlWidth = true;
            h.childControlHeight = true;
            h.childForceExpandWidth = false;
            h.childForceExpandHeight = true;

            // Left Column: Preview Pedestal Stage
            var leftCol = Ui.Rect("LeftColumn", Body);
            var leftLe = leftCol.gameObject.AddComponent<LayoutElement>();
            leftLe.minWidth = leftLe.preferredWidth = 330f;

            var leftV = leftCol.gameObject.AddComponent<VerticalLayoutGroup>();
            leftV.spacing = Theme.Space2;
            leftV.childControlWidth = true;
            leftV.childControlHeight = false;
            leftV.childForceExpandWidth = true;

            var stageBox = Ui.Rect("StageCard", leftCol);
            stageBox.sizeDelta = new Vector2(0f, 380f);
            var stageBg = stageBox.gameObject.AddComponent<Image>();
            Ui.SetSprite(stageBg, Theme.PanelSprite(Theme.Skin.Amber));

            // Stage title plate
            var plate = Ui.Img(stageBox, "StagePlate", Theme.BoardCreamSprite());
            Ui.Place(plate.rectTransform, Ui.TopCenter, new Vector2(160f, 32f), new Vector2(0f, -Theme.Space2), Ui.TopCenter);
            Ui.Label(plate.transform, "XEM TRƯỚC", Theme.TextXs, Theme.TextDark, TextAlignmentOptions.Midline, Ui.Edge.None);

            // Ground pedestal / shadow ellipse under character feet
            var shadow = Ui.Rect("PedestalShadow", stageBox);
            Ui.Place(shadow, Ui.BottomCenter, new Vector2(170f, 32f), new Vector2(0f, Theme.Space4), Ui.BottomCenter);
            var shadowImg = shadow.gameObject.AddComponent<Image>();
            Ui.SetSprite(shadowImg, "shadow");
            shadowImg.color = new Color(1f, 1f, 1f, 0.75f);

            // Portrait container
            _previewBox = Ui.Rect("PortraitHolder", stageBox);
            Ui.Place(_previewBox, Ui.Center, new Vector2(200f, 320f), new Vector2(0f, 12f), Ui.Center);

            // Randomize and Animation toggle row under stage
            var stageActionRow = Ui.Rect("StageActions", leftCol);
            stageActionRow.sizeDelta = new Vector2(0f, 44f);
            var sarH = stageActionRow.gameObject.AddComponent<HorizontalLayoutGroup>();
            sarH.spacing = Theme.Space2;
            sarH.childControlWidth = true;
            sarH.childControlHeight = true;
            sarH.childForceExpandWidth = true;

            var randBtn = UiTextButton.Create(stageActionRow, "🎲 Ngẫu nhiên", Theme.Btn.Gold);
            randBtn.Clicked += () =>
            {
                SoundFx.Tap();
                RandomizeLook();
            };

            var walkBtn = UiTextButton.Create(stageActionRow, "Bước đi", Theme.Btn.Gray);
            walkBtn.Clicked += () =>
            {
                SoundFx.Tap();
                _previewStep = (_previewStep + 1) % 3;
                walkBtn.Text = _previewStep == 0 ? "Bước đi" : $"Dáng {_previewStep}";
                Redraw();
            };

            // Right Column: Controls & Selectors
            var rightCol = Ui.Rect("RightColumn", Body);
            var rightLe = rightCol.gameObject.AddComponent<LayoutElement>();
            rightLe.minWidth = 460f;
            rightLe.flexibleWidth = 1f;

            var v = rightCol.gameObject.AddComponent<VerticalLayoutGroup>();
            v.spacing = Theme.Space2;
            v.padding = new RectOffset((int)Theme.Space2, (int)Theme.Space2, (int)Theme.Space1, (int)Theme.Space1);
            v.childControlWidth = true;
            v.childControlHeight = false;
            v.childForceExpandWidth = true;
            v.childForceExpandHeight = false;

            // Gender selection row
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
                labelLe.minWidth = 160f;
                labelLe.flexibleWidth = 1f;

                var prevBtn = UiTextButton.Create(row, "<", Theme.Btn.Gray);
                var prevLe = prevBtn.Rect.gameObject.AddComponent<LayoutElement>();
                prevLe.minWidth = prevLe.preferredWidth = 48f;
                prevBtn.Clicked += () =>
                {
                    SoundFx.Tap();
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
                    SoundFx.Tap();
                    p.Value = (p.Value + 1) % p.Count;
                    Redraw();
                };
            }

            // Submit Button
            var submitRt = Ui.Rect("SubmitHolder", rightCol);
            submitRt.sizeDelta = new Vector2(0f, 54f);
            var submitBtn = UiTextButton.Create(submitRt, "VÀO PHỐ", Theme.Btn.Green);
            Ui.Stretch(submitBtn.Rect);
            submitBtn.Clicked += () =>
            {
                SoundFx.Tap();
                OnSubmit();
            };

            UpdateGenderButtons();
            Redraw();
        }

        void RandomizeLook()
        {
            var rng = new System.Random();
            _gender = rng.Next(2) == 0 ? "male" : "female";
            foreach (var p in _parts)
            {
                p.Value = rng.Next(p.Count);
            }
            UpdateGenderButtons();
            Redraw();
            UiToast.Show("Đã đổi diện mạo ngẫu nhiên!", Theme.ToastTone.Info);
        }

        void SetGender(string gender)
        {
            if (_gender == gender) return;
            SoundFx.Tap();
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
                Character.FillPortrait(_previewBox, CurrentLook(), "", _previewStep);
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
