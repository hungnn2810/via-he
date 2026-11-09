// Base for anything that opens and closes: full screens, modals and sheets.
// Fades through a CanvasGroup on unscaled time, so windows still animate while the game is paused.
using System;
using UnityEngine;

namespace ViaHeOnline
{
    public abstract class UiLayer : MonoBehaviour
    {
        const float DefaultDuration = 0.16f;

        CanvasGroup _group;
        float _progress;
        float _target;
        Action _afterAnimation;

        public bool IsOpen { get; private set; }
        public float Duration { get; set; } = DefaultDuration;

        protected CanvasGroup Group
        {
            get
            {
                if (!_group && !TryGetComponent(out _group)) _group = gameObject.AddComponent<CanvasGroup>();
                return _group;
            }
        }

        /// Called every animation step with eased progress in 0..1 (0 closed, 1 open).
        protected virtual void Apply(float eased) => Group.alpha = eased;

        protected virtual void OnOpened() { }
        protected virtual void OnClosed() { }

        public void Open(bool animate = true)
        {
            if (IsOpen) return;
            IsOpen = true;
            gameObject.SetActive(true);
            transform.SetAsLastSibling();
            Group.interactable = true;
            Group.blocksRaycasts = true;
            // Draw the starting frame now so nothing flashes at full opacity before the first Update
            Apply(Ease(_progress));
            if (!animate) { _progress = 1; Apply(1); FinishAnimation(); }
            else Animate(1, null);
            OnOpened();
        }

        public void Close(bool animate = true)
        {
            if (!IsOpen) return;
            IsOpen = false;
            // Stop taps the moment closing starts, not when the fade ends
            Group.interactable = false;
            Group.blocksRaycasts = false;
            OnClosed();
            if (!animate || !gameObject.activeInHierarchy) { _progress = 0; Apply(0); gameObject.SetActive(false); }
            else Animate(0, () => gameObject.SetActive(false));
        }

        void Animate(float target, Action after)
        {
            _target = target;
            _afterAnimation = after;
            enabled = true;
        }

        void FinishAnimation()
        {
            enabled = false;
            var after = _afterAnimation;
            _afterAnimation = null;
            after?.Invoke();
        }

        protected virtual void Awake()
        {
            // Layers are built closed; Open() wakes them. Nothing to draw yet, so no Apply here: a subclass
            // builds its children after this runs.
            enabled = false;
        }

        static float Ease(float t) => t * t * (3f - 2f * t);

        void Update()
        {
            _progress = Mathf.MoveTowards(_progress, _target, Time.unscaledDeltaTime / Mathf.Max(0.01f, Duration));
            Apply(Ease(_progress));
            if (Mathf.Approximately(_progress, _target)) FinishAnimation();
        }
    }
}
