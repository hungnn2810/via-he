// Progress bar with smooth fill animation and semantic fill tones.
// Uses Theme.ProgressTrackSprite() and Theme.ProgressFillSprite(tone).
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace ViaHeOnline
{
    public class UiProgressBar : MonoBehaviour
    {
        public Image Track { get; private set; }
        public Image Fill { get; private set; }
        public RectTransform FillRect { get; private set; }
        public TextMeshProUGUI Label { get; private set; }
        public Theme.ProgressTone Tone { get; private set; } = Theme.ProgressTone.Green;

        public float Value { get; private set; } // 0..1
        float _targetValue;
        float _fillWidth;

        public static UiProgressBar Create(Transform parent, float width = 200f, float height = Theme.ProgressHeight,
            Theme.ProgressTone tone = Theme.ProgressTone.Green, bool showLabel = true)
        {
            var go = Ui.Rect("ProgressBar", parent);
            go.sizeDelta = new Vector2(width, height);

            var bar = go.gameObject.AddComponent<UiProgressBar>();
            bar.Tone = tone;

            bar.Track = Ui.Img(go, "Track", Theme.ProgressTrackSprite());
            Ui.Stretch(bar.Track.rectTransform);

            // Container for masked or sliced fill
            var fillArea = Ui.Rect("FillArea", go);
            Ui.Stretch(fillArea, 2f, 2f, 2f, 2f);

            var fillImg = Ui.Img(fillArea, "Fill", Theme.ProgressFillSprite(tone));
            bar.Fill = fillImg;
            bar.FillRect = fillImg.rectTransform;
            bar.FillRect.anchorMin = new Vector2(0f, 0f);
            bar.FillRect.anchorMax = new Vector2(0f, 1f);
            bar.FillRect.pivot = new Vector2(0f, 0.5f);
            bar.FillRect.anchoredPosition = Vector2.zero;

            if (showLabel)
            {
                bar.Label = Ui.Label(go, "", Theme.TextXs, Theme.TextOnDark,
                    TextAlignmentOptions.Midline, Ui.Edge.Thin, name: "Label");
                Ui.Stretch(bar.Label.rectTransform);
            }

            bar.SetValue(0f, animate: false);
            return bar;
        }

        public void SetTone(Theme.ProgressTone tone)
        {
            Tone = tone;
            Ui.SetSprite(Fill, Theme.ProgressFillSprite(tone));
        }

        public void SetValue(float progress, bool animate = true)
        {
            progress = Mathf.Clamp01(progress);
            _targetValue = progress;
            if (!animate)
            {
                Value = progress;
                ApplyFill(progress);
                enabled = false;
            }
            else
            {
                enabled = true;
            }
        }

        public void SetProgress(long current, long max, string format = "{0}/{1}", bool animate = true)
        {
            float p = max > 0 ? Mathf.Clamp01((float)current / max) : 0f;
            SetValue(p, animate);
            if (Label)
            {
                Label.text = string.Format(format, Ui.Number(current), Ui.Number(max));
            }
        }

        void ApplyFill(float t)
        {
            var fillArea = FillRect.parent as RectTransform;
            float totalWidth = fillArea ? fillArea.rect.width : 200f;
            FillRect.sizeDelta = new Vector2(totalWidth * t, 0f);
            Fill.enabled = t > 0.02f;
        }

        void Update()
        {
            Value = Mathf.MoveTowards(Value, _targetValue, Time.unscaledDeltaTime * 2.5f);
            ApplyFill(Value);
            if (Mathf.Approximately(Value, _targetValue))
            {
                Value = _targetValue;
                ApplyFill(Value);
                enabled = false;
            }
        }
    }
}
