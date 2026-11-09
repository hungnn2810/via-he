// High-performance virtualized scrolling list view with row pooling.
// Reuses a small pool of instantiated row objects based on viewport visibility,
// completely eliminating ContentSizeFitter and GC spikes during list rebuilds and scrolling.
using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace ViaHeOnline
{
    public class UiListView : MonoBehaviour
    {
        public ScrollRect ScrollRect { get; private set; }
        public RectTransform Viewport { get; private set; }
        public RectTransform Content { get; private set; }
        public Scrollbar Scrollbar { get; private set; }

        public float RowHeight { get; set; } = Theme.RowHeight;
        public float Spacing { get; set; } = Theme.Space2;
        public float PaddingTop { get; set; } = Theme.Space2;
        public float PaddingBottom { get; set; } = Theme.Space2;
        public float PaddingLeft { get; set; } = Theme.Space2;
        public float PaddingRight { get; set; } = Theme.Space2;

        public int ItemCount { get; private set; }

        Func<Transform, GameObject> _createRow;
        Action<int, GameObject> _bindRow;

        readonly List<GameObject> _pool = new List<GameObject>();
        readonly Dictionary<int, GameObject> _active = new Dictionary<int, GameObject>();

        public static UiListView Create(Transform parent, float rowHeight = Theme.RowHeight, float spacing = Theme.Space2)
        {
            var go = Ui.Rect("ListView", parent);
            Ui.Stretch(go);

            var list = go.gameObject.AddComponent<UiListView>();
            list.RowHeight = rowHeight;
            list.Spacing = spacing;
            list.Build();
            return list;
        }

        void Build()
        {
            ScrollRect = gameObject.AddComponent<ScrollRect>();
            ScrollRect.horizontal = false;
            ScrollRect.vertical = true;
            ScrollRect.movementType = ScrollRect.MovementType.Clamped;
            ScrollRect.inertia = true;
            ScrollRect.decelerationRate = 0.135f;
            ScrollRect.scrollSensitivity = 28f;

            // Viewport with RectMask2D for GPU clipping without stencil buffer overhead
            var vp = Ui.Rect("Viewport", transform);
            Ui.Stretch(vp, 0, 0, 16f, 0); // leave room for scrollbar
            var mask = vp.gameObject.AddComponent<RectMask2D>();
            Viewport = vp;
            ScrollRect.viewport = Viewport;

            // Content container
            var content = Ui.Rect("Content", Viewport);
            content.anchorMin = new Vector2(0f, 1f);
            content.anchorMax = new Vector2(1f, 1f);
            content.pivot = new Vector2(0f, 1f);
            content.offsetMin = Vector2.zero;
            content.offsetMax = Vector2.zero;
            Content = content;
            ScrollRect.content = Content;

            // Scrollbar on the right
            var barGo = Ui.Rect("Scrollbar", transform);
            Ui.Place(barGo, Ui.MiddleRight, new Vector2(12f, 0f), Vector2.zero, Ui.MiddleRight);
            barGo.anchorMin = new Vector2(1f, 0f);
            barGo.anchorMax = new Vector2(1f, 1f);
            barGo.offsetMin = new Vector2(-14f, Theme.Space2);
            barGo.offsetMax = new Vector2(-2f, -Theme.Space2);

            var track = Ui.Img(barGo, "Track", null);
            track.color = new Color(0, 0, 0, 0.15f);
            Ui.Stretch(track.rectTransform);

            var thumbGo = Ui.Rect("Thumb", barGo);
            var thumb = Ui.Img(thumbGo, "Handle", Theme.ScrollThumbSprite());
            Ui.Stretch(thumb.rectTransform);

            Scrollbar = barGo.gameObject.AddComponent<Scrollbar>();
            Scrollbar.direction = Scrollbar.Direction.BottomToTop;
            Scrollbar.targetGraphic = thumb;
            Scrollbar.handleRect = thumb.rectTransform;
            ScrollRect.verticalScrollbar = Scrollbar;
            ScrollRect.verticalScrollbarVisibility = ScrollRect.ScrollbarVisibility.AutoHideAndExpandViewport;

            ScrollRect.onValueChanged.AddListener(_ => RefreshVisible());
        }

        public void SetItemTemplate(Func<Transform, GameObject> createRow, Action<int, GameObject> bindRow)
        {
            _createRow = createRow;
            _bindRow = bindRow;
        }

        public void SetCount(int count, bool resetScroll = true)
        {
            ItemCount = count;
            float totalHeight = PaddingTop + PaddingBottom + (count > 0 ? count * RowHeight + (count - 1) * Spacing : 0f);
            Content.sizeDelta = new Vector2(0f, totalHeight);

            if (resetScroll)
            {
                ScrollRect.verticalNormalizedPosition = 1f;
                Content.anchoredPosition = Vector2.zero;
            }

            RefreshVisible();
        }

        public void RefreshData()
        {
            foreach (var kv in _active)
            {
                _bindRow?.Invoke(kv.Key, kv.Value);
            }
        }

        void RefreshVisible()
        {
            if (_createRow == null || _bindRow == null || ItemCount == 0)
            {
                RecycleAll();
                return;
            }

            float viewHeight = Viewport.rect.height;
            if (viewHeight <= 0) viewHeight = Theme.WindowSize.y;

            float scrollY = Content.anchoredPosition.y;
            float step = RowHeight + Spacing;

            // Calculate visible range with 1 item buffer above and below
            int firstVisible = Mathf.Max(0, Mathf.FloorToInt((scrollY - PaddingTop) / step) - 1);
            int lastVisible = Mathf.Min(ItemCount - 1, Mathf.CeilToInt((scrollY + viewHeight - PaddingTop) / step) + 1);

            // Recycle items that went out of view
            var toRecycle = new List<int>();
            foreach (var idx in _active.Keys)
            {
                if (idx < firstVisible || idx > lastVisible) toRecycle.Add(idx);
            }
            foreach (var idx in toRecycle)
            {
                RecycleRow(idx);
            }

            // Spawn or update visible items
            for (int i = firstVisible; i <= lastVisible; i++)
            {
                if (!_active.TryGetValue(i, out var rowObj))
                {
                    rowObj = GetOrCreateRow();
                    _active[i] = rowObj;
                    PositionRow(rowObj.transform as RectTransform, i);
                    _bindRow(i, rowObj);
                }
            }
        }

        void PositionRow(RectTransform rt, int index)
        {
            float y = -(PaddingTop + index * (RowHeight + Spacing));
            rt.anchorMin = new Vector2(0f, 1f);
            rt.anchorMax = new Vector2(1f, 1f);
            rt.pivot = new Vector2(0f, 1f);
            rt.sizeDelta = new Vector2(-(PaddingLeft + PaddingRight), RowHeight);
            rt.anchoredPosition = new Vector2(PaddingLeft, y);
        }

        GameObject GetOrCreateRow()
        {
            if (_pool.Count > 0)
            {
                var row = _pool[_pool.Count - 1];
                _pool.RemoveAt(_pool.Count - 1);
                row.SetActive(true);
                return row;
            }
            return _createRow(Content);
        }

        void RecycleRow(int index)
        {
            if (_active.TryGetValue(index, out var rowObj))
            {
                _active.Remove(index);
                rowObj.SetActive(false);
                _pool.Add(rowObj);
            }
        }

        void RecycleAll()
        {
            foreach (var row in _active.Values)
            {
                row.SetActive(false);
                _pool.Add(row);
            }
            _active.Clear();
        }

        void OnDisable()
        {
            RecycleAll();
        }
    }
}
