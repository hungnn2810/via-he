// A panel docked to a screen edge (bottom or side sheet).
// Commonly used for drawers, quick actions, stall setup or inspect drawers.
// Inherits scrim, theme skin, close button, and animation from UiPanel.
using System;
using UnityEngine;

namespace ViaHeOnline
{
    public class UiSheet : UiPanel
    {
        public enum DockEdge { Bottom, Left, Right }

        public DockEdge Edge { get; private set; } = DockEdge.Bottom;
        public float Extent { get; private set; } = 360f;

        Vector2 _targetPos;
        Vector2 _hiddenPos;

        public static UiSheet Create(string name, DockEdge edge = DockEdge.Bottom, float extent = 360f,
            Theme.Skin skin = Theme.Skin.Amber, bool closable = true)
        {
            var sheet = Make<UiSheet>("Sheet:" + name, skin, closable);
            sheet.Edge = edge;
            sheet.Extent = extent;
            sheet.Fit();
            sheet.gameObject.SetActive(false);
            return sheet;
        }

        public void SetExtent(float extent)
        {
            Extent = extent;
            Fit();
        }

        protected override void OnOpened()
        {
            Fit();
            base.OnOpened();
        }

        void Fit()
        {
            var inset = Theme.PanelInset;
            switch (Edge)
            {
                case DockEdge.Bottom:
                    Frame.anchorMin = new Vector2(0f, 0f);
                    Frame.anchorMax = new Vector2(1f, 0f);
                    Frame.pivot = new Vector2(0.5f, 0f);
                    Frame.sizeDelta = new Vector2(0f, Extent);
                    _targetPos = Vector2.zero;
                    _hiddenPos = new Vector2(0f, -Extent - 40f);
                    Ui.Stretch(Body, inset.x + Theme.Space3, inset.y + Theme.Space2, inset.z + Theme.Space3, inset.w + Theme.Space2);
                    break;

                case DockEdge.Left:
                    Frame.anchorMin = new Vector2(0f, 0f);
                    Frame.anchorMax = new Vector2(0f, 1f);
                    Frame.pivot = new Vector2(0f, 0.5f);
                    Frame.sizeDelta = new Vector2(Extent, 0f);
                    _targetPos = Vector2.zero;
                    _hiddenPos = new Vector2(-Extent - 40f, 0f);
                    Ui.Stretch(Body, inset.x + Theme.Space2, inset.y + Theme.Space3, inset.z + Theme.Space2, inset.w + Theme.Space3);
                    break;

                case DockEdge.Right:
                    Frame.anchorMin = new Vector2(1f, 0f);
                    Frame.anchorMax = new Vector2(1f, 1f);
                    Frame.pivot = new Vector2(1f, 0.5f);
                    Frame.sizeDelta = new Vector2(Extent, 0f);
                    _targetPos = Vector2.zero;
                    _hiddenPos = new Vector2(Extent + 40f, 0f);
                    Ui.Stretch(Body, inset.x + Theme.Space2, inset.y + Theme.Space3, inset.z + Theme.Space2, inset.w + Theme.Space3);
                    break;
            }

            if (CloseButton)
            {
                Ui.Place(CloseButton.Rect, Ui.TopRight, Vector2.one * Theme.CloseButtonSize, new Vector2(-6f, 4f), Ui.Center);
            }
        }

        protected override void ApplyFrame(float eased)
        {
            Frame.anchoredPosition = Vector2.Lerp(_hiddenPos, _targetPos, eased);
        }
    }
}
