// Data types received from the server over messages / HTTP (must match server/src/profile.ts and data.ts).
using System.Collections.Generic;

namespace ViaHeOnline
{
    public class Employee
    {
        public string id;
        public string name;
        public int charm;
        public int skill;
        public int strength;
        public string trait; // quick | smooth | gardener | gossip
        public string look;
        public long hireCost; // only set on candidates
        public Dictionary<string, string> outfit = new Dictionary<string, string>();
    }

    public class LogEntry
    {
        public long at;
        public string type; // co_selling | sidewalk_fee | visit | help
        public string who;
        public long amount;
    }

    public class Appearance
    {
        public string gender;
        public int hair;
        public int brows;
        public int lips;
        public int cheeks;
        public int earrings;
    }

    public class District { public int index; }

    public class NeighbourState
    {
        public int points;
        public int quests;
        public int progress;
        public long giftDay;
    }

    public class ProfessionState
    {
        public string id;
        public int rank;
        public int work;
        public long season;
    }

    public class DeliveryOrder
    {
        public string id;
        public string kind;
        public string item;
        public int quantity;
        public long reward;
        public long expiresAt;
    }

    public class Delivery
    {
        public long reward;
        public long doneAt;
    }

    public class DailyTask
    {
        public string id;
        public int progress;
        public int target;
        public bool done;
    }

    public class Daily
    {
        public long day;
        public List<DailyTask> tasks = new List<DailyTask>();
    }

    public class MarketState
    {
        public long debt;
        public long borrowedAt;
        public long creditLockedUntil;
        public long sharedDay;
        public int sharedGiven;
    }

    public class Profile
    {
        public string id;
        public string name;
        public long money;
        public int level;
        public long xp;
        public long xpToLevelUp;
        public int stamina;
        public int maxEmployees;
        public long totalSales;
        public long createdAt;
        public long serverTime;
        public Appearance appearance;
        public List<District> districts = new List<District>();
        public Dictionary<string, int> store = new Dictionary<string, int>();
        public int storeCapacity;
        public int freeSeeds;
        public int tutorial;
        public MarketState market;
        public ProfessionState profession;
        public Dictionary<string, NeighbourState> neighbours = new Dictionary<string, NeighbourState>();
        public string vehicle;
        public List<string> vehicles = new List<string>();
        public List<DeliveryOrder> orders = new List<DeliveryOrder>();
        public List<Delivery> deliveries = new List<Delivery>();
        public string gardenerId;
        public Daily daily = new Daily();
        public List<string> friends = new List<string>();
        public long fame;
        public List<string> titles = new List<string>();
        public List<string> decorations = new List<string>();
        public string recoveryCode;
        public Dictionary<string, string> outfit = new Dictionary<string, string>();
        public List<string> wardrobe = new List<string>();
        public List<Employee> employees = new List<Employee>();
        public List<Employee> candidates = new List<Employee>();
        public List<LogEntry> log = new List<LogEntry>();
    }

    public class Product
    {
        public string id;
        public string name;
        public int unlockLevel;
        public long cost;
        public long price;
        public float sellSeconds;
        public int xp;
        public bool homegrown;
        public bool seasonal;
    }

    public class Wearable
    {
        public string id;
        public string name;
        public string slot; // hat | shirt | pants | acc
        public long price;
        public int unlockLevel;
        public int moneyPct;
        public int xpPct;
        public int charm;
    }

    public class LookOptions
    {
        public int hair;
        public int brows;
        public int lips;
        public int cheeks;
        public int earrings;
    }

    public class BuildingInfo
    {
        public string id;
        public string name;
        public long cost;
        public int buildSeconds;
        public int unlockLevel;
        public int maxLevel;
        public long incomePerHour;
        public long needsFame;
    }

    public class DistrictInfo
    {
        public string name;
        public long cost;
        public int unlockLevel;
        public long needsFame;
    }

    // A server-owned district anyone can enter; the street id is the ownerId to join with
    public class PublicDistrictInfo
    {
        public string id;
        public string name;
    }

    public class CropInfo
    {
        public string id;
        public string name;
        public int unlockLevel;
        public long seedCost;
        public int seconds;
        public int yield;
    }

    public class RecipeInput
    {
        public string item;
        public int amount;
    }

    public class RecipeInfo
    {
        public string id;
        public string name;
        public int unlockLevel;
        public int seconds;
        public int yield;
        public string needsFriend;
        public List<RecipeInput> inputList = new List<RecipeInput>();
    }

    public class ProfessionInfo
    {
        public string id;
        public string name;
        public string help;
    }

    public class VehicleInfo
    {
        public string id;
        public string name;
        public long price;
        public int speedPct;
        public int capacity;
    }

    public class OrderKindInfo
    {
        public string id;
        public string name;
    }

    public class QuestInfo
    {
        public string text;
        public string type;
        public string item;
        public int target;
    }

    public class NeighbourInfo
    {
        public string id;
        public string name;
        public string portrait;
        public string likes;
        public string reward;
        public List<QuestInfo> quests = new List<QuestInfo>();
    }

    public class MeetingChoice
    {
        public string id;
        public string name;
    }

    public class PlayerOrderInfo
    {
        public long id;
        public string buyer;
        public string buyer_name;
        public string item;
        public int quantity;
        public long price;
    }

    public class DecorationInfo
    {
        public string id;
        public string name;
        public long price;
    }

    public class TaskInfo
    {
        public string id;
        public string name;
        public int target;
    }

    public class Catalog
    {
        public LookOptions lookOptions;
        public List<BuildingInfo> buildings = new List<BuildingInfo>();
        public List<TaskInfo> dailyTasks = new List<TaskInfo>();
        public List<DecorationInfo> decorations = new List<DecorationInfo>();
        public List<DistrictInfo> districts = new List<DistrictInfo>();
        public List<PublicDistrictInfo> publicDistricts = new List<PublicDistrictInfo>();
        public int maxDistricts = 10;
        public List<CropInfo> crops = new List<CropInfo>();
        public List<RecipeInfo> recipes = new List<RecipeInfo>();
        public List<ProfessionInfo> professions = new List<ProfessionInfo>();
        public List<VehicleInfo> vehicles = new List<VehicleInfo>();
        public List<OrderKindInfo> orderKinds = new List<OrderKindInfo>();
        public List<NeighbourInfo> neighbours = new List<NeighbourInfo>();
        public List<MeetingChoice> meetingChoices = new List<MeetingChoice>();
        public List<Product> products = new List<Product>();
        public List<Wearable> wearables = new List<Wearable>();
        public Dictionary<string, object> balance;
    }

    public class LoginResult
    {
        public string token;
        public string id;
        public string name;
    }

    public class StreetSummary
    {
        public string ownerId;
        public string ownerName;
        public int ownerLevel;
        public int district;
        public int shard;
        public int playerCount;
        public int stallCount;
        public bool isOpen;
        public bool isFriend;
        public bool isPublic;
    }

    public class LeaderboardEntry
    {
        public string ownerId;
        public string name;
        public int level;
        public long fame;
    }

    public class Leaderboard
    {
        public long season;
        public List<LeaderboardEntry> top = new List<LeaderboardEntry>();
    }

    public class MarketPriceItem
    {
        public string item;
        public string name;
        public int unlockLevel;
        public long cost;
        public int pct;
        public long price;
    }

    public class MarketPricesResult
    {
        public long day;
        public int unlockLevel;
        public int maxBuy;
        public int creditLevel;
        public long creditLimit;
        public int interestPct;
        public List<MarketPriceItem> prices = new List<MarketPriceItem>();
    }

    public class SharedOrderResult
    {
        public long id;
        public string item;
        public int target;
        public int progress;
        public long reward;
        public long expiresAt;
        public int level;
        public int perDay;
        public int mine;
        public int givenToday;
        public int claimable;
    }

    public class SaleMessage { public int slot; public long amount; public string ownerId; }
    public class LevelUpMessage { public string id; public string name; public int level; }
    public class InviteMessage { public string playerId; public string customerId; }
    public class ErrorMessage { public string text; }
    public class IncomeMessage { public long amount; }
    public class OrderDoneMessage { public long reward; }
    public class RegularSaleMessage { public string name; public string customerId; }
    public class FortuneMessage { public string text; public int luckyNumber; }
    public class FortuneSharedMessage { public string from; public string fromName; public FortuneMessage fortune; }
    public class SeasonMessage { public string id; public int day; }
    public class SeasonQuestDoneMessage { public string season; public string quest; public long reward; }
    public class SharedOrderGivenMessage { public string who; public int quantity; }
    public class SharedOrderClaimedMessage { public string who; }
    public class EmoteMessage { public string fromId; public string targetId; public string kind; public string text; }
    public class CafeSeatsMessage { public List<object> seats = new List<object>(); }
}
