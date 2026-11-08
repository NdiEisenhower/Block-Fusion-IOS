// Multi-Language Localization System (i18n)
// Supports English (en), TshiVenda (ve), and isiZulu (zu) with dynamic extensibility

class I18N {
    static currentLang = 'en';

    static languages = [
        { code: 'en', name: 'English', flag: '🇬🇧', enabled: true },
        { code: 've', name: 'TshiVenda', flag: '🇿🇦', enabled: true },
        { code: 'zu', name: 'isiZulu', flag: '🇿🇦', enabled: true }
    ];

    static translations = {
        en: {
            // Navigation & Main Menu
            continue_game: '▶ Continue',
            worlds: '🌍 Worlds',
            daily_challenge: '📅 Daily Challenge',
            refer_earn: '🎁 Refer & Earn',
            store: '🛒 Store',
            leaderboard: '📊 Leaderboard',
            settings: '⚙️ Settings',
            achievements: '🏆 Achievements',
            new_badge: 'New',
            coins_free_ads: 'Coins & Free Ads',

            // Header & Player Status
            guest_player: 'Guest Player',
            offline_mode: 'Offline Mode',
            moves_left: 'moves left',

            // World & Level Select
            world_levels: 'Levels',
            stars_needed: 'stars needed',
            completed: 'Completed',

            // Game UI & Controls
            goal: 'GOAL',
            moves: 'Moves',
            best: 'Best',
            need_help: 'Need help?',
            undo: '↩ Undo',
            shuffle: '🔀 Shuffle',
            remove: '🗑️ Remove',
            swap: '✨ Swap',
            free_help: '📺 Free Help',

            // In-Game Win / Loss Modals
            level_complete: 'LEVEL COMPLETE! 🎉',
            game_over: 'GAME OVER! 💔',
            stars_earned: 'Stars Earned',
            reward: 'Reward',
            next_level: 'Next Level ▶',
            double_reward: '🌟 Double Reward (Watch Ad)',
            retry: '🔄 Retry',
            home: '🏠 Home',
            no_more_moves: 'No More Moves Available!',
            watch_ad_help: 'Watch an Ad for Extra Tiles 📺',

            // Store Screen
            your_balance: 'Your Balance',
            store_connected: 'Store Connected',
            restore_purchases: '🔄 Restore',
            coin_packs: '💰 Coin Packs',
            special_offers: '🚫 Special Offers',
            remove_ads: 'Remove Ads',
            remove_ads_desc: 'No banners or popups (+200 Coins)',
            offline_sub: 'Offline Subscription',
            offline_sub_desc: 'Play offline anywhere without ads!',
            support_dev: 'Buy Me a Coffee',
            support_dev_desc: 'Support the game! (+500 Coins)',
            unlock_themes: '🎨 Unlock Themes (Coins)',
            owned: 'OWNED',
            unlock: 'UNLOCK',
            active: 'ACTIVE',
            best_value: 'BEST VALUE',

            // Referral Screen
            ref_title: 'Refer & Earn',
            your_ref_code: 'Your Referral Code',
            share_code: '📤 Share Code',
            copy_link: '📋 Copy Link',
            redeem_code_title: '🎁 Redeem a Friend\'s Code',
            redeem_desc: 'Enter a code from a friend to instantly claim +500 Bonus Coins!',
            redeem_btn: 'Redeem',
            friend_milestones: '🏆 Friend Milestones',
            friends: 'Friends',
            friend: 'Friend',
            claimed: 'CLAIMED',
            claim: 'CLAIM 🎉',

            // Leaderboard
            timeframe_overall: '🌍 Overall',
            timeframe_daily: '📅 Daily',
            timeframe_weekly: '📊 Weekly',
            timeframe_monthly: '📈 Monthly',
            smart_view: '🎯 Smart View',
            my_position: '📍 My Position',
            global_view: '🌍 Global',
            friends_view: '👥 Friends',
            all_countries: 'All Countries',
            top_players: '🏆 Top Players',
            privacy_note: '🔒 Player names are private. Only your name is visible to you.',

            // Settings Screen
            settings_title: 'Settings',
            language_setting: '🌐 Language / Luambo / Ulimi',
            select_language: 'Select App Language',
            themes_title: '🎨 Themes',
            themes_desc: 'Change how tiles look. Unlock more in the Store.',
            sound_effects: '🔊 Sound Effects',
            toggle_sounds: 'Toggle game sounds',
            how_to_play: '📖 How to Play',
            tutorial_desc: 'View the tutorial again',
            daily_challenge_status: 'Daily Challenge Status',
            not_completed: 'Not completed yet',
            completed_today: 'Completed today!',
            purchases_header: '💳 Purchases',
            restore_purchases_title: 'Restore Purchases',
            restore_desc: 'Restore Google Play themes and ad removal',
            cloud_save_header: '☁️ Cloud Save',
            sync_progress: 'Sync Progress',
            sync_now: 'Sync Now',
            offline_status: 'Offline Status',
            account_header: '👤 Account',
            sign_in: 'Sign In',
            sign_out: 'Sign Out',
            privacy_header: '🔐 Data & Privacy',
            privacy_policy: '📜 Privacy Policy',
            export_data: '📥 Export Your Data',
            delete_data: '🗑️ Request Data Deletion',
            danger_zone: '⚠️ Danger Zone',
            reset_progress: '🗑️ Reset All Progress',
            view: 'View',
            on: 'On',
            off: 'Off',
            unlimited_play: 'Unlimited Play',

            // Messages & Toasts
            lang_changed: '🌐 Language updated!',
            code_copied: '📋 Link copied to clipboard!',
            code_redeemed: '🎉 Code redeemed! You received bonus coins!',
            theme_changed: '🎨 Theme changed!'
        },

        ve: {
            // Navigation & Main Menu (TshiVenda)
            continue_game: '▶ Bvela Phanda',
            worlds: '🌍 Shango',
            daily_challenge: '📅 Mbila ya Tšuvha',
            refer_earn: '🎁 Rhamba Khonani',
            store: '🛒 Zwitolo',
            leaderboard: '📊 Vhavhuli',
            settings: '⚙️ Zwiimwa',
            achievements: '🏆 Zwipano',
            new_badge: 'Ntswa',
            coins_free_ads: 'Tshelede & Ads dza Mahala',

            // Header & Player Status
            guest_player: 'Mueni',
            offline_mode: 'Tshifhinga tsha Offline',
            moves_left: 'metsheo yo salaho',

            // World & Level Select
            world_levels: 'Metsheo',
            stars_needed: 'naledzi dzi todeho',
            completed: 'Zwo Fhela',

            // Game UI & Controls
            goal: 'NDIVHO',
            moves: 'Metsheo',
            best: 'Zwivhuya',
            need_help: 'Toda thuso?',
            undo: '↩ Humela',
            shuffle: '🔀 Vhanganisa',
            remove: '🗑️ Bvisa',
            swap: '✨ Tshitsha',
            free_help: '📺 Thuso ya Mahala',

            // In-Game Win / Loss Modals
            level_complete: 'ZWO FHELA LWO VHUYA! 🎉',
            game_over: 'MUTAMBO WOHIWA! 💔',
            stars_earned: 'Naledzi dzo Wanala',
            reward: 'Mali',
            next_level: 'Khavhelo e daho ▶',
            double_reward: '🌟 Dobolola Tshelede (Kanda Ad)',
            retry: '🔄 Tamba Hafhu',
            home: '🏠 Hayani',
            no_more_moves: 'A huna metsheo yo salaho!',
            watch_ad_help: 'Oravha Ad u wane zwitina 📺',

            // Store Screen
            your_balance: 'Tshelede Yau',
            store_connected: 'Tshitolo tsho Tumaniiswa',
            restore_purchases: '🔄 Vhuedzedza',
            coin_packs: '💰 Zwiputshu zwa Tshelede',
            special_offers: '🚫 Zwiiteo zvo Khethekaho',
            remove_ads: 'Bvisa Andivhatsodzo',
            remove_ads_desc: 'A huna zwianndivhadzo (+200 Tshelede)',
            offline_sub: 'Subscription ya Offline',
            offline_sub_desc: 'Tambani hufehi ngeno huina andivhatsodzo!',
            support_dev: 'Renga Kofhi ya Museki',
            support_dev_desc: 'Tikedzani mutambo! (+500 Tshelede)',
            unlock_themes: '🎨 Vulani Mivhala (Tshelede)',
            owned: 'YAU',
            unlock: 'VULA',
            active: 'SALA',
            best_value: 'ZWIVHUYA ZVETSHI',

            // Referral Screen
            ref_title: 'Rhamba u Wane',
            your_ref_code: 'Khodu Yau ya u Rhamba',
            share_code: '📤 Kovhana Khodu',
            copy_link: '📋 Kopiisa Link',
            redeem_code_title: '🎁 Shumisa Khodu ya Khonani',
            redeem_desc: 'Pani khodu ya khonani uri u wane +500 tshelede ya mahala!',
            redeem_btn: 'Tanganedza',
            friend_milestones: '🏆 Zvipani zwa Khonani',
            friends: 'Khonani',
            friend: 'Khonani',
            claimed: 'ZWOHIWA',
            claim: 'TANGANEDZA 🎉',

            // Leaderboard
            timeframe_overall: '🌍 Zwothe',
            timeframe_daily: '📅 Duvha leli',
            timeframe_weekly: '📊 Vhege yei',
            timeframe_monthly: '📈 Mwedzi uyu',
            smart_view: '🎯 Smart View',
            my_position: '📍 Vhudulo Hanga',
            global_view: '🌍 Shango Lothe',
            friends_view: '👥 Khonani',
            all_countries: 'Shango Dzothe',
            top_players: '🏆 Vatambi vha Vhudi',
            privacy_note: '🔒 Madzina a Vatambi ma tshireledziwa.',

            // Settings Screen
            settings_title: 'Zwiimwa',
            language_setting: '🌐 Luambo / Language / Ulimi',
            select_language: 'Nanga Luambo lwa Mutambo',
            themes_title: '🎨 Mivhala',
            themes_desc: 'Cinchani ndugiso ya zwitina. Vulani zwiputshu zwitolo.',
            sound_effects: '🔊 Mubvumo',
            toggle_sounds: 'Shandukisani mubvumo',
            how_to_play: '📖 Ndivho ya u Tamba',
            tutorial_desc: 'Vhonani hafhu ndivho',
            daily_challenge_status: 'Mbila ya Tšuvha',
            not_completed: 'A i athu fhela',
            completed_today: 'Yo fhela namusi!',
            purchases_header: '💳 Zwo Rengwaho',
            restore_purchases_title: 'Vhuedzedzani Zwo Rengwaho',
            restore_desc: 'Vhuedzedzani mivhala na u bvisa zwianndivhadzo',
            cloud_save_header: '☁️ Pulana kha Cloud',
            sync_progress: 'Yelanisa Tswelopele',
            sync_now: 'Yelanisa Swino',
            offline_status: 'Tshifhinga tsha Offline',
            account_header: '👤 Akhaunthu',
            sign_in: 'Dzhenani',
            sign_out: 'Bvuani',
            privacy_header: '🔐 Data & Tshiphiri',
            privacy_policy: '📜 Milayo ya Tshiphiri',
            export_data: '📥 Bvisani Data Yanu',
            delete_data: '🗑️ Thuthani Data',
            danger_zone: '⚠️ Zwiitisi zva Khombo',
            reset_progress: '🗑️ Phumula Zwothe',
            view: 'Vbona',
            on: 'Yo Vulea',
            off: 'Yo Dzima',
            unlimited_play: 'U Tamba hu si na Gano',

            // Messages & Toasts
            lang_changed: '🌐 Luambo lwo shandukiswa!',
            code_copied: '📋 Link yo kopiwa!',
            code_redeemed: '🎉 Khodu yo tanganedzwa!',
            theme_changed: '🎨 Muvhala wo shanduka!'
        },

        zu: {
            // Navigation & Main Menu (isiZulu)
            continue_game: '▶ Qhubeka',
            worlds: '🌍 Imihlaba',
            daily_challenge: '📅 Inselelo Yansuku Zonke',
            refer_earn: '🎁 Mema Abangane',
            store: '🛒 Isitolo',
            leaderboard: '📊 Abaphambili',
            settings: '⚙️ Izilungiselelo',
            achievements: '🏆 Izimpumelelo',
            new_badge: 'Esha',
            coins_free_ads: 'Izinhlamvu ne-Ads Yamahhala',

            // Header & Player Status
            guest_player: 'Isivakashi',
            offline_mode: 'Inhlano engaxhumekile',
            moves_left: 'izinyathelo ezisele',

            // World & Level Select
            world_levels: 'Izinyathelo',
            stars_needed: 'izinkanyezi ezidingekayo',
            completed: 'Kugcwalisiwe',

            // Game UI & Controls
            goal: 'INHLOSO',
            moves: 'Izinyathelo',
            best: 'Okungcono Kakhulu',
            need_help: 'Udinga usizo?',
            undo: '↩ Phindela Emuva',
            shuffle: '🔀 Shova',
            remove: '🗑️ Susa',
            swap: '✨ Shintshanisa',
            free_help: '📺 Usizo Lwamahhala',

            // In-Game Win / Loss Modals
            level_complete: 'ULEVELI OGCWELE! 🎉',
            game_over: 'UMDLALO UPHELILE! 💔',
            stars_earned: 'Izinkanyezi Ezitholiwe',
            reward: 'Umvuzo',
            next_level: 'Izinga Elilandelayo ▶',
            double_reward: '🌟 Phinda Umvuzo (Buka Isikhangiso)',
            retry: '🔄 Zama Futhi',
            home: '🏠 Ekhaya',
            no_more_moves: 'Awekho Amanyathelo Asele!',
            watch_ad_help: 'Buka Isikhangiso ukuze uthole amagobolondo 📺',

            // Store Screen
            your_balance: 'Ibhalansi Yakho',
            store_connected: 'Isitolo Siyaxhumana',
            restore_purchases: '🔄 Buyisela',
            coin_packs: '💰 Amaphakethe Wezinhlamvu',
            special_offers: '🚫 Izinto Ezikhethekile',
            remove_ads: 'Susa Izikhangiso',
            remove_ads_desc: 'Awekho amaphuphu nezikhangiso (+200 Izinhlamvu)',
            offline_sub: 'Inkokhelo Ye-Offline',
            offline_sub_desc: 'Tshala noma ikuphi ngaphandle kwezikhangiso!',
            support_dev: 'Thenga Ikhofi Lomthuthukisi',
            support_dev_desc: 'Sekela umdlalo! (+500 Izinhlamvu)',
            unlock_themes: '🎨 Vula Imiklamo (Izinhlamvu)',
            owned: 'EYAKHO',
            unlock: 'VULA',
            active: 'IYAFAKA',
            best_value: 'OKUNGCONO KAKHULU',

            // Referral Screen
            ref_title: 'Mema Futhi Uthole',
            your_ref_code: 'Ikhodi Yakho Yokusabalalisa',
            share_code: '📤 Yabelana Ngekhodi',
            copy_link: '📋 Kopisha Isixhumanisi',
            redeem_code_title: '🎁 Sebenzisa Ikhodi Yomngane',
            redeem_desc: 'Faka ikhodi yomngane wakho ukuze uthole +500 Izinhlamvu zamahhala!',
            redeem_btn: 'Sebenzisa',
            friend_milestones: '🏆 Izinyathelo Zabangane',
            friends: 'Abangane',
            friend: 'Umngane',
            claimed: 'UTHOLE',
            claim: 'THOLA 🎉',

            // Leaderboard
            timeframe_overall: '🌍 Konke',
            timeframe_daily: '📅 Namhlanje',
            timeframe_weekly: '📊 Kule Viki',
            timeframe_monthly: '📈 Kule Nyanga',
            smart_view: '🎯 Smart View',
            my_position: '📍 Indawo Yami',
            global_view: '🌍 Umhlaba Wonke',
            friends_view: '👥 Abangane',
            all_countries: 'Amazwe Wonke',
            top_players: '🏆 Abadlali Abaphezulu',
            privacy_note: '🔒 Amagama abadlali ayimfihlo.',

            // Settings Screen
            settings_title: 'Izilungiselelo',
            language_setting: '🌐 Ulimi / Language / Luambo',
            select_language: 'Khetha Ulimi Lwe-App',
            themes_title: '🎨 Imiklamo',
            themes_desc: 'Shintsha ukuthi amagobolondo abukeka kanjani.',
            sound_effects: '🔊 Imisindo',
            toggle_sounds: 'Shintsha imisindo yemidlalo',
            how_to_play: '📖 Indlela Yokudlala',
            tutorial_desc: 'Buka ukudlala futhi',
            daily_challenge_status: 'Inselelo Yansuku Zonke',
            not_completed: 'Akukagcwaliswa manje',
            completed_today: 'Igcwaliswe namhlanje!',
            purchases_header: '💳 Inkokhelo',
            restore_purchases_title: 'Buyisela Inkokhelo',
            restore_desc: 'Buyisela imiklamo nezikhangiso ezisusiwe',
            cloud_save_header: '☁️ Gcina ku-Cloud',
            sync_progress: 'Vumelanisa Inqubekelaphambili',
            sync_now: 'Vumelanisa Manje',
            offline_status: 'Inhlano engaxhumekile',
            account_header: '👤 I-Akhawunti',
            sign_in: 'Ngena',
            sign_out: 'Phuma',
            privacy_header: '🔐 Inqubomgomo Ngemininingwane',
            privacy_policy: '📜 Inqubomgomo Yobumfihlo',
            export_data: '📥 Landa Inqubekelaphambili',
            delete_data: '🗑️ Susa Imeyili Ne-Data',
            danger_zone: '⚠️ Indawo Yengozi',
            reset_progress: '🗑️ Susa Yonke Inqubekelaphambili',
            view: 'Buka',
            on: 'Kuvuliwe',
            off: 'Kucishiwe',
            unlimited_play: 'Ukwenza Okungapheli',

            // Messages & Toasts
            lang_changed: '🌐 Ulimi kushintshiwe!',
            code_copied: '📋 Isixhumanisi sikopishwe!',
            code_redeemed: '🎉 Ikhodi isetshenzisiwe!',
            theme_changed: '🎨 Umklamo ushintshiwe!'
        }
    };

    static getAvailableLanguages() {
        const list = Array.isArray(this.languages) ? this.languages : [];
        const active = list.filter(l => l && l.enabled !== false);
        // Guarantee English is always present as base fallback
        if (!active.some(l => l.code === 'en')) {
            const enObj = list.find(l => l.code === 'en') || { code: 'en', name: 'English', flag: '🇬🇧', enabled: true };
            active.unshift(enObj);
        }
        return active;
    }

    static isLanguageEnabled(langCode) {
        if (!langCode || langCode === 'en') return true;
        const list = Array.isArray(this.languages) ? this.languages : [];
        const found = list.find(l => l.code === langCode);
        return !found || found.enabled !== false;
    }

    static init() {
        if (typeof App !== 'undefined' && App.state && App.state.language) {
            this.currentLang = App.state.language;
        } else {
            const saved = localStorage.getItem('blockRush2KLang');
            if (saved && this.translations[saved]) {
                this.currentLang = saved;
            }
        }
        if (!this.isLanguageEnabled(this.currentLang)) {
            console.log(`🌐 Saved language [${this.currentLang}] is disabled, resetting to [en]`);
            this.currentLang = 'en';
        }
        console.log(`🌐 i18n initialized with language: [${this.currentLang}]`);
    }

    static setLanguage(langCode) {
        if (!this.isLanguageEnabled(langCode)) {
            console.warn(`Language [${langCode}] is disabled remotely. Falling back to [en]`);
            langCode = 'en';
        }
        if (!this.translations[langCode]) {
            console.warn(`Language [${langCode}] not found, falling back to [en]`);
            langCode = 'en';
        }
        this.currentLang = langCode;
        localStorage.setItem('blockRush2KLang', langCode);

        if (typeof App !== 'undefined' && App.state) {
            App.state.language = langCode;
            App.saveState();
        }

        console.log(`🌐 Switched language to: [${langCode}]`);
        this.applyToDOM();

        if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
            App.showToast(this.t('lang_changed', '🌐 Language updated!'));
        }

        // Re-render active screens
        if (typeof Navigation !== 'undefined') {
            Navigation.renderSettings();
            const activeScreen = document.querySelector('.screen.active');
            if (activeScreen) {
                const screenId = activeScreen.id.replace('screen-', '');
                if (screenId === 'store' && typeof Store !== 'undefined') Store.renderStoreContent();
                if (screenId === 'referral' && typeof Navigation !== 'undefined') Navigation.renderReferralScreen();
                if (screenId === 'game' && typeof GameUI !== 'undefined' && App.currentGame) {
                    GameUI.updateGameUI(App.currentGame);
                }
            }
        }
    }

    static t(key, fallback = '') {
        const langDict = this.translations[this.currentLang] || this.translations['en'];
        if (langDict && langDict[key]) {
            return langDict[key];
        }
        const enDict = this.translations['en'];
        if (enDict && enDict[key]) {
            return enDict[key];
        }
        return fallback || key;
    }

    static applyToDOM() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) {
                const text = this.t(key);
                if (text) el.textContent = text;
            }
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (key) {
                const text = this.t(key);
                if (text) el.placeholder = text;
            }
        });
    }

    static applyRemoteData(data) {
        if (!data) return;
        if (data.languages && Array.isArray(data.languages)) {
            this.languages = data.languages;
            // If active language was disabled by admin, fall back to English
            if (!this.isLanguageEnabled(this.currentLang)) {
                console.log(`🌐 Active language [${this.currentLang}] disabled by admin. Reverting to [en].`);
                this.setLanguage('en');
            }
        }
        if (data.translations && typeof data.translations === 'object') {
            for (const code in data.translations) {
                this.translations[code] = { ...(this.translations[code] || {}), ...data.translations[code] };
            }
        }
        this.applyToDOM();
        if (typeof Navigation !== 'undefined' && document.getElementById('screen-settings')?.classList.contains('active')) {
            Navigation.renderSettings();
        }
    }

    static async loadRemoteTranslations() {
        try {
            if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) {
                const db = firebase.database();
                const snap = await db.ref('remote_translations').once('value');
                const data = snap.val();
                if (data) {
                    this.applyRemoteData(data);
                    console.log('🌐 Remote translations merged successfully from cloud');
                }

                // Listen for realtime translation and language on/off changes
                db.ref('remote_translations').on('value', (s) => {
                    const freshData = s.val();
                    if (freshData) {
                        this.applyRemoteData(freshData);
                    }
                });
            }
        } catch (e) {
            console.warn('Could not load remote translations:', e);
        }
    }
}

if (typeof window !== 'undefined') {
    window.I18N = I18N;
}
