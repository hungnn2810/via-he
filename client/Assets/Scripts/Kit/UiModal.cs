// A centred window: a framed panel with a title plate across the top, a close badge on the corner,
// a body area for content and an optional row of buttons along the bottom.
using System;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace ViaHeOnline
{
    public class UiModal : UiPanel
    {
        const float PlateHeight = 44f;
        const float PlateMinWidth = 180f;
        const float ButtonMaxWidth = 200f;

        protected Vector2 _size;
        protected Image _plate;
        protected TextMeshProUGUI _title;
        protected RectTransform _footer;
        protected readonly List<UiTextButton> _buttons = new List<UiTextButton>();

        public string Title => _title ? _title.text : "";

        public void SetSize(Vector2 size)
        {
            _size = size;
            Fit();
        }

        protected static T MakeModal<T>(string title, Vector2? size = null, Theme.Skin skin = Theme.Skin.Amber, bool closable = true) where T : UiModal
        {
            var modal = Make<T>("Modal:" + title, skin, closable);
            modal._size = size ?? Theme.WindowSize;

            modal._plate = Ui.Img(modal.Frame, "TitlePlate", Theme.TitlePlateSprite());
            modal._title = Ui.Label(modal._plate.transform, title ?? "", Theme.TextLg, Theme.TitleColor(skin),
                TextAlignmentOptions.Midline, Ui.Edge.Thick, name: "Title");
            Ui.Stretch(modal._title.rectTransform, Theme.Space3, 0, Theme.Space3, Theme.Space1);

            modal._footer = Ui.Rect("Footer", modal.Frame);
            modal.Fit();
            return modal;
        }

        /// Build a modal, closed. Fill Body, then call Open().
        public static UiModal Create(string title, Vector2? size = null, Theme.Skin skin = Theme.Skin.Amber, bool closable = true)
        {
            var modal = MakeModal<UiModal>(title, size, skin, closable);
            modal.gameObject.SetActive(false);
            return modal;
        }

        public void SetTitle(string title)
        {
            if (_title) _title.text = title;
            Fit();
        }

        /// A button in the footer row. Buttons share the row equally, up to a maximum width each.
        public UiTextButton AddButton(string text, Theme.Btn role, Action onClick, bool closesWindow = false)
        {
            var button = UiTextButton.Create(_footer, text, role);
            button.Clicked += () =>
            {
                onClick?.Invoke();
                if (closesWindow) Close();
            };
            _buttons.Add(button);
            Fit();
            return button;
        }

        protected override void OnOpened()
        {
            Fit(); // the canvas may have changed shape since the window was built
            base.OnOpened();
        }

        protected override void ApplyFrame(float eased) => Frame.localScale = Vector3.one * Mathf.Lerp(0.9f, 1f, eased);

        /// Sizes the frame to the window, shrunk to fit short screens, and lays out the plate, body and footer.
        protected void Fit()
        {
            if (!Frame) return;
            var avail = Root.CanvasSize;
            var size = new Vector2(
                Mathf.Min(_size.x, avail.x - 2f * Theme.Space4),
                Mathf.Min(_size.y, avail.y - 2f * (Theme.TitleOverhang + Theme.Space2)));
            Ui.Place(Frame, Ui.Center, size, Vector2.zero);

            if (_plate && _title)
            {
                float plateWidth = Mathf.Max(PlateMinWidth, _title.GetPreferredValues(_title.text).x + 2f * Theme.Space6);
                Ui.Place(_plate.rectTransform, Ui.TopCenter, new Vector2(plateWidth, PlateHeight),
                    new Vector2(0f, Theme.TitleOverhang - PlateHeight * 0.5f), Ui.Center);
            }

            var inset = Theme.PanelInset;
            float left = inset.x + Theme.Space2, right = inset.z + Theme.Space2;
            float bottom = inset.y + Theme.Space2, top = inset.w + Theme.Space2;
            float footerBlock = _buttons.Count > 0 ? Theme.ButtonHeight + Theme.Space2 : 0f;

            if (Body) Ui.Stretch(Body, left, bottom + footerBlock, right, top);

            if (_footer)
            {
                _footer.anchorMin = new Vector2(0f, 0f);
                _footer.anchorMax = new Vector2(1f, 0f);
                _footer.pivot = new Vector2(0.5f, 0f);
                _footer.offsetMin = new Vector2(left, bottom);
                _footer.offsetMax = new Vector2(-right, bottom + Theme.ButtonHeight);
            }

            int n = _buttons.Count;
            if (n == 0) return;
            float rowWidth = size.x - left - right;
            float width = Mathf.Min(ButtonMaxWidth, (rowWidth - (n - 1) * Theme.Space3) / n);
            float total = n * width + (n - 1) * Theme.Space3;
            for (int i = 0; i < n; i++)
            {
                float x = -total * 0.5f + width * 0.5f + i * (width + Theme.Space3);
                Ui.Place(_buttons[i].Rect, Ui.Center, new Vector2(width, Theme.ButtonHeight), new Vector2(x, 0f));
            }
        }
    }
}
