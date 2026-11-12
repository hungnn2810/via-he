// Server connection: guest login, joining a street (Colyseus room), sending commands, receiving the private profile.
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Colyseus;
using ViaHeOnline.Schema;
using UnityEngine;

namespace ViaHeOnline
{
    public class Network
    {
        // Change this when the server goes online (e.g. wss://street.example.com)
        public static string ServerAddress = "ws://localhost:2567";

        public Client Client { get; private set; }
        public Room<StreetState> Room { get; private set; }
        public LoginResult Account { get; private set; }
        public Profile Profile { get; private set; }
        public Catalog Catalog { get; private set; }

        float _profileReceivedAt;

        // Server clock in milliseconds, estimated from the last profile message
        public long ServerNow => Profile == null ? 0 : Profile.serverTime + (long)((Time.realtimeSinceStartup - _profileReceivedAt) * 1000);

        public event Action<Profile> OnProfileChanged;
        public event Action<string> OnError;
        public event Action<SaleMessage> OnSale;
        public event Action<LevelUpMessage> OnLevelUp;
        public event Action<InviteMessage> OnInvite;
        public event Action OnRoomLeft;
        public event Action<long> OnIncome;
        public event Action<long> OnOrderDone;
        public event Action<RegularSaleMessage> OnRegularSale;
        public event Action<FortuneMessage> OnFortune;
        public event Action<FortuneSharedMessage> OnFortuneShared;
        public event Action<SeasonMessage> OnSeason;
        public event Action<SeasonQuestDoneMessage> OnSeasonQuestDone;
        public event Action<SharedOrderGivenMessage> OnSharedOrderGiven;
        public event Action<SharedOrderClaimedMessage> OnSharedOrderClaimed;
        public event Action<EmoteMessage> OnEmote;
        public event Action<CafeSeatsMessage> OnCafeSeats;

        public Network()
        {
            if (PlayerPrefs.HasKey("serverAddress")) ServerAddress = PlayerPrefs.GetString("serverAddress");
            Client = new Client(ServerAddress);
        }

        public static string DeviceId
        {
            get
            {
                var id = PlayerPrefs.GetString("deviceId", "");
                if (id.Length < 8)
                {
                    id = Guid.NewGuid().ToString("N");
                    PlayerPrefs.SetString("deviceId", id);
                    PlayerPrefs.Save();
                }
                return id;
            }
        }

        public async Task Login(string name)
        {
            Account = await Client.Http.Post<LoginResult>("api/login", new Dictionary<string, object>
            {
                ["deviceId"] = DeviceId,
                ["name"] = name,
            });
            PlayerPrefs.SetString("name", Account.name);
            PlayerPrefs.Save();
        }

        // Move an account to this device
        public async Task Recover(string code)
        {
            Account = await Client.Http.Post<LoginResult>("api/recover", new Dictionary<string, object>
            {
                ["deviceId"] = DeviceId,
                ["code"] = code,
            });
            PlayerPrefs.SetString("name", Account.name);
            PlayerPrefs.Save();
        }

        public async Task<List<PlayerOrderInfo>> GetPlayerOrders() => await Room.Request<List<PlayerOrderInfo>>("playerOrders");
        public async Task<MarketPricesResult> GetMarketPrices() => await Room.Request<MarketPricesResult>("marketPrices");
        public async Task<SharedOrderResult> GetSharedOrder() => await Room.Request<SharedOrderResult>("sharedOrder");

        public async Task<Leaderboard> GetLeaderboard() => await Client.Http.Get<Leaderboard>("api/leaderboard");

        public async Task<List<StreetSummary>> ListStreets()
        {
            return await Client.Http.Get<List<StreetSummary>>("api/streets?token=" + Uri.EscapeDataString(Account.token));
        }

        // Public districts with the shard a new visitor should join
        public async Task<List<StreetSummary>> ListPublicDistricts()
        {
            return await Client.Http.Get<List<StreetSummary>>("api/public?token=" + Uri.EscapeDataString(Account.token));
        }

        // Join someone's street (your own by default). shard is only used by public districts (see ListPublicDistricts).
        public async Task JoinStreet(string ownerId = null, int district = 0, int shard = -1)
        {
            if (Room != null)
            {
                var old = Room;
                Room = null;
                await old.Leave();
            }
            var options = new Dictionary<string, object>
            {
                ["token"] = Account.token,
                ["ownerId"] = ownerId ?? Account.id,
                ["district"] = district,
            };
            if (shard >= 0) options["shard"] = shard;
            Room = await Client.JoinOrCreate<StreetState>("street", options);
            var room = Room;
            room.OnMessage<Profile>("profile", p => { Profile = p; _profileReceivedAt = Time.realtimeSinceStartup; OnProfileChanged?.Invoke(p); });
            room.OnMessage<ErrorMessage>("error", m => OnError?.Invoke(m.text));
            room.OnMessage<SaleMessage>("sale", m => OnSale?.Invoke(m));
            room.OnMessage<LevelUpMessage>("levelUp", m => OnLevelUp?.Invoke(m));
            room.OnMessage<InviteMessage>("inviteCustomer", m => OnInvite?.Invoke(m));
            room.OnMessage<IncomeMessage>("income", m => OnIncome?.Invoke(m.amount));
            room.OnMessage<OrderDoneMessage>("orderDone", m => OnOrderDone?.Invoke(m.reward));
            room.OnMessage<RegularSaleMessage>("regularSale", m => OnRegularSale?.Invoke(m));
            room.OnMessage<FortuneMessage>("fortune", m => OnFortune?.Invoke(m));
            room.OnMessage<FortuneSharedMessage>("fortuneShared", m => OnFortuneShared?.Invoke(m));
            room.OnMessage<SeasonMessage>("season", m => OnSeason?.Invoke(m));
            room.OnMessage<SeasonQuestDoneMessage>("seasonQuestDone", m => OnSeasonQuestDone?.Invoke(m));
            room.OnMessage<SharedOrderGivenMessage>("sharedOrderGiven", m => OnSharedOrderGiven?.Invoke(m));
            room.OnMessage<SharedOrderClaimedMessage>("sharedOrderClaimed", m => OnSharedOrderClaimed?.Invoke(m));
            room.OnMessage<EmoteMessage>("emote", m => OnEmote?.Invoke(m));
            room.OnMessage<CafeSeatsMessage>("cafeSeats", m => OnCafeSeats?.Invoke(m));
            room.OnLeave += _ => { if (Room == room) { Room = null; OnRoomLeft?.Invoke(); } };
            if (Catalog == null) Catalog = await room.Request<Catalog>("catalog");
        }

        public async Task Leave()
        {
            if (Room != null)
            {
                var r = Room;
                Room = null;
                await r.Leave();
            }
        }

        public void Send(string type, Dictionary<string, object> payload = null)
        {
            if (Room == null) return;
            _ = Room.Send(type, payload ?? new Dictionary<string, object>());
        }

        public Product GetProduct(string id) => Catalog?.products.Find(p => p.id == id);
        public Wearable GetWearable(string id) => Catalog?.wearables.Find(w => w.id == id);

        public static string Money(long amount) => amount.ToString("#,0").Replace(',', '.') + "đ";
    }
}
