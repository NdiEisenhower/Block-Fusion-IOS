// Game Configuration
const CONFIG = {
    // Disabled Ads per platform: 'huawei', 'google', 'web', 'both' (huawei & google), 'all', or 'none'
    // Can be an array (e.g. ['huawei']), object ({ huawei: true, google: false, web: false }), or string keyword
    DISABLED_ADS_PLATFORMS: {
        huawei: false,  // Ads enabled on Huawei
        google: false,  // Ads enabled on Google
        web: false,     // Ads enabled on Web
        ios: false      // Ads enabled on Apple iOS
    },

    // App Versioning
    APP_VERSION: '1.0.0',
    APP_BUILD: 1,

    // Show Ads related UI elements ('auto' evaluates per platform, or explicitly true/false)
    SHOW_ADS_UI: 'auto',
    ENABLE_MULTI_LANGUAGE: false,

    isAdsUiEnabled() {
        if (this.SHOW_ADS_UI === true) return true;
        if (this.SHOW_ADS_UI === false) return false;
        try {
            if (typeof AdService !== 'undefined' && typeof AdService.isAdEnabled === 'function') {
                return AdService.isAdEnabled();
            }
        } catch (e) { }
        return true;
    },

    // Ads Configuration
    ADS: {
        INTERSTITIAL_GAME_COUNT_FREQUENCY: 3, // Show interstitial ad every N game plays / rounds (default: 3)
        SHOW_BANNER_IN_GAME: true            // Show banner ad at the top during game play
    },

    // Maximum levels playable without account (legacy - kept for backward compatibility)
    MAX_OFFLINE_LEVELS: 50,

    // Offline Mode Settings (Active on mobile app, disabled on website for unlimited play)
    OFFLINE: {
        MAX_LEVELS: 5,            // Maximum number of offline levels allowed (mobile only)
        WARNING_THRESHOLD: 2,     // Show warning when this many moves left
        ENABLED: typeof window !== 'undefined' && (typeof Android !== 'undefined' || !!window.Android || !!window.Billing),
        RESET_ON_LOGIN: true      // Reset offline count when user logs in
    },

    WORLDS: [
        { id: 0, name: 'Forest', icon: '🌳', color: '#4a8', unlockStars: 0 },
        { id: 1, name: 'Desert', icon: '🏜️', color: '#d4a030', unlockStars: 15 },
        { id: 2, name: 'Snow', icon: '❄️', color: '#80c8f0', unlockStars: 35 },
        { id: 3, name: 'Volcano', icon: '🌋', color: '#e06030', unlockStars: 60 },
        { id: 4, name: 'Galaxy', icon: '🌌', color: '#9060e0', unlockStars: 90 },
        { id: 5, name: 'Sky', icon: '☁️', color: '#60b0e0', unlockStars: 120 },
        { id: 6, name: 'Ocean', icon: '🌊', color: '#2080c0', unlockStars: 155 },
        { id: 7, name: 'Mythic', icon: '🐉', color: '#a060d0', unlockStars: 195 },
    ],

    THEME_LABELS: {
        numbers: ['2', '4', '8', '16', '32', '64', '128', '256', '512', '1024', '2048', '4096', '8192', '16384', '32768', '65536'],
        fruit: ['🍎', '🍐', '🍊', '🍋', '🍇', '🍉', '🍓', '🍑', '🍒', '🥝', '🥭', '🍍', '🥥', '🍌', '🍈', '🍎'],
        animals: ['🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦'],
        space: ['🌙', '☄️', '🪐', '⭐', '🌍', '🚀', '🛸', '🌞', '💫', '🌌', '🛰️', '🌑', '🌠', '🔭', '🪐', '🌙'],
        southafrica: ['🏡', '🏘️', '🏙️', '🇿🇦', '🏰', '🌍', '🏟️', '⛰️', '🏖️', '🌿', '🦁', '🐘', '🦏', '🐆', '🌅', '🇿🇦'],
        theme_neon: ['⚡', '💡', '🔴', '🟡', '🟢', '🔵', '🟣', '✨', '⭐', '🌟', '💥', '🎆', '🔮', '💫', '⚡', '🌟'],
        theme_wood: ['🪵', '🪓', '🌴', '🌲', '🌳', '🍂', '🍁', '🌰', '🪵', '🏡', '🏕️', '🪵', '🪑', '🪵', '🌲', '🌳'],
    },

    THEME_COSTS: { fruit: 2500, animals: 2500, space: 4000, southafrica: 4000, theme_neon: 5000, theme_wood: 5000 },

    POWERUP_COSTS: { undo: 100, shuffle: 250, removeTile: 300, superSwap: 400 },

    DAILY_CHALLENGES: [
        { type: 'reach', goal: 64, reward: 150, desc: 'Reach a 64 tile', icon: '🎯' },
        { type: 'reach', goal: 128, reward: 200, desc: 'Reach a 128 tile', icon: '🎯' },
        { type: 'reach', goal: 256, reward: 250, desc: 'Reach a 256 tile', icon: '🎯' },
        { type: 'moves', goal: 30, reward: 150, desc: 'Finish any level in under 30 moves', icon: '🏃' },
        { type: 'moves', goal: 20, reward: 200, desc: 'Finish any level in under 20 moves', icon: '🏃' },
        { type: 'levels', goal: 2, reward: 200, desc: 'Complete 2 levels today', icon: '📚' },
        { type: 'levels', goal: 4, reward: 350, desc: 'Complete 4 levels today', icon: '📚' },
        { type: 'coins', goal: 300, reward: 150, desc: 'Earn 300 coins today', icon: '💰' },
        { type: 'coins', goal: 600, reward: 250, desc: 'Earn 600 coins today', icon: '💰' },
        { type: 'merge', goal: 20, reward: 150, desc: 'Merge 20 tiles', icon: '🔗' },
        { type: 'merge', goal: 40, reward: 250, desc: 'Merge 40 tiles', icon: '🔗' },
    ],

    ACHIEVEMENTS: [
        { id: 'first_win', name: 'First Win', desc: 'Complete your first level', icon: '🏆', check: (state) => state.levelsCompleted >= 1 },
        { id: '10_levels', name: 'Getting Started', desc: 'Complete 10 levels', icon: '🌟', check: (state) => state.levelsCompleted >= 10 },
        { id: '100_levels', name: 'Dedicated Player', desc: 'Complete 100 levels', icon: '💪', check: (state) => state.levelsCompleted >= 100 },
        { id: 'tile_2048', name: '2048 Master', desc: 'Create a 2048 tile', icon: '🔥', check: (state) => state.highestTileEver >= 2048 },
        { id: 'tile_8192', name: 'Legendary', desc: 'Create an 8192 tile', icon: '👑', check: (state) => state.highestTileEver >= 8192 },
        { id: '50_ads', name: 'Ad Supporter', desc: 'Watch 50 rewarded ads', icon: '📺', check: (state) => state.totalAdsWatched >= 50 },
        { id: '10000_coins', name: 'Rich', desc: 'Collect 10,000 coins total', icon: '💰', check: (state) => state.coins >= 10000 },
        { id: 'all_themes', name: 'Collector', desc: 'Unlock all themes', icon: '🎨', check: (state) => state.unlockedThemes.length >= 5 },
        { id: '30_stars', name: 'Star Hunter', desc: 'Earn 30 total stars', icon: '⭐', check: (state) => state.totalStarsEarned >= 30 },
        { id: '5_worlds', name: 'World Traveler', desc: 'Reach World 5', icon: '🌍', check: (state) => state.currentWorld >= 4 },
        { id: 'daily_challenge', name: 'Daily Winner', desc: 'Complete a daily challenge', icon: '📅', check: (state) => state.dailyChallengeDone === true },
        { id: 'streak_7', name: 'Weekly Streak', desc: 'Login for 7 days straight', icon: '🔥', check: (state) => state.currentStreak >= 7 },
    ],

    STORE_ITEMS: {
        coinPacks: [
            { id: 'coins_pack_3000', name: 'Starter Pack', coins: 3000, price: 'R14.99', icon: '💰' },
            { id: 'coins_pack_5000', name: '5000 Coins', coins: 5000, price: 'R22.99', icon: '💰' },
            { id: 'coins_pack_15000', name: '15000 Coins', coins: 15000, price: 'R45.99', icon: '💰', bestValue: true },
        ],
        themes: [
            { id: 'numbers', name: 'Classic Numbers', cost: 0, icon: '🔢' },
            { id: 'fruit', name: 'Fruit Theme', cost: 2500, icon: '🍎' },
            { id: 'animals', name: 'Animals Theme', cost: 2500, icon: '🐾' },
            { id: 'space', name: 'Space Theme', cost: 4000, icon: '🚀' },
            { id: 'southafrica', name: 'Country Theme', cost: 4000, icon: '🌐' },
            { id: 'theme_neon', name: 'Neon Theme', cost: 5000, icon: '⚡' },
            { id: 'theme_wood', name: 'Wood Theme', cost: 5000, icon: '🪵' },
        ],
        removeAds: { id: 'remove_ads', name: 'Remove Ads', price: 'R56.99', icon: '🚫', desc: 'Remove all banner & interstitial ads + 200 coins' },
        offlineSub: { id: 'sub_offline_mode', name: 'Offline Subscription', price: 'R19.99/mo', icon: '📶', desc: 'Play anywhere without internet connection or ads' },
        buyCoffee: {
            id: 'buy_me_coffee',
            name: 'Buy Me a Coffee',
            price: 'R28.99',
            icon: '☕',
            coins: 500,
            desc: 'Support the game + get 500 bonus coins!'
        },
    },

    // Level goal calculation - scales progressively
    getLevelGoal(worldId, levelNum) {
        const globalLevel = worldId * 25 + levelNum;
        let power;

        if (globalLevel <= 5) {
            power = 3; // 8
        } else if (globalLevel <= 10) {
            power = 4; // 16
        } else if (globalLevel <= 15) {
            power = 5; // 32
        } else if (globalLevel <= 20) {
            power = 6; // 64
        } else if (globalLevel <= 30) {
            power = 7; // 128
        } else if (globalLevel <= 40) {
            power = 8; // 256
        } else if (globalLevel <= 50) {
            power = 9; // 512
        } else if (globalLevel <= 65) {
            power = 10; // 1024
        } else if (globalLevel <= 80) {
            power = 11; // 2048
        } else if (globalLevel <= 95) {
            power = 12; // 4096
        } else if (globalLevel <= 110) {
            power = 13; // 8192
        } else if (globalLevel <= 130) {
            power = 14; // 16384
        } else if (globalLevel <= 150) {
            power = 15; // 32768
        } else {
            power = 16; // 65536
        }

        return Math.pow(2, power);
    },

    getTargetMoves(worldId, levelNum) {
        const goal = this.getLevelGoal(worldId, levelNum);
        const base = Math.ceil(Math.log2(goal) * 4.5);
        const reduction = worldId * 2;
        return Math.max(8, base - reduction);
    },

    getLevelReward(worldId, levelNum) {
        const goal = this.getLevelGoal(worldId, levelNum);
        return Math.floor(goal / 2) + 30;
    }
};