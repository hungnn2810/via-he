// Tab strip for switching between pages or categories (e.g. Wardrobe, Leaderboard, Shop tabs).
// Uses TabSprite(on/off) from Theme, plays sound on select, and updates tab visual states.
using System;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace ViaHeOnline
{
    public class UiTabBar : MonoBehaviour
    {
        public class TabItem
        {
            public int Index;
            public string Label;
            public RectTransform Rect;
            public Image Background;
            public TextMeshProUGUI Text;
            public UiBadge Badge;
        }

        readonly List<TabItem> _tabs = new List<TabItem>();
        public int SelectedIndex { get; private set; } = -1;
        public event Action<int> OnTabSelected;

        public static UiTabBar Create(Transform parent, string[] labels, Action<int> onSelect = null,
            float tabWidth = 100f, float height = Theme.TabHeight)
        {
            var go = Ui.Rect("TabBar", parent);
            var bar = go.gameObject.AddComponent<UiTabBar>();
            if (onSelect != null) bar.OnTabSelected += onSelect;

            int count = labels.Length;
            float totalWidth = count * tabWidth + (count - 1) * Theme.Space2;
            go.sizeDelta = new Vector2(totalWidth, height);

            for (int i = 0; i < count; i++)
            {
                int index = i;
                float x = -totalWidth * 0.5f + tabWidth * 0.5f + i * (tabWidth + Theme.Space2);

                var tabGo = Ui.Rect("Tab:" + labels[i], go);
                Ui.Place(tabGo, Ui.Center, new Vector2(tabWidth, height), new Vector2(x, 0f));

                var bg = Ui.Img(tabGo, "Background", Theme.TabSprite(false), true);
                Ui.Stretch(bg.rectTransform);

                var txt = Ui.Label(tabGo, labels[i], Theme.TextSm, Theme.TextDark,
                    TextAlignmentOptions.Midline, Ui.Edge.Thin, name: "Label");
                Ui.Stretch(txt.rectTransform, Theme.Space2, 0, Theme.Space2, 0);

                var item = new TabItem
                {
                    Index = index,
                    Label = labels[i],
                    Rect = tabGo,
                    Background = bg,
                    Text = txt,
                };

                Ui.OnTap(bg, () => bar.Select(index));
                bar._tabs.Add(item);
            }

            if (count > 0) bar.Select(0, notify: false);
            return bar;
        }

        public void Select(int index, bool notify = true)
        {
            if (index < 0 || index >= _tabs.Count) return;
            if (SelectedIndex == index) return;

            SelectedIndex = index;
            SoundFx.Tap();

            for (int i = 0; i < _tabs.Count; i++)
            {
                bool active = i == index;
                Ui.SetSprite(_tabs[i].Background, Theme.TabSprite(active));
                _tabs[i].Text.color = active ? Theme.TextDark : Theme.TextMuted;
                Ui.SetEdge(_tabs[i].Text, active ? Ui.Edge.Thin : Ui.Edge.None);
            }

            if (notify) OnTabSelected?.Invoke(index);
        }

        public void SetBadge(int index, int count)
        {
            if (index < 0 || index >= _tabs.Count) return;
            var tab = _tabs[index];
            if (count > 0)
            {
                if (tab.Badge == null)
                {
                    tab.Badge = UiBadge.Create(tab.Rect, count);
                    Ui.Place(tab.Badge.Rect, Ui.TopRight, new Vector2(28f, Theme.BadgeHeight), new Vector2(-2f, 2f), Ui.TopRight);
                }
                else
                {
                    tab.Badge.SetCount(count);
                }
            }
            else if (tab.Badge != null)
            {
                tab.Badge.gameObject.SetActive(false);
            }
        }
    }
}
