// Main game controller: boots itself when Play is pressed (no scene setup needed),
// login screen, HUD, network sync, character creator and scene event wiring.
// All player-facing text stays Vietnamese (see CLAUDE.md).
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using TMPro;
using UnityEngine;
using UnityEngine.UI;
using ViaHeOnline.Schema;

namespace ViaHeOnline
{
    public class Game : MonoBehaviour
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Boot()
        {
            if (FindAnyObjectByType<Game>()) return;
            new GameObject("Game").AddComponent<Game>();
        }

        Network _net;
        StreetScene _scene;
        Camera _cam;
        GameObject _loginView;
        TMP_InputField _nameInput, _serverInput, _codeInput;
        TextMeshProUGUI _statusLabel;
        UiTextButton _loginButton;
        Hud _hud;

        void Start()
        {
            Screen.orientation = ScreenOrientation.LandscapeLeft;
            Application.targetFrameRate = 60;

            _cam = Camera.main;
            if (!_cam)
            {
                var camGo = new GameObject("Main Camera");
                _cam = camGo.AddComponent<Camera>();
                camGo.tag = "MainCamera";
            }
            if (!_cam.GetComponent<AudioListener>()) _cam.gameObject.AddComponent<AudioListener>();
            _cam.orthographic = true;
            _cam.orthographicSize = 3.6f;
            _cam.clearFlags = CameraClearFlags.SolidColor;
            _cam.backgroundColor = Draw.Hex("#5ec2f2");
            _cam.transform.position = new Vector3(6f, StreetScene.CameraY, -10f);

            UiRoot.Ensure();

            var sceneGo = new GameObject("StreetScene");
            _scene = sceneGo.AddComponent<StreetScene>();
            _scene.Init(_net, _cam);

            _scene.OnOwnStallTapped += (stall) => StallModal.ShowClose(_net, stall);
            _scene.OnLotTapped += (index) => UiToast.Show($"Ô đất số {index}");
            _scene.OnObjectAction += (action) =>
            {
                switch (action)
                {
                    case StreetAction.Staff: StaffModal.Show(_net); break;
                    case StreetAction.Shop: ShopModal.Show(_net); break;
                    case StreetAction.Wardrobe: WardrobeModal.Show(_net); break;
                    case StreetAction.Bus: BusModal.Show(_net, (ownerId, dist) => _ = JoinStreet(ownerId, dist)); break;
                }
            };

            ShowLogin();
            if (SkipLoginScreen)
            {
                // Log in straight away with the saved name and server; the login
                // screen comes back only if that fails.
                _loginView.SetActive(false);
                OnLoginClicked();
            }
        }

        // ---------- Login Screen ----------

        // TEMPORARY: skip the login screen during development. Set to false to bring it back.
        const bool SkipLoginScreen = true;

        void ShowLogin()
        {
            var root = UiRoot.Instance.ScreenLayer;
            _loginView = Ui.Stretch(Ui.Rect("LoginScreen", root)).gameObject;

            // City backdrop in lower half
            if (SpriteLibrary.Has("bg_city"))
            {
                var bg = Ui.Img(_loginView.transform, "CityBg", "bg_city");
                bg.rectTransform.anchorMin = new Vector2(0f, 0f);
                bg.rectTransform.anchorMax = new Vector2(1f, 0.45f);
                bg.rectTransform.offsetMin = bg.rectTransform.offsetMax = Vector2.zero;
            }

            // Centered login panel
            var panelRt = Ui.Place(Ui.Rect("Panel", _loginView.transform), Ui.Center, new Vector2(520f, 560f), Vector2.zero);
            var panelImg = panelRt.gameObject.AddComponent<Image>();
            Ui.SetSprite(panelImg, Theme.PanelSprite(Theme.Skin.Blue));

            // Title plate
            var plate = Ui.Img(panelRt, "TitlePlate", Theme.TitlePlateSprite());
            Ui.Place(plate.rectTransform, Ui.TopCenter, new Vector2(360f, 60f), new Vector2(0f, Theme.TitleOverhang - 30f), Ui.Center);
            var title = Ui.Label(plate.transform, "VỈA HÈ ONLINE", Theme.TextXl, Theme.Gold,
                TextAlignmentOptions.Midline, Ui.Edge.Thick, name: "Title");
            Ui.Stretch(title.rectTransform);

            // Form container
            var form = Ui.Rect("Form", panelRt);
            Ui.Stretch(form, 40f, 30f, 40f, 50f);
            var v = form.gameObject.AddComponent<VerticalLayoutGroup>();
            v.spacing = 10f;
            v.childControlWidth = true;
            v.childControlHeight = false;
            v.childForceExpandWidth = true;
            v.childForceExpandHeight = false;

            Ui.Label(form, "Tên của bạn", Theme.TextMd, Theme.TextDark);
            _nameInput = CreateInput(form, "Nhập tên...", PlayerPrefs.GetString("name", ""));

            Ui.Label(form, "Máy chủ", Theme.TextMd, Theme.TextDark);
            string serverAddr = PlayerPrefs.GetString("serverAddress", Network.ServerAddress);
            _serverInput = CreateInput(form, "ws://...", serverAddr);

            Ui.Label(form, "Mã khôi phục (khi đổi máy)", Theme.TextMd, Theme.TextDark);
            _codeInput = CreateInput(form, "Bỏ trống nếu chơi mới", "");

            _statusLabel = Ui.Label(form, "", Theme.TextSm, Theme.FigureCost);
            _statusLabel.rectTransform.sizeDelta = new Vector2(0f, 24f);

            var btnRt = Ui.Rect("LoginButtonHolder", form);
            btnRt.sizeDelta = new Vector2(0f, Theme.ButtonHeight);
            _loginButton = UiTextButton.Create(btnRt, "VÀO PHỐ", Theme.Btn.Green);
            Ui.Stretch(_loginButton.Rect);
            _loginButton.Clicked += OnLoginClicked;
        }

        static TMP_InputField CreateInput(Transform parent, string placeholder, string value)
        {
            var rt = Ui.Rect("Input", parent);
            rt.sizeDelta = new Vector2(0f, 50f);
            var bg = rt.gameObject.AddComponent<Image>();
            Ui.SetSprite(bg, Theme.RowSprite());
            bg.raycastTarget = true;

            var textArea = Ui.Rect("TextArea", rt);
            Ui.Stretch(textArea, Theme.Space3, Theme.Space2, Theme.Space3, Theme.Space2);
            textArea.gameObject.AddComponent<RectMask2D>();

            var text = Ui.Rect("Text", textArea).gameObject.AddComponent<TextMeshProUGUI>();
            var font = UiFont.Asset;
            if (font != null) text.font = font;
            text.fontSize = Theme.TextMd;
            text.color = Theme.TextDark;
            text.alignment = TextAlignmentOptions.MidlineLeft;
            text.richText = false;
            Ui.Stretch(text.rectTransform);

            var ph = Ui.Rect("Placeholder", textArea).gameObject.AddComponent<TextMeshProUGUI>();
            if (font != null) ph.font = font;
            ph.fontSize = Theme.TextMd;
            ph.color = Theme.TextMuted;
            ph.alignment = TextAlignmentOptions.MidlineLeft;
            ph.text = placeholder ?? "";
            Ui.Stretch(ph.rectTransform);

            var input = rt.gameObject.AddComponent<TMP_InputField>();
            input.textViewport = textArea;
            input.textComponent = text;
            input.placeholder = ph;
            if (font != null) input.fontAsset = font;
            input.text = value ?? "";
            return input;
        }

        async void OnLoginClicked()
        {
            if (_loginButton != null) _loginButton.Interactable = false;
            if (_statusLabel != null) _statusLabel.text = "Đang kết nối...";

            try
            {
                string server = _serverInput.text.Trim();
                PlayerPrefs.SetString("serverAddress", server);
                Network.ServerAddress = server;

                _net = new Network();
                _scene.Init(_net, _cam);

                string name = _nameInput.text.Trim();
                string code = _codeInput.text.Trim();
                if (!string.IsNullOrEmpty(code))
                {
                    await _net.Recover(code);
                }
                else
                {
                    await _net.Login(name);
                }
                var acc = _net.Account;

                if (acc != null)
                {
                    PlayerPrefs.SetString("name", acc.name);
                }

                if (_loginView) _loginView.SetActive(false);
                await StartPlaying();
            }
            catch (Exception ex)
            {
                if (_loginView) _loginView.SetActive(true);
                if (_statusLabel != null) _statusLabel.text = "Không vào được: " + ex.Message;
                if (_loginButton != null) _loginButton.Interactable = true;
            }
        }

        async Task StartPlaying()
        {
            _net.OnIncome += (amount) =>
            {
                UiToast.Show(amount > 0 ? $"Thu được {Network.Money(amount)} từ cửa hàng" : "Cửa hàng chưa có tiền để thu");
            };

            _net.OnOrderDone += (reward) =>
            {
                SoundFx.LevelUp();
                UiToast.Show($"Giao đủ đơn hàng! Thưởng {Network.Money(reward)}", Theme.ToastTone.Success);
            };

            _net.OnLevelUp += (m) =>
            {
                if (_net.Account != null && m.id == _net.Account.id) SoundFx.LevelUp();
                UiToast.Show(_net.Account != null && m.id == _net.Account.id
                    ? $"Chúc mừng! Bạn lên cấp {m.level}"
                    : $"{m.name} lên cấp {m.level}", Theme.ToastTone.Success);
            };

            _net.OnError += (text) =>
            {
                SoundFx.Error();
                UiToast.Show(text, Theme.ToastTone.Error);
            };

            _net.OnRoomLeft += () =>
            {
                UiToast.Show("Mất kết nối với phố. Bấm Về nhà để vào lại.", Theme.ToastTone.Warning);
            };

            _net.OnProfileChanged += (p) =>
            {
                if (_hud != null) _hud.Refresh(p, _net.Room?.State);
            };

            await JoinStreet(null);
            await AskForCharacter();
            BuildHud();
        }

        async Task AskForCharacter()
        {
            for (int i = 0; i < 40 && _net.Profile == null; i++) await Task.Delay(50);
            if (_net.Profile == null || _net.Profile.appearance != null) return;

            var tcs = new TaskCompletionSource<bool>();
            CharacterCreator.Show(_net.Catalog?.lookOptions, (msg) =>
            {
                _net.Send("createCharacter", msg);
                tcs.TrySetResult(true);
            });
            await tcs.Task;
        }

        void BuildHud()
        {
            if (_hud != null) return;
            _hud = Hud.Create(UiRoot.Instance.ScreenLayer, _net);

            _hud.OnHomeClicked += () => _ = JoinStreet(null);
            _hud.OnDistrictSelected += (d) => _ = JoinStreet(null, d);
            _hud.OnStallClicked += () => StallModal.Show(_net, _net?.Room?.State, -1);
            _hud.OnStaffClicked += () => StaffModal.Show(_net);
            _hud.OnWardrobeClicked += () => WardrobeModal.Show(_net);
            _hud.OnShopClicked += () => ShopModal.Show(_net);
            _hud.OnMarketClicked += () => MarketModal.Show(_net);
            _hud.OnLogClicked += () => LogModal.Show(_net);
            _hud.OnBusClicked += () => BusModal.Show(_net, (ownerId, dist) => _ = JoinStreet(ownerId, dist));
            _hud.OnMenuClicked += () => _hud.ShowMoreMenu();

            if (_net.Profile != null)
            {
                _hud.Refresh(_net.Profile, _net.Room?.State);
            }
        }

        async Task JoinStreet(string ownerId, int district = 0)
        {
            await _net.JoinStreet(ownerId, district);
            var room = _net.Room;
            if (room != null)
            {
                room.OnStateChange += (st, isFirst) =>
                {
                    if (_scene) _scene.Sync(st);
                    if (_hud != null) _hud.RefreshStreet(st);
                };
                if (room.State != null)
                {
                    if (_scene) _scene.Sync(room.State);
                    if (_hud != null) _hud.RefreshStreet(room.State);
                }
            }
        }

        void OnDestroy()
        {
            if (_net != null)
            {
                _ = _net.Leave();
            }
        }
    }
}
