// Firebase Service with Analytics and Crashlytics
class FirebaseService {
    // ===== PLATFORM & DEVICE TRACKING HELPERS =====
    static getDetectedPlatform() {
        if (typeof window !== 'undefined') {
            if (typeof window.iOS !== 'undefined') return 'ios';
            if (typeof window.webkit !== 'undefined' && window.webkit.messageHandlers && window.webkit.messageHandlers.adBridge) return 'ios';
            if (typeof window.Android !== 'undefined' && window.Android !== null) {
                if (typeof window.Android.getPlatform === 'function') {
                    const p = window.Android.getPlatform();
                    if (p && (p.toLowerCase() === 'ios' || p.toLowerCase() === 'apple')) return 'ios';
                }
                if (typeof window.Android.getEnvironment === 'function' && window.Android.getEnvironment() === 'ios') return 'ios';
            }
            if (typeof AdService !== 'undefined' && typeof AdService.detectPlatform === 'function') {
                const p = AdService.detectPlatform();
                if (p === 'ios') return 'ios';
            }
            if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return 'ios';
            if (typeof window.Android !== 'undefined' && window.Android !== null) {
                if (window.Android.isHuawei || window.Android.isHMS) return 'huawei';
                return 'google';
            }
            if (/Android/i.test(navigator.userAgent)) return 'google';
        }
        return 'web';
    }

    static getDeviceModel() {
        if (typeof window !== 'undefined') {
            if (typeof window.Android !== 'undefined' && typeof window.Android.getDeviceInfo === 'function') {
                try {
                    const info = JSON.parse(window.Android.getDeviceInfo());
                    if (info.model) return info.model;
                } catch (e) {}
            }
            if (/iPhone/i.test(navigator.userAgent)) return 'iPhone';
            if (/iPad/i.test(navigator.userAgent)) return 'iPad';
            if (/Android/i.test(navigator.userAgent)) return 'Android Device';
        }
        return 'Web Browser';
    }

    static getPlatformLabel() {
        const p = this.getDetectedPlatform();
        switch (p) {
            case 'ios': return '🍎 Apple iOS (App Store)';
            case 'google': return '🟢 Google Play (Android)';
            case 'huawei': return '🔴 Huawei AppGallery';
            default: return '🌐 Web Instant Play';
        }
    }

    static db = null;
    static auth = null;
    static currentUser = null;
    static initialized = false;
    static analytics = null;
    static crashlytics = null;


    static init() {
        try {
            const config = typeof ACTIVE_FIREBASE_CONFIG !== 'undefined'
                ? ACTIVE_FIREBASE_CONFIG
                : FIREBASE_CONFIG;

            if (!firebase.apps.length) {
                firebase.initializeApp(config);
                console.log('Firebase initialized with project:', config.projectId);
            } else {
                firebase.app();
            }

            this.db = firebase.database();
            this.auth = firebase.auth();

            // Initialize Analytics
            try {
                if (typeof firebase.analytics !== 'undefined') {
                    this.analytics = firebase.analytics();
                    console.log('Firebase Analytics initialized');
                    this.logEvent('app_start', { version: '1.0.0' });
                }
            } catch (e) {
                console.warn('Analytics init failed:', e.message);
            }

            // Initialize Crashlytics (via Performance Monitoring for web)
            try {
                if (typeof firebase.performance !== 'undefined') {
                    this.crashlytics = firebase.performance();
                    console.log('Firebase Performance initialized');
                }
            } catch (e) {
                console.warn('Performance init failed:', e.message);
            }

            this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
                .then(() => console.log('Auth persistence: LOCAL'))
                .catch(error => {
                    console.warn('Persistence error:', error);
                    this.logCrash('auth_persistence_error', error.message);
                });

            this.auth.onAuthStateChanged((user) => {
                if (user) {
                    this.currentUser = user;
                    console.log('User signed in:', user.uid);
                    this.logEvent('login', { method: user.providerData[0]?.providerId || 'unknown' });

                    if (typeof App !== 'undefined' && App.state && !App.state.isLoggedIn) {
                        App.state.isLoggedIn = true;
                        App.state.loginProvider = user.providerData[0]?.providerId || 'unknown';
                        App.state.userId = user.uid;

                        if (user.displayName && user.displayName !== 'Player' && user.displayName !== 'Guest Player') {
                            App.state.playerName = user.displayName;
                        } else if (user.email) {
                            App.state.playerName = user.email.split('@')[0];
                        } else {
                            const randomName = this.generateAnonymousPlayerName(user.uid);
                            App.state.playerName = randomName;
                            if (user.updateProfile) {
                                user.updateProfile({ displayName: randomName }).catch(() => {});
                            }
                        }

                        if (user.email) App.state.email = user.email;
                        if (user.photoURL) App.state.photoURL = user.photoURL;

                        App.saveState();
                        App.updateOfflineIndicator();
                        App.updateLoginButtonVisibility();
                        App.updatePlayerDisplay();

                        this.loadUserData().then(cloudData => {
                            if (cloudData) {
                                this.mergeCloudData(cloudData);
                            } else {
                                // First time user - save their data
                                this.saveUserData(App.state);
                            }
                        }).catch(() => { });

                        // ✅ MIGRATE OLD LEADERBOARD DATA
                        this.migrateLeaderboardData().then(() => {
                            // Force save leaderboard entry after migration
                            this.saveLeaderboardEntry({
                                displayName: (App.state.playerName && App.state.playerName !== 'Player' && App.state.playerName !== 'Guest Player') ? App.state.playerName : this.generateAnonymousPlayerName(user.uid),
                                totalStarsEarned: App.state.totalStarsEarned || 0,
                                levelsCompleted: App.state.levelsCompleted || 0,
                                photoURL: App.state.photoURL || null
                            });
                        });
                    }
                } else {
                    this.currentUser = null;
                }
            });

            this.initialized = true;
            console.log('Firebase service ready');

            // Load remote configuration and dynamic translations
            this.fetchRemoteConfig();
            if (typeof I18N !== 'undefined' && typeof I18N.loadRemoteTranslations === 'function') {
                I18N.loadRemoteTranslations();
            }

            return true;
        } catch (e) {
            console.warn('Firebase init failed:', e.message);
            this.logCrash('firebase_init_error', e.message);
            this.initialized = false;
            return false;
        }
    }

    // ===== REMOTE CONFIG SYNC =====
    static async fetchRemoteConfig() {
        if (!this.db) return null;
        try {
            const snap = await this.db.ref('remote_config').once('value');
            const config = snap.val();
            if (config) {
                console.log('☁️ Remote config loaded from cloud');
                this.applyRemoteConfig(config);
            }

            // Realtime listener for live remote configuration changes
            this.db.ref('remote_config').on('value', (s) => {
                const fresh = s.val();
                if (fresh) {
                    this.applyRemoteConfig(fresh);
                }
            });

            return config;
        } catch (e) {
            console.warn('Could not fetch remote config:', e.message);
        }
        return null;
    }

    static applyRemoteConfig(config) {
        if (!config || typeof CONFIG === 'undefined') return;

        // 1. Ads settings
        if (config.ads) {
            const ads = config.ads;
            if (typeof CONFIG.DISABLED_ADS === 'object') {
                CONFIG.DISABLED_ADS.web = !ads.webAdsEnabled;
                CONFIG.DISABLED_ADS.google = !ads.googleAdsEnabled;
                CONFIG.DISABLED_ADS.huawei = !ads.huaweiAdsEnabled;
                CONFIG.DISABLED_ADS.ios = ads.iosAdsEnabled !== undefined ? !ads.iosAdsEnabled : false;
            }
            if (typeof AdService !== 'undefined') {
                if (ads.iosAdsEnabled !== undefined) {
                    if (ads.iosAdsEnabled) {
                        AdService.enableAdsForPlatform('ios');
                    } else {
                        AdService.disableAdsForPlatform('ios');
                    }
                }
            }
            if (CONFIG.ADS) {
                if (ads.interstitialFrequency) {
                    CONFIG.ADS.INTERSTITIAL_GAME_COUNT_FREQUENCY = ads.interstitialFrequency;
                }
                if (ads.showBannerInGame !== undefined) {
                    CONFIG.ADS.SHOW_BANNER_IN_GAME = ads.showBannerInGame;
                }
            }

            // Android TV Ads toggle
            if (ads.enableTvAds !== undefined && typeof Android !== 'undefined' && typeof Android.setTvAdsEnabled === 'function') {
                Android.setTvAdsEnabled(!!ads.enableTvAds);
            }
        }

        // 1b. Apple App Store (iOS) Remote Config
        if (config.ios) {
            const iosConfig = config.ios;
            if (typeof AdService !== 'undefined' && AdService.config) {
                if (!AdService.config.ios) AdService.config.ios = {};
                if (iosConfig.bannerAdUnitId) AdService.config.ios.banner = iosConfig.bannerAdUnitId;
                if (iosConfig.interstitialAdUnitId) AdService.config.ios.interstitial = iosConfig.interstitialAdUnitId;
                if (iosConfig.rewardedAdUnitId) AdService.config.ios.rewarded = iosConfig.rewardedAdUnitId;
                if (iosConfig.appId) AdService.config.ios.appId = iosConfig.appId;
            }

            const isIosPlatform = (typeof AdService !== 'undefined' && AdService.platform === 'ios') ||
                                  (typeof window.Android !== 'undefined' && typeof window.Android.getPlatform === 'function' && window.Android.getPlatform() === 'ios') ||
                                  (typeof window.iOS !== 'undefined');

            if (isIosPlatform && typeof window.Android !== 'undefined' && typeof window.Android.initAds === 'function') {
                const bId = iosConfig.bannerAdUnitId || (AdService.config && AdService.config.ios ? AdService.config.ios.banner : "");
                const iId = iosConfig.interstitialAdUnitId || (AdService.config && AdService.config.ios ? AdService.config.ios.interstitial : "");
                const rId = iosConfig.rewardedAdUnitId || (AdService.config && AdService.config.ios ? AdService.config.ios.rewarded : "");
                window.Android.initAds(bId, iId, rId);
            }

            // Force update modal for iOS
            if (isIosPlatform && iosConfig.forceUpdate && iosConfig.versionCode) {
                const currentIosVersionCode = 1;
                if (currentIosVersionCode < (parseInt(iosConfig.versionCode) || 1)) {
                    const storeUrl = iosConfig.storeUrl || 'https://apps.apple.com/app/id6470000000';
                    if (typeof PopupManager !== 'undefined' && PopupManager.show) {
                        PopupManager.show({
                            icon: '🍎',
                            title: 'Update Required',
                            subtitle: `Version ${iosConfig.versionName || 'New'} Available`,
                            customContent: `<div style="text-align:center;padding:12px;color:#cbd5e1;font-size:14px;line-height:1.6;">
                                A new version of Block Rush 2K is available on the App Store with performance updates and new stages. Please update to continue!
                            </div>`,
                            confirmText: 'Update on App Store',
                            showCancel: false,
                            showClose: false,
                            onConfirm: () => {
                                window.location.href = storeUrl;
                            }
                        });
                    }
                }
            }
        }

        // 2. General, Geo-Locking & Native App Settings
        if (config.general) {
            const gen = config.general;

            // Multi-Language master toggle from remote config
            const isLangConfigured = gen.enableMultiLanguage !== undefined 
                ? gen.enableMultiLanguage 
                : gen.languageEnabled;

            if (isLangConfigured !== undefined) {
                const isLangOn = !!isLangConfigured;
                if (typeof CONFIG !== 'undefined') {
                    CONFIG.ENABLE_MULTI_LANGUAGE = isLangOn;
                }
                if (typeof I18N !== 'undefined') {
                    I18N.enabled = isLangOn;
                    if (!isLangOn && I18N.currentLang !== 'en') {
                        I18N.setLanguage('en');
                    }
                }
                // If language picker modal is currently visible on screen, close it immediately!
                if (!isLangOn && typeof PopupManager !== 'undefined') {
                    const popupEl = document.getElementById('custom-popup-overlay');
                    if (popupEl && popupEl.classList.contains('show')) {
                        const titleEl = popupEl.querySelector('.popup-title');
                        if (titleEl && titleEl.textContent && titleEl.textContent.includes('Language')) {
                            PopupManager.close('cancel');
                        }
                    }
                }
                if (typeof Navigation !== 'undefined' && document.getElementById('screen-settings')?.classList.contains('active')) {
                    Navigation.renderSettings();
                }
            }

            // Geo-Locking Whitelist (Allowed Countries)
            if (gen.allowedCountries !== undefined && typeof Android !== 'undefined' && typeof Android.setAllowedCountries === 'function') {
                Android.setAllowedCountries(gen.allowedCountries);
            }

            // Geo-Locking Blacklist (Blocked Countries)
            if (gen.blockedCountries !== undefined && typeof Android !== 'undefined' && typeof Android.setBlockedCountries === 'function') {
                Android.setBlockedCountries(gen.blockedCountries);
            }

            // Native Orientation
            if (gen.landscapeEnabled !== undefined && typeof Android !== 'undefined' && typeof Android.setLandscapeEnabled === 'function') {
                Android.setLandscapeEnabled(!!gen.landscapeEnabled);
            }

            // Maintenance mode
            if (gen.maintenanceMode) {
                const msg = gen.maintenanceMessage || 'Block Rush 2K is undergoing temporary maintenance. Please check back shortly!';
                if (typeof PopupManager !== 'undefined' && PopupManager.show) {
                    PopupManager.show({
                        icon: '🚧',
                        title: 'System Maintenance',
                        subtitle: 'Scheduled Service',
                        customContent: `<div style="text-align:center;padding:12px;color:#cbd5e1;font-size:14px;line-height:1.6;">${msg}</div>`,
                        showConfirm: false,
                        showCancel: false,
                        showClose: false
                    });
                }
            }

            // Global announcement banner
            if (gen.broadcastActive && gen.broadcastBanner) {
                let existingBanner = document.getElementById('global-broadcast-banner');
                if (!existingBanner) {
                    existingBanner = document.createElement('div');
                    existingBanner.id = 'global-broadcast-banner';
                    existingBanner.style.cssText = 'background:linear-gradient(90deg, #f59e0b, #d97706);color:#0f172a;font-weight:800;font-size:12px;text-align:center;padding:6px 12px;position:relative;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
                    document.body.insertBefore(existingBanner, document.body.firstChild);
                }
                existingBanner.innerHTML = `📢 <span>${gen.broadcastBanner}</span>`;
                existingBanner.style.display = 'block';
            } else {
                const existingBanner = document.getElementById('global-broadcast-banner');
                if (existingBanner) existingBanner.style.display = 'none';
            }
        }

        // 3. Economy settings
        if (config.economy) {
            if (config.economy.startingCoins && typeof CONFIG.STARTING_COINS !== 'undefined') {
                CONFIG.STARTING_COINS = config.economy.startingCoins;
            }
        }

        // 4. Offline mode settings
        if (config.offline && typeof CONFIG.OFFLINE === 'object') {
            if (config.offline.maxLevels) {
                CONFIG.OFFLINE.MAX_LEVELS = config.offline.maxLevels;
            }
        }
    }

    // Merge cloud data with local state
    static mergeCloudData(cloudData) {
        if (!cloudData || typeof App === 'undefined' || !App.state) return;

        console.log('Merging cloud data...');
        let merged = false;

        // Merge coins - keep the higher value
        if (cloudData.coins > App.state.coins) {
            App.state.coins = cloudData.coins;
            merged = true;
        }

        // Merge stars - take the higher star count per level
        if (cloudData.stars) {
            for (const [key, value] of Object.entries(cloudData.stars)) {
                if (!App.state.stars[key] || value > App.state.stars[key]) {
                    App.state.stars[key] = value;
                    merged = true;
                }
            }
        }

        // Merge unlocked themes
        if (cloudData.unlockedThemes) {
            cloudData.unlockedThemes.forEach(theme => {
                if (!App.state.unlockedThemes.includes(theme)) {
                    App.state.unlockedThemes.push(theme);
                    merged = true;
                }
            });
        }

        // Merge achievements
        if (cloudData.achievements) {
            for (const [key, value] of Object.entries(cloudData.achievements)) {
                if (!App.state.achievements[key] || value > App.state.achievements[key]) {
                    App.state.achievements[key] = value;
                    merged = true;
                }
            }
        }

        // Update highest tile
        if (cloudData.highestTileEver > App.state.highestTileEver) {
            App.state.highestTileEver = cloudData.highestTileEver;
            merged = true;
        }

        // Update levels completed
        if (cloudData.levelsCompleted > App.state.levelsCompleted) {
            App.state.levelsCompleted = cloudData.levelsCompleted;
            merged = true;
        }

        // Update total stars earned
        if (cloudData.totalStarsEarned > App.state.totalStarsEarned) {
            App.state.totalStarsEarned = cloudData.totalStarsEarned;
            merged = true;
        }

        // Use cloud's active theme if unlocked locally
        if (cloudData.activeTheme && App.state.unlockedThemes.includes(cloudData.activeTheme)) {
            App.applyTheme(cloudData.activeTheme);
            merged = true;
        }

        // Merge ads removed status
        if (cloudData.adsRemoved) {
            App.state.adsRemoved = true;
            merged = true;
        }

        if (merged) {
            App.saveState();
            App.updateAllCoinDisplays();
            App.updatePlayerDisplay();
            if (typeof App.showToast === 'function') {
                App.showToast('☁️ Cloud data merged successfully!');
            }
            console.log('Cloud data merged');
        }
    }

    // Analytics Methods
    static logEvent(eventName, eventParams = {}) {
        const detectedPlatform = this.getDetectedPlatform();
        const enrichedParams = {
            platform: detectedPlatform,
            os: detectedPlatform === 'ios' ? 'iOS' : (detectedPlatform === 'google' || detectedPlatform === 'huawei') ? 'Android' : 'Web',
            deviceModel: this.getDeviceModel(),
            platformLabel: this.getPlatformLabel(),
            clientType: detectedPlatform === 'ios' ? 'ios_native' : (detectedPlatform === 'google' || detectedPlatform === 'huawei') ? 'android_native' : 'web_client',
            ...eventParams
        };

        if (detectedPlatform === 'ios') {
            console.log(`📊 [iOS Tracking] Logged event [${eventName}]:`, enrichedParams);
        }

        // If on Android or iOS native bridge, forward to native analytics
        if (typeof Android !== 'undefined' && typeof Android.logEvent === 'function') {
            try {
                Android.logEvent(eventName, JSON.stringify(enrichedParams));
            } catch (e) {
                console.warn('Native logEvent failed:', e.message);
            }
        }
        if (typeof Android !== 'undefined' && typeof Android.logEvent === 'function') {
            try {
                Android.logEvent(eventName, JSON.stringify(eventParams));
            } catch (e) {
                console.warn('Native logEvent failed:', e.message);
            }
        }

        if (this.analytics) {
            try {
                this.analytics.logEvent(eventName, eventParams);
            } catch (e) {
                console.warn('Analytics event failed:', e.message);
            }
        }
    }

    static setUserProperties(properties) {
        // If on Android, forward to native analytics
        if (typeof Android !== 'undefined' && typeof Android.setUserProperty === 'function') {
            try {
                for (const [key, value] of Object.entries(properties)) {
                    Android.setUserProperty(key, String(value));
                }
            } catch (e) {
                console.warn('Native setUserProperty failed:', e.message);
            }
        }

        if (this.analytics) {
            try {
                this.analytics.setUserProperties(properties);
            } catch (e) {
                console.warn('Set user properties failed:', e.message);
            }
        }
    }

    static setCurrentScreen(screenName) {
        // If on Android, forward to native analytics
        if (typeof Android !== 'undefined' && typeof Android.logScreenView === 'function') {
            try {
                Android.logScreenView(screenName);
            } catch (e) {
                console.warn('Native logScreenView failed:', e.message);
            }
        }

        if (this.analytics) {
            try {
                this.analytics.setCurrentScreen(screenName);
            } catch (e) {
                console.warn('Set screen failed:', e.message);
            }
        }
    }

    // Crashlytics Methods
    static logCrash(errorType, errorMessage) {
        console.error(`[Crashlytics] ${errorType}: ${errorMessage}`);

        // If on Android, forward to native Crashlytics
        if (typeof Android !== 'undefined' && typeof Android.logException === 'function') {
            try {
                Android.logException(errorType, errorMessage);
            } catch (e) {
                console.warn('Native logException failed:', e.message);
            }
        }

        if (this.crashlytics) {
            try {
                const trace = this.crashlytics.trace('error_' + errorType);
                trace.putAttribute('error_message', errorMessage);
                trace.putAttribute('timestamp', Date.now().toString());
                trace.start();
                trace.stop();
            } catch (e) {
                console.warn('Crashlytics log failed:', e.message);
            }
        }
        this.logEvent('app_error', { error_type: errorType, error_message: errorMessage });
    }

    static logLevelComplete(worldId, levelNum, stars, moves) {
        this.logEvent('level_complete', {
            world: worldId + 1,
            level: levelNum,
            stars: stars,
            moves: moves
        });
    }

    static logLevelStart(worldId, levelNum) {
        this.logEvent('level_start', {
            world: worldId + 1,
            level: levelNum
        });
    }

    static logLevelFail(worldId, levelNum, moves) {
        this.logEvent('level_fail', {
            world: worldId + 1,
            level: levelNum,
            moves: moves
        });
    }

    static logPowerUpUsed(type) {
        this.logEvent('powerup_used', { type: type });
    }

    static logAdWatched(type) {
        this.logEvent('ad_watched', { type: type });
    }

    static logPurchase(item, price) {
        this.logEvent('purchase', { item: item, price: price });
    }

    static handleRedirectResult() {
        if (!this.initialized || !this.auth) return;
        this.auth.getRedirectResult()
            .then((result) => {
                if (result?.user) {
                    this.logEvent('login_redirect_success', { method: 'google' });
                    this.currentUser = result.user;
                    if (typeof App !== 'undefined' && App.handleSuccessfulLogin) {
                        App.handleSuccessfulLogin(result.user, 'google');
                    }
                }
            })
            .catch((error) => {
                console.error('Redirect error:', error.code);
                this.logCrash('redirect_error', error.message || error.code);
            });
    }

    // ===== SIGN IN METHODS =====

    // Google Sign In
    static async signInWithGoogle() {
        if (!this.initialized) return { success: false, error: 'Not initialized' };
        try {
            this.logEvent('login_attempt', { method: 'google' });
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({
                prompt: 'select_account'
            });
            provider.addScope('profile');
            provider.addScope('email');

            // In Android WebViews, popup windows are blocked or problematic.
            // Using signInWithRedirect provides the recommended OAuth 2.0 Web Fallback
            // that works perfectly on Huawei devices without Google Play Services.
            if (typeof Android !== 'undefined') {
                await this.auth.signInWithRedirect(provider);
                return { success: true, redirect: true };
            } else {
                const result = await this.auth.signInWithPopup(provider);
                this.currentUser = result.user;
                this.logEvent('login_success', { method: 'google' });
                return { success: true, user: result.user };
            }
        } catch (error) {
            let msg = 'Sign-in failed';
            if (error.code === 'auth/popup-closed-by-user') msg = 'Cancelled';
            if (error.code === 'auth/popup-blocked') msg = 'Pop-up blocked';
            this.logCrash('google_signin_error', error.code);
            return { success: false, error: msg };
        }
    }

    static async signInWithGoogleRedirect() {
        if (!this.initialized) return { success: false, error: 'Not initialized' };
        try {
            this.logEvent('login_attempt_redirect', { method: 'google' });
            const provider = new firebase.auth.GoogleAuthProvider();
            await this.auth.signInWithRedirect(provider);
            return { success: true, redirect: true };
        } catch (error) {
            this.logCrash('google_redirect_error', error.code);
            return { success: false, error: error.message };
        }
    }

    // Email/Password Sign In
    static async signInWithEmail(email, password) {
        if (!this.initialized) return { success: false, error: 'Not initialized' };
        try {
            const result = await this.auth.signInWithEmailAndPassword(email, password);
            this.currentUser = result.user;
            this.logEvent('login', { method: 'email' });
            return { success: true, user: result.user };
        } catch (error) {
            let msg = 'Sign-in failed';
            if (error.code === 'auth/user-not-found') msg = 'No account found with this email';
            if (error.code === 'auth/wrong-password') msg = 'Incorrect password';
            if (error.code === 'auth/invalid-email') msg = 'Invalid email address';
            if (error.code === 'auth/user-disabled') msg = 'This account has been disabled';
            if (error.code === 'auth/too-many-requests') msg = 'Too many failed attempts. Try again later.';
            this.logCrash('email_signin_error', error.code);
            return { success: false, error: msg };
        }
    }

    // Email/Password Sign Up
    static async signUpWithEmail(email, password, displayName = null) {
        if (!this.initialized) return { success: false, error: 'Not initialized' };
        try {
            const result = await this.auth.createUserWithEmailAndPassword(email, password);
            this.currentUser = result.user;

            // Update profile with display name
            if (displayName && result.user) {
                await result.user.updateProfile({
                    displayName: displayName
                });
                // Reload user to get updated profile
                await result.user.reload();
                this.currentUser = this.auth.currentUser;
            }

            this.logEvent('sign_up', { method: 'email' });
            return { success: true, user: result.user };
        } catch (error) {
            let msg = 'Sign-up failed';
            if (error.code === 'auth/email-already-in-use') msg = 'This email is already registered';
            if (error.code === 'auth/invalid-email') msg = 'Invalid email address';
            if (error.code === 'auth/weak-password') msg = 'Password should be at least 6 characters';
            if (error.code === 'auth/operation-not-allowed') msg = 'Email/password accounts are not enabled';
            this.logCrash('email_signup_error', error.code);
            return { success: false, error: msg };
        }
    }

    // Password Reset
    static async sendPasswordReset(email) {
        if (!this.initialized) return { success: false, error: 'Not initialized' };
        try {
            await this.auth.sendPasswordResetEmail(email);
            this.logEvent('password_reset', {});
            return { success: true, message: 'Password reset email sent!' };
        } catch (error) {
            let msg = 'Failed to send reset email';
            if (error.code === 'auth/user-not-found') msg = 'No account found with this email';
            if (error.code === 'auth/invalid-email') msg = 'Invalid email address';
            if (error.code === 'auth/too-many-requests') msg = 'Too many requests. Try again later.';
            this.logCrash('password_reset_error', error.code);
            return { success: false, error: msg };
        }
    }

    // Update Password (for signed-in users)
    static async updatePassword(newPassword) {
        if (!this.initialized || !this.currentUser) {
            return { success: false, error: 'Not signed in' };
        }
        try {
            await this.currentUser.updatePassword(newPassword);
            this.logEvent('password_updated', {});
            return { success: true, message: 'Password updated successfully!' };
        } catch (error) {
            let msg = 'Failed to update password';
            if (error.code === 'auth/weak-password') msg = 'Password should be at least 6 characters';
            if (error.code === 'auth/requires-recent-login') msg = 'Please sign in again to update password';
            this.logCrash('password_update_error', error.code);
            return { success: false, error: msg };
        }
    }

    // ===== ANONYMOUS SIGN IN =====

    // Generate a friendly randomized player name (e.g. Player_4821)
    static generateAnonymousPlayerName(uid) {
        let num;
        if (uid && typeof uid === 'string') {
            let hash = 0;
            for (let i = 0; i < uid.length; i++) {
                hash = ((hash << 5) - hash) + uid.charCodeAt(i);
                hash |= 0;
            }
            num = 1000 + Math.abs(hash % 9000);
        } else {
            num = Math.floor(1000 + Math.random() * 9000);
        }
        return `Player_${num}`;
    }

    static async signInAnonymously() {
        if (!this.initialized) return { success: false, error: 'Not initialized' };
        try {
            // Check if already signed in anonymously or with a provider
            if (this.currentUser) {
                // If user is already signed in with email, don't override
                if (this.currentUser.providerData && this.currentUser.providerData.length > 0) {
                    const provider = this.currentUser.providerData[0].providerId;
                    if (provider !== 'anonymous') {
                        return { success: false, error: 'Already signed in with ' + provider };
                    }
                }
            }

            const result = await this.auth.signInAnonymously();
            this.currentUser = result.user;

            // When a player signs in anonymously, add a random number so it doesn't just say 'Player'
            if (!result.user.displayName || result.user.displayName === 'Player' || result.user.displayName === 'Guest Player') {
                const randomName = this.generateAnonymousPlayerName(result.user.uid);
                try {
                    await result.user.updateProfile({ displayName: randomName });
                } catch (e) {
                    console.warn('Anonymous profile update note:', e.message);
                }
                if (typeof App !== 'undefined' && App.state) {
                    App.state.playerName = randomName;
                    App.saveState();
                    App.updatePlayerDisplay();
                }
            }

            this.logEvent('login', { method: 'anonymous' });
            return { success: true, user: result.user };
        } catch (error) {
            let msg = 'Anonymous sign-in failed';
            if (error.code === 'auth/operation-not-allowed') msg = 'Anonymous accounts are not enabled';
            this.logCrash('anonymous_signin_error', error.code);
            return { success: false, error: msg };
        }
    }

    // Link anonymous account to email/password
    static async linkAnonymousToEmail(email, password, displayName = null) {
        if (!this.initialized || !this.currentUser) {
            return { success: false, error: 'Not signed in' };
        }

        if (!this.currentUser.isAnonymous) {
            return { success: false, error: 'Already linked to a provider' };
        }

        try {
            const credential = firebase.auth.EmailAuthProvider.credential(email, password);
            const result = await this.currentUser.linkWithCredential(credential);
            this.currentUser = result.user;

            // Update profile with display name
            if (displayName && result.user) {
                await result.user.updateProfile({
                    displayName: displayName
                });
                await result.user.reload();
                this.currentUser = this.auth.currentUser;
            }

            this.logEvent('link_account', { method: 'email' });
            return { success: true, user: result.user };
        } catch (error) {
            let msg = 'Failed to link account';
            if (error.code === 'auth/email-already-in-use') msg = 'This email is already registered';
            if (error.code === 'auth/weak-password') msg = 'Password should be at least 6 characters';
            if (error.code === 'auth/credential-already-in-use') msg = 'This email is already linked to another account';
            this.logCrash('link_account_error', error.code);
            return { success: false, error: msg };
        }
    }

    // Get auth providers for an email (for sign-in methods)
    static async fetchSignInMethodsForEmail(email) {
        if (!this.initialized) return [];
        try {
            const methods = await this.auth.fetchSignInMethodsForEmail(email);
            return methods;
        } catch (error) {
            console.warn('Fetch sign-in methods error:', error.message);
            return [];
        }
    }

    // ===== SAVE & LOAD DATA =====

    static async saveUserData(data) {
        if (!this.initialized || !this.currentUser) return false;
        try {
            const cleanData = {
                coins: data.coins || 0,
                currentWorld: data.currentWorld || 0,
                currentLevel: data.currentLevel || 1,
                totalStarsEarned: data.totalStarsEarned || 0,
                levelsCompleted: data.levelsCompleted || 0,
                highestTileEver: data.highestTileEver || 2,
                stars: data.stars || {},
                unlockedThemes: data.unlockedThemes || ['numbers'],
                activeTheme: data.activeTheme || 'numbers',
                achievements: data.achievements || {},
                totalAdsWatched: data.totalAdsWatched || 0,
                currentStreak: data.currentStreak || 0,
                maxStreak: data.maxStreak || 0,
                lastPlayedDate: data.lastPlayedDate || '',
                soundOn: data.soundOn !== undefined ? data.soundOn : true,
                adsRemoved: data.adsRemoved || false,
                offlineLevelsPlayed: data.offlineLevelsPlayed || 0,
                powerUpsUsed: data.powerUpsUsed || 0,
                totalMovesMade: data.totalMovesMade || 0,
                totalGamesPlayed: data.totalGamesPlayed || 0,
                totalWins: data.totalWins || 0,
                platform: this.getDetectedPlatform(),
                platformLabel: this.getPlatformLabel(),
                deviceModel: this.getDeviceModel(),
                clientType: this.getDetectedPlatform() === 'ios' ? 'ios_native' : (this.getDetectedPlatform() === 'google' || this.getDetectedPlatform() === 'huawei') ? 'android_native' : 'web_client',
                updatedAt: firebase.database.ServerValue.TIMESTAMP,
                uid: this.currentUser.uid,
                displayName: (this.currentUser.displayName && this.currentUser.displayName !== 'Player' && this.currentUser.displayName !== 'Guest Player')
                    ? this.currentUser.displayName
                    : ((App.state && App.state.playerName && App.state.playerName !== 'Player' && App.state.playerName !== 'Guest Player')
                        ? App.state.playerName
                        : (this.currentUser.email ? this.currentUser.email.split('@')[0] : this.generateAnonymousPlayerName(this.currentUser.uid))),
                email: this.currentUser.email || null,
                photoURL: this.currentUser.photoURL || null
            };
            await this.db.ref('users/' + this.currentUser.uid).set(cleanData);
            console.log('User data saved to cloud');

            // ✅ Save to leaderboard with current stats
            await this.saveLeaderboardEntry({
                displayName: cleanData.displayName,
                totalStarsEarned: cleanData.totalStarsEarned || 0,
                levelsCompleted: cleanData.levelsCompleted || 0,
                photoURL: this.currentUser.photoURL || null
            });

            return true;
        } catch (e) {
            console.warn('Save failed:', e.message);
            this.logCrash('save_data_error', e.message);
            return false;
        }
    }
    static async loadUserData() {
        if (!this.initialized || !this.currentUser) return null;
        try {
            const snapshot = await this.db.ref('users/' + this.currentUser.uid).once('value');
            const data = snapshot.val();
            if (data) {
                if (data.isBanned) {
                    console.warn('⛔ Account is suspended by administrator');
                    if (typeof App !== 'undefined' && App.showBannedNotice) {
                        App.showBannedNotice(data.banReason);
                        App.signOut();
                    }
                    return null;
                }
                // Remove sensitive/internal fields
                delete data.updatedAt;
                delete data.uid;
                delete data.email;
                delete data.displayName;
                delete data.photoURL;
                console.log('Cloud data loaded:', data.levelsCompleted, 'levels,', data.totalStarsEarned, 'stars');
                return data;
            }
            return null;
        } catch (e) {
            console.warn('Load failed:', e.message);
            this.logCrash('load_data_error', e.message);
            return null;
        }
    }

    // ===== REFERRAL SYSTEM METHODS =====

    static async getOrCreateReferralCode() {
        if (!this.initialized || !this.currentUser) {
            let code = (App.state.referralCode || 'BR2K-' + (App.state.playerName || 'USER').substring(0, 3).toUpperCase() + Math.floor(1000 + Math.random() * 9000)).toUpperCase();
            App.state.referralCode = code;
            App.saveState();
            return code;
        }

        const uid = this.currentUser.uid;
        try {
            const userRefSnap = await this.db.ref(`users/${uid}/referralCode`).once('value');
            if (userRefSnap.exists() && userRefSnap.val()) {
                const existingCode = userRefSnap.val();
                App.state.referralCode = existingCode;
                App.saveState();
                return existingCode;
            }

            const namePart = (this.currentUser.displayName || this.currentUser.email || 'PLAYER').replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();
            const numPart = Math.floor(1000 + Math.random() * 9000);
            const newCode = `BR2K-${namePart}${numPart}`;

            await this.db.ref(`referralCodes/${newCode}`).set(uid);
            await this.db.ref(`users/${uid}/referralCode`).set(newCode);

            App.state.referralCode = newCode;
            App.saveState();
            return newCode;
        } catch (e) {
            console.warn('Referral code creation error:', e.message);
            const fallbackCode = `BR2K-${uid.substring(0, 5).toUpperCase()}`;
            App.state.referralCode = fallbackCode;
            App.saveState();
            return fallbackCode;
        }
    }

    static async redeemReferralCode(code) {
        code = (code || '').trim().toUpperCase();
        if (!code) return { success: false, message: 'Please enter a referral code!' };

        if (!this.initialized || !this.currentUser) {
            return { success: false, message: 'Please sign in to redeem referral codes!' };
        }

        const myUid = this.currentUser.uid;

        if (App.state.referredBy) {
            return { success: false, message: 'You have already redeemed a referral code!' };
        }

        if (App.state.referralCode === code) {
            return { success: false, message: 'You cannot redeem your own referral code!' };
        }

        try {
            const codeSnap = await this.db.ref(`referralCodes/${code}`).once('value');
            if (!codeSnap.exists() || !codeSnap.val()) {
                return { success: false, message: 'Invalid referral code. Please check and try again!' };
            }

            const referrerUid = codeSnap.val();
            if (referrerUid === myUid) {
                return { success: false, message: 'You cannot redeem your own code!' };
            }

            await this.db.ref(`users/${myUid}/referredBy`).set(code);
            await this.db.ref(`referralRedemptions/${referrerUid}/${myUid}`).set({
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                code: code,
                user: App.state.playerName || 'Friend'
            });

            await this.db.ref(`users/${referrerUid}/referralsCount`).transaction((current) => (current || 0) + 1);

            const rewardCoins = 500;
            App.state.coins = (App.state.coins || 0) + rewardCoins;
            App.state.referredBy = code;
            App.saveState();
            App.updateAllCoinDisplays();

            await this.saveUserData(App.state);

            return {
                success: true,
                message: `🎉 Code redeemed! You received 💰 +${rewardCoins} Bonus Coins!`
            };
        } catch (e) {
            console.error('Redeem referral code error:', e);
            return { success: false, message: 'Failed to redeem code: ' + e.message };
        }
    }

    static async syncReferrals() {
        if (!this.initialized || !this.currentUser) return null;
        const uid = this.currentUser.uid;

        try {
            const userSnap = await this.db.ref(`users/${uid}`).once('value');
            const userData = userSnap.val() || {};

            const count = userData.referralsCount || 0;
            const claimed = userData.claimedMilestones || {};
            const adFreeUntil = userData.adFreeUntil || 0;

            App.state.referralsCount = count;
            App.state.claimedMilestones = claimed;
            App.state.adFreeUntil = adFreeUntil;

            if (adFreeUntil > Date.now()) {
                App.state.adsRemovedTemp = true;
                if (typeof AdService !== 'undefined') AdService.removeAds();
            }

            App.saveState();
            return { count, claimed, adFreeUntil };
        } catch (e) {
            console.warn('Sync referrals error:', e.message);
            return null;
        }
    }

    static async claimReferralMilestone(friendsTarget, coinReward, adFreeDays) {
        if (!this.initialized || !this.currentUser) {
            return { success: false, message: 'Please sign in to claim rewards!' };
        }

        const uid = this.currentUser.uid;
        const currentCount = App.state.referralsCount || 0;

        if (currentCount < friendsTarget) {
            return { success: false, message: `Need ${friendsTarget} referred friends to claim!` };
        }

        const claimed = App.state.claimedMilestones || {};
        if (claimed[friendsTarget]) {
            return { success: false, message: 'Milestone reward already claimed!' };
        }

        try {
            if (coinReward > 0) {
                App.state.coins = (App.state.coins || 0) + coinReward;
            }

            let adFreeUntil = App.state.adFreeUntil || Date.now();
            if (adFreeUntil < Date.now()) adFreeUntil = Date.now();

            if (adFreeDays > 0) {
                const addMs = adFreeDays * 24 * 60 * 60 * 1000;
                adFreeUntil += addMs;
                App.state.adFreeUntil = adFreeUntil;
                App.state.adsRemovedTemp = true;
                if (typeof AdService !== 'undefined') AdService.removeAds();
            }

            claimed[friendsTarget] = true;
            App.state.claimedMilestones = claimed;

            App.saveState();
            App.updateAllCoinDisplays();

            await this.db.ref(`users/${uid}/claimedMilestones/${friendsTarget}`).set(true);
            await this.db.ref(`users/${uid}/adFreeUntil`).set(adFreeUntil);
            await this.saveUserData(App.state);

            let rewardMsg = `🎉 Milestone Unlocked (${friendsTarget} Friends)!`;
            if (coinReward > 0) rewardMsg += ` +${coinReward.toLocaleString()} Coins`;
            if (adFreeDays > 0) rewardMsg += ` +${adFreeDays} Days Ad-Free!`;

            return { success: true, message: rewardMsg };
        } catch (e) {
            console.error('Claim milestone error:', e);
            return { success: false, message: 'Error claiming milestone: ' + e.message };
        }
    }

    // ===== LEADERBOARD METHODS =====

    // Save leaderboard entry to all timeframes
    static async saveLeaderboardEntry(userData) {
        if (!this.initialized || !this.currentUser) return false;
        try {
            const uid = this.currentUser.uid;
            const now = new Date();
            const today = this.getDateKey(now);
            const weekKey = this.getWeekKey(now);
            const monthKey = this.getMonthKey(now);

            // Get photoURL
            let photoURL = null;
            if (this.currentUser.photoURL) {
                photoURL = this.currentUser.photoURL;
            } else if (App.state && App.state.photoURL) {
                photoURL = App.state.photoURL;
            }

            // Get country from user data
            const country = App.state?.country || 'Unknown';

            // Prepare base data
            const displayName = (userData.displayName && userData.displayName !== 'Player' && userData.displayName !== 'Guest Player')
                ? userData.displayName
                : ((this.currentUser && this.currentUser.displayName && this.currentUser.displayName !== 'Player' && this.currentUser.displayName !== 'Guest Player')
                    ? this.currentUser.displayName
                    : ((App.state && App.state.playerName && App.state.playerName !== 'Player' && App.state.playerName !== 'Guest Player')
                        ? App.state.playerName
                        : this.generateAnonymousPlayerName(uid)));

            const baseData = {
                displayName: displayName,
                totalStarsEarned: userData.totalStarsEarned || 0,
                levelsCompleted: userData.levelsCompleted || 0,
                photoURL: photoURL,
                country: country,
                updatedAt: firebase.database.ServerValue.TIMESTAMP,
                uid: uid
            };

            // Save to all leaderboards
            const updates = {};

            // Overall leaderboard
            updates[`leaderboard/overall/${uid}`] = baseData;

            // Daily leaderboard
            updates[`leaderboard/daily/${today}/${uid}`] = {
                ...baseData,
                date: today
            };

            // Weekly leaderboard
            updates[`leaderboard/weekly/${weekKey}/${uid}`] = {
                ...baseData,
                week: weekKey
            };

            // Monthly leaderboard
            updates[`leaderboard/monthly/${monthKey}/${uid}`] = {
                ...baseData,
                month: monthKey
            };

            // Update all at once
            await this.db.ref().update(updates);
            console.log('✅ Leaderboard updated for all timeframes');
            return true;
        } catch (e) {
            console.warn('Leaderboard save failed:', e.message);
            return false;
        }
    }

    // Get leaderboard with pagination
    static async getLeaderboardPaginated(timeframe = 'overall', page = 1, pageSize = 20, country = null) {
        if (!this.initialized || !this.db) return { entries: [], totalCount: 0, hasMore: false };
        try {
            let path = `leaderboard/${timeframe}`;

            // If timeframe is daily/weekly/monthly, get current period
            if (timeframe === 'daily') {
                const today = this.getDateKey(new Date());
                path = `leaderboard/daily/${today}`;
            } else if (timeframe === 'weekly') {
                const weekKey = this.getWeekKey(new Date());
                path = `leaderboard/weekly/${weekKey}`;
            } else if (timeframe === 'monthly') {
                const monthKey = this.getMonthKey(new Date());
                path = `leaderboard/monthly/${monthKey}`;
            }

            // Get all entries from the path
            const snapshot = await this.db.ref(path)
                .orderByChild('totalStarsEarned')
                .limitToLast(1000)
                .once('value');

            let allEntries = [];
            snapshot.forEach(child => {
                const data = child.val();
                if (data) {
                    // Filter by country if specified
                    if (country && data.country !== country) return;

                    let photoURL = data.photoURL || null;

                    // For current user, also check auth and app state
                    if (this.currentUser && child.key === this.currentUser.uid) {
                        if (!photoURL && this.currentUser.photoURL) {
                            photoURL = this.currentUser.photoURL;
                        }
                        if (!photoURL && App.state && App.state.photoURL) {
                            photoURL = App.state.photoURL;
                        }
                    }

                    allEntries.push({
                        uid: child.key,
                        name: (data.displayName && data.displayName !== 'Player') ? data.displayName : this.generateAnonymousPlayerName(child.key),
                        stars: data.totalStarsEarned || 0,
                        levels: data.levelsCompleted || 0,
                        photoURL: photoURL,
                        country: data.country || 'Unknown',
                        isCurrentUser: this.currentUser && child.key === this.currentUser.uid,
                        updatedAt: data.updatedAt
                    });
                }
            });

            // Sort by stars (descending)
            allEntries.sort((a, b) => b.stars - a.stars);

            // Calculate pagination
            const totalCount = allEntries.length;
            const startIndex = (page - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            const paginatedEntries = allEntries.slice(startIndex, endIndex);
            const hasMore = endIndex < totalCount;

            return {
                entries: paginatedEntries,
                totalCount: totalCount,
                hasMore: hasMore,
                currentPage: page,
                totalPages: Math.ceil(totalCount / pageSize),
                pageSize: pageSize,
                startIndex: startIndex + 1,
                endIndex: Math.min(endIndex, totalCount)
            };

        } catch (e) {
            console.warn('Leaderboard pagination failed:', e.message);
            return {
                entries: [],
                totalCount: 0,
                hasMore: false,
                currentPage: 1,
                totalPages: 0,
                startIndex: 0,
                endIndex: 0,
                pageSize: pageSize
            };
        }
    }

    // Get leaderboard (backward compatibility)
    static async getLeaderboard(timeframe = 'overall', limit = 50) {
        const result = await this.getLeaderboardPaginated(timeframe, 1, limit);
        return result.entries;
    }

    // Get countries for filter
    static async getCountriesPaginated(timeframe = 'overall') {
        if (!this.initialized || !this.db) return [];
        try {
            let path = `leaderboard/${timeframe}`;

            if (timeframe === 'daily') {
                const today = this.getDateKey(new Date());
                path = `leaderboard/daily/${today}`;
            } else if (timeframe === 'weekly') {
                const weekKey = this.getWeekKey(new Date());
                path = `leaderboard/weekly/${weekKey}`;
            } else if (timeframe === 'monthly') {
                const monthKey = this.getMonthKey(new Date());
                path = `leaderboard/monthly/${monthKey}`;
            }

            const snapshot = await this.db.ref(path)
                .orderByChild('totalStarsEarned')
                .limitToLast(100)
                .once('value');

            const countries = new Set();
            snapshot.forEach(child => {
                const data = child.val();
                if (data && data.country) {
                    countries.add(data.country);
                }
            });
            return Array.from(countries).sort();
        } catch (e) {
            console.warn('Get countries failed:', e.message);
            return [];
        }
    }

    // ===== DATE HELPER METHODS =====

    // Get date key (YYYY-MM-DD)
    static getDateKey(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Get week key (YYYY-WW)
    static getWeekKey(date) {
        const d = new Date(date);
        const startOfWeek = new Date(d);
        startOfWeek.setDate(d.getDate() - d.getDay());
        const year = startOfWeek.getFullYear();
        const weekNumber = Math.ceil((((startOfWeek - new Date(year, 0, 1)) / 86400000) + 1) / 7);
        return `${year}-W${String(weekNumber).padStart(2, '0')}`;
    }

    // Get month key (YYYY-MM)
    static getMonthKey(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }

    // ===== PROFILE PICTURE =====

    // Upload profile picture to Firebase Storage
    static async uploadProfilePicture(dataUrl) {
        if (!this.initialized || !this.currentUser) {
            return { success: false, error: 'Not signed in' };
        }

        try {
            // Check if Firebase Storage is available
            if (typeof firebase.storage === 'undefined') {
                console.warn('Firebase Storage not available. Using data URL directly.');
                if (typeof App !== 'undefined') {
                    App.state.photoURL = dataUrl;
                    App.saveState();
                    App.updatePlayerDisplay();
                    // Update leaderboard entry with photoURL
                    await this.updateLeaderboardPhotoURL(dataUrl);
                }
                return { success: true, url: dataUrl };
            }

            // Convert data URL to blob
            const response = await fetch(dataUrl);
            const blob = await response.blob();

            // Upload to Firebase Storage
            const storageRef = firebase.storage().ref();
            const profileRef = storageRef.child(`users/${this.currentUser.uid}/avatar.jpg`);

            const uploadTask = await profileRef.put(blob);
            const downloadUrl = await uploadTask.ref.getDownloadURL();

            // Update user profile with photo URL
            await this.currentUser.updateProfile({
                photoURL: downloadUrl
            });

            // Reload user to get updated profile
            await this.currentUser.reload();
            this.currentUser = this.auth.currentUser;

            // Update app state
            if (typeof App !== 'undefined') {
                App.state.photoURL = downloadUrl;
                App.saveState();
                App.updatePlayerDisplay();
                // Update leaderboard entry with photoURL
                await this.updateLeaderboardPhotoURL(downloadUrl);
            }

            this.logEvent('profile_picture_upload', {});
            console.log('Profile picture uploaded successfully');
            return { success: true, url: downloadUrl };

        } catch (error) {
            console.warn('Profile picture upload failed:', error.message);
            this.logCrash('profile_upload_error', error.message);
            return { success: false, error: error.message };
        }
    }

    // Update leaderboard with new photoURL
    static async updateLeaderboardPhotoURL(photoURL) {
        if (!this.initialized || !this.currentUser) return false;
        try {
            const uid = this.currentUser.uid;
            const now = new Date();
            const today = this.getDateKey(now);
            const weekKey = this.getWeekKey(now);
            const monthKey = this.getMonthKey(now);

            const updates = {};

            // Update all timeframes
            updates[`leaderboard/overall/${uid}/photoURL`] = photoURL;
            updates[`leaderboard/overall/${uid}/updatedAt`] = firebase.database.ServerValue.TIMESTAMP;

            updates[`leaderboard/daily/${today}/${uid}/photoURL`] = photoURL;
            updates[`leaderboard/daily/${today}/${uid}/updatedAt`] = firebase.database.ServerValue.TIMESTAMP;

            updates[`leaderboard/weekly/${weekKey}/${uid}/photoURL`] = photoURL;
            updates[`leaderboard/weekly/${weekKey}/${uid}/updatedAt`] = firebase.database.ServerValue.TIMESTAMP;

            updates[`leaderboard/monthly/${monthKey}/${uid}/photoURL`] = photoURL;
            updates[`leaderboard/monthly/${monthKey}/${uid}/updatedAt`] = firebase.database.ServerValue.TIMESTAMP;

            await this.db.ref().update(updates);
            console.log('✅ Leaderboard photoURL updated');
            return true;
        } catch (e) {
            console.warn('Failed to update leaderboard photoURL:', e.message);
            return false;
        }
    }

    // ===== DELETE ACCOUNT =====

    static async deleteAccount() {
        if (!this.initialized || !this.currentUser) {
            return { success: false, error: 'Not signed in' };
        }
        try {
            const uid = this.currentUser.uid;

            // Delete user data from database
            await this.db.ref('users/' + uid).remove();
            await this.db.ref('leaderboard/overall/' + uid).remove();

            // Also delete from daily, weekly, monthly
            const now = new Date();
            const today = this.getDateKey(now);
            const weekKey = this.getWeekKey(now);
            const monthKey = this.getMonthKey(now);

            await this.db.ref(`leaderboard/daily/${today}/${uid}`).remove();
            await this.db.ref(`leaderboard/weekly/${weekKey}/${uid}`).remove();
            await this.db.ref(`leaderboard/monthly/${monthKey}/${uid}`).remove();

            // Also delete any profile picture from storage
            try {
                if (typeof firebase.storage !== 'undefined') {
                    const storageRef = firebase.storage().ref();
                    const profileRef = storageRef.child(`users/${uid}/avatar.jpg`);
                    await profileRef.delete().catch(() => { });
                    console.log('Profile picture deleted from storage');
                }
            } catch (e) {
                // Ignore storage deletion errors
                console.warn('Storage deletion skipped:', e.message);
            }

            // Delete the user account
            await this.currentUser.delete();
            this.currentUser = null;
            this.logEvent('account_deleted', {});
            return { success: true, message: 'Account deleted successfully' };
        } catch (error) {
            let msg = 'Failed to delete account';
            if (error.code === 'auth/requires-recent-login') {
                msg = 'Please sign in again before deleting your account';
            } else if (error.code === 'auth/too-many-requests') {
                msg = 'Too many requests. Please try again later.';
            }
            this.logCrash('account_delete_error', error.code);
            return { success: false, error: msg };
        }
    }

    // Migrate old leaderboard data to new structure
    static async migrateLeaderboardData() {
        if (!this.initialized || !this.currentUser) return false;
        try {
            const uid = this.currentUser.uid;

            // Check if user has data in the old structure
            const oldSnapshot = await this.db.ref(`leaderboard/${uid}`).once('value');
            const oldData = oldSnapshot.val();

            if (oldData) {
                console.log('Found old leaderboard data, migrating...');

                // Get current date keys
                const now = new Date();
                const today = this.getDateKey(now);
                const weekKey = this.getWeekKey(now);
                const monthKey = this.getMonthKey(now);

                // Prepare data
                const baseData = {
                    displayName: (oldData.displayName && oldData.displayName !== 'Player') || (this.currentUser.displayName && this.currentUser.displayName !== 'Player') || this.generateAnonymousPlayerName(uid),
                    totalStarsEarned: oldData.totalStarsEarned || 0,
                    levelsCompleted: oldData.levelsCompleted || 0,
                    photoURL: oldData.photoURL || this.currentUser.photoURL || null,
                    country: oldData.country || 'Unknown',
                    updatedAt: firebase.database.ServerValue.TIMESTAMP,
                    uid: uid
                };

                // Save to new structure
                const updates = {};
                updates[`leaderboard/overall/${uid}`] = baseData;
                updates[`leaderboard/daily/${today}/${uid}`] = { ...baseData, date: today };
                updates[`leaderboard/weekly/${weekKey}/${uid}`] = { ...baseData, week: weekKey };
                updates[`leaderboard/monthly/${monthKey}/${uid}`] = { ...baseData, month: monthKey };

                await this.db.ref().update(updates);

                // Optionally delete old data
                // await this.db.ref(`leaderboard/${uid}`).remove();

                console.log('✅ Leaderboard data migrated successfully');
                return true;
            } else {
                console.log('No old leaderboard data found');
                return false;
            }
        } catch (e) {
            console.warn('Migration failed:', e.message);
            return false;
        }
    }

    // ===== SIGN OUT =====

    static signOut() {
        if (this.auth) {
            this.logEvent('logout', {});
            this.auth.signOut().then(() => {
                this.currentUser = null;
                console.log('User signed out');
            }).catch(() => { });
        }
    }

    // ===== FEEDBACK & REVIEWS =====

    static async submitFeedback(rating, feedbackText) {
        if (!this.db) {
            if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
                this.db = firebase.database();
            } else {
                console.warn('Firebase DB not initialized');
                throw new Error('Database not connected');
            }
        }
        const uid = (this.currentUser && this.currentUser.uid) ? this.currentUser.uid : ('anon_' + Math.random().toString(36).substring(2, 9));
        const username = (App.state && App.state.playerName) ? App.state.playerName : ((this.currentUser && this.currentUser.displayName) ? this.currentUser.displayName : 'Player');
        const email = (App.state && App.state.email) ? App.state.email : ((this.currentUser && this.currentUser.email) ? this.currentUser.email : 'No email');
        const platform = (typeof AdService !== 'undefined' && AdService.getPlatform) ? AdService.getPlatform() : 'web';
        const timestamp = (typeof firebase !== 'undefined' && firebase.database && firebase.database.ServerValue)
            ? firebase.database.ServerValue.TIMESTAMP
            : Date.now();

        const detectedPlatform = this.getDetectedPlatform();
        const feedbackData = {
            uid: uid,
            username: username,
            email: email,
            rating: Number(rating),
            feedback: feedbackText,
            platform: detectedPlatform,
            platformLabel: this.getPlatformLabel(),
            deviceModel: this.getDeviceModel(),
            timestamp: timestamp
        };

        const newRef = this.db.ref('feedback').push();
        await newRef.set(feedbackData);
        console.log('✅ Feedback saved to database successfully');
        return true;
    }

    // ===== PROMO & CAMPAIGN ATTRIBUTION TRACKING =====
    static async recordPromoVisit(promoData) {
        if (!this.db) {
            if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
                this.db = firebase.database();
            } else {
                console.warn('Firebase DB not initialized for promo tracking');
                return null;
            }
        }

        try {
            const promoKey = (promoData.promoCode || promoData.campaign || 'general')
                .replace(/[.#$[\]/]/g, '_')
                .toUpperCase();

            const promoRef = this.db.ref(`promo_tracking/${promoKey}`);
            
            // Increment overall visits counter
            promoRef.child('stats/totalVisits').transaction(curr => (curr || 0) + 1);
            promoRef.child('stats/lastVisitAt').set(firebase.database.ServerValue.TIMESTAMP);
            if (promoData.campaign) {
                promoRef.child('stats/campaignName').set(promoData.campaign);
            }

            // Log detailed visit entry
            const entryRef = promoRef.child('events').push();
            await entryRef.set({
                promoCode: promoData.promoCode || '',
                campaign: promoData.campaign || '',
                source: promoData.source || '',
                referrer: document.referrer || 'direct',
                platform: navigator.platform || '',
                isMobile: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
                country: (typeof App !== 'undefined' && App.state && App.state.country) ? App.state.country : 'Unknown',
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });

            console.log('📊 Promo visit logged for code:', promoKey);
            return promoKey;
        } catch (err) {
            console.warn('Failed to record promo visit:', err);
            return null;
        }
    }

    static async recordPromoConversion(promoKey, type = 'claimed') {
        if (!this.db || !promoKey) return;
        try {
            const cleanKey = promoKey.replace(/[.#$[\]/]/g, '_').toUpperCase();
            this.db.ref(`promo_tracking/${cleanKey}/stats/conversions`).transaction(curr => (curr || 0) + 1);
            this.db.ref(`promo_tracking/${cleanKey}/events`).push({
                type: type,
                uid: (this.currentUser && this.currentUser.uid) ? this.currentUser.uid : 'guest',
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
        } catch (e) {
            console.warn('Error recording promo conversion:', e);
        }
    }
}

if (typeof window !== 'undefined') {
    window.FirebaseService = FirebaseService;
}