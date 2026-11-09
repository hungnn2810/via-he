// Two-button confirmation modal (e.g. demolish building, fire employee, close stall).
// Modeled after the original client's ref_confirm_dialog.
using System;
using TMPro;
using UnityEngine;

namespace ViaHeOnline
{
    public static class UiConfirm
    {
        public static UiModal Show(string title, string message, Action onConfirm, Action onCancel = null,
            string confirmText = "Đồng ý", string cancelText = "Bỏ qua",
            Theme.Btn confirmRole = Theme.Btn.Green, Theme.Skin skin = Theme.Skin.Amber)
        {
            var modal = UiModal.Create(title, new Vector2(440f, 260f), skin, closable: true);

            var msgLabel = Ui.Label(modal.Body, message, Theme.TextMd, Theme.TextDark,
                TextAlignmentOptions.Midline, Ui.Edge.None, wrap: true, name: "Message");
            Ui.Stretch(msgLabel.rectTransform, Theme.Space4, Theme.Space3, Theme.Space4, Theme.Space3);

            modal.AddButton(cancelText, Theme.Btn.Gray, () => onCancel?.Invoke(), closesWindow: true);
            modal.AddButton(confirmText, confirmRole, () => onConfirm?.Invoke(), closesWindow: true);

            modal.Open();
            return modal;
        }
    }
}
