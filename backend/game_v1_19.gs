// ═══════════════════════════════════════════════════════════════
// 紅玉滿宇宙 遊戲化模組 v1.19(2026-11-11:寵物改版)
// v1.19 更新步驟:整份取代舊的遊戲化模組後,在編輯器執行一次 gm_setup()(補新工作表與新欄位、新參數)。
// 赤心幣、服裝商店、扭蛋、寵物、成就徽章、互動、每日一題、生日、團隊基金、冠軍櫃位、月結。
// 安裝:
//   1. 貼到 Apps Script 最底部。
//   2. extHandler_ 內加一行: var gm = gmHandler_(action, p); if (gm) return gm;
//   3. 在編輯器執行一次 gm_installTriggers()(建立每日 03:10 的自動結算),第一次會要求授權。
//   4. 執行一次 gm_setup()(建立所有工作表、填入預設參數、商品目錄、題庫範本)。
// 所有數值都在「遊戲參數」工作表,改了立即生效。
// 寫法:ES5(不用箭頭函式),相容舊版 Apps Script。
// ═══════════════════════════════════════════════════════════════

var GM_SHEETS = {
  ledger:  ['赤心幣流水帳', ['時間', '員工編號', '類型', '數量', '說明', '來源鍵']],
  params:  ['遊戲參數', ['參數名', '數值', '說明']],
  catalog: ['商品目錄', ['物品編號', '名稱', '分類', '等級', '價格', '上架', '扭蛋系列', '說明']],
  owned:   ['擁有物品', ['員工編號', '物品編號', '取得方式', '時間']],
  badges:  ['徽章紀錄', ['員工編號', '徽章編號', '期別', '取得時間', '配戴']],
  inter:   ['互動紀錄', ['時間', '日期', '送出人', '接收人', '類型', '已讀']],
  quiz:    ['題庫', ['題號', '分類', '題目', 'A', 'B', 'C', 'D', '正解', '解說', '啟用']],
  answers: ['答題紀錄', ['日期', '員工編號', '題號', '作答', '對錯', '時間']],
  fund:    ['團隊基金', ['時間', '員工編號', '數量']],
  pets:    ['寵物', ['員工編號', '口味', '名字', '購買日期', '配戴配件', '加成小時', '遊戲加命', '型態', '狀態', '寵物編號', '孵化日']],
  album:   ['寵物相簿', ['員工編號', '寵物編號', '階段', '型態', '口味', '日期', '累積工時']],
  diary:   ['寵物日記', ['員工編號', '週別', '內容', '時間']],
  trades:  ['寵物交換', ['編號', '發起人', '對象', '狀態', '建立時間', '處理時間']],
  petlog:  ['寵物動態', ['時間', '員工編號', '類型', '內容']],
  games:   ['小遊戲紀錄', ['時間', '日期', '員工編號', '遊戲', '分數', '獎勵']],
  hours:   ['工時日結', ['日期', '員工編號', '櫃位', '分鐘']],
  gacha:   ['扭蛋紀錄', ['時間', '員工編號', '物品編號', '等級', '重複退幣']],
  wishes:  ['生日祝福', ['日期', '壽星', '送出人', '時間']]
};

var GM_PARAM_DEFAULTS = [
  ['測試版開始日', '2026-11-16', '赤心幣從這天開始累積'],
  ['正式版開始日', '2026-12-01', '這天把餘額乘上加倍倍率(只做一次)'],
  ['正式版加倍倍率', 2, ''],
  ['工時倍率_1', 1, '權限等級 1 每小時幾枚'],
  ['工時倍率_2', 1.2, '權限等級 2(分隊長)'],
  ['工時倍率_3', 1.5, '權限等級 3(管理者)'],
  ['工時倍率_4', 1.5, '權限等級 4(總經理,預留)'],
  ['工時倍率_5', 1.5, '權限等級 5(大隊長)'],
  ['活動工時倍率', 2, '在活動場次(櫃位設定「場所性質」=活動,或 00 開頭)的工時加倍'],
  ['每日一題獎勵', 1, ''],
  ['連續答對7天加碼', 5, ''],
  ['互動之星獎勵', 200, '每月 1 日結算上月'],
  ['互動之星最低人數', 5, '送出＋收到的不同人數至少要這麼多'],
  ['冠軍櫃位總獎勵', 500, '依該櫃位當月上班時數比例分配'],
  ['壽星獎勵', 30, ''],
  ['送祝福獎勵', 1, '每天上限 3 次'],
  ['扭蛋價格', 50, ''],
  ['扭蛋每月上限', 5, ''],
  ['扭蛋機率_稀有', 25, '百分比'],
  ['扭蛋機率_傳說', 5, '百分比'],
  ['扭蛋保底次數', 10, '連續幾次沒中稀有以上,下一次必中'],
  ['扭蛋重複退幣', 20, ''],
  ['寵物價格', 0, 'v1.19 起寵物免費(此參數停用)'],
  ['寵物交換間隔天數', 30, '每人完成一次寵物交換後,隔幾天才能再換'],
  ['相剋傷害倍率', 1.2, '對戰時打被自己剋的型態,傷害乘上此數'],
  ['捐獻最低', 10, ''],
  ['單日營業額門檻', 20000, '「業績爆發」徽章:單日單店營業額達到此數'],
  ['基金解鎖', '500:lounge,1500:plants,3000:arcade,6000:station,10000:spectrum', '累積數:解鎖代號'],
  ['品牌週年日', '', 'MM-DD,待隊長確認'],
  ['小遊戲每日上限', 5, '小遊戲破紀錄獎勵,每天全部遊戲合計最多幾枚'],
  ['資歷門檻', '1080,2160,3240', '資歷徽章銅/銀/金的累計工時(小時);依「累計工時」表的「累計工時總計」']
];

// 商品:物品編號, 名稱, 分類(haircolor/acc/outfit/frame/hat/petacc), 等級, 價格, 上架(商店/扭蛋/否), 扭蛋系列, 說明
var GM_CATALOG_SEED = [
  ['hc_mint', '薄荷綠髮色', 'haircolor', '普通', 10, '商店', '', ''],
  ['hc_purple', '夢幻紫髮色', 'haircolor', '普通', 10, '商店', '', ''],
  ['hc_silver', '銀白髮色', 'haircolor', '普通', 15, '商店', '', ''],
  ['bowtie', '領結', 'acc', '普通', 10, '商店', '', ''],
  ['scarf', '圍巾', 'acc', '普通', 15, '商店', '', ''],
  ['backpack', '背包', 'acc', '普通', 25, '商店', '', ''],
  ['wings', '小翅膀', 'acc', '稀有', 80, '商店', '', ''],
  ['cape', '紅玉披風', 'acc', '傳說', 220, '商店', '', ''],
  ['halo', '光環', 'acc', '傳說', 300, '商店', '', ''],
  ['raincoat', '黃色雨衣', 'outfit', '稀有', 50, '商店', '', ''],
  ['chefsuit', '主廚服', 'outfit', '稀有', 60, '商店', '', ''],
  ['spacesuit', '太空服', 'outfit', '稀有', 100, '商店', '', ''],
  ['goldtrex', '金色小暴龍裝', 'outfit', '傳說', 400, '商店', '', ''],
  ['frame_wood', '木質名牌框', 'frame', '稀有', 50, '商店', '', ''],
  ['frame_glow', '發光名牌框', 'frame', '傳說', 250, '商店', '', ''],
  ['pet_bow', '寵物領結', 'petacc', '普通', 20, '商店', '', ''],
  ['pet_wings', '寵物小翅膀', 'petacc', '稀有', 60, '商店', '', ''],
  ['pet_crown', '寵物皇冠', 'petacc', '稀有', 120, '商店', '', ''],
  ['g_antenna', '外星觸角', 'hat', '普通', 0, '扭蛋', '宇宙系列', ''],
  ['g_starclip', '星星髮夾', 'acc', '普通', 0, '扭蛋', '宇宙系列', ''],
  ['g_moonpin', '月亮胸章', 'acc', '普通', 0, '扭蛋', '宇宙系列', ''],
  ['g_helmet', '太空頭盔', 'hat', '稀有', 0, '扭蛋', '宇宙系列', ''],
  ['g_rocket', '火箭背包', 'acc', '稀有', 0, '扭蛋', '宇宙系列', ''],
  ['g_ufo', '小飛碟頭飾', 'hat', '稀有', 0, '扭蛋', '宇宙系列', ''],
  ['g_galaxy', '銀河披風', 'acc', '傳說', 0, '扭蛋', '宇宙系列', ''],
  ['g_saturn', '土星光環', 'acc', '傳說', 0, '扭蛋', '宇宙系列', ''],
  // ── 對戰裝備(說明欄放數值:atk 攻擊、def 防禦、hp 體力、spd 速度;卡片 card:效果:數值)──
  ['w_spatula', '木鍋鏟', 'weapon', '普通', 40, '商店', '', 'atk:3'],
  ['w_whisk', '打蛋器', 'weapon', '普通', 60, '商店', '', 'atk:5,spd:1'],
  ['w_mold', '雞蛋糕烤盤', 'weapon', '稀有', 150, '商店', '', 'atk:9'],
  ['w_star', '星光權杖', 'weapon', '稀有', 0, '扭蛋', '戰鬥系列', 'atk:8,spd:3'],
  ['w_flame', '紅玉火焰劍', 'weapon', '傳說', 0, '扭蛋', '戰鬥系列', 'atk:15,spd:2'],
  ['w_champ', '冠軍之劍', 'weapon', '傳說', 0, '徽章:champion', '', 'atk:14,spd:1'],
  ['w_knife', '削皮小刀', 'weapon', '普通', 0, '掉落', '', 'atk:4,spd:2'],
  ['a_apron', '厚圍裙', 'armor', '普通', 40, '商店', '', 'def:3,hp:10'],
  ['a_mitt', '隔熱手套', 'armor', '普通', 60, '商店', '', 'def:5'],
  ['a_chef', '主廚護甲', 'armor', '稀有', 150, '商店', '', 'def:8,hp:20'],
  ['a_galaxy', '銀河戰甲', 'armor', '傳說', 0, '扭蛋', '戰鬥系列', 'def:12,hp:40'],
  ['a_star', '星塵斗篷', 'armor', '稀有', 0, '扭蛋', '戰鬥系列', 'def:6,hp:20,spd:2'],
  ['a_attend', '全勤護甲', 'armor', '稀有', 0, '徽章:attend', '', 'def:7,hp:30'],
  ['a_cap', '防燙帽', 'armor', '普通', 0, '掉落', '', 'def:3,hp:15'],
  ['c_heal', '熱騰騰雞蛋糕', 'card', '普通', 30, '商店', '', 'card:heal:30'],
  ['c_power', '紅玉能量', 'card', '普通', 30, '商店', '', 'card:power:50'],
  ['c_shield', '奶油護盾', 'card', '普通', 30, '商店', '', 'card:shield:25'],
  ['c_gift', '全家福大禮盒', 'card', '稀有', 0, '扭蛋', '戰鬥系列', 'card:heal:60'],
  ['c_meteor', '流星雨', 'card', '傳說', 0, '扭蛋', '戰鬥系列', 'card:power:100'],
  ['c_book', '博學之書', 'card', '稀有', 0, '徽章:quiz_30', '', 'card:power:80'],
  ['c_lucky', '幸運籤', 'card', '普通', 0, '掉落', '', 'card:shield:40'],
  ['c_tea', '下午茶時光', 'card', '普通', 0, '掉落', '', 'card:heal:40'],
  // ── 夥伴小店販售(「小店:店型」,價格為建議價,店主可在 80%~150% 間調整)──
  ['s_coffee', '美式咖啡', 'gift', '普通', 15, '小店:咖啡店', '', 'gift:☕'],
  ['s_latte', '拿鐵', 'gift', '普通', 25, '小店:咖啡店', '', 'gift:☕'],
  ['s_espresso', '濃縮咖啡卡', 'card', '普通', 20, '小店:咖啡店', '', 'card:power:30'],
  ['s_cookie', '寵物餅乾', 'petsnack', '普通', 10, '小店:甜點店', '', 'petsnack:2'],
  ['s_petcake', '寵物蛋糕', 'petsnack', '普通', 25, '小店:甜點店', '', 'petsnack:6'],
  ['s_macaron', '馬卡龍', 'gift', '普通', 20, '小店:甜點店', '', 'gift:🍬'],
  ['s_rose', '玫瑰', 'gift', '普通', 20, '小店:花店', '', 'gift:🌹'],
  ['s_bouquet', '花束', 'gift', '稀有', 40, '小店:花店', '', 'gift:💐'],
  ['s_wreath', '花冠(收藏)', 'decor', '稀有', 50, '小店:花店', '', 'decor:🌸'],
  ['s_woodsword', '練習木劍', 'weapon', '普通', 50, '小店:武器鋪', '', 'atk:4'],
  ['s_buckler', '小圓盾', 'armor', '普通', 50, '小店:武器鋪', '', 'def:4,hp:5'],
  ['s_ironsword', '鐵劍', 'weapon', '稀有', 120, '小店:武器鋪', '', 'atk:7,spd:1'],
  ['s_cardheal', '補血卡', 'card', '普通', 35, '小店:卡片屋', '', 'card:heal:40'],
  ['s_cardpow', '力量卡', 'card', '普通', 35, '小店:卡片屋', '', 'card:power:60'],
  ['s_cardshield', '護盾卡', 'card', '普通', 35, '小店:卡片屋', '', 'card:shield:35'],
  ['s_plush', '小暴龍玩偶(收藏)', 'decor', '普通', 30, '小店:雜貨店', '', 'decor:🦖'],
  ['s_keychain', '雞蛋糕吊飾(收藏)', 'decor', '普通', 15, '小店:雜貨店', '', 'decor:🧁'],
  ['s_snackpack', '寵物零食包', 'petsnack', '普通', 18, '小店:雜貨店', '', 'petsnack:4']
];

// 徽章:編號, 名稱, 圖示, 說明, 獎勵, 是否每期可再得
var GM_BADGES = [
  ['first_punch', '初心者', '🌱', '第一次上班打卡', 10, false],
  ['first_open', '開門紅', '🌅', '第一次當天第一位開店', 10, false],
  ['close_10', '收店達人・銅', '🥉', '完成收店盤點 10 次', 20, false],
  ['close_50', '收店達人・銀', '🥈', '完成收店盤點 50 次', 50, false],
  ['close_100', '收店達人・金', '🥇', '完成收店盤點 100 次', 100, false],
  ['attend', '全勤之星', '⭐', '當月排班全部出勤、無遲到', 50, true],
  ['target', '達標之星', '🎯', '當月工時達標', 30, true],
  ['bigday', '業績爆發', '🔥', '單日單店營業額達門檻', 50, false],
  ['quiz_30', '博學家', '📘', '每日一題累計答對 30 題', 20, false],
  ['quiz_100', '大博學家', '📚', '每日一題累計答對 100 題', 50, false],
  ['fashion', '時尚達人', '👗', '擁有 10 件付費服裝', 20, false],
  ['collector', '圖鑑大師', '🏅', '扭蛋系列收集完成', 100, true],
  ['popular', '人氣王', '💖', '收到互動的不同夥伴滿 10 人', 20, false],
  ['star', '互動之星', '🌟', '當月互動之星', 0, true],
  ['champion', '冠軍櫃位', '🏆', '在當月營業額第一名櫃位上班', 0, true],
  ['donor_1', '團隊贊助者・銅', '🤝', '捐獻累計 100 枚', 0, false],
  ['donor_2', '團隊贊助者・銀', '🤝', '捐獻累計 500 枚', 0, false],
  ['donor_3', '團隊贊助者・金', '🤝', '捐獻累計 1,000 枚', 0, false],
  ['tenure_1', '資歷・銅', '🎖️', '累計工時滿 1,080 小時(可開自己的小店)', 100, false],
  ['tenure_2', '資歷・銀', '🎖️', '累計工時滿 2,160 小時', 200, false],
  ['tenure_3', '資歷・金', '🎖️', '累計工時滿 3,240 小時', 300, false],
  ['birthday', '生日派對', '🎂', '在紅玉滿過生日', 0, true],
  ['mentor', '好導師', '🧑‍🏫', '帶新人(管理者頒發)', 50, true],
  ['special', '特別貢獻', '💎', '管理者頒發', 0, true],
  ['gamer', '小遊戲週冠軍', '🎮', '任一款小遊戲週排行第一', 10, true],
  ['pet_dex', '寵物圖鑑大師', '📖', '五種寵物都親手養到完全體', 100, false]
];
// 寵物小遊戲:編號、名稱、需要的寵物階段、破個人紀錄的獎勵、分數上限(防止異常分數)
var GM_GAMES = [['catch', '接雞蛋糕', 1, 1, 5000], ['memory', '雞蛋糕翻翻樂', 2, 1, 1000], ['breakout', '打磚塊', 3, 2, 20000],
                ['oven', '烤爐大挑戰', 4, 2, 20000], ['runner', '寵物跑酷', 5, 3, 100000]];

var GM_INTER_TYPES = { cheer: '加油打氣', like: '按讚', nod: '點頭致意', smile: '微笑', pat: '摸摸寵物的頭' };
var GM_PET_FLAVORS = ['原味', '可可', '紅玉', '抹茶'];
var GM_PET_STAGES = [[0, '蛋寶寶'], [40, '雛形期'], [120, '嬰兒期'], [300, '兒童期'], [600, '完全體']];   // v1.19

// 每日一題初稿 30 題(2026-11-10,待隊長審)
var GM_QUIZ_SEED = [["Q01", "品牌", "紅玉滿赤心雞蛋糕的品牌標語是？", "願食雞蛋糕，常保赤子心", "一口雞蛋糕，滿滿好心情", "赤心相待，紅玉滿堂", "雞蛋糕，最懂台灣味", "A", "登入頁上的標語就是「願食雞蛋糕，常保赤子心」。", "是"], ["Q02", "品牌", "我們目前的四種麵糊口味是？", "原味、可可、紅玉、抹茶", "原味、巧克力、草莓、抹茶", "原味、可可、芋頭、紅豆", "原味、紅玉、黑糖、抹茶", "A", "盤點和收店都要分別填這四種口味。", "是"], ["Q03", "品牌", "紅玉滿赤心雞蛋糕在光譜餐飲品牌集團中代表哪個顏色？", "紅色", "橙色", "黃色", "綠色", "A", "集團以光譜七色規劃七個品牌，紅玉滿是紅色，澄司吐司是橙色。", "是"], ["Q04", "品牌", "光譜餐飲品牌集團規劃發展幾個品牌？", "3 個", "5 個", "7 個", "10 個", "C", "對應光譜的七種顏色。", "是"], ["Q05", "品牌", "下列哪一個是我們的固定櫃位？", "遠百信義", "台北101", "新光三越南西", "微風南山", "A", "固定櫃位有遠百信義、國家音樂廳、南港 LaLaport、遠百竹北。", "是"], ["Q06", "品牌", "紅玉滿至今參加過大約多少場活動？", "50 場以上", "100 場以上", "300 場以上", "500 場以上", "D", "品牌累積參加 500 場以上活動，也和許多政府單位合作。", "是"], ["Q07", "制度", "2026 年夥伴的基本時薪是多少？", "183 元", "190 元", "196 元", "200 元", "C", "2026 年所有夥伴都以 196 元為基準時薪。", "是"], ["Q08", "制度", "一般夥伴每月達標的條件是？", "160 小時＋假日 2 天", "180 小時＋假日 4 天", "200 小時＋假日 4 天", "180 小時，不看假日", "B", "一般夥伴 180 小時＋4 天假日出勤；學生夥伴是 72 小時＋4 天。", "是"], ["Q09", "制度", "學生夥伴每月達標的工時門檻是？", "60 小時", "72 小時", "90 小時", "120 小時", "B", "學生夥伴是 72 小時＋4 天假日出勤。", "是"], ["Q10", "制度", "國定假日或颱風天上班，時薪怎麼算？", "×1.33", "×1.5", "×2", "照原時薪", "C", "國定假日和颱風天都是 2 倍。", "是"], ["Q11", "制度", "上班時數會扣掉午餐 1 小時嗎？", "會", "不會", "滿 8 小時才扣", "看櫃位規定", "B", "制度明訂工時不扣午餐時間。", "是"], ["Q12", "制度", "制度中所有金額的計算，零頭怎麼處理？", "四捨五入", "無條件捨去", "無條件進位（對夥伴有利）", "由主管決定", "C", "所有金額採無條件進位，對夥伴有利。", "是"], ["Q13", "制度", "介紹新夥伴的介紹獎金總共多少？", "3,000 元", "5,000 元", "8,000 元", "10,000 元", "D", "10,000 元，在被介紹人累計 180、360、720 小時時分三次發放。", "是"], ["Q14", "制度", "生日津貼在什麼時候發放？", "每年年底", "生日當月", "到職週年", "三節時一起發", "B", "生日津貼在夥伴生日當月發放。", "是"], ["Q15", "制度", "假日出勤獎金是每櫃每天多少元，再依時數比例分配？", "300 元", "500 元", "800 元", "1,000 元", "B", "每櫃每天 500 元，非雙倍薪日才有。", "是"], ["Q16", "制度", "百貨櫃位（A 類）的業績是以銷貨額的多少計算？", "70%", "80%", "90%", "100%", "B", "A 類百貨以銷貨額 ×80% 計算業績。", "是"], ["Q17", "SOP", "上班打卡前，App 會要求你先拍什麼？", "櫃位環境照", "儀容照（帽子、口罩、制服）", "麵糊照", "發票照", "B", "沒有儀容照就不能打上班卡。", "是"], ["Q18", "SOP", "洗手消毒時，至少要洗多久？", "5 秒", "10 秒", "20 秒", "1 分鐘", "C", "開店 SOP：洗手 20 秒以上並用酒精消毒。", "是"], ["Q19", "SOP", "當天第一位到櫃位的夥伴，打卡後要完成什麼？", "開店盤點（麵糊起始量與零用金）", "收店盤點", "訂單確認", "排班確認", "A", "第一位開店的人要填四種口味麵糊起始量與接手零用金。", "是"], ["Q20", "SOP", "收店時，最後離開的夥伴要上傳哪兩組照片？", "儀容照、麵糊照", "烤爐清潔照、環境清潔照", "發票照、零用金照", "商品照、客人照", "B", "收店要上傳烤爐清潔與環境清潔照片，才能打下班卡。", "是"], ["Q21", "SOP", "竹籤、紙袋快用完時，最好的做法是？", "下班後再說", "在宇宙辦公室的缺貨看板登記", "自己去買", "跟客人借", "B", "缺貨看板登記後，大家和管理者都看得到。", "是"], ["Q22", "SOP", "收店盤點要填寫哪些麵糊數量？", "只填總數", "四種口味各自的剩餘包數與當日進貨", "只填原味", "不用填", "B", "四種口味的剩餘與進貨要分別填寫，管理儀表板會依此顯示各店剩餘麵糊。", "是"], ["Q23", "SOP", "烤爐清潔應該在什麼時候進行？", "剛關電源時馬上擦", "關閉電源、降溫後再清潔", "開著電源邊烤邊擦", "隔天開店再清", "B", "降溫後清潔才安全，也能保護烤盤。", "是"], ["Q24", "食安", "帽子的正確戴法是？", "露出瀏海比較好看", "頭髮全部收進帽子裡", "只要有戴就好", "熱的時候可以拿下", "B", "頭髮全部收進帽子，避免掉落到食物裡。", "是"], ["Q25", "食安", "麵糊開封後，最需要注意的是？", "顏色是否好看", "保存期限與冷藏保存", "放在烤爐旁保溫", "倒在一起比較省空間", "B", "開店 SOP 要確認麵糊數量與保存期限。", "是"], ["Q26", "食安", "收銀找零後，要再碰食物前應該？", "直接拿", "洗手或消毒手部", "擦一下圍裙", "戴上手套就不用管", "B", "錢幣容易沾附細菌，碰食物前要清潔雙手。", "是"], ["Q27", "服務", "客人想訂大量雞蛋糕外送，夥伴應該怎麼做？", "請客人改天再來", "在 App「訂單」建立外送訂單", "用便條紙記下來", "口頭記住就好", "B", "訂單系統會提醒最晚開始製作時間，避免漏單。", "是"], ["Q28", "服務", "訂單上的「最晚開始製作時間」是怎麼算的？", "取貨時間減掉預計製作時間", "取貨時間加 30 分鐘", "建單時間加 1 小時", "固定上午 10 點", "A", "系統用取貨（外送則用外送時間）減預計製作分鐘數，時間到會在頂端提醒。", "是"], ["Q29", "App", "赤心幣每工作 1 小時可以得到幾枚？（一般夥伴）", "1 枚", "2 枚", "5 枚", "10 枚", "A", "一般夥伴每小時 1 枚，分隊長 ×1.2、管理者 ×1.5，活動場次再 ×2。", "是"], ["Q30", "App", "忘記或要修改密碼，可以怎麼做？", "在「我的」頁的帳號安全修改，或聯絡門市總監、營運總監", "重新申請帳號", "問其他夥伴的密碼", "不用管它", "A", "可以自己在「我的」頁修改；忘記密碼請聯絡門市總監或營運總監。", "是"]];

// ───────── 基本工具 ─────────
var GM_CACHE_ = {};
function gm_ss_() { return GM_CACHE_.ss || (GM_CACHE_.ss = SpreadsheetApp.openById(SHEET_ID)); }
function gm_sh_(key) {
  if (GM_CACHE_['sh_' + key]) return GM_CACHE_['sh_' + key];
  var d = GM_SHEETS[key], sh = gm_ss_().getSheetByName(d[0]);
  if (!sh) { sh = gm_ss_().insertSheet(d[0]); sh.getRange(1, 1, 1, d[1].length).setValues([d[1]]); sh.setFrozenRows(1); }
  return (GM_CACHE_['sh_' + key] = sh);
}
function gm_rows_(key) {           // 不含標題列
  if (GM_CACHE_['rows_' + key]) return GM_CACHE_['rows_' + key];
  var sh = gm_sh_(key), n = sh.getLastRow();
  var v = n > 1 ? sh.getRange(2, 1, n - 1, GM_SHEETS[key][1].length).getValues() : [];
  return (GM_CACHE_['rows_' + key] = v);
}
function gm_append_(key, rows) {
  if (!rows.length) return;
  var sh = gm_sh_(key), start = sh.getLastRow() + 1;
  var rng = sh.getRange(start, 1, rows.length, rows[0].length);
  rng.setNumberFormat('@'); rng.setValues(rows.map(function (r) { return r.map(function (x) { return x == null ? '' : String(x); }); }));
  var c = GM_CACHE_['rows_' + key]; if (c) rows.forEach(function (r) { c.push(r.map(function (x) { return x == null ? '' : String(x); })); });
}
function gm_now_() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss'); }
function gm_today_() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd'); }
function gm_dstr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM-dd');
  var s = String(v || '').trim().replace(/\//g, '-'), m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : '';
}
function gm_addDays_(d, n) { var t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
function gm_prevMonth_(ym) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1; if (!m) { y--; m = 12; } return y + '-' + ('0' + m).slice(-2); }
function gm_num_(v) { var n = Number(String(v == null ? '' : v).replace(/[^\d.\-]/g, '')); return String(v).trim() === '' || !isFinite(n) ? 0 : n; }

function gm_param_(name) {
  if (!GM_CACHE_.params) {
    var m = {}; GM_PARAM_DEFAULTS.forEach(function (p) { m[p[0]] = p[1]; });
    gm_rows_('params').forEach(function (r) { if (String(r[0]).trim() !== '' && String(r[1]).trim() !== '') m[String(r[0]).trim()] = r[1]; });
    GM_CACHE_.params = m;
  }
  var v = GM_CACHE_.params[name];
  return typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : v;
}

// 夥伴資料:A 員工編號、B 姓名、C 暱稱、E 生日(民國 yy/mm/dd)、J 到職日、K 離職日、M 權限等級
function gm_emps_() {
  if (GM_CACHE_.emps) return GM_CACHE_.emps;
  var v = gm_ss_().getSheetByName('夥伴資料').getDataRange().getValues(), out = {};
  for (var r = 1; r < v.length; r++) {
    var id = String(v[r][0]).trim(); if (!id) continue;
    out[id] = { id: id, name: String(v[r][1] || ''), nick: String(v[r][2] || ''), birthday: v[r][4], start: v[r][9],
                resigned: String(v[r][10] || '').trim() !== '', role: Number(v[r][12]) || 1, pos: String(v[r][11] || '').trim() };
  }
  return (GM_CACHE_.emps = out);
}
function gm_emp_(id) { return gm_emps_()[String(id || '').trim()] || null; }
// 權限:1 夥伴、2 分隊長、3 管理者、4 總經理(預留)、5 大隊長(全部權限)。
// 遊戲最高管理(補發赤心幣、頒徽章、手動結算)限 4 級以上;過渡期職務為「大隊長」者也算(權限等級還沒改成 5 之前)。
function gm_isTop_(e) { return !!e && (e.role >= 4 || e.pos === '大隊長'); }
function gm_bdMD_(v) {          // 生日 → "MM-DD"
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Taipei', 'MM-dd');
  var p = String(v || '').trim().split(/[\/\-.]/); if (p.length < 2) return '';
  var m = p[p.length - 2], d = p[p.length - 1]; return ('0' + Number(m)).slice(-2) + '-' + ('0' + Number(d)).slice(-2);
}

// ───────── 赤心幣 ─────────
function gm_hasKey_(key) {
  if (!GM_CACHE_.keys) { GM_CACHE_.keys = {}; gm_rows_('ledger').forEach(function (r) { if (r[5]) GM_CACHE_.keys[r[5]] = 1; }); }
  return !!GM_CACHE_.keys[key];
}
function gm_credit_(emp, type, amount, note, key) {   // key 相同只會入帳一次
  amount = Math.round(Number(amount) || 0); if (!amount) return false;
  if (key && gm_hasKey_(key)) return false;
  gm_append_('ledger', [[gm_now_(), emp, type, amount, note || '', key || '']]);
  if (key) GM_CACHE_.keys[key] = 1;
  return true;
}
function gm_balance_(emp) {
  var s = 0; gm_rows_('ledger').forEach(function (r) { if (r[1] === emp) s += Number(r[3]) || 0; }); return s;
}
function gm_isFrozen_(emp) { var e = gm_emp_(emp); return !e || e.resigned; }

// ───────── 工時日結(打卡紀錄:B 日期、C 員工編號、F 打卡類型、G 打卡時間 ISO、J 打卡地點)─────────
function gm_punchRows_() {
  if (GM_CACHE_.punch) return GM_CACHE_.punch;
  var out = [];
  ['打卡紀錄', '打卡紀錄_歷史'].forEach(function (n) {
    var sh = gm_ss_().getSheetByName(n); if (!sh || sh.getLastRow() < 2) return;
    var v = sh.getRange(2, 1, sh.getLastRow() - 1, 10).getValues();
    v.forEach(function (r) {
      var t = r[6] instanceof Date ? r[6] : new Date(String(r[6]));
      if (isNaN(t.getTime())) return;
      out.push({ date: gm_dstr_(r[1]), emp: String(r[2]).trim(), type: String(r[5]).trim(), t: t.getTime(), loc: String(r[9] || '').trim() });
    });
  });
  return (GM_CACHE_.punch = out);
}
function gm_minutesFor_(date) {      // → [{emp, loc, min}]
  var by = {};
  gm_punchRows_().forEach(function (p) { if (p.date === date) (by[p.emp] = by[p.emp] || []).push(p); });
  var res = {};
  Object.keys(by).forEach(function (emp) {
    var list = by[emp].sort(function (a, b) { return a.t - b.t; }), open = null;
    list.forEach(function (p) {
      if (p.type === '上班') open = p;
      else if (p.type === '下班' && open) {
        var min = Math.round((p.t - open.t) / 60000);
        if (min > 0 && min <= 16 * 60) { var k = emp + '|' + open.loc; res[k] = (res[k] || 0) + min; }
        open = null;
      }
    });
  });
  return Object.keys(res).map(function (k) { var a = k.split('|'); return { emp: a[0], loc: a.slice(1).join('|'), min: res[k] }; });
}
// 重算某天的工時日結(先刪該日舊資料再寫入,補打卡後也會更新)
function gm_settleHoursDay_(date) {
  var sh = gm_sh_('hours'), v = gm_rows_('hours');
  for (var i = v.length - 1; i >= 0; i--) if (String(v[i][0]) === date) sh.deleteRow(i + 2);
  GM_CACHE_.rows_hours = null;
  var rows = gm_minutesFor_(date).map(function (x) { return [date, x.emp, x.loc, x.min]; });
  gm_append_('hours', rows);
}
// 工時幣:累計分鐘 × 倍率 ÷ 60 取整數,扣掉已發放的,補發差額(不倒扣)
function gm_payHours_(runDate) {
  // 活動場次的工時給 2 倍(隊長 11/10;倍數見參數「活動工時倍率」)
  var start = gm_param_('測試版開始日'), mins = {}, act = gm_activityLocs_(), actMult = Number(gm_param_('活動工時倍率')) || 1;
  gm_rows_('hours').forEach(function (r) {
    if (String(r[0]) < start) return;
    var w = (act[r[2]] || /^00/.test(String(r[2]))) ? actMult : 1;
    mins[r[1]] = (mins[r[1]] || 0) + (Number(r[3]) || 0) * w;
  });
  var paid = {};
  gm_rows_('ledger').forEach(function (r) { if (r[2] === '工時') paid[r[1]] = (paid[r[1]] || 0) + (Number(r[3]) || 0); });
  Object.keys(mins).forEach(function (emp) {
    var e = gm_emp_(emp); if (!e || e.resigned) return;
    var mult = Number(gm_param_('工時倍率_' + Math.min(5, Math.max(1, e.role)))) || 1;
    var due = Math.floor(mins[emp] * mult / 60), diff = due - (paid[emp] || 0);
    if (diff > 0) gm_credit_(emp, '工時', diff, '工時結算至 ' + gm_addDays_(runDate, -1) + '(加權後 ' + Math.round(mins[emp] / 6) / 10 + ' 小時 ×' + mult + ',活動場次 ×' + (Number(gm_param_('活動工時倍率')) || 1) + ')', 'HOURS|' + emp + '|' + runDate);
  });
}
function gm_minutesSince_(emp, fromDate, toDate, loc) {
  var s = 0; gm_rows_('hours').forEach(function (r) {
    if (r[1] === emp && String(r[0]) >= fromDate && (!toDate || String(r[0]) <= toDate) && (!loc || r[2] === loc)) s += Number(r[3]) || 0;
  }); return s;
}

// ───────── 徽章 ─────────
function gm_badgeDef_(id) { for (var i = 0; i < GM_BADGES.length; i++) if (GM_BADGES[i][0] === id) return GM_BADGES[i]; return null; }
function gm_hasBadge_(emp, id, period) {
  var rows = gm_rows_('badges');
  for (var i = 0; i < rows.length; i++) if (rows[i][0] === emp && rows[i][1] === id && String(rows[i][2]) === String(period || '')) return true;
  return false;
}
function gm_award_(emp, id, period, coinsOverride) {
  var d = gm_badgeDef_(id); if (!d || !gm_emp_(emp)) return false;
  period = d[5] ? String(period || '') : '';
  if (gm_hasBadge_(emp, id, period)) return false;
  gm_append_('badges', [[emp, id, period, gm_now_(), '']]);
  var coins = coinsOverride != null ? coinsOverride : d[4];
  if (coins) gm_credit_(emp, '徽章', coins, '獲得徽章「' + d[1] + '」' + (period ? '(' + period + ')' : ''), 'BADGE|' + emp + '|' + id + '|' + period);
  // 徽章解鎖的專屬裝備
  var cat = gm_catalog_(), own = gm_owned_(emp);
  Object.keys(cat).forEach(function (k) { if (cat[k].where === '徽章:' + id && !own[k]) gm_append_('owned', [[emp, k, '徽章', gm_now_()]]); });
  return true;
}

// 每日自動檢查徽章
function gm_autoBadges_() {
  var start = gm_param_('測試版開始日'), emps = gm_emps_(), ss = gm_ss_();
  // 初心者
  gm_punchRows_().forEach(function (p) { if (p.type === '上班' && p.date >= start && emps[p.emp]) gm_award_(p.emp, 'first_punch'); });
  // 開門紅(開店盤點:B 日期、D 員工編號)
  var op = ss.getSheetByName('開店盤點');
  if (op && op.getLastRow() > 1) op.getRange(2, 1, op.getLastRow() - 1, 6).getValues().forEach(function (r) {
    if (gm_dstr_(r[1]) >= start && emps[String(r[3]).trim()]) gm_award_(String(r[3]).trim(), 'first_open');
  });
  // 收店達人、業績爆發(收店盤點:B 日期、D 員工編號、F 櫃位、Q 當日營業額、AC 營業額合計)
  var closeCnt = {}, th = Number(gm_param_('單日營業額門檻')) || 0;
  gm_closeRows_().forEach(function (c) {
    if (c.date < start || !emps[c.emp]) return;
    closeCnt[c.emp] = (closeCnt[c.emp] || 0) + 1;
    if (gm_hash_(c.emp + c.date + c.loc) % 100 < 15) gm_drop_(c.emp, '確實完成收店盤點(' + c.date + ')', 'CLOSE|' + c.emp + '|' + c.date + '|' + c.loc);
    if (th && c.rev >= th) gm_award_(c.emp, 'bigday');
  });
  Object.keys(closeCnt).forEach(function (e) {
    if (closeCnt[e] >= 10) gm_award_(e, 'close_10');
    if (closeCnt[e] >= 50) gm_award_(e, 'close_50');
    if (closeCnt[e] >= 100) gm_award_(e, 'close_100');
  });
  // 達標之星(達標紀錄:A 員工編號、C 年月、H 是否達標)
  var tg = ss.getSheetByName('達標紀錄');
  if (tg && tg.getLastRow() > 1) tg.getRange(2, 1, tg.getLastRow() - 1, 8).getValues().forEach(function (r) {
    var ym = String(r[2]).trim(); if (r[2] instanceof Date) ym = Utilities.formatDate(r[2], 'Asia/Taipei', 'yyyy-MM');
    if (ym >= start.slice(0, 7) && /^(是|TRUE|true|Y|✓|達標)$/.test(String(r[7]).trim()) && emps[String(r[0]).trim()]) gm_award_(String(r[0]).trim(), 'target', ym);
  });
  // 資歷(隊長 11/10:以累計工時為主,不看到職日)。累計工時表:A 員工編號、C 年月、G 累計工時總計 → 取每人最新年月那筆
  var cum = {}, cs = ss.getSheetByName('累計工時');
  if (cs && cs.getLastRow() > 1) cs.getRange(2, 1, cs.getLastRow() - 1, 7).getValues().forEach(function (r) {
    var id = String(r[0]).trim(); if (!id) return;
    var ym = r[2] instanceof Date ? Utilities.formatDate(r[2], 'Asia/Taipei', 'yyyy-MM') : String(r[2]).trim();
    if (!cum[id] || ym >= cum[id].ym) cum[id] = { ym: ym, h: gm_num_(r[6]) };
  });
  var th3 = String(gm_param_('資歷門檻') || '1000,2000,3000').split(',').map(Number);
  Object.keys(cum).forEach(function (id) {
    if (!emps[id] || emps[id].resigned) return;
    for (var y = 1; y <= 3; y++) if (th3[y - 1] && cum[id].h >= th3[y - 1]) gm_award_(id, 'tenure_' + y);
  });
  // 人氣王、時尚達人、博學家、贊助者
  Object.keys(emps).forEach(function (id) { gm_checkSocialBadges_(id); });
}
function gm_checkSocialBadges_(id) {
  var from = {}; gm_rows_('inter').forEach(function (r) { if (r[3] === id) from[r[2]] = 1; });
  if (Object.keys(from).length >= 10) gm_award_(id, 'popular');
  var paidItems = 0, cat = gm_catalog_();
  gm_rows_('owned').forEach(function (r) { if (r[0] === id && cat[r[1]] && ['acc', 'outfit', 'frame', 'haircolor', 'hat'].indexOf(cat[r[1]].cat) >= 0) paidItems++; });
  if (paidItems >= 10) gm_award_(id, 'fashion');
  var right = 0; gm_rows_('answers').forEach(function (r) { if (r[1] === id && String(r[4]) === '對') right++; });
  if (right >= 30) gm_award_(id, 'quiz_30');
  if (right >= 100) gm_award_(id, 'quiz_100');
  var don = 0; gm_rows_('fund').forEach(function (r) { if (r[1] === id) don += Number(r[2]) || 0; });
  if (don >= 100) gm_award_(id, 'donor_1');
  if (don >= 500) gm_award_(id, 'donor_2');
  if (don >= 1000) gm_award_(id, 'donor_3');
}

// 工作表現掉落:從「掉落」物品中挑一件還沒有的(都有了就不掉)
function gm_drop_(emp, reason, key) {
  if (gm_hasKey_('DROP|' + key)) return null;
  var cat = gm_catalog_(), own = gm_owned_(emp);
  var pool = Object.keys(cat).filter(function (k) { return cat[k].where === '掉落' && !own[k]; });
  GM_CACHE_.keys['DROP|' + key] = 1;
  gm_append_('ledger', [[gm_now_(), emp, '掉落', 0, reason, 'DROP|' + key]]);
  if (!pool.length) return null;
  var got = pool[gm_hash_(key) % pool.length];
  gm_append_('owned', [[emp, got, '掉落', gm_now_()]]);
  gm_append_('ledger', [[gm_now_(), emp, '掉落', 0, reason + ':獲得「' + cat[got].name + '」', '']]);
  return cat[got];
}

// ───────── 營業額(收店盤點)─────────
function gm_closeRows_() {
  if (GM_CACHE_.close) return GM_CACHE_.close;
  var out = [];
  ['收店盤點', '收店盤點_歷史'].forEach(function (n) {
    var sh = gm_ss_().getSheetByName(n); if (!sh || sh.getLastRow() < 2) return;
    var v = sh.getRange(2, 1, sh.getLastRow() - 1, Math.min(29, sh.getLastColumn())).getValues();
    v.forEach(function (r) {
      var rev = String(r[28] == null ? '' : r[28]).trim() !== '' ? gm_num_(r[28]) : gm_num_(r[16]);
      out.push({ date: gm_dstr_(r[1]), emp: String(r[3]).trim(), loc: String(r[5]).trim(), rev: rev });
    });
  });
  return (GM_CACHE_.close = out);
}
function gm_activityLocs_() {
  var sh = gm_ss_().getSheetByName('櫃位設定'), out = {};
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().forEach(function (r) {
    if (String(r[5]).trim() === '活動') out[String(r[0]).trim()] = 1;
  });
  return out;
}
function gm_revenueRank_(ym) {      // 固定櫃位當月營業額排行
  var act = gm_activityLocs_(), sum = {};
  gm_closeRows_().forEach(function (c) {
    if (c.date.slice(0, 7) !== ym || !c.loc || act[c.loc] || /^00/.test(c.loc)) return;
    sum[c.loc] = (sum[c.loc] || 0) + c.rev;
  });
  return Object.keys(sum).map(function (k) { return { loc: k, rev: sum[k] }; }).sort(function (a, b) { return b.rev - a.rev; });
}

// ───────── 月結(每月 1 日):互動之星、冠軍櫃位、全勤 ─────────
function gm_monthly_(ym) {
  var start = gm_param_('測試版開始日');
  if (ym + '-31' < start) return;
  // 互動之星
  var sent = {}, recv = {};
  gm_rows_('inter').forEach(function (r) {
    if (String(r[1]).slice(0, 7) !== ym) return;
    (sent[r[2]] = sent[r[2]] || {})[r[3]] = 1; (recv[r[3]] = recv[r[3]] || {})[r[2]] = 1;
  });
  var score = {}, minN = Number(gm_param_('互動之星最低人數')) || 0;
  Object.keys(gm_emps_()).forEach(function (id) {
    var s = Object.keys(sent[id] || {}).length + Object.keys(recv[id] || {}).length;
    if (s >= minN && s > 0) score[id] = s;
  });
  var best = 0; Object.keys(score).forEach(function (k) { if (score[k] > best) best = score[k]; });
  if (best) Object.keys(score).forEach(function (k) {
    if (score[k] === best && !gm_isFrozen_(k)) { gm_award_(k, 'star', ym); gm_credit_(k, '互動之星', gm_param_('互動之星獎勵'), ym + ' 本月互動之星', 'STAR|' + k + '|' + ym); }
  });
  // 冠軍櫃位
  var rank = gm_revenueRank_(ym);
  if (rank.length && rank[0].rev > 0) {
    var loc = rank[0].loc, mins = {}, total = 0;
    gm_rows_('hours').forEach(function (r) {
      if (String(r[0]).slice(0, 7) === ym && r[2] === loc && String(r[0]) >= start) { mins[r[1]] = (mins[r[1]] || 0) + (Number(r[3]) || 0); total += Number(r[3]) || 0; }
    });
    var pool = Number(gm_param_('冠軍櫃位總獎勵')) || 0;
    if (total > 0) Object.keys(mins).forEach(function (emp) {
      if (gm_isFrozen_(emp)) return;
      var amt = Math.round(pool * mins[emp] / total);
      gm_award_(emp, 'champion', ym);
      gm_credit_(emp, '冠軍櫃位', amt, ym + ' 冠軍櫃位 ' + loc + '(上班 ' + Math.round(mins[emp] / 6) / 10 + ' / ' + Math.round(total / 6) / 10 + ' 小時)', 'CHAMP|' + emp + '|' + ym);
    });
    gm_setState_('冠軍櫃位_' + ym, loc);
  }
  // 全勤之星(班表:B 日期、D 員工編號、F 櫃位、G 上班時間)
  var sch = gm_ss_().getSheetByName('班表'), plan = {};
  if (sch && sch.getLastRow() > 1) sch.getRange(2, 1, sch.getLastRow() - 1, 7).getValues().forEach(function (r) {
    var d = gm_dstr_(r[1]), emp = String(r[3]).trim(); if (!emp || d.slice(0, 7) !== ym || d < start) return;
    var st = r[6] instanceof Date ? Utilities.formatDate(r[6], 'Asia/Taipei', 'HH:mm') : String(r[6]).trim();
    (plan[emp] = plan[emp] || []).push({ date: d, start: st });
  });
  var firstIn = {};
  gm_punchRows_().forEach(function (p) {
    if (p.type !== '上班') return; var k = p.emp + '|' + p.date;
    if (!firstIn[k] || p.t < firstIn[k]) firstIn[k] = p.t;
  });
  Object.keys(plan).forEach(function (emp) {
    var ok = plan[emp].every(function (s) {
      var t = firstIn[emp + '|' + s.date]; if (!t) return false;
      var m = /^(\d{1,2}):(\d{2})/.exec(s.start); if (!m) return true;
      var due = new Date(s.date + 'T' + ('0' + m[1]).slice(-2) + ':' + m[2] + ':00+08:00').getTime();
      return t <= due + 5 * 60000;
    });
    if (ok && plan[emp].length && !gm_isFrozen_(emp)) { gm_award_(emp, 'attend', ym); gm_drop_(emp, ym + ' 全勤', 'ATTEND|' + emp + '|' + ym); }
  });
}
function gm_setState_(k, v) { PropertiesService.getScriptProperties().setProperty('gm_' + k, String(v)); }
function gm_getState_(k) { return PropertiesService.getScriptProperties().getProperty('gm_' + k) || ''; }

// ───────── 每日排程 ─────────
function gm_dailyJob() {
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    GM_CACHE_ = {};
    var today = gm_today_(), start = gm_param_('測試版開始日');
    if (today <= start) return;
    // 1. 工時:前 3 天重算(補打卡也會更新),第一次執行會從開始日一路補到昨天
    var last = gm_getState_('工時已結算到') || gm_addDays_(start, -1);
    var from = last < gm_addDays_(today, -3) ? gm_addDays_(last, 1) : gm_addDays_(today, -3);
    if (from < start) from = start;
    for (var d = from; d < today; d = gm_addDays_(d, 1)) gm_settleHoursDay_(d);
    gm_setState_('工時已結算到', gm_addDays_(today, -1));
    gm_payHours_(today);
    // 2. 壽星
    var md = today.slice(5), emps = gm_emps_();
    Object.keys(emps).forEach(function (id) {
      var e = emps[id]; if (e.resigned || gm_bdMD_(e.birthday) !== md) return;
      gm_award_(id, 'birthday', today.slice(0, 4));
      gm_credit_(id, '生日', gm_param_('壽星獎勵'), '生日快樂!', 'BDAY|' + id + '|' + today.slice(0, 4));
    });
    // 3. 徽章
    gm_autoBadges_();
    // 4. 月結(每月 1 日結算上月;若漏跑,下次執行會補)
    var ym = today.slice(0, 7), prev = gm_prevMonth_(ym);
    if (gm_getState_('已月結') !== prev) { gm_monthly_(prev); gm_setState_('已月結', prev); }
    // 4b. 塔防週戰(每週一結算上週;模組有安裝才執行)
    if (typeof td_weekly_ === 'function') td_weekly_(today);
    gm_gameWeekly_(today);
    // 4c. 寵物:孵化、相簿補齊;每週一寫寵物日記(v1.19)
    gm_petSyncAll_(); gm_petDiaryWeekly_(today);
    // 5. 正式版加倍(只做一次)
    var off = gm_param_('正式版開始日');
    if (off && today >= off && gm_getState_('已加倍') !== off) {
      var mult = Number(gm_param_('正式版加倍倍率')) || 1;
      Object.keys(emps).forEach(function (id) {
        if (emps[id].resigned) return;
        var bal = gm_balance_(id);
        if (bal > 0 && mult > 1) gm_credit_(id, '正式版加倍', bal * (mult - 1), '測試期餘額 ' + bal + ' ×' + mult, 'DOUBLE|' + id + '|' + off);
      });
      gm_setState_('已加倍', off);
    }
  } finally { lock.releaseLock(); }
}
function gm_installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'gm_dailyJob') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('gm_dailyJob').timeBased().atHour(3).nearMinute(10).everyDays(1).inTimezone('Asia/Taipei').create();
  return '已建立每日 03:10 自動結算';
}
function gm_setup() {
  Object.keys(GM_SHEETS).forEach(function (k) {   // 建表；舊表缺的標題欄(例如寵物 G 欄「遊戲加命」)只補空白格，不動資料
    var sh = gm_sh_(k), head = GM_SHEETS[k][1], cur = sh.getRange(1, 1, 1, head.length).getValues()[0];
    head.forEach(function (h, i) { if (String(cur[i]).trim() === '') sh.getRange(1, i + 1).setValue(h); });
  });
  var have = {}; gm_rows_('params').forEach(function (r) { have[String(r[0]).trim()] = 1; });
  var add = GM_PARAM_DEFAULTS.filter(function (p) { return !have[p[0]]; });
  if (add.length) gm_append_('params', add);
  var cat = {}; gm_rows_('catalog').forEach(function (r) { cat[r[0]] = 1; });
  var addC = GM_CATALOG_SEED.filter(function (c) { return !cat[c[0]]; });
  if (addC.length) gm_append_('catalog', addC);
  if (!gm_rows_('quiz').length) gm_append_('quiz', GM_QUIZ_SEED);   // 題庫初稿 30 題(隊長審核後可直接改試算表)
  return '已建立工作表與預設資料';
}

// ───────── 商品、擁有 ─────────
function gm_catalog_() {
  if (GM_CACHE_.catalog) return GM_CACHE_.catalog;
  var m = {}, rows = gm_rows_('catalog'); if (!rows.length) rows = GM_CATALOG_SEED;
  rows.forEach(function (r) {
    var id = String(r[0]).trim(); if (!id) return;
    m[id] = { id: id, name: String(r[1]), cat: String(r[2]), tier: String(r[3]), price: Number(r[4]) || 0, where: String(r[5]), series: String(r[6] || ''), note: String(r[7] || '') };
  });
  return (GM_CACHE_.catalog = m);
}
function gm_owned_(emp) { var o = {}; gm_rows_('owned').forEach(function (r) { if (r[0] === emp) o[r[1]] = 1; }); return o; }
// 給角色造型模組用:這個物品是不是要擁有才能穿
function gm_requiresOwn_(itemId) { var c = gm_catalog_()[itemId]; return !!c; }

function gm_buy_(p) {
  var emp = String(p.empId || '').trim(), item = String(p.item || '').trim(), e = gm_emp_(emp);
  if (!e || e.resigned) return { error: '帳號無法使用' };
  var c = gm_catalog_()[item]; if (!c || c.where !== '商店') return { error: '這個商品目前沒有販售' };
  if (gm_owned_(emp)[item]) return { error: '已經擁有了' };
  if (gm_balance_(emp) < c.price) return { error: '赤心幣不足' };
  gm_credit_(emp, '購買', -c.price, '購買「' + c.name + '」', 'BUY|' + emp + '|' + item);
  gm_append_('owned', [[emp, item, '購買', gm_now_()]]);
  try { CacheService.getScriptCache().remove('av_all'); } catch (e) {}
  gm_checkSocialBadges_(emp);
  return { success: true, data: { balance: gm_balance_(emp) } };
}

// ───────── 扭蛋 ─────────
function gm_gacha_(p) {
  var emp = String(p.empId || '').trim(), e = gm_emp_(emp);
  if (!e || e.resigned) return { error: '帳號無法使用' };
  var price = Number(gm_param_('扭蛋價格')) || 50, ym = gm_today_().slice(0, 7), mine = [];
  gm_rows_('gacha').forEach(function (r) { if (r[1] === emp) mine.push(r); });
  var thisMonth = mine.filter(function (r) { return String(r[0]).slice(0, 7) === ym; }).length;
  if (thisMonth >= (Number(gm_param_('扭蛋每月上限')) || 5)) return { error: '本月扭蛋次數已用完' };
  if (gm_balance_(emp) < price) return { error: '赤心幣不足' };
  var cat = gm_catalog_(), pool = { '普通': [], '稀有': [], '傳說': [] };
  Object.keys(cat).forEach(function (k) { if (cat[k].where === '扭蛋' && pool[cat[k].tier]) pool[cat[k].tier].push(cat[k]); });
  // 保底:最近連續幾次都是普通
  var streak = 0; for (var i = mine.length - 1; i >= 0 && String(mine[i][3]) === '普通'; i--) streak++;
  var pity = Number(gm_param_('扭蛋保底次數')) || 10, roll = Math.random() * 100;
  var leg = Number(gm_param_('扭蛋機率_傳說')) || 5, rare = Number(gm_param_('扭蛋機率_稀有')) || 25;
  var tier = roll < leg ? '傳說' : roll < leg + rare ? '稀有' : '普通';
  if (tier === '普通' && streak + 1 >= pity) tier = Math.random() * (leg + rare) < leg ? '傳說' : '稀有';
  if (!pool[tier].length) tier = pool['普通'].length ? '普通' : '稀有';
  var got = pool[tier][Math.floor(Math.random() * pool[tier].length)];
  if (!got) return { error: '扭蛋機目前沒有商品' };
  var dup = !!gm_owned_(emp)[got.id], refund = dup ? Number(gm_param_('扭蛋重複退幣')) || 0 : 0;
  var n = mine.length + 1;
  gm_credit_(emp, '扭蛋', -price, '扭蛋第 ' + n + ' 次', 'GACHA|' + emp + '|' + n);
  if (dup) gm_credit_(emp, '扭蛋退幣', refund, '重複「' + got.name + '」分解', 'GREF|' + emp + '|' + n);
  else gm_append_('owned', [[emp, got.id, '扭蛋', gm_now_()]]);
  gm_append_('gacha', [[gm_now_(), emp, got.id, tier, refund]]);
  // 系列收集完成
  if (!dup && got.series) {
    var own = gm_owned_(emp), all = Object.keys(cat).filter(function (k) { return cat[k].series === got.series; });
    if (all.every(function (k) { return own[k]; })) gm_award_(emp, 'collector', got.series);
  }
  gm_checkSocialBadges_(emp);
  return { success: true, data: { item: got, tier: tier, duplicate: dup, refund: refund, balance: gm_balance_(emp), left: (Number(gm_param_('扭蛋每月上限')) || 5) - thisMonth - 1 } };
}

// ───────── 寵物(v1.19 改版:第一隻免費、孵化時隨機型態、圖鑑再孵、交換、摸摸頭、相簿、日記)─────────
// 寵物表一列一隻;狀態「身邊」是目前帶著的那隻,「圖鑑」是長到完全體後收藏的。
// 成長時數 = 主人從「領養日期」起的工時 + 「加成小時」(寵物零食、交換前累積的時數)。
var GM_PET_TYPES = [['chicken', '雞'], ['trex', '暴龍'], ['digger', '挖土機'], ['train', '火車'], ['trice', '三角龍']];
function gm_petTypeName_(id) { for (var i = 0; i < GM_PET_TYPES.length; i++) if (GM_PET_TYPES[i][0] === id) return GM_PET_TYPES[i][1]; return ''; }
function gm_petId_() { return 'P' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10); }
function gm_petFromRow_(r, i) {
  var emp = r[0], hrs = Math.floor(gm_minutesSince_(emp, String(r[3])) / 60) + (Number(r[5]) || 0), stage = 0;
  GM_PET_STAGES.forEach(function (s, k) { if (hrs >= s[0]) stage = k; });
  var next = GM_PET_STAGES[stage + 1];
  return { id: String(r[9] || ''), owner: emp, flavor: r[1], name: r[2], since: String(r[3]), acc: String(r[4] || ''), hours: hrs,
           stage: stage + 1, stageName: GM_PET_STAGES[stage][1], nextAt: next ? next[0] : null,
           type: String(r[7] || ''), typeName: gm_petTypeName_(String(r[7] || '')), status: String(r[8] || '身邊') || '身邊',
           hatched: String(r[10] || ''), row: i + 2 };
}
function gm_pet_(emp) {      // 目前帶在身邊的那隻
  var rows = gm_rows_('pets');
  for (var i = 0; i < rows.length; i++) if (rows[i][0] === emp && (String(rows[i][8] || '身邊') || '身邊') === '身邊') return gm_petFromRow_(rows[i], i);
  return null;
}
function gm_petSet_(row, col, vals) {   // col 從 1 起算
  var rng = gm_sh_('pets').getRange(row, col, 1, vals.length); rng.setNumberFormat('@'); rng.setValues([vals.map(String)]);
  GM_CACHE_.rows_pets = null;
}
function gm_petEvent_(emp, kind, text) { gm_append_('petlog', [[gm_now_(), emp, kind, text]]); }
// 補齊:沒有寵物編號的舊資料補編號;滿 40 小時還沒型態的 → 隨機開出型態(孵化);每升一階段記一張相簿
function gm_petSync_(pet) {
  if (!pet) return pet;
  if (!pet.id) { pet.id = gm_petId_(); gm_petSet_(pet.row, 10, [pet.id]); }
  if (pet.stage >= 2 && !pet.type) {
    var t = GM_PET_TYPES[Math.floor(Math.random() * GM_PET_TYPES.length)][0];
    gm_petSet_(pet.row, 8, [t]); gm_petSet_(pet.row, 11, [gm_today_()]);
    pet.type = t; pet.typeName = gm_petTypeName_(t); pet.hatched = gm_today_();
    var e = gm_emp_(pet.owner);
    gm_petEvent_(pet.owner, 'hatch', (e ? (e.nick || e.name) : pet.owner) + ' 的蛋孵出了' + pet.typeName + '!');
  }
  var have = {}; gm_rows_('album').forEach(function (r) { if (r[1] === pet.id) have[String(r[2])] = 1; });
  var add = [];
  for (var st = 1; st <= pet.stage; st++) if (!have[String(st)]) add.push([pet.owner, pet.id, st, pet.type, pet.flavor, gm_today_(), st === pet.stage ? pet.hours : GM_PET_STAGES[st - 1][0]]);
  if (add.length) gm_append_('album', add);
  return pet;
}
function gm_petSyncAll_() {
  var rows = gm_rows_('pets').slice();
  rows.forEach(function (r, i) { if ((String(r[8] || '身邊') || '身邊') === '身邊') gm_petSync_(gm_petFromRow_(r, i)); });
}
// 領養:第一隻免費;之後只有身邊那隻長到完全體才能「收進圖鑑、再孵一顆」(也免費)
function gm_petBuy_(p) {
  var emp = String(p.empId || '').trim(), e = gm_emp_(emp);
  if (!e || e.resigned) return { error: '帳號無法使用' };
  var cur = gm_pet_(emp);
  if (cur && cur.stage < 5) return { error: '寵物長到完全體,才能收進圖鑑再孵新的蛋' };
  var flavor = GM_PET_FLAVORS.indexOf(p.flavor) >= 0 ? p.flavor : '原味';
  var name = String(p.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 8) || '小雞蛋糕';
  if (cur) { gm_petSync_(cur); gm_petSet_(cur.row, 9, ['圖鑑']); gm_petEvent_(emp, 'retire', cur.name + '(' + cur.typeName + ')收進圖鑑'); gm_petDexBadge_(emp); }
  gm_append_('pets', [[emp, flavor, name, gm_today_(), '', 0, 1, '', '身邊', gm_petId_(), '']]);
  return { success: true, data: gm_pet_(emp) };
}
function gm_petUpdate_(p) {
  var emp = String(p.empId || '').trim(), pet = gm_pet_(emp); if (!pet) return { error: '還沒有寵物' };
  var acc = p.acc != null ? String(p.acc) : pet.acc, cat = gm_catalog_();
  if (acc && (!cat[acc] || cat[acc].cat !== 'petacc' || !gm_owned_(emp)[acc])) return { error: '還沒擁有這個配件' };
  var name = p.name != null ? String(p.name).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 8) : pet.name;
  gm_petSet_(pet.row, 3, [name || pet.name, pet.since, acc]);
  return { success: true, data: gm_pet_(emp) };
}
function gm_petDex_(emp) {   // 圖鑑:自己養到完全體的(收進圖鑑的,加上身邊已是完全體的)
  var out = [];
  gm_rows_('pets').forEach(function (r, i) {
    if (r[0] !== emp) return; var pt = gm_petFromRow_(r, i);
    if (pt.status === '圖鑑' || (pt.status === '身邊' && pt.stage >= 5)) out.push({ id: pt.id, name: pt.name, type: pt.type, typeName: pt.typeName, flavor: pt.flavor, current: pt.status === '身邊' });
  });
  return out;
}
function gm_petDexBadge_(emp) {
  var got = {}; gm_petDex_(emp).forEach(function (d) { if (d.type) got[d.type] = 1; });
  if (Object.keys(got).length >= GM_PET_TYPES.length) gm_award_(emp, 'pet_dex');
}
function gm_petAlbum_(petId) {
  return gm_rows_('album').filter(function (r) { return r[1] === petId; }).map(function (r) {
    return { stage: Number(r[2]), stageName: (GM_PET_STAGES[Number(r[2]) - 1] || [])[1], type: r[3], flavor: r[4], date: String(r[5]), hours: Number(r[6]) || 0 };
  }).sort(function (a, b) { return a.stage - b.stage; });
}
// 摸摸頭:每人對同一隻寵物每天一次;記在互動紀錄(類型 pat),算進互動之星
function gm_petPat_(p) {
  var from = String(p.empId || '').trim(), to = String(p.to || '').trim();
  if (!gm_emp_(from) || gm_isFrozen_(from)) return { error: '帳號無法使用' };
  if (from === to) return { error: '自己的寵物每天都能抱抱,不用摸頭啦' };
  var pet = gm_petSync_(gm_pet_(to)); if (!pet) return { error: '對方還沒有寵物' };
  var today = gm_today_();
  if (gm_rows_('inter').some(function (r) { return String(r[1]) === today && r[2] === from && r[3] === to && r[4] === 'pat'; })) return { error: '今天已經摸過牠了' };
  gm_append_('inter', [[gm_now_(), today, from, to, 'pat', '']]);
  gm_checkSocialBadges_(to);
  return { success: true, data: { stage: pet.stage, type: pet.type, name: pet.name } };
}
// ───── 交換:一對一、同階段、第 2~4 階段、雙方同意、每人 30 天一次、配件不跟著走 ─────
function gm_tradeLast_(emp) {
  var last = ''; gm_rows_('trades').forEach(function (r) { if (r[3] === '完成' && (r[1] === emp || r[2] === emp) && String(r[5]) > last) last = String(r[5]); });
  return last.slice(0, 10);
}
function gm_tradeCheck_(a, b) {
  var pa = gm_petSync_(gm_pet_(a)), pb = gm_petSync_(gm_pet_(b)), days = Number(gm_param_('寵物交換間隔天數')) || 30, today = gm_today_();
  if (!pa) return '你還沒有寵物'; if (!pb) return '對方還沒有寵物';
  if (pa.stage < 2 || pb.stage < 2 || !pa.type || !pb.type) return '還在蛋的階段不能交換';
  if (pa.stage >= 5 || pb.stage >= 5) return '完全體不能交換';
  if (pa.stage !== pb.stage) return '只能交換相同階段的寵物(你:第 ' + pa.stage + ' 階段,對方:第 ' + pb.stage + ' 階段)';
  var la = gm_tradeLast_(a), lb = gm_tradeLast_(b);
  if (la && gm_addDays_(la, days) > today) return '你在 ' + gm_addDays_(la, days) + ' 之後才能再交換';
  if (lb && gm_addDays_(lb, days) > today) return '對方在 ' + gm_addDays_(lb, days) + ' 之後才能再交換';
  return '';
}
function gm_tradeOffer_(p) {
  var from = String(p.empId || '').trim(), to = String(p.to || '').trim();
  if (!gm_emp_(from) || gm_isFrozen_(from)) return { error: '帳號無法使用' };
  if (!gm_emp_(to) || gm_isFrozen_(to) || from === to) return { error: '找不到這位夥伴' };
  var err = gm_tradeCheck_(from, to); if (err) return { error: err };
  if (gm_rows_('trades').some(function (r) { return r[3] === '等待中' && (r[1] === from || r[2] === from); })) return { error: '你已經有一筆等待中的交換,先處理完再提出' };
  var id = 'T' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss');
  gm_append_('trades', [[id, from, to, '等待中', gm_now_(), '']]);
  return { success: true };
}
function gm_tradeReply_(p) {
  var me = String(p.empId || '').trim(), id = String(p.id || ''), rows = gm_rows_('trades'), i = -1;
  for (var k = 0; k < rows.length; k++) if (rows[k][0] === id) i = k;
  if (i < 0) return { error: '找不到這筆交換' };
  var r = rows[i], row = i + 2, set = function (st) { var rng = gm_sh_('trades').getRange(row, 4, 1, 3); rng.setNumberFormat('@'); rng.setValues([[st, String(r[4]), gm_now_()]]); GM_CACHE_.rows_trades = null; };
  if (r[3] !== '等待中') return { error: '這筆交換已經處理過了' };
  if (p.cancel) { if (r[1] !== me) return { error: '只有提出的人可以取消' }; set('已取消'); return { success: true }; }
  if (r[2] !== me) return { error: '這筆交換不是給你的' };
  if (!p.accept) { set('已拒絕'); return { success: true }; }
  var err = gm_tradeCheck_(r[1], r[2]); if (err) { set('已失效'); return { error: '條件已經不符合:' + err }; }
  var pa = gm_pet_(r[1]), pb = gm_pet_(r[2]), today = gm_today_();
  // 交換後:換主人、領養日期改今天、累積時數存進「加成小時」(之後依新主人的工時繼續長)、配件拿下(留在原主人物品裡)
  gm_petSet_(pa.row, 1, [r[2]]); gm_petSet_(pa.row, 4, [today, '', String(pa.hours)]);
  gm_petSet_(pb.row, 1, [r[1]]); gm_petSet_(pb.row, 4, [today, '', String(pb.hours)]);
  set('完成');
  var ea = gm_emp_(r[1]), eb = gm_emp_(r[2]);
  gm_petEvent_(r[1], 'trade', (ea.nick || ea.name) + ' 和 ' + (eb.nick || eb.name) + ' 交換了寵物(' + pa.typeName + ' ⇄ ' + pb.typeName + ')');
  return { success: true, data: gm_pet_(me) };
}
function gm_tradesFor_(emp) {
  var emps = gm_emps_(), nm = function (id) { var e = emps[id]; return e ? (e.nick || e.name) : id; };
  return gm_rows_('trades').filter(function (r) { return r[3] === '等待中' && (r[1] === emp || r[2] === emp); }).map(function (r) {
    var other = r[1] === emp ? r[2] : r[1], op = gm_pet_(other);
    return { id: r[0], mine: r[1] === emp, other: other, otherName: nm(other), otherPet: op ? { name: op.name, type: op.type, typeName: op.typeName, stage: op.stage, flavor: op.flavor } : null, time: String(r[4]) };
  });
}
// ───── 寵物日記:每週一寫上週,只寫有上班的人 ─────
function gm_petDiaryWeekly_(today) {
  var t = new Date(today + 'T00:00:00Z'); if (t.getUTCDay() !== 1) return;
  var from = gm_addDays_(today, -7), to = gm_addDays_(today, -1), wk = from;
  var done = {}; gm_rows_('diary').forEach(function (r) { done[r[0] + '|' + r[1]] = 1; });
  var add = [];
  gm_rows_('pets').forEach(function (r, i) {
    if ((String(r[8] || '身邊') || '身邊') !== '身邊' || done[r[0] + '|' + wk] || gm_isFrozen_(r[0])) return;
    var pet = gm_petFromRow_(r, i), emp = r[0], mins = 0, locs = {};
    gm_rows_('hours').forEach(function (h) { if (h[1] === emp && String(h[0]) >= from && String(h[0]) <= to) { mins += Number(h[3]) || 0; locs[h[2]] = (locs[h[2]] || 0) + (Number(h[3]) || 0); } });
    if (mins < 60) return;
    var top = Object.keys(locs).sort(function (a, b) { return locs[b] - locs[a]; })[0] || '';
    var shortLoc = String(top).replace(/^\d+/, '').replace(/^(正櫃|快閃櫃|展覽|活動|分隊長)/, '');
    var recv = {}; gm_rows_('inter').forEach(function (x) { if (x[3] === emp && String(x[1]) >= from && String(x[1]) <= to) recv[x[2]] = 1; });
    var right = 0; gm_rows_('answers').forEach(function (x) { if (x[1] === emp && String(x[0]) >= from && String(x[0]) <= to && String(x[4]) === '對') right++; });
    var grew = gm_rows_('album').filter(function (x) { return x[1] === pet.id && String(x[5]) >= from && String(x[5]) <= to && Number(x[2]) >= 2; }).map(function (x) { return Number(x[2]); });
    var parts = ['這週陪主人在' + (shortLoc || '櫃位') + '上了 ' + Math.round(mins / 6) / 10 + ' 小時班'];
    if (Object.keys(recv).length) parts.push('主人收到 ' + Object.keys(recv).length + ' 位夥伴的加油');
    if (right) parts.push('我們一起答對了 ' + right + ' 題');
    var txt = parts.join(',') + '。';
    if (grew.length) txt += '我長大了,現在是「' + GM_PET_STAGES[Math.max.apply(null, grew) - 1][1] + '」!';
    txt += ['下週也一起加油!', '主人辛苦了~', '最喜歡陪主人上班了!'][Math.floor(Math.random() * 3)];
    add.push([emp, wk, txt, gm_now_()]);
  });
  if (add.length) gm_append_('diary', add);
}
function gm_lastWorkDate_(emp) {
  var today = gm_today_(), last = ''; gm_rows_('hours').forEach(function (r) { if (r[1] === emp && String(r[0]) < today && String(r[0]) > last && Number(r[3]) > 0) last = String(r[0]); });
  return last;
}

// ───────── 互動 ─────────
function gm_interact_(p) {
  var from = String(p.empId || '').trim(), to = String(p.to || '').trim(), type = String(p.type || '');
  if (!gm_emp_(from) || gm_isFrozen_(from)) return { error: '帳號無法使用' };
  if (!gm_emp_(to) || gm_isFrozen_(to)) return { error: '找不到這位夥伴' };
  if (from === to) return { error: '不能對自己互動' };
  if (!GM_INTER_TYPES[type] || type === 'pat') return { error: '互動類型不正確' };
  var today = gm_today_(), dup = gm_rows_('inter').some(function (r) { return String(r[1]) === today && r[2] === from && r[3] === to && r[4] === type; });
  if (dup) return { error: '今天已經對他' + GM_INTER_TYPES[type] + '過了' };
  gm_append_('inter', [[gm_now_(), today, from, to, type, '']]);
  gm_checkSocialBadges_(to);
  return { success: true };
}
function gm_inboxRead_(p) {
  var emp = String(p.empId || '').trim(), sh = gm_sh_('inter'), rows = gm_rows_('inter');
  rows.forEach(function (r, i) { if (r[3] === emp && !r[5]) sh.getRange(i + 2, 6).setValue('Y'); });
  return { success: true };
}

// ───────── 每日一題 ─────────
function gm_hash_(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
function gm_todayQuestion_(emp) {
  var today = gm_today_(), done = {}, todayRow = null;
  gm_rows_('answers').forEach(function (r) { if (r[1] === emp) { done[r[2]] = 1; if (String(r[0]) === today) todayRow = r; } });
  var qs = gm_rows_('quiz').filter(function (r) { return String(r[0]).trim() && !/^(否|N|FALSE|false)$/.test(String(r[9]).trim()); });
  if (todayRow) {
    var q0 = qs.filter(function (r) { return String(r[0]) === String(todayRow[2]); })[0];
    return { answered: true, correct: String(todayRow[4]) === '對', choice: todayRow[3], q: q0 };
  }
  var pool = qs.filter(function (r) { return !done[r[0]]; }); if (!pool.length) pool = qs;
  if (!pool.length) return { none: true };
  return { answered: false, q: pool[gm_hash_(emp + today) % pool.length] };
}
function gm_qOut_(r, withAnswer) {
  if (!r) return null;
  var o = { id: String(r[0]), cat: r[1], text: r[2], options: { A: r[3], B: r[4], C: r[5], D: r[6] } };
  if (withAnswer) { o.answer = String(r[7]).trim().toUpperCase(); o.explain = r[8]; }
  return o;
}
function gm_answer_(p) {
  var emp = String(p.empId || '').trim(); if (!gm_emp_(emp) || gm_isFrozen_(emp)) return { error: '帳號無法使用' };
  if (gm_today_() < gm_param_('測試版開始日')) return { error: '每日一題將於測試版開始後開放' };
  var st = gm_todayQuestion_(emp); if (st.none) return { error: '題庫還沒有題目' };
  if (st.answered) return { error: '今天已經作答過了' };
  if (String(p.qid) !== String(st.q[0])) return { error: '題目已更新,請重新整理' };
  var ans = String(p.answer || '').toUpperCase(), right = ans === String(st.q[7]).trim().toUpperCase(), today = gm_today_();
  gm_append_('answers', [[today, emp, st.q[0], ans, right ? '對' : '錯', gm_now_()]]);
  var bonus = 0;
  if (right) {
    gm_credit_(emp, '每日一題', gm_param_('每日一題獎勵'), '每日一題答對', 'QUIZ|' + emp + '|' + today);
    // 連續 7 天答對
    var map = {}; gm_rows_('answers').forEach(function (r) { if (r[1] === emp) map[String(r[0])] = String(r[4]) === '對'; });
    var n = 0; for (var d = today; map[d]; d = gm_addDays_(d, -1)) n++;
    if (n > 0 && n % 7 === 0) { bonus = Number(gm_param_('連續答對7天加碼')) || 0; gm_credit_(emp, '每日一題', bonus, '連續答對 ' + n + ' 天', 'QSTREAK|' + emp + '|' + today); gm_drop_(emp, '每日一題連續答對 ' + n + ' 天', 'QDROP|' + emp + '|' + today); }
  }
  gm_checkSocialBadges_(emp);
  return { success: true, data: { correct: right, question: gm_qOut_(st.q, true), bonus: bonus, balance: gm_balance_(emp) } };
}

// ───────── 生日祝福 ─────────
function gm_birthdaysToday_() {
  var md = gm_today_().slice(5), emps = gm_emps_(), out = [];
  Object.keys(emps).forEach(function (id) { var e = emps[id]; if (!e.resigned && gm_bdMD_(e.birthday) === md) out.push({ id: id, name: e.nick || e.name }); });
  return out;
}
function gm_wish_(p) {
  var from = String(p.empId || '').trim(), to = String(p.to || '').trim(), today = gm_today_();
  if (!gm_emp_(from) || gm_isFrozen_(from)) return { error: '帳號無法使用' };
  if (!gm_birthdaysToday_().some(function (b) { return b.id === to; })) return { error: '今天不是他的生日' };
  if (from === to) return { error: '不能祝福自己' };
  var rows = gm_rows_('wishes');
  if (rows.some(function (r) { return String(r[0]) === today && r[1] === to && r[2] === from; })) return { error: '已經送過祝福了' };
  gm_append_('wishes', [[today, to, from, gm_now_()]]);
  var sentToday = rows.filter(function (r) { return String(r[0]) === today && r[2] === from; }).length;
  if (sentToday <= 3) gm_credit_(from, '送祝福', gm_param_('送祝福獎勵'), '祝 ' + (gm_emp_(to).nick || gm_emp_(to).name) + ' 生日快樂', 'WISH|' + from + '|' + to + '|' + today);
  return { success: true };
}

// ───────── 團隊基金 ─────────
function gm_fundInfo_() {
  var total = 0, by = {};
  gm_rows_('fund').forEach(function (r) { var n = Number(r[2]) || 0; total += n; by[r[1]] = (by[r[1]] || 0) + n; });
  var tiers = String(gm_param_('基金解鎖') || '').split(',').map(function (s) { var a = s.split(':'); return { at: Number(a[0]), key: String(a[1] || '').trim() }; })
    .filter(function (x) { return x.at > 0 && x.key; }).sort(function (a, b) { return a.at - b.at; });
  var emps = gm_emps_();
  var top = Object.keys(by).map(function (k) { return { id: k, name: emps[k] ? (emps[k].nick || emps[k].name) : k, amount: by[k] }; })
    .sort(function (a, b) { return b.amount - a.amount; }).slice(0, 5);
  return { total: total, tiers: tiers.map(function (t) { return { at: t.at, key: t.key, unlocked: total >= t.at }; }), top: top, by: by };
}
function gm_donate_(p) {
  var emp = String(p.empId || '').trim(), amt = Math.floor(Number(p.amount) || 0);
  if (!gm_emp_(emp) || gm_isFrozen_(emp)) return { error: '帳號無法使用' };
  if (amt < (Number(gm_param_('捐獻最低')) || 10)) return { error: '一次至少捐 ' + gm_param_('捐獻最低') + ' 枚' };
  if (gm_balance_(emp) < amt) return { error: '赤心幣不足' };
  var n = gm_rows_('fund').length + 1;
  gm_credit_(emp, '捐獻', -amt, '捐入團隊基金', 'FUND|' + emp + '|' + n + '|' + gm_now_());
  gm_append_('fund', [[gm_now_(), emp, amt]]);
  gm_checkSocialBadges_(emp);
  return { success: true, data: { balance: gm_balance_(emp), fund: gm_fundInfo_() } };
}

// ───────── 徽章配戴 ─────────
function gm_wear_(p) {
  var emp = String(p.empId || '').trim(), want = [];
  try { want = typeof p.badges === 'string' ? JSON.parse(p.badges) : (p.badges || []); } catch (e) { want = []; }
  want = want.slice(0, 3);
  var sh = gm_sh_('badges'), rows = gm_rows_('badges'), seen = {};
  rows.forEach(function (r, i) {
    if (r[0] !== emp) return;
    var on = want.indexOf(r[1]) >= 0 && !seen[r[1]];
    if (on) seen[r[1]] = 1;
    if ((r[4] === 'Y') !== on) sh.getRange(i + 2, 5).setValue(on ? 'Y' : '');
  });
  return { success: true };
}

// ───────── 寵物小遊戲 ─────────
function gm_weekFrom_(d) { var t = new Date(d + 'T00:00:00Z'); return gm_addDays_(d, -((t.getUTCDay() + 6) % 7)); }
function gm_games_(p) {
  var emp = String(p.empId || '').trim(), pet = gm_pet_(emp), today = gm_today_(), wk = gm_weekFrom_(today), emps = gm_emps_();
  var best = {}, week = {}, todayGot = 0;
  gm_rows_('games').forEach(function (r) {
    var g = r[3], sc = Number(r[4]) || 0;
    if (r[2] === emp) { best[g] = Math.max(best[g] || 0, sc); if (String(r[1]) === today) todayGot += Number(r[5]) || 0; }
    if (String(r[1]) >= wk) { var k = g + '|' + r[2]; week[k] = Math.max(week[k] || 0, sc); }
  });
  var games = GM_GAMES.map(function (g) {
    var top = Object.keys(week).filter(function (k) { return k.split('|')[0] === g[0]; }).map(function (k) { var id = k.split('|')[1]; return { name: emps[id] ? (emps[id].nick || emps[id].name) : id, score: week[k], me: id === emp }; })
      .sort(function (a, b) { return b.score - a.score; }).slice(0, 5);
    return { id: g[0], name: g[1], stage: g[2], reward: g[3], unlocked: !!pet && pet.stage >= g[2], best: best[g[0]] || 0, top: top };
  });
  var lives = pet ? Number((gm_rows_('pets')[pet.row - 2] || [])[6]) || 0 : 0;
  return { success: true, data: { pet: pet, games: games, todayGot: todayGot, cap: Number(gm_param_('小遊戲每日上限')) || 5, extraLives: lives } };
}
function gm_gameStart_(p) {   // 開局:有寵物零食加的命就用掉一條
  var emp = String(p.empId || '').trim(), pet = gm_pet_(emp); if (!pet) return { error: '先領養寵物才能玩' };
  var g = GM_GAMES.filter(function (x) { return x[0] === p.game; })[0]; if (!g) return { error: '沒有這款遊戲' };
  if (pet.stage < g[2]) return { error: '寵物長到第 ' + g[2] + ' 階段才解鎖' };
  var lives = Number(gm_rows_('pets')[pet.row - 2][6]) || 0, extra = 0;
  if (lives > 0) { var rng = gm_sh_('pets').getRange(pet.row, 7); rng.setNumberFormat('@'); rng.setValue(String(lives - 1)); extra = 1; GM_CACHE_.rows_pets = null; }
  return { success: true, data: { extra: extra, left: Math.max(0, lives - extra) } };
}
function gm_gameScore_(p) {
  var emp = String(p.empId || '').trim(), e = gm_emp_(emp); if (!e || e.resigned) return { error: '帳號無法使用' };
  var g = GM_GAMES.filter(function (x) { return x[0] === p.game; })[0]; if (!g) return { error: '沒有這款遊戲' };
  var pet = gm_pet_(emp); if (!pet || pet.stage < g[2]) return { error: '這款遊戲還沒解鎖' };
  var score = Math.max(0, Math.min(g[4], Math.round(Number(p.score) || 0))), today = gm_today_();
  var best = 0, got = 0;
  gm_rows_('games').forEach(function (r) { if (r[2] === emp) { if (r[3] === g[0]) best = Math.max(best, Number(r[4]) || 0); if (String(r[1]) === today) got += Number(r[5]) || 0; } });
  var cap = Number(gm_param_('小遊戲每日上限')) || 5, reward = 0;
  if (score > best && score > 0 && today >= gm_param_('測試版開始日')) {
    reward = Math.max(0, Math.min(g[3], cap - got));
    if (reward) gm_credit_(emp, '小遊戲', reward, g[1] + ' 破個人紀錄(' + score + ' 分)', 'GAME|' + emp + '|' + g[0] + '|' + gm_now_() + '|' + score);
  }
  gm_append_('games', [[gm_now_(), today, emp, g[0], score, reward]]);
  return { success: true, data: { score: score, best: Math.max(best, score), newRecord: score > best, reward: reward } };
}
function gm_gameWeekly_(today) {   // 每週一:上週各遊戲第一名頒「小遊戲週冠軍」
  if (((new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7) !== 0) return;
  var from = gm_addDays_(today, -7), to = gm_addDays_(today, -1), top = {};
  gm_rows_('games').forEach(function (r) {
    var d = String(r[1]); if (d < from || d > to) return;
    var sc = Number(r[4]) || 0; if (!top[r[3]] || sc > top[r[3]].sc) top[r[3]] = { emp: r[2], sc: sc };
  });
  Object.keys(top).forEach(function (g) { if (top[g].sc > 0 && !gm_isFrozen_(top[g].emp)) gm_award_(top[g].emp, 'gamer', g + '|' + from); });
}

// ───────── 管理者 ─────────
function gm_admin_(p) {
  var me = gm_emp_(p.empId); if (!gm_isTop_(me)) return { error: '只有大隊長(第 5 級)與總經理(第 4 級)可以使用' };
  var target = String(p.target || '').trim(), reason = String(p.reason || '').trim().slice(0, 100);
  if (!gm_emp_(target)) return { error: '找不到員工編號 ' + target };
  if (!reason) return { error: '請填寫理由' };
  if (p.badge) {
    if (['mentor', 'special'].indexOf(p.badge) < 0) return { error: '只能手動頒發「好導師」或「特別貢獻」' };
    var ok = gm_award_(target, p.badge, gm_now_(), p.amount != null && p.amount !== '' ? Number(p.amount) : null);
    gm_append_('ledger', [[gm_now_(), target, '管理紀錄', 0, me.name + ' 頒發徽章 ' + p.badge + ':' + reason, '']]);
    return ok ? { success: true } : { error: '頒發失敗' };
  }
  var amt = Math.round(Number(p.amount) || 0); if (!amt) return { error: '請輸入數量' };
  gm_credit_(target, '管理調整', amt, me.name + ':' + reason, 'ADMIN|' + target + '|' + gm_now_() + '|' + Math.random());
  return { success: true, data: { balance: gm_balance_(target) } };
}

// ───────── 給 App 的資料包 ─────────
function gm_me_(p) {
  var emp = String(p.empId || '').trim(), e = gm_emp_(emp); if (!e) return { error: '找不到此帳號' };
  var today = gm_today_(), ym = today.slice(0, 7), cat = gm_catalog_(), owned = gm_owned_(emp);
  var myPet = gm_petSync_(gm_pet_(emp));   // 順便處理孵化與相簿
  var ledger = gm_rows_('ledger').filter(function (r) { return r[1] === emp && Number(r[3]); }).slice(-30).reverse()
    .map(function (r) { return { time: String(r[0]), type: r[2], amount: Number(r[3]), note: r[4] }; });
  var mine = {}; gm_rows_('badges').forEach(function (r) { if (r[0] === emp) (mine[r[1]] = mine[r[1]] || []).push({ period: String(r[2]), time: String(r[3]), worn: r[4] === 'Y' }); });
  var badges = GM_BADGES.map(function (b) { return { id: b[0], name: b[1], icon: b[2], desc: b[3], coins: b[4], got: mine[b[0]] || [] }; });
  var qs = gm_todayQuestion_(emp);
  var inbox = gm_rows_('inter').filter(function (r) { return r[3] === emp; }).slice(-20).reverse().map(function (r) {
    var f = gm_emp_(r[2]); return { time: String(r[0]), from: r[2], fromName: f ? (f.nick || f.name) : r[2], type: r[4], label: GM_INTER_TYPES[r[4]] || r[4], unread: !r[5] };
  });
  var sentToday = gm_rows_('inter').filter(function (r) { return r[2] === emp && String(r[1]) === today; }).map(function (r) { return r[3] + '|' + r[4]; });
  var bdays = gm_birthdaysToday_().map(function (b) {
    var w = gm_rows_('wishes').filter(function (r) { return String(r[0]) === today && r[1] === b.id; });
    return { id: b.id, name: b.name, wishes: w.length, wished: w.some(function (r) { return r[2] === emp; }),
             from: b.id === emp ? w.map(function (r) { var f = gm_emp_(r[2]); return f ? (f.nick || f.name) : r[2]; }) : [] };
  });
  var gThis = gm_rows_('gacha').filter(function (r) { return r[1] === emp && String(r[0]).slice(0, 7) === ym; }).length;
  var fund = gm_fundInfo_();
  var params = {}; ['測試版開始日', '正式版開始日', '正式版加倍倍率', '扭蛋價格', '扭蛋每月上限', '扭蛋機率_稀有', '扭蛋機率_傳說', '扭蛋保底次數', '扭蛋重複退幣', '寵物價格', '捐獻最低', '冠軍櫃位總獎勵', '互動之星獎勵']
    .forEach(function (k) { params[k] = gm_param_(k); });
  return { success: true, data: {
    balance: gm_balance_(emp), frozen: e.resigned, role: e.role, isTop: gm_isTop_(e), today: today, params: params, ledger: ledger,
    catalog: Object.keys(cat).map(function (k) { var c = cat[k]; return { id: c.id, name: c.name, cat: c.cat, tier: c.tier, price: c.price, where: c.where, series: c.series, owned: !!owned[k] }; }),
    badges: badges, pet: myPet, petStages: GM_PET_STAGES, petTypes: GM_PET_TYPES,
    petAlbum: myPet ? gm_petAlbum_(myPet.id) : [], petDex: gm_petDex_(emp), petEverOwned: gm_rows_('pets').some(function (r) { return r[0] === emp; }),
    petDiary: gm_rows_('diary').filter(function (r) { return r[0] === emp; }).slice(-12).reverse().map(function (r) { return { week: String(r[1]), text: r[2] }; }),
    petTrades: gm_tradesFor_(emp), petTradeNext: (function () { var l = gm_tradeLast_(emp); return l ? gm_addDays_(l, Number(gm_param_('寵物交換間隔天數')) || 30) : ''; })(),
    lastWork: gm_lastWorkDate_(emp),
    petPartners: (function () {   // 可以提出交換的夥伴(同階段、第 2~4 階段)
      if (!myPet || myPet.stage < 2 || myPet.stage >= 5) return [];
      var out = [], emps = gm_emps_();
      gm_rows_('pets').forEach(function (r, i) {
        if (r[0] === emp || (String(r[8] || '身邊') || '身邊') !== '身邊' || !emps[r[0]] || emps[r[0]].resigned) return;
        var pt = gm_petFromRow_(r, i); if (pt.stage !== myPet.stage || !pt.type) return;
        out.push({ id: r[0], name: emps[r[0]].nick || emps[r[0]].name, pet: { name: pt.name, type: pt.type, typeName: pt.typeName, flavor: pt.flavor, stage: pt.stage } });
      });
      return out;
    })(),
    quiz: qs.none ? { none: true } : { answered: qs.answered, correct: qs.correct, choice: qs.choice, question: gm_qOut_(qs.q, qs.answered) },
    inbox: inbox, sentToday: sentToday, birthdays: bdays,
    gifts: typeof pv_rows_ === 'function' ? pv_rows_('gifts').filter(function (r) { return r[2] === emp && !r[4]; }).map(function (r) {
      var f = gm_emp_(r[1]), c = gm_catalog_()[r[3]] || {}; return { from: f ? (f.nick || f.name) : r[1], item: c.name, icon: String(c.note || '').split(':')[1] || '🎁' }; }) : [],
    gacha: { used: gThis, left: Math.max(0, (Number(gm_param_('扭蛋每月上限')) || 5) - gThis) },
    fund: { total: fund.total, tiers: fund.tiers, top: fund.top, mine: fund.by[emp] || 0 },
    ranking: gm_revenueRank_(ym).map(function (x, i) { return { rank: i + 1, loc: x.loc, rev: x.rev }; }),
    champion: { ym: gm_prevMonth_(ym), loc: gm_getState_('冠軍櫃位_' + gm_prevMonth_(ym)) }
  } };
}
// 宇宙辦公室用的公開資料(不含金額):寵物、配戴徽章、生日、冠軍、基金解鎖、最近互動
function gm_scene_() {
  var emps = gm_emps_(), pets = {}, worn = {};
  gm_rows_('pets').forEach(function (r, i) { if ((String(r[8] || '身邊') || '身邊') !== '身邊') return; var pt = gm_petFromRow_(r, i); pets[r[0]] = { flavor: pt.flavor, name: pt.name, stage: pt.stage, acc: pt.acc, type: pt.type }; });
  var icon = {}; GM_BADGES.forEach(function (b) { icon[b[0]] = b[2]; });
  gm_rows_('badges').forEach(function (r) { if (r[4] === 'Y') (worn[r[0]] = worn[r[0]] || []).push(icon[r[1]] || ''); });
  var feed = gm_rows_('inter').slice(-15).reverse().map(function (r) {
    var a = emps[r[2]], b = emps[r[3]];
    return { time: String(r[0]), from: r[2], to: r[3], fromName: a ? (a.nick || a.name) : r[2], toName: b ? (b.nick || b.name) : r[3], type: r[4], label: GM_INTER_TYPES[r[4]] };
  });
  var petFeed = gm_rows_('petlog').slice(-10).reverse().map(function (r) { return { time: String(r[0]), emp: r[1], kind: r[2], text: r[3] }; });
  var ym = gm_today_().slice(0, 7);
  var boss = null; Object.keys(emps).forEach(function (id) { var e = emps[id]; if (!boss && !e.resigned && (e.pos === '大隊長' || e.role >= 5)) boss = { id: id, name: e.nick || e.name }; });
  return { success: true, data: { pets: pets, worn: worn, birthdays: gm_birthdaysToday_(), feed: feed, petFeed: petFeed, boss: boss,
    champion: gm_getState_('冠軍櫃位_' + gm_prevMonth_(ym)), unlocks: gm_fundInfo_().tiers.filter(function (t) { return t.unlocked; }).map(function (t) { return t.key; }),
    anniversary: String(gm_param_('品牌週年日') || '') } };
}

// ───────── 路由 ─────────
function gmHandler_(action, p) {
  if (!/^gm[A-Z]/.test(String(action || ''))) return null;
  p = p || {};
  try {
    GM_CACHE_ = {};
    var write = ['gmGameStart', 'gmGameScore', 'gmBuy', 'gmGacha', 'gmPetBuy', 'gmPetUpdate', 'gmPetPat', 'gmPetTrade', 'gmPetTradeReply', 'gmInteract', 'gmInboxRead', 'gmAnswer', 'gmWish', 'gmDonate', 'gmWear', 'gmAdmin', 'gmRunDaily'];
    var lock = null;
    if (write.indexOf(action) >= 0) { lock = LockService.getScriptLock(); lock.waitLock(20000); }
    try {
      switch (action) {
        case 'gmMe': return gm_me_(p);
        case 'gmScene': return gm_scene_();
        case 'gmBuy': return gm_buy_(p);
        case 'gmGacha': return gm_gacha_(p);
        case 'gmPetBuy': return gm_petBuy_(p);
        case 'gmPetUpdate': return gm_petUpdate_(p);
        case 'gmPetPat': return gm_petPat_(p);
        case 'gmPetTrade': return gm_tradeOffer_(p);
        case 'gmPetTradeReply': return gm_tradeReply_(p);
        case 'gmInteract': return gm_interact_(p);
        case 'gmInboxRead': return gm_inboxRead_(p);
        case 'gmAnswer': return gm_answer_(p);
        case 'gmWish': return gm_wish_(p);
        case 'gmDonate': return gm_donate_(p);
        case 'gmWear': return gm_wear_(p);
        case 'gmAdmin': return gm_admin_(p);
        case 'gmGames': return gm_games_(p);
        case 'gmGameStart': return gm_gameStart_(p);
        case 'gmGameScore': return gm_gameScore_(p);
        case 'gmRunDaily': { var me = gm_emp_(p.empId); if (!gm_isTop_(me)) return { error: '只有大隊長與總經理可以使用' };
          if (lock) { lock.releaseLock(); lock = null; } gm_dailyJob(); return { success: true }; }
      }
    } finally { if (lock) lock.releaseLock(); }
    return { error: '未知的遊戲動作' };
  } catch (e) { return { error: '遊戲功能發生錯誤:' + e.message }; }
}
