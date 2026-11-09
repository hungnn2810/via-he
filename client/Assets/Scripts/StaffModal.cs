// Staff modal: managing hired employees (assigning gardener, firing) and recruiting candidates.
// All player-facing copy is in Vietnamese.
using System;
using System.Collections.Generic;
using TMPro;
using UnityEngine;
using UnityEngine.UI;

namespace ViaHeOnline
{
    public class StaffModal : UiModal
    {
        Network _net;
        RectTransform _content;

        public static StaffModal Show(Network net)
        {
            if (net == null || net.Profile == null) return null;

            var modal = MakeModal<StaffModal>("Nhân viên", new Vector2(780f, 560f), Theme.Skin.Amber, closable: true);
            modal._net = net;
            modal.Build();
            modal.Open();
            return modal;
        }

        static string TraitName(string trait) => trait switch
        {
            "quick" => "Nhanh nhảu",
            "smooth" => "Dẻo miệng",
            "gardener" => "Chăm chỉ",
            "gossip" => "Hay buôn chuyện",
            _ => "Bình thường"
        };

        static long Wage(Employee e) => 5000L + (e.charm + e.skill + e.strength) * 100L;

        void Build()
        {
            var p = _net.Profile;

            // Top Summary Banner in cream board
            var banner = Ui.Img(Body, "SummaryBanner", Theme.BoardCreamSprite());
            banner.rectTransform.anchorMin = new Vector2(0f, 1f);
            banner.rectTransform.anchorMax = new Vector2(1f, 1f);
            banner.rectTransform.offsetMin = new Vector2(Theme.Space3, -56f);
            banner.rectTransform.offsetMax = new Vector2(-Theme.Space3, -Theme.Space1);

            string summary = $"Đã thuê {p.employees.Count}/{p.maxEmployees}. Đẹp: hút khách · Khéo: bán nhanh · Khỏe: chở nhiều hàng. Nhân viên đứng sạp vẫn bán khi bạn rời phố. Lương trả mỗi ngày.";
            var summaryLabel = Ui.Label(banner.transform, summary, Theme.TextXs, Theme.TextDark,
                TextAlignmentOptions.Midline, Ui.Edge.None, wrap: true);
            Ui.Stretch(summaryLabel.rectTransform, Theme.Space3, Theme.Space1, Theme.Space3, Theme.Space1);

            // Scrollable list container
            var scrollGo = Ui.Rect("ScrollList", Body);
            Ui.Stretch(scrollGo, Theme.Space3, Theme.Space2, Theme.Space3, 64f);

            var scroll = scrollGo.gameObject.AddComponent<ScrollRect>();
            scroll.horizontal = false;
            scroll.vertical = true;
            scroll.scrollSensitivity = 25f;

            var viewport = Ui.Rect("Viewport", scrollGo);
            Ui.Stretch(viewport, 0, 0, 10f, 0);
            viewport.gameObject.AddComponent<RectMask2D>();
            scroll.viewport = viewport;

            var content = Ui.Rect("Content", viewport);
            content.anchorMin = new Vector2(0f, 1f);
            content.anchorMax = new Vector2(1f, 1f);
            content.pivot = new Vector2(0.5f, 1f);
            content.offsetMin = content.offsetMax = Vector2.zero;
            scroll.content = content;

            var vlg = content.gameObject.AddComponent<VerticalLayoutGroup>();
            vlg.spacing = Theme.Space2;
            vlg.childControlWidth = true;
            vlg.childControlHeight = false;
            vlg.childForceExpandWidth = true;

            var csf = content.gameObject.AddComponent<ContentSizeFitter>();
            csf.verticalFit = ContentSizeFitter.FitMode.PreferredSize;

            _content = content;

            RefreshList();

            // Footer
            AddButton("Đóng", Theme.Btn.Blue, () => Close(), closesWindow: true);
        }

        void RefreshList()
        {
            if (_content == null) return;
            foreach (Transform child in _content) Destroy(child.gameObject);

            var p = _net.Profile;

            // Section 1: Hired Employees
            if (p.employees != null && p.employees.Count > 0)
            {
                foreach (var emp in p.employees)
                {
                    CreateHiredEmployeeRow(_content, emp);
                }
            }
            else
            {
                var emptyCard = Ui.Rect("EmptyNotice", _content);
                emptyCard.sizeDelta = new Vector2(0f, 40f);
                Ui.Label(emptyCard, "Chưa thuê nhân viên nào. Hãy tuyển ứng viên bên dưới!", Theme.TextSm, Theme.TextMuted, TextAlignmentOptions.Midline);
            }

            // Section 2: Candidate Header
            var candHeader = Ui.Rect("CandidateHeader", _content);
            candHeader.sizeDelta = new Vector2(0f, 36f);
            Ui.Label(candHeader, "Người xin việc", Theme.TextMd, Theme.TextDark, TextAlignmentOptions.MidlineLeft);

            // Section 2: Candidates
            if (p.candidates != null && p.candidates.Count > 0)
            {
                foreach (var cand in p.candidates)
                {
                    CreateCandidateRow(_content, cand);
                }
            }
            else
            {
                var emptyCand = Ui.Rect("EmptyCand", _content);
                emptyCand.sizeDelta = new Vector2(0f, 40f);
                Ui.Label(emptyCand, "Hôm nay chưa có người xin việc mới.", Theme.TextSm, Theme.TextMuted, TextAlignmentOptions.Midline);
            }
        }

        void CreateHiredEmployeeRow(Transform parent, Employee emp)
        {
            var p = _net.Profile;
            var rt = Ui.Rect("Emp_" + emp.id, parent);
            rt.sizeDelta = new Vector2(0f, 68f);

            var bg = rt.gameObject.AddComponent<Image>();
            Ui.SetSprite(bg, Theme.RowSprite());

            // Avatar / Icon
            var icon = Ui.Img(rt, "Icon", "icon_staff");
            Ui.Place(icon.rectTransform, Ui.MiddleLeft, new Vector2(48f, 48f), new Vector2(Theme.Space2, 0f), Ui.MiddleLeft);

            // Labels
            var labelBox = Ui.Rect("Labels", rt);
            Ui.Place(labelBox, Ui.MiddleLeft, new Vector2(360f, 52f), new Vector2(64f, 0f), Ui.MiddleLeft);
            var v = labelBox.gameObject.AddComponent<VerticalLayoutGroup>();
            v.spacing = 2f;
            v.childControlWidth = true;
            v.childControlHeight = false;
            v.childForceExpandWidth = true;

            string title = $"{emp.name} ({TraitName(emp.trait)})";
            Ui.Label(labelBox, title, Theme.TextMd, Theme.TextDark);

            string stats = $"Đẹp {emp.charm} · Khéo {emp.skill} · Khỏe {emp.strength} · Lương {Network.Money(Wage(emp))}";
            Ui.Label(labelBox, stats, Theme.TextSm, Theme.TextMuted);

            // Action Buttons
            var btnBox = Ui.Rect("Actions", rt);
            Ui.Place(btnBox, Ui.MiddleRight, new Vector2(120f, 44f), new Vector2(-Theme.Space2, 0f), Ui.MiddleRight);

            var fireBtn = UiTextButton.Create(btnBox, "Cho nghỉ", Theme.Btn.Red);
            Ui.Stretch(fireBtn.Rect);
            fireBtn.Clicked += () =>
            {
                UiConfirm.Show("Cho nghỉ việc", $"Bạn có chắc muốn cho nhân viên {emp.name} nghỉ việc?", () =>
                {
                    _net.Send("fire", new Dictionary<string, object> { ["employeeId"] = emp.id });
                    p.employees.Remove(emp);
                    RefreshList();
                });
            };
        }

        void CreateCandidateRow(Transform parent, Employee cand)
        {
            var p = _net.Profile;
            var rt = Ui.Rect("Cand_" + cand.id, parent);
            rt.sizeDelta = new Vector2(0f, 68f);

            var bg = rt.gameObject.AddComponent<Image>();
            Ui.SetSprite(bg, Theme.RowSprite());

            // Icon
            var icon = Ui.Img(rt, "Icon", "icon_staff");
            Ui.Place(icon.rectTransform, Ui.MiddleLeft, new Vector2(48f, 48f), new Vector2(Theme.Space2, 0f), Ui.MiddleLeft);

            // Labels
            var labelBox = Ui.Rect("Labels", rt);
            Ui.Place(labelBox, Ui.MiddleLeft, new Vector2(380f, 52f), new Vector2(64f, 0f), Ui.MiddleLeft);
            var v = labelBox.gameObject.AddComponent<VerticalLayoutGroup>();
            v.spacing = 2f;
            v.childControlWidth = true;
            v.childControlHeight = false;
            v.childForceExpandWidth = true;

            string title = $"{cand.name} ({TraitName(cand.trait)})";
            Ui.Label(labelBox, title, Theme.TextMd, Theme.TextDark);

            string stats = $"Đẹp {cand.charm} · Khéo {cand.skill} · Khỏe {cand.strength}";
            Ui.Label(labelBox, stats, Theme.TextSm, Theme.TextMuted);

            // Hire Button
            var hireBtn = UiTextButton.Create(rt, $"Thuê {Network.Money(cand.hireCost)}", Theme.Btn.Green);
            Ui.Place(hireBtn.Rect, Ui.MiddleRight, new Vector2(160f, 44f), new Vector2(-Theme.Space2, 0f), Ui.MiddleRight);
            hireBtn.Clicked += () =>
            {
                if (p.employees.Count >= p.maxEmployees)
                {
                    UiToast.Show("Đã đủ số lượng nhân viên tối đa", Theme.ToastTone.Warning);
                    return;
                }
                if (p.money < cand.hireCost)
                {
                    UiToast.Show("Không đủ tiền thuê", Theme.ToastTone.Warning);
                    return;
                }
                _net.Send("hire", new Dictionary<string, object> { ["candidateId"] = cand.id });
                UiToast.Show($"Đã thuê {cand.name}!", Theme.ToastTone.Success);
                p.candidates.Remove(cand);
                RefreshList();
            };
        }
    }
}
