// Main Application Controller
class App {
    static state = {
        coins: 100,
        stars: {},
        currentWorld: 0,
        currentLevel: 1,
        highestTileEver: 0,
        soundOn: true,
        activeTheme: 'numbers',
        unlockedThemes: ['numbers'],
        dailyChallengeDone: false,
        dailyChallengeDate: null,
        isLoggedIn: false,
        totalAdsWatched: 0,
        totalGamesPlayed: 0,
        totalWins: 0,
        currentStreak: 0,
        maxStreak: 0,
        lastPlayedDate: null,
        offlineLevelsPlayed: 0,
        powerUpsUsed: 0,
        totalMovesMade: 0,
        userId: null,
        playerName: 'Guest Player',
        email: null,
        photoURL: null,
        swapSelectionMode: false,
        selectedTile: null,
        selectedTilePos: null,
        levelsCompleted: 0,
        totalStarsEarned: 0,
        achievements: {},
        country: 'Unknown',
        adsRemoved: false,
        hasRated: false,
        doubleRewardPending: false,
        referralCode: null,
        referredBy: null,
        referralsCount: 0,
        claimedMilestones: {},
        adFreeUntil: 0,
        adEnvironment: 'web' // 'web' or 'android'
    };

    static pendingReferralCode = null;

    static currentGame = null;
    static isAndroid = false;
    static adBridgeReady = false;

    static init() {
        console.log('🚀 Initializing Block Rush 2K...');

        // Initialize i18n localization
        if (typeof I18N !== 'undefined') {
            I18N.init();
        }

        // Detect Android bridge
        this.detectAndroidAndRemoveBanner();
        this.detectScreenMode();
        this.loadState();
        this.applyTheme(this.state.activeTheme || 'numbers');

        // Setup Android callbacks
        this.setupAndroidCallbacks();

        // Check if bridge is already available
        if (typeof Android !== 'undefined') {
            console.log('✅ Android bridge already available');
            this.adBridgeReady = true;
            this.isAndroid = true;
            this.state.adEnvironment = 'android';
            // Test bridge after a short delay
            setTimeout(() => this.testAndroidBridge(), 1000);
        }


        if (typeof FirebaseService !== 'undefined') {
            FirebaseService.init();
        }

        if (typeof AdService !== 'undefined') {
            console.log('📢 Initializing AdService...');
            // Make sure config is set
            if (AdService.config && AdService.config.admob) {
                AdService.init();
            } else {
                console.warn('AdService.config not properly defined');
            }
        } else {
            console.warn('AdService not available');
        }


        if (typeof SoundManager !== 'undefined') {
            SoundManager.enabled = this.state.soundOn;
        }

        this.updateAllCoinDisplays();
        this.updatePlayerDisplay();
        this.updateOfflineIndicator();
        this.updateLoginButtonVisibility();
        this.setupNetworkListeners();

        this.checkPendingGame();

        if (typeof DailyChallenge !== 'undefined' && DailyChallenge.checkDailyReset) {
            DailyChallenge.checkDailyReset();
        } else {
            console.warn('DailyChallenge not fully loaded');
        }

        if (typeof Achievements !== 'undefined' && Achievements.init) {
            Achievements.init();
        }

        if (typeof Store !== 'undefined' && Store.init) {
            Store.init();
        }

        if (typeof Leaderboard !== 'undefined' && Leaderboard.loadLeaderboard) {
            Leaderboard.loadLeaderboard();
        }

        const exitBtn = document.getElementById('btn-exit-game');
        if (exitBtn) {
            exitBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                PopupManager.confirmExit();
            });
        }

        const playerInfo = document.getElementById('player-info-display');
        if (playerInfo) {
            playerInfo.addEventListener('click', () => {
                this.handlePlayerClick();
            });
        }


        // Detect country
        this.detectCountry();

        // Apply translations to DOM
        if (typeof I18N !== 'undefined') {
            I18N.applyToDOM();
        }

        // Check for referral code in URL query string (e.g. ?ref=BR2K-ABC12)
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const refCode = urlParams.get('ref') || urlParams.get('referral');
            if (refCode && !this.state.referredBy) {
                console.log('🎁 Referral code detected in URL:', refCode);
                this.pendingReferralCode = refCode.trim().toUpperCase();
            }
        } catch (e) { }

        // Initialize ads based on environment
        if (typeof AdService !== 'undefined') {
            AdService.init();
        }

        // Initialize promo link tracking & reward
        this.initPromoTracking();

        // Check if user is on mobile browser and prompt for app download if appropriate
        this.checkAndPromptAppDownload();

        console.log('✅ App initialized successfully!');
        console.log('   Coins:', this.state.coins);
        console.log('   World:', this.state.currentWorld);
        console.log('   Level:', this.state.currentLevel);
        console.log('   Theme:', this.state.activeTheme);
        console.log('   Logged In:', this.state.isLoggedIn);
        console.log('   Environment:', this.state.adEnvironment);

        // Auto-focus Continue button on Home screen (TV devices only)
        setTimeout(() => {
            if (window.isTv) {
                const continueBtn = document.querySelector('#screen-home button[onclick*="continueGame"], .home-menu .btn-primary');
                if (continueBtn) continueBtn.focus();
            }
        }, 250);
    }


    // ============================================================
    // ANDROID BRIDGE DETECTION
    // ============================================================
    static detectAndroidAndRemoveBanner() {
        // Only remove HTML banner if running in native app wrapper with active bridge
        const isNativeApp = (typeof window.Android !== 'undefined' && window.Android !== null) ||
                            (typeof window.AdMob !== 'undefined');

        if (isNativeApp) {
            console.log('📱 Native app bridge detected - removing HTML banner for native ad rendering');

            // Remove the banner container
            const bannerContainer = document.getElementById('banner-ad');
            if (bannerContainer) {
                bannerContainer.style.display = 'none';
                bannerContainer.innerHTML = '';
            }

            // Remove any other ad containers
            const adContainers = document.querySelectorAll('.banner-ad-container, .ad-container');
            adContainers.forEach(el => {
                el.style.display = 'none';
                el.innerHTML = '';
            });

            // Remove padding from app
            const app = document.getElementById('app');
            if (app) {
                app.style.paddingTop = '0';
                app.style.paddingBottom = '0';
            }

            this.isAndroid = true;
            this.state.adEnvironment = 'android';
        }
    }

    // ============================================================
    // SCREEN MODE DETECTION (Desktop, Large Screen, TV)
    // ============================================================
    static detectScreenMode() {
        const update = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            const isLandscape = width > height;
            const isWide = (width >= 768 && isLandscape) || width >= 992;
            const isTV = /TV|SmartTV|GoogleTV|HbbTV|BRAVIA|NetCast|Tizen|POV_TV/i.test(navigator.userAgent) || window.location.search.includes('tv=1');

            window.isTv = isTV;

            document.body.classList.toggle('large-screen', isWide);
            document.body.classList.toggle('desktop-mode', width >= 992);
            document.body.classList.toggle('tv-mode', isTV);

            console.log(`🖥️ Screen mode updated: isWide=${isWide}, isTV=${isTV}, dimensions=${width}x${height}`);
            if (App.currentGame && !App.currentGame.gameOver && typeof GameUI !== 'undefined' && GameUI.renderBoard) {
                GameUI.renderBoard(App.currentGame);
            }
        };

        window.addEventListener('resize', update);
        window.addEventListener('orientationchange', update);
        update();
    }

    // ============================================================
    // PROMO & CAMPAIGN LINK TRACKING (Task 4)
    // ============================================================
    static initPromoTracking() {
        try {
            const params = new URLSearchParams(window.location.search);
            const promoCode = params.get('promo') || params.get('promo_code');
            const campaign = params.get('campaign') || params.get('utm_campaign');
            const source = params.get('src') || params.get('source') || params.get('utm_source');

            if (promoCode || campaign || source) {
                const trackIdentifier = (promoCode || campaign || source).trim().toUpperCase();
                console.log('🎯 Promo/Campaign detected in URL:', { promoCode, campaign, source });

                // Save to local storage for persistent attribution
                localStorage.setItem('blockrush_promo_source', trackIdentifier);
                localStorage.setItem('blockrush_promo_time', Date.now().toString());

                // Record visit to Firebase
                if (typeof FirebaseService !== 'undefined' && FirebaseService.recordPromoVisit) {
                    FirebaseService.recordPromoVisit({
                        promoCode: promoCode || '',
                        campaign: campaign || '',
                        source: source || ''
                    });
                }

                // If promo has a reward and hasn't been claimed yet on this device
                const claimKey = 'br2k_promo_claimed_' + trackIdentifier;
                if (!localStorage.getItem(claimKey)) {
                    localStorage.setItem(claimKey, 'true');
                    const bonusCoins = 500;
                    this.state.coins = (this.state.coins || 0) + bonusCoins;
                    this.saveState();
                    this.updateAllCoinDisplays();

                    if (typeof FirebaseService !== 'undefined' && FirebaseService.recordPromoConversion) {
                        FirebaseService.recordPromoConversion(trackIdentifier, 'claimed_bonus');
                    }

                    setTimeout(() => {
                        if (typeof PopupManager !== 'undefined' && PopupManager.show) {
                            PopupManager.show({
                                icon: '🎁',
                                title: 'Promo Reward Unlocked!',
                                subtitle: 'Welcome to Block Rush 2K',
                                details: [
                                    { label: 'Bonus Reward', value: `+${bonusCoins} Coins` },
                                    { label: 'Promo Code', value: trackIdentifier }
                                ],
                                customContent: `
                                    <div style="text-align:center;padding:8px 0;font-size:13px;color:#cbd5e1;line-height:1.5;">
                                        Thanks for checking out Block Rush 2K via our promo link! We've credited <strong>${bonusCoins} coins</strong> to help you unlock power-ups and themes!
                                    </div>
                                `,
                                confirmText: 'Claim & Play! 🚀',
                                showCancel: false
                            });
                        } else {
                            this.showToast(`🎁 Promo Bonus! +${bonusCoins} coins!`);
                        }
                    }, 1200);
                }
            }
        } catch (e) {
            console.warn('Error in promo tracking:', e);
        }
    }

    // ============================================================
    // APP STORE / DOWNLOAD PROMPT (Task 3)
    // ============================================================
    static checkAndPromptAppDownload() {
        const isNative = (typeof window.Android !== 'undefined' && window.Android !== null) ||
                         (typeof window.AdMob !== 'undefined');
        if (isNative) return;

        const dismissed = sessionStorage.getItem('br2k_app_prompt_dismissed');
        if (dismissed) return;

        const isAndroid = /Android/i.test(navigator.userAgent);
        if (isAndroid) {
            setTimeout(() => {
                this.showAppDownloadPrompt('android');
            }, 3000);
        }
    }

    static showAppDownloadPrompt(platform = 'android') {
        if (typeof PopupManager === 'undefined' || !PopupManager.show) return;

        sessionStorage.setItem('br2k_app_prompt_dismissed', '1');

        PopupManager.show({
            icon: '📱',
            title: 'Play on Mobile App',
            subtitle: 'Block Rush 2K is available for mobile',
            details: [
                { label: 'Platform', value: 'Huawei & Android Devices' },
                { label: 'Performance', value: 'Silky smooth 60 FPS' },
                { label: 'In-App Store', value: 'Coin packs & exclusive themes' }
            ],
            customContent: `
                <div style="text-align:center;padding:6px 0;font-size:13px;color:#cbd5e1;line-height:1.5;">
                    Would you like to play on the official <strong>Block Rush 2K Mobile App</strong> for the best mobile experience, in-app store, and cloud sync?
                </div>
            `,
            confirmText: '📲 Get Mobile App',
            onConfirm: () => {
                window.location.href = '/download';
            },
            cancelText: 'Continue in Browser',
            showCancel: true
        });
    }

    static setupAndroidCallbacks() {
        // Callback when Android AdBridge is ready
        window.onAdBridgeReady = function () {
            console.log('✅ Android AdBridge ready callback received');
            App.adBridgeReady = true;

            // Reload ads if needed
            if (typeof AdService !== 'undefined') {
                AdService.loadBannerAd();
            }
        };

        // Callback when rewarded ad completes - FIXED to trigger _rewardCallback
        window.onRewardedAdCompleted = function (success) {
            console.log('🎁 Rewarded ad completed:', success);
            if (typeof window._rewardCallback === 'function') {
                const cb = window._rewardCallback;
                window._rewardCallback = null;
                cb(success);
            }
            if (success) {
                App.showToast('🎁 Reward earned!');
            } else {
                App.showToast('❌ Ad canceled or failed, please try again');
            }
        };

        // Billing: Purchase success callback from Android
        window.onPurchaseSuccess = function (productId, orderId) {
            console.log('💳 Purchase success from Android:', productId, orderId);
            if (typeof Store !== 'undefined') { Store.isPurchasing = false; }
            App.handlePurchaseSuccess(productId, orderId);
        };

        // Billing: Purchase failed callback
        window.onPurchaseFailed = function (errorMessage) {
            console.warn('❌ Purchase failed from Android:', errorMessage);
            if (typeof Store !== 'undefined') { Store.isPurchasing = false; }
            App.showToast('❌ ' + (errorMessage || 'Purchase canceled or failed'));
        };

        // Billing: Purchases restored callback
        window.onPurchasesRestored = function (restoredProducts) {
            console.log('🔄 Purchases restored from Android:', restoredProducts);
            App.handlePurchasesRestored(restoredProducts);
        };

        // Billing: Real localized prices loaded
        window.onPricesLoaded = function (prices) {
            console.log('🏷️ Localized prices loaded from App Store:', prices);
            App.googlePlayPrices = prices || {};
            if (typeof Store !== 'undefined' && Store.renderStoreContent) {
                Store.renderStoreContent();
            }
        };

        // Callback when interstitial ad fails
        window.onInterstitialFailed = function () {
            console.log('❌ Interstitial ad failed');
        };

        // Callback from Android for reward
        window.onRewardEarned = function (rewardType, amount) {
            console.log('💰 Reward earned:', rewardType, amount);
            App.handleReward(rewardType, amount);
        };

        // Callback from Android for ad events
        window.onAdEvent = function (eventType, data) {
            console.log('📢 Ad event:', eventType, data);
        };
    }

    static handlePurchaseSuccess(productId, orderId) {
        console.log('Processing purchase success for:', productId);
        try { SoundManager.coin(); } catch (e) { }

        if (typeof FirebaseService !== 'undefined') {
            FirebaseService.logPurchase(productId, 0); // Price can be updated later if needed
        }

        switch (productId) {
            case 'buy_me_coffee':
                this.state.coins = (this.state.coins || 0) + 500;
                this.saveState();
                this.updateAllCoinDisplays();
                this.showToast('☕ Thank you for buying me a coffee! +500 Coins added!');
                break;
            case 'coins_pack_3000':
                this.state.coins = (this.state.coins || 0) + 3000;
                this.saveState();
                this.updateAllCoinDisplays();
                this.showToast('🎉 +3,000 Coins added!');
                break;
            case 'coins_pack_5000':
                this.state.coins = (this.state.coins || 0) + 5000;
                this.saveState();
                this.updateAllCoinDisplays();
                this.showToast('🎉 +5,000 Coins added!');
                break;
            case 'coins_pack_15000':
                this.state.coins = (this.state.coins || 0) + 15000;
                this.saveState();
                this.updateAllCoinDisplays();
                this.showToast('🎉 +15,000 Coins added! Best Value!');
                break;
            case 'remove_ads':
                this.state.adsRemoved = true;
                this.state.coins = (this.state.coins || 0) + 200;
                this.saveState();
                this.updateAllCoinDisplays();
                if (typeof AdService !== 'undefined') AdService.removeAds();
                this.showToast('🚫 Ads removed permanently! +200 bonus coins');
                break;
            default:
                this.showToast('✅ Purchase complete: ' + productId);
        }

        if (typeof Achievements !== 'undefined') {
            Achievements.check();
        }
        if (typeof Store !== 'undefined' && Store.renderStoreContent) {
            Store.renderStoreContent();
        }
    }

    static handlePurchasesRestored(restoredProducts) {
        if (!restoredProducts || restoredProducts.length === 0) {
            this.showToast('ℹ️ No active purchases found to restore');
            return;
        }

        let restoredCount = 0;
        let restoredNames = [];

        if (restoredProducts.includes('remove_ads')) {
            this.state.adsRemoved = true;
            if (typeof AdService !== 'undefined') AdService.removeAds();
            restoredNames.push('Remove Ads');
            restoredCount++;
        }

        this.saveState();
        if (typeof Store !== 'undefined' && Store.renderStoreContent) {
            Store.renderStoreContent();
        }

        if (restoredCount > 0) {
            this.showToast('✅ Restored: ' + restoredNames.join(', '));
        } else {
            this.showToast('ℹ️ Restored ' + restoredProducts.length + ' purchase(s)');
        }
    }

    static setupAndroidAdService() {
        if (typeof AdService === 'undefined') {
            console.warn('AdService not available, using fallback');
            return;
        }

        console.log('📱 Setting up Android AdService override');

        // Override AdService for Android
        const originalInit = AdService.init;
        AdService.init = function () {
            console.log('📱 AdService initialized in Android mode');
            if (!this.isAdEnabled()) {
                this.adsEnabled = false;
                this.hideBannerAd();
                return;
            }

            // Initialize Android ads via bridge
            if (Android && Android.initAds) {
                try {
                    Android.initAds(
                        this.config.admob.banner,
                        this.config.admob.interstitial,
                        this.config.admob.rewarded
                    );
                } catch (e) {
                    console.warn('Android initAds failed:', e);
                }
            }

            this.loadBannerAd();
            this.loadInterstitialAd();
            this.loadRewardedAd();
        };

        // Override banner ad for Android
        const originalLoadBanner = AdService.loadBannerAd;
        AdService.loadBannerAd = function () {
            if (!this.isAdEnabled()) return;
            const container = document.getElementById('banner-ad');
            if (!container) return;

            if (Android && Android.showBannerAd) {
                try {
                    Android.showBannerAd(this.config.admob.banner);
                    container.style.display = 'flex';
                    container.innerHTML = `
                        <div style="width:100%;height:50px;display:flex;align-items:center;justify-content:center;background:var(--surface);color:#8899bb;font-size:11px;">
                            📱 AdMob Banner
                        </div>
                    `;
                } catch (e) {
                    console.warn('Android showBannerAd failed:', e);
                    originalLoadBanner.call(this);
                }
            } else {
                originalLoadBanner.call(this);
            }
        };

        // Override interstitial for Android
        const originalShowInterstitial = AdService.showInterstitialAd;
        AdService.showInterstitialAd = function (force) {
            if (!this.isAdEnabled()) return;
            if (Android && Android.showInterstitialAd) {
                try {
                    Android.showInterstitialAd(this.config.admob.interstitial);
                    return;
                } catch (e) {
                    console.warn('Android showInterstitialAd failed:', e);
                }
            }
            originalShowInterstitial.call(this, force);
        };

        // Override rewarded ad for Android
        const originalShowRewarded = AdService.showRewardedAd;
        AdService.showRewardedAd = function (callback) {
            if (!this.isAdEnabled()) {
                if (callback) callback(true);
                return;
            }

            // Store callback for Android
            window._rewardCallback = callback;

            if (Android && Android.showRewardedAd) {
                try {
                    Android.showRewardedAd(this.config.admob.rewarded);
                } catch (e) {
                    console.warn('Android showRewardedAd failed:', e);
                    // Fallback
                    setTimeout(() => {
                        if (callback) callback(true);
                    }, 2000);
                }
            } else {
                // Fallback
                setTimeout(() => {
                    if (callback) callback(true);
                }, 2000);
            }
        };

        // Override reward user
        AdService.rewardUser = function (type, callback) {
            if (Android && Android.showRewardedAd) {
                this.showRewardedAd((success) => {
                    if (success) {
                        App.handleReward(type);
                        if (callback) callback(true);
                    } else {
                        App.showToast('❌ Ad failed, try again');
                        if (callback) callback(false);
                    }
                });
            } else {
                // Fallback
                setTimeout(() => {
                    App.handleReward(type);
                    if (callback) callback(true);
                }, 1500);
            }
        };

        console.log('✅ Android AdService overrides applied');
    }

    // ============================================================
    // REWARD HANDLING (Shared between Web and Android)
    // ============================================================
    static handleReward(type, amount = null) {
        if (typeof FirebaseService !== 'undefined') {
            FirebaseService.logAdWatched(type);
        }
        switch (type) {
            case 'coins':
                const reward = amount || (50 + Math.floor(Math.random() * 100));
                this.state.coins = (this.state.coins || 0) + reward;
                this.state.totalAdsWatched = (this.state.totalAdsWatched || 0) + 1;
                this.saveState();
                this.updateAllCoinDisplays();
                this.showToast(`💰 +${reward} coins from ad!`);
                break;

            case 'extra_move':
                if (this.currentGame) {
                    this.currentGame.spawnTile();
                    this.currentGame.spawnTile();
                    GameUI.renderBoard(this.currentGame);
                    this.showToast('🎁 Extra tiles spawned!');
                }
                break;

            case 'double_reward':
                this.state.doubleRewardPending = true;
                this.saveState();
                this.showToast('✨ Next reward will be doubled!');
                break;

            case 'undo_free':
                if (this.currentGame) {
                    this.currentGame.saveUndoState();
                    // Free undo without coin cost
                    if (this.currentGame.undo()) {
                        this.state.powerUpsUsed++;
                        this.saveState();
                        GameUI.renderBoard(this.currentGame);
                        GameUI.updateGameUI(this.currentGame);
                        this.showToast('↩️ Free undo from ad!');
                    }
                }
                break;

            default:
                this.showToast('🎁 Thanks for watching!');
        }

        if (typeof Achievements !== 'undefined') {
            Achievements.check();
        }
    }

    // ============================================================
    // ANDROID BRIDGE UTILITY METHODS
    // ============================================================
    static isAndroidEnvironment() {
        return this.isAndroid || this.state.adEnvironment === 'android';
    }

    static isAdBridgeReady() {
        return this.adBridgeReady;
    }

    static callAndroid(method, ...args) {
        if (this.isAndroid && typeof Android !== 'undefined') {
            try {
                return Android[method](...args);
            } catch (e) {
                console.warn(`Android call ${method} failed:`, e);
                return null;
            }
        }
        return null;
    }

    static getAndroidDeviceInfo() {
        if (this.isAndroid && Android && Android.getDeviceInfo) {
            try {
                return JSON.parse(Android.getDeviceInfo());
            } catch (e) {
                console.warn('Failed to get device info:', e);
                return null;
            }
        }
        return null;
    }

    static sendToAndroid(data) {
        if (this.isAndroid && Android && Android.sendMessage) {
            try {
                Android.sendMessage(JSON.stringify(data));
            } catch (e) {
                console.warn('Failed to send to Android:', e);
            }
        }
    }

    // ============================================================
    // AD METHODS (Unified)
    // ============================================================
    static watchAdForCoins() {
        if (this.isAndroid) {
            // Android - use native rewarded ad
            if (typeof AdService !== 'undefined') {
                AdService.rewardUser('coins');
            }
        } else {
            // Web - use AdSense/AdMob web
            if (typeof AdService !== 'undefined') {
                AdService.rewardUser('coins');
            }
        }
    }

    static watchAdExtraMove() {
        if (typeof CONFIG !== 'undefined' && !CONFIG.isAdsUiEnabled()) {
            this.showToast('ℹ️ Ads are disabled');
            return;
        }

        if (!this.currentGame) {
            this.showToast('❌ No active game');
            return;
        }

        if (this.currentGame.gameOver || this.currentGame.gameWon) {
            this.showToast('⚠️ Game is already over!');
            return;
        }

        if (this.isAndroid) {
            if (typeof AdService !== 'undefined') {
                AdService.rewardUser('extra_move');
            }
        } else {
            // Web fallback
            this.showToast('📺 Watching ad for extra help...');
            setTimeout(() => {
                this.currentGame.spawnTile();
                this.currentGame.spawnTile();
                GameUI.renderBoard(this.currentGame);
                GameUI.updateGameUI(this.currentGame);
                this.state.totalAdsWatched++;
                this.saveState();
                this.showToast('🎁 Extra tiles spawned!');
                try { SoundManager.coin(); } catch (e) { }
            }, 1000);
        }
    }

    static doubleReward(reward) {
        GameUI.closeModal();

        if (typeof AdService !== 'undefined') {
            // Show loading indicator
            if (typeof App !== 'undefined') {
                App.showToast('📺 Watching ad for double reward...');
            }

            // Use the existing showDoubleRewardAd method
            AdService.showDoubleRewardAd(reward, (success) => {
                if (success) {
                    // After successful ad, go to next level
                    setTimeout(() => {
                        GameUI.nextLevel();
                    }, 500);
                } else {
                    // Show the win modal again so user can retry
                    if (App.currentGame) {
                        const game = App.currentGame;
                        GameUI.showWinModal(game, game.getStars(), reward);
                    }
                    App.showToast('❌ Ad failed, try again');
                }
            });
        } else {
            // Fallback if AdService is not available
            const doubledAmount = reward * 2;
            App.state.coins += doubledAmount;
            App.saveState();
            App.updateAllCoinDisplays();
            App.showToast('💰 Reward doubled! +' + doubledAmount + ' coins');

            // Go to next level after fallback
            setTimeout(() => {
                GameUI.nextLevel();
            }, 500);
        }
    }

    // ============================================================
    // EXISTING METHODS (Keep your existing code below)
    // ============================================================

    static setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.showToast('🔄 Back online!');
            if (this.state.isLoggedIn && typeof FirebaseService !== 'undefined') {
                FirebaseService.saveUserData(this.state);
            }
            this.updateOfflineIndicator();
        });

        window.addEventListener('offline', () => {
            this.showToast('📱 Playing offline');
            this.updateOfflineIndicator();
        });
    }

    static async detectCountry() {
        // 1. Check device timezone and offset (South Africa is UTC+2 / offset -120)
        try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
            const offset = new Date().getTimezoneOffset();
            if (tz.includes('Africa/') || tz.includes('Johannesburg') || offset === -120 || offset === -180) {
                this.state.country = 'South Africa';
                this.state.countryCode = 'ZA';
                this.saveState();
                console.log('📍 Country set via Timezone/Offset:', this.state.country, this.state.countryCode);
                return;
            } else if (tz.includes('America/')) {
                this.state.country = 'United States';
                this.state.countryCode = 'US';
                this.saveState();
                return;
            } else if (tz.includes('Europe/London')) {
                this.state.country = 'United Kingdom';
                this.state.countryCode = 'GB';
                this.saveState();
                return;
            } else if (tz.includes('Europe/Berlin')) {
                this.state.country = 'Germany';
                this.state.countryCode = 'DE';
                this.saveState();
                return;
            }
        } catch (e3) {}

        // 2. Check device locale
        try {
            const locale = navigator.language || navigator.userLanguage || '';
            if (locale.toLowerCase().includes('za') || locale.toLowerCase().includes('af')) {
                this.state.country = 'South Africa';
                this.state.countryCode = 'ZA';
                this.saveState();
                return;
            }
        } catch (e4) {}

        // 3. Default fallback to South Africa (ZA) instead of relying on inaccurate external IP Geo APIs
        this.state.country = 'South Africa';
        this.state.countryCode = 'ZA';
        this.saveState();
        console.log('📍 Country defaulted to South Africa (ZA)');
    }

    static ALLOWED_COUNTRIES = []; // Empty allow list
    static BLOCKED_COUNTRIES = [];

    static isRegionBlocked() {
        return false;
    }

    static getCountryInfo() {
        const countryName = (this.state && this.state.country) ? this.state.country : 'South Africa';
        const countryCode = (this.state && this.state.countryCode) ? this.state.countryCode : (countryName === 'South Africa' ? 'ZA' : '');
        let flag = '🇿🇦';

        if (countryCode && countryCode.length === 2 && /^[A-Z]{2}$/.test(countryCode)) {
            flag = String.fromCodePoint(...countryCode.split('').map(c => 127397 + c.charCodeAt(0)));
        } else if (countryName.toLowerCase().includes('united states') || countryName.toLowerCase().includes('usa')) {
            flag = '🇺🇸';
        } else if (countryName.toLowerCase().includes('united kingdom') || countryName.toLowerCase().includes('uk')) {
            flag = '🇬🇧';
        } else if (countryName.toLowerCase().includes('germany')) {
            flag = '🇩🇪';
        }

        return {
            name: countryName,
            code: countryCode,
            flag: flag,
            themeName: `${countryName} Theme`
        };
    }

    static getOfflineInfo() {
        const maxLevels = CONFIG.OFFLINE.MAX_LEVELS || 5;
        const warningThreshold = CONFIG.OFFLINE.WARNING_THRESHOLD || 2;
        const played = this.state.offlineLevelsPlayed || 0;
        const remaining = Math.max(0, maxLevels - played);

        return {
            maxLevels: maxLevels,
            warningThreshold: warningThreshold,
            played: played,
            remaining: remaining,
            isExhausted: remaining <= 0,
            isLow: remaining <= warningThreshold,
            isEnabled: CONFIG.OFFLINE.ENABLED,
            isLoggedIn: this.state.isLoggedIn
        };
    }

    static updateOfflineIndicator() {
        const offlineBox = document.getElementById('offline-box');
        const offlineBar = document.getElementById('offline-indicator-bar');
        const offlineCount = document.getElementById('offline-level-count');
        const offlineMax = document.getElementById('offline-max-count');

        if (offlineBox) {
            if (!this.state.isLoggedIn && CONFIG.OFFLINE.ENABLED) {
                const maxLevels = CONFIG.OFFLINE.MAX_LEVELS || 5;
                const warningThreshold = CONFIG.OFFLINE.WARNING_THRESHOLD || 2;
                const played = this.state.offlineLevelsPlayed || 0;
                const remaining = Math.max(0, maxLevels - played);

                const leftLabel = offlineBox.querySelector('.offline-left');
                if (leftLabel) {
                    const offlineText = (typeof I18N !== 'undefined') ? I18N.t('offline_mode', 'Offline Mode') : 'Offline Mode';
                    leftLabel.innerHTML = `📱 <span>${offlineText}</span>`;
                }

                const rightLabel = offlineBox.querySelector('.offline-right');
                if (rightLabel) {
                    const movesLeftText = (typeof I18N !== 'undefined') ? I18N.t('moves_left', 'moves left') : 'moves left';
                    rightLabel.textContent = `${remaining}/${maxLevels} ${movesLeftText}`;

                    if (remaining <= warningThreshold) {
                        rightLabel.style.color = '#e94560';
                    } else if (remaining <= warningThreshold * 2) {
                        rightLabel.style.color = '#f7c948';
                    } else {
                        rightLabel.style.color = '#94a3b8';
                    }
                }

                if (offlineCount) {
                    offlineCount.textContent = remaining;
                }
                if (offlineMax) {
                    offlineMax.textContent = maxLevels;
                }

                offlineBox.classList.remove('hidden');
                offlineBox.style.display = 'flex';
            } else {
                offlineBox.classList.add('hidden');
                offlineBox.style.display = 'none';
            }
        }

        if (offlineBar) {
            if (!this.state.isLoggedIn && CONFIG.OFFLINE.ENABLED) {
                offlineBar.classList.remove('hidden');
                offlineBar.style.display = 'flex';
            } else {
                offlineBar.classList.add('hidden');
                offlineBar.style.display = 'none';
            }
        }
    }

    static handlePlayerClick() {
        if (this.state.isLoggedIn) {
            Navigation.navigateTo('settings');
        } else {
            this.showLoginPrompt();
        }
    }

    static closeLogin() {
        Navigation.navigateTo('home');
        this.showToast('👋 Login cancelled');
    }

    static loadState() {
        try {
            const saved = localStorage.getItem('blockRush2KSave') || localStorage.getItem('blockFusionSave');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.state = { ...this.state, ...parsed };
                console.log('📂 Loaded saved state');
            }
            // Ensure correct country and sanitize cached bad GeoIP values (like ES, NZ, etc.)
            if (!this.state.countryCode || this.state.countryCode === 'UNKNOWN' || this.state.countryCode === 'ES' || this.state.countryCode === 'NZ') {
                this.state.country = 'South Africa';
                this.state.countryCode = 'ZA';
            } else {
                try {
                    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
                    if (tz.includes('Africa/') || tz.includes('Johannesburg')) {
                        this.state.country = 'South Africa';
                        this.state.countryCode = 'ZA';
                    }
                } catch (e) {}
            }

            if (!this.state.unlockedThemes || !Array.isArray(this.state.unlockedThemes)) {
                this.state.unlockedThemes = ['numbers'];
            }
            if (!this.state.unlockedThemes.includes('numbers')) {
                this.state.unlockedThemes.push('numbers');
            }
        } catch (e) {
            console.warn('Could not load save:', e);
        }
    }

    static applyTheme(themeId) {
        if (!themeId) themeId = this.state.activeTheme || 'numbers';
        this.state.activeTheme = themeId;

        const allThemeClasses = [
            'theme-numbers',
            'theme-fruit',
            'theme-animals',
            'theme-space',
            'theme-southafrica',
            'theme-theme_neon',
            'theme-neon',
            'theme-theme_wood',
            'theme-wood'
        ];

        const classesToAdd = [`theme-${themeId}`];
        if (themeId === 'theme_neon' || themeId === 'neon') {
            classesToAdd.push('theme-theme_neon', 'theme-neon');
        }
        if (themeId === 'theme_wood' || themeId === 'wood') {
            classesToAdd.push('theme-theme_wood', 'theme-wood');
        }

        const targets = [
            document.getElementById('app'),
            document.body,
            document.getElementById('board-wrapper'),
            document.getElementById('tutorial-board-wrapper')
        ];

        targets.forEach(target => {
            if (!target) return;
            allThemeClasses.forEach(cls => target.classList.remove(cls));
            classesToAdd.forEach(cls => target.classList.add(cls));
        });

        if (typeof Android !== 'undefined' && typeof Android.setActiveTheme === 'function') {
            try { Android.setActiveTheme(themeId); } catch (e) { }
        }

        if (this.currentGame && typeof GameUI !== 'undefined' && GameUI.renderBoard) {
            try { GameUI.renderBoard(this.currentGame); } catch (e) { }
        }
    }

    static applyWorldTheme(worldId) {
        if (worldId === null || worldId === undefined) return;

        const worldNames = ['forest', 'desert', 'snow', 'volcano', 'galaxy', 'sky', 'ocean', 'mythic'];
        const worldName = worldNames[worldId] || 'forest';

        const allWorldClasses = worldNames.map(w => `world-${w}`);
        const targets = [document.getElementById('app'), document.body, document.getElementById('screen-game')];

        targets.forEach(t => {
            if (!t) return;
            allWorldClasses.forEach(cls => t.classList.remove(cls));
            t.classList.add(`world-${worldName}`);
        });
    }

    static removeWorldTheme() {
        const worldNames = ['forest', 'desert', 'snow', 'volcano', 'galaxy', 'sky', 'ocean', 'mythic'];
        const allWorldClasses = worldNames.map(w => `world-${w}`);
        const targets = [document.getElementById('app'), document.body, document.getElementById('screen-game')];

        targets.forEach(t => {
            if (!t) return;
            allWorldClasses.forEach(cls => t.classList.remove(cls));
        });
    }

    static saveState() {
        try {
            const saveData = { ...this.state };
            delete saveData.swapSelectionMode;
            delete saveData.selectedTile;
            delete saveData.selectedTilePos;

            localStorage.setItem('blockRush2KSave', JSON.stringify(saveData));
        } catch (e) {
            console.warn('Could not save state:', e);
        }
    }

    static updateAllCoinDisplays() {
        const coinDisplays = document.querySelectorAll('[id$="-coins"]');
        coinDisplays.forEach(el => {
            if (el) el.textContent = this.state.coins.toLocaleString();
        });
    }

    static updatePlayerDisplay() {
        const photoURL = this.state.photoURL || null;
        const guestText = (typeof I18N !== 'undefined') ? I18N.t('guest_player', 'Guest Player') : 'Guest Player';
        const displayName = this.state.isLoggedIn ?
            (this.state.playerName || 'Player') :
            guestText;

        const allAvatars = document.querySelectorAll('.player-avatar-placeholder, .player-avatar, .profile-avatar, [class*="avatar"]');

        allAvatars.forEach(el => {
            if (!el) return;

            const isImageContainer = el.tagName === 'IMG' || el.querySelector('img');

            if (photoURL) {
                if (el.tagName === 'IMG') {
                    el.src = photoURL;
                    el.style.display = 'block';
                } else {
                    el.innerHTML = `<img src="${photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;">`;
                    el.style.padding = '0';
                    el.style.background = 'transparent';
                    el.style.border = 'none';
                    el.style.fontSize = '0';
                }
                el.style.overflow = 'hidden';
            } else {
                if (el.tagName === 'IMG') {
                    el.style.display = 'none';
                } else {
                    if (!el.querySelector('img')) {
                        el.innerHTML = '👤';
                        el.style.padding = '';
                        el.style.background = '';
                        el.style.border = '';
                        el.style.fontSize = '';
                        el.style.overflow = '';
                    }
                }
            }
        });

        const loginBtn = document.getElementById('btn-login-prompt');
        if (loginBtn) {
            if (this.state.isLoggedIn) {
                if (photoURL) {
                    loginBtn.innerHTML = `<img src="${photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;">`;
                    loginBtn.style.padding = '0';
                    loginBtn.style.background = '';
                    loginBtn.style.border = '2px solid #4a8';
                    loginBtn.style.borderRadius = '50%';
                    loginBtn.style.overflow = 'hidden';
                    loginBtn.style.fontSize = '0';
                } else {
                    loginBtn.innerHTML = '<span style="font-size:18px;">👤</span>';
                    loginBtn.style.padding = '';
                    loginBtn.style.background = '';
                    loginBtn.style.border = '';
                    loginBtn.style.borderRadius = '';
                    loginBtn.style.overflow = '';
                    loginBtn.style.fontSize = '';
                }
                loginBtn.title = displayName;
            } else {
                loginBtn.innerHTML = '<span style="font-size:18px;">☁️</span>';
                loginBtn.style.padding = '';
                loginBtn.style.background = '';
                loginBtn.style.border = '';
                loginBtn.style.borderRadius = '';
                loginBtn.style.overflow = '';
                loginBtn.style.fontSize = '';
                loginBtn.title = 'Sign in';
            }
        }

        const playerInfo = document.getElementById('player-info-display');
        if (playerInfo) {
            const avatar = playerInfo.querySelector('.player-avatar-placeholder');
            if (avatar) {
                if (photoURL) {
                    avatar.innerHTML = `<img src="${photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;">`;
                    avatar.style.padding = '0';
                    avatar.style.background = 'transparent';
                    avatar.style.border = 'none';
                    avatar.style.fontSize = '0';
                } else {
                    avatar.innerHTML = '👤';
                    avatar.style.padding = '';
                    avatar.style.background = '';
                    avatar.style.border = '';
                    avatar.style.fontSize = '';
                }
                avatar.style.overflow = 'hidden';
            }
            const nameEl = playerInfo.querySelector('.player-name');
            if (nameEl) {
                nameEl.textContent = displayName;
                nameEl.style.whiteSpace = 'normal';
                nameEl.style.maxWidth = 'none';
                nameEl.style.overflow = 'visible';
                nameEl.style.textOverflow = 'clip';
                nameEl.style.fontSize = '13px';
                nameEl.style.fontWeight = '600';
            }
        }

        const nameElements = document.querySelectorAll('.player-name, #player-name-display, .player-name-display');
        nameElements.forEach(el => {
            if (el) {
                el.textContent = displayName;
                el.style.whiteSpace = 'normal';
                el.style.maxWidth = 'none';
                el.style.overflow = 'visible';
                el.style.textOverflow = 'clip';
            }
        });

        this.updateOfflineIndicator();
    }

    static updateLoginButtonVisibility() {
        const btn = document.getElementById('btn-login-prompt');
        if (btn) {
            const photoURL = this.state.photoURL || null;
            const displayName = this.state.playerName || 'Player';

            if (this.state.isLoggedIn) {
                if (photoURL) {
                    btn.innerHTML = `<img src="${photoURL}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;">`;
                    btn.style.padding = '0';
                    btn.style.background = '';
                    btn.style.border = '2px solid #4a8';
                    btn.style.borderRadius = '50%';
                    btn.style.overflow = 'hidden';
                    btn.style.fontSize = '0';
                } else {
                    btn.innerHTML = '<span style="font-size:18px;">👤</span>';
                    btn.style.padding = '';
                    btn.style.background = '';
                    btn.style.border = '';
                    btn.style.borderRadius = '';
                    btn.style.overflow = '';
                    btn.style.fontSize = '';
                }
                btn.title = displayName;
                btn.onclick = () => this.handlePlayerClick();
            } else {
                btn.innerHTML = '<span style="font-size:18px;">☁️</span>';
                btn.style.padding = '';
                btn.style.background = '';
                btn.style.border = '';
                btn.style.borderRadius = '';
                btn.style.overflow = '';
                btn.style.fontSize = '';
                btn.title = 'Sign in';
                btn.onclick = () => this.handlePlayerClick();
            }
        }
        this.updateOfflineIndicator();
    }

    static showLoginPrompt() {
        if (typeof PopupManager === 'undefined') {
            Navigation.navigateTo('login-prompt');
            return;
        }

        const maxLevels = CONFIG.OFFLINE.MAX_LEVELS || 5;
        const warningThreshold = CONFIG.OFFLINE.WARNING_THRESHOLD || 2;
        const played = this.state.offlineLevelsPlayed || 0;
        const remaining = Math.max(0, maxLevels - played);
        const isLow = remaining <= warningThreshold;

       PopupManager.show({
               icon: '🔐',
               title: 'Welcome to Block Rush 2K',
               subtitle: 'Sign in or create an account to save your progress',
               showConfirm: false,
               showCancel: false,
               showClose: true,
               showBack: true,
               onBack: () => {
                   this.closeLogin();
               },
               customContent: `
                   <div style="padding: 8px 0;">
                       ${(CONFIG.OFFLINE && CONFIG.OFFLINE.ENABLED) ? `
                       <div style="background:${isLow ? 'rgba(233,69,96,0.15)' : 'rgba(255,255,255,0.05)'};border-radius:8px;padding:12px;margin-bottom:16px;text-align:center;border:1px solid ${isLow ? '#e94560' : 'transparent'};">
                           <div style="font-size:14px;color:var(--text-muted);">
                               📱 Offline Mode: <strong style="color:${isLow ? '#e94560' : '#f7c948'};">${remaining}</strong> of ${maxLevels} moves remaining
                           </div>
                           ${isLow ? '<div style="font-size:12px;color:#e94560;margin-top:4px;">⚠️ Low on offline moves! Sign in for unlimited play.</div>' : ''}
                           ${remaining <= 0 ? '<div style="font-size:12px;color:#e94560;margin-top:4px;">🚫 No offline moves left! Please sign in to continue.</div>' : ''}
                       </div>` : ''}

                       <div style="display:flex;flex-direction:column;gap:12px;">
                           <button class="btn btn-primary" onclick="App.handleGoogleSignIn()" style="background:#4285F4;width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:14px;">
                               <span style="font-size:20px;">G</span> Sign in with Google
                           </button>
                           <button class="btn btn-secondary" onclick="App.handleAnonymousSignIn()" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:14px;">
                               <span>👤</span> Continue Anonymously
                           </button>
                       </div>

                       <div style="display:flex;align-items:center;gap:12px;margin:16px 0;">
                           <hr style="flex:1;border:none;border-top:1px solid rgba(255,255,255,0.1);">
                           <span style="color:#8899bb;font-size:12px;">or</span>
                           <hr style="flex:1;border:none;border-top:1px solid rgba(255,255,255,0.1);">
                       </div>

                       <!-- Auth Mode Tabs -->
                       <div style="display:flex;border-bottom:1px solid rgba(255,255,255,0.1);margin-bottom:14px;">
                           <button id="tab-btn-signin" class="auth-tab-btn" data-tab="signin" onclick="App.switchAuthTab('signin')" style="flex:1;padding:8px;background:none;border:none;border-bottom:2px solid var(--accent, #e94560);color:var(--text-primary);font-weight:700;cursor:pointer;">
                               Sign In
                           </button>
                           <button id="tab-btn-signup" class="auth-tab-btn" data-tab="signup" onclick="App.switchAuthTab('signup')" style="flex:1;padding:8px;background:none;border:none;border-bottom:2px solid transparent;color:var(--text-muted, #8899bb);font-weight:600;cursor:pointer;">
                               Register
                           </button>
                       </div>

                       <!-- Sign In Form -->
                       <div id="auth-signin-content" style="display:flex;flex-direction:column;gap:8px;">
                           <input type="email" id="login-email" placeholder="Email address" style="width:100%;padding:12px;border-radius:10px;border:2px solid var(--bg-card);background:var(--bg-surface);color:var(--text-primary);font-size:16px;box-sizing:border-box;">
                           <input type="password" id="login-password" placeholder="Password" style="width:100%;padding:12px;border-radius:10px;border:2px solid var(--bg-card);background:var(--bg-surface);color:var(--text-primary);font-size:16px;box-sizing:border-box;">
                           <button class="btn btn-primary" style="width:100%;padding:14px;" onclick="App.handleEmailSignIn()">Sign In</button>
                           <button class="btn btn-sm btn-outline" onclick="App.handleForgotPassword()" style="font-size:12px;color:var(--text-muted);border-color:transparent;padding:4px 8px;">
                               Forgot password?
                           </button>
                       </div>

                       <!-- Sign Up Form (Matches handleEmailSignUp fields) -->
                       <div id="auth-signup-content" style="display:none;flex-direction:column;gap:8px;">
                           <div style="display:flex;gap:8px;">
                               <input type="text" id="signup-firstname" placeholder="First Name" style="width:50%;padding:10px;border-radius:8px;border:2px solid var(--bg-card);background:var(--bg-surface);color:var(--text-primary);box-sizing:border-box;">
                               <input type="text" id="signup-lastname" placeholder="Last Name" style="width:50%;padding:10px;border-radius:8px;border:2px solid var(--bg-card);background:var(--bg-surface);color:var(--text-primary);box-sizing:border-box;">
                           </div>
                           <input type="text" id="signup-displayname" placeholder="Display Name (optional)" style="width:100%;padding:10px;border-radius:8px;border:2px solid var(--bg-card);background:var(--bg-surface);color:var(--text-primary);box-sizing:border-box;">
                           <input type="email" id="signup-email" placeholder="Email address" style="width:100%;padding:10px;border-radius:8px;border:2px solid var(--bg-card);background:var(--bg-surface);color:var(--text-primary);box-sizing:border-box;">
                           <input type="password" id="signup-password" placeholder="Password (min. 6 characters)" style="width:100%;padding:10px;border-radius:8px;border:2px solid var(--bg-card);background:var(--bg-surface);color:var(--text-primary);box-sizing:border-box;">
                           <input type="password" id="signup-confirm-password" placeholder="Confirm Password" style="width:100%;padding:10px;border-radius:8px;border:2px solid var(--bg-card);background:var(--bg-surface);color:var(--text-primary);box-sizing:border-box;">
                           <button class="btn btn-primary" style="width:100%;padding:14px;margin-top:4px;" onclick="App.handleEmailSignUp()">Create Account</button>
                       </div>

                       <div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.05);display:flex;flex-direction:column;gap:8px;">
                           <button class="btn btn-sm btn-outline" onclick="App.skipLogin()" style="width:100%;font-size:12px;color:var(--text-muted);">
                               ${(CONFIG.OFFLINE && CONFIG.OFFLINE.ENABLED) ? `Continue as Guest (${remaining} moves left)` : 'Continue as Guest'}
                           </button>
                           <button class="btn btn-secondary" onclick="App.closeLogin()" style="width:100%;padding:10px;font-size:14px;">
                               ← Back to Game
                           </button>
                       </div>
                   </div>
               `
           });
    }

     static closeLogin() {
        if (typeof PopupManager !== 'undefined') {
            PopupManager.close('cancel');
        }
        if (typeof Navigation !== 'undefined') {
            Navigation.navigateTo('home');
        }
    }

    static skipLogin() {
        PopupManager.close('cancel');
        Navigation.navigateTo('home');
        this.showToast('📱 Playing offline. Progress saved locally.');
    }

    static isWorldUnlocked(worldId) {
        if (worldId === 0) return true;
        const prevWorld = worldId - 1;
        let totalStars = 0;
        for (let l = 1; l <= 25; l++) {
            const key = `${prevWorld}-${l}`;
            totalStars += (this.state.stars[key] || 0);
        }
        const requiredStars = CONFIG.WORLDS[worldId]?.unlockStars || 15;
        return totalStars >= requiredStars;
    }

    static getWorldStars(worldId) {
        let total = 0;
        for (let l = 1; l <= 25; l++) {
            const key = `${worldId}-${l}`;
            total += (this.state.stars[key] || 0);
        }
        return total;
    }

    static checkPendingGame() {
        const pending = sessionStorage.getItem('pendingGame');
        if (pending) {
            try {
                const data = JSON.parse(pending);
                this.startLevel(data.levelNum, data.worldId);
                sessionStorage.removeItem('pendingGame');
            } catch (e) {
                console.warn('Could not restore pending game:', e);
            }
        }
    }

    static continueGame() {
        if (this.currentGame && !this.currentGame.gameOver && !this.currentGame.gameWon) {
            Navigation.navigateTo('game');
            return;
        }

        let worldId = this.state.currentWorld;
        let levelNum = this.state.currentLevel;

        const key = `${worldId}-${levelNum}`;
        if (this.state.stars[key] && this.state.stars[key] > 0) {
            let found = false;
            for (let w = 0; w < CONFIG.WORLDS.length; w++) {
                for (let l = 1; l <= 25; l++) {
                    const k = `${w}-${l}`;
                    if (!this.state.stars[k] || this.state.stars[k] === 0) {
                        worldId = w;
                        levelNum = l;
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
            if (!found) {
                this.showToast('🎉 You completed all levels!');
                Navigation.navigateTo('world-select');
                return;
            }
        }

        this.state.currentWorld = worldId;
        this.state.currentLevel = levelNum;
        this.saveState();
        this.startLevel(levelNum, worldId);
    }

    static startLevel(levelNum, worldId = this.state.currentWorld) {
        console.log(`🎮 Starting Level ${levelNum} in World ${worldId}`);

        if (typeof FirebaseService !== 'undefined') {
            FirebaseService.logLevelStart(worldId, levelNum);
        }

        if (!this.state.isLoggedIn && CONFIG.OFFLINE.ENABLED) {
            const maxLevels = CONFIG.OFFLINE.MAX_LEVELS || 5;
            if ((this.state.offlineLevelsPlayed || 0) >= maxLevels) {
                this.showToast('⚠️ You\'ve reached the offline limit! Sign in to continue playing.');
                this.showLoginPrompt();
                return;
            }
        }

        if (!this.state.isLoggedIn && CONFIG.OFFLINE.ENABLED) {
            this.state.offlineLevelsPlayed = (this.state.offlineLevelsPlayed || 0) + 1;
            this.updateOfflineIndicator();

            const maxLevels = CONFIG.OFFLINE.MAX_LEVELS || 5;
            const remaining = maxLevels - this.state.offlineLevelsPlayed;
            const warningThreshold = CONFIG.OFFLINE.WARNING_THRESHOLD || 2;

            if (remaining <= warningThreshold && remaining > 0) {
                this.showToast(`⚠️ ${remaining} offline moves left! Sign in for unlimited play.`);
            }
        }

        this.state.currentWorld = worldId;
        this.state.currentLevel = levelNum;
        this.state.totalGamesPlayed++;
        this.saveState();

        this.applyWorldTheme(worldId);

        this.currentGame = new GameEngine(worldId, levelNum);
        Navigation.navigateTo('game');
        GameUI.renderBoard(this.currentGame);
        GameUI.updateGameUI(this.currentGame);
        this.cleanupSwapMode();

        if (levelNum === 1 && worldId === 0) {
            setTimeout(() => this.showTutorial(), 500);
        }

        try { AdService.showBannerAd(); } catch (e) { }
        try { AdService.recordGamePlay(); } catch (e) { }
    }

    static retryLevel() {
        if (this.currentGame) {
            this.startLevel(this.state.currentLevel, this.state.currentWorld);
        }
    }

    static nextLevelAfterWin() {
        const nextLevel = this.state.currentLevel + 1;
        if (nextLevel <= 25) {
            this.startLevel(nextLevel, this.state.currentWorld);
        } else {
            const nextWorld = this.state.currentWorld + 1;
            if (nextWorld < CONFIG.WORLDS.length) {
                this.startLevel(1, nextWorld);
            } else {
                this.showToast('🏆 You completed all levels! Congratulations!');
                Navigation.navigateTo('world-select');
            }
        }
    }

    static quitGame() {
        this.cleanupSwapMode();
        this.currentGame = null;
        Navigation.navigateTo('home');
        try {
            if (typeof AdService !== 'undefined' && AdService.showBannerAd) {
                AdService.showBannerAd();
            }
        } catch (e) { }
        this.updateAllCoinDisplays();

        const modalContainer = document.getElementById('modal-container');
        if (modalContainer) {
            modalContainer.innerHTML = '';
        }

        const popupOverlay = document.getElementById('popup-overlay');
        if (popupOverlay) {
            popupOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    static showGameInfo() {
        PopupManager.showLevelInfo();
    }

    static getLevelStars(worldId, levelNum) {
        const key = `${worldId}-${levelNum}`;
        return this.state.stars[key] || 0;
    }

    static useUndo() {
        if (!this.currentGame) {
            this.showToast('❌ No active game');
            return;
        }

        if (this.swapSelectionMode) {
            this.clearSwapSelection();
        }

        if (this.currentGame.gameOver || this.currentGame.gameWon) {
            this.showToast('⚠️ Game is already over!');
            return;
        }

        // Check if user has free undo from ad
        if (this.state.freeUndoAvailable) {
            this.state.freeUndoAvailable = false;
            this.saveState();
            if (this.currentGame.undo()) {
                this.state.powerUpsUsed++;
                this.saveState();
                this.updateAllCoinDisplays();
                GameUI.renderBoard(this.currentGame);
                GameUI.updateGameUI(this.currentGame);
                this.showToast('↩️ Free undo used!');
                try { SoundManager.click(); } catch (e) { }
            } else {
                this.showToast('❌ Nothing to undo!');
            }
            return;
        }

        if (this.state.coins < CONFIG.POWERUP_COSTS.undo) {
            this.showToast('❌ Not enough coins! Need ' + CONFIG.POWERUP_COSTS.undo + ' coins');
            return;
        }

        if (this.currentGame.undo()) {
            if (typeof FirebaseService !== 'undefined') FirebaseService.logPowerUpUsed('undo');
            this.state.coins -= CONFIG.POWERUP_COSTS.undo;
            this.state.powerUpsUsed++;
            this.currentGame.powerUpsUsed++;
            this.saveState();
            this.updateAllCoinDisplays();
            GameUI.renderBoard(this.currentGame);
            GameUI.updateGameUI(this.currentGame);
            this.showToast('↩️ Undo successful!');
            try { SoundManager.click(); } catch (e) { }
        } else {
            this.showToast('❌ Nothing to undo!');
        }
    }

    static useShuffle() {
        if (!this.currentGame) {
            this.showToast('❌ No active game');
            return;
        }

        if (this.currentGame.gameOver || this.currentGame.gameWon) {
            this.showToast('⚠️ Game is already over!');
            return;
        }

        if (this.state.coins < CONFIG.POWERUP_COSTS.shuffle) {
            this.showToast('❌ Not enough coins! Need ' + CONFIG.POWERUP_COSTS.shuffle + ' coins');
            return;
        }

        this.state.coins -= CONFIG.POWERUP_COSTS.shuffle;
        this.state.powerUpsUsed++;
        this.currentGame.powerUpsUsed++;
        this.saveState();
        this.updateAllCoinDisplays();

        this.currentGame.saveUndoState();
        this.currentGame.shuffle();
        if (typeof FirebaseService !== 'undefined') FirebaseService.logPowerUpUsed('shuffle');
        GameUI.renderBoard(this.currentGame);
        GameUI.updateGameUI(this.currentGame);
        this.showToast('🔀 Board shuffled!');
        try { SoundManager.click(); } catch (e) { }
    }

    static useRemoveTile() {
        if (!this.currentGame) {
            this.showToast('❌ No active game');
            return;
        }

        if (this.currentGame.gameOver || this.currentGame.gameWon) {
            this.showToast('⚠️ Game is already over!');
            return;
        }

        if (this.state.coins < CONFIG.POWERUP_COSTS.removeTile) {
            this.showToast('❌ Not enough coins! Need ' + CONFIG.POWERUP_COSTS.removeTile + ' coins');
            return;
        }

        if (this.currentGame.removeLowestTile()) {
            if (typeof FirebaseService !== 'undefined') FirebaseService.logPowerUpUsed('remove_tile');
            this.state.coins -= CONFIG.POWERUP_COSTS.removeTile;
            this.state.powerUpsUsed++;
            this.currentGame.powerUpsUsed++;
            this.saveState();
            this.updateAllCoinDisplays();
            GameUI.renderBoard(this.currentGame);
            GameUI.updateGameUI(this.currentGame);
            this.showToast('🗑️ Lowest tile removed!');
            try { SoundManager.click(); } catch (e) { }

            this.currentGame.checkWinLose();
            if (this.currentGame.gameWon) {
                this.handleLevelWin();
            } else if (this.currentGame.gameOver) {
                this.handleLevelLoss();
            }
        } else {
            this.showToast('❌ No tiles to remove!');
        }
    }

    static useSuperSwap() {
        if (!this.currentGame) {
            this.showToast('❌ No active game');
            return;
        }

        if (this.currentGame.gameOver || this.currentGame.gameWon) {
            this.showToast('⚠️ Game is already over!');
            return;
        }

        if (this.state.coins < CONFIG.POWERUP_COSTS.superSwap) {
            this.showToast('❌ Not enough coins! Need ' + CONFIG.POWERUP_COSTS.superSwap + ' coins');
            return;
        }

        this.state.coins -= CONFIG.POWERUP_COSTS.superSwap;
        this.updateAllCoinDisplays();
        this.saveState();

        if (typeof FirebaseService !== 'undefined') FirebaseService.logPowerUpUsed('super_swap');

        try { SoundManager.click(); } catch (e) { }

        this.swapSelectionMode = true;
        this.selectedTile = null;
        this.selectedTilePos = null;

        this.highlightSwapTiles();
        this.showToast('✨ Tap two tiles to swap them');
    }

    static highlightSwapTiles() {
        if (!this.currentGame) return;
        const board = this.currentGame.getBoardData();
        const tiles = document.querySelectorAll('.tile');

        tiles.forEach(tile => {
            const r = parseInt(tile.getAttribute('data-r'));
            const c = parseInt(tile.getAttribute('data-c'));
            if (board[r][c] > 0) {
                tile.style.cursor = 'pointer';
                tile.style.boxShadow = '0 0 20px rgba(247, 201, 72, 0.5), inset 0 0 20px rgba(247, 201, 72, 0.1)';
                tile.style.border = '2px solid rgba(247, 201, 72, 0.5)';
                tile.style.transform += ' scale(1.02)';
                tile.style.transition = 'all 0.2s ease';

                const newTile = tile.cloneNode(true);
                tile.parentNode.replaceChild(newTile, tile);

                newTile.onclick = (e) => {
                    e.stopPropagation();
                    this.handleTileSwap(r, c);
                };
            }
        });
    }

    static handleTileSwap(r, c) {
        if (!this.currentGame) return;
        const board = this.currentGame.getBoardData();

        if (board[r][c] === 0) {
            this.showToast('⚠️ Cannot swap empty tile');
            return;
        }

        if (this.selectedTile === null) {
            this.selectedTile = board[r][c];
            this.selectedTilePos = [r, c];
            this.highlightSelectedTile(r, c);
            try { SoundManager.click(); } catch (e) { }
            this.showToast('🎯 Tap second tile to swap');
        } else {
            const [r1, c1] = this.selectedTilePos;

            if (r1 === r && c1 === c) {
                this.clearSwapSelection();
                this.showToast('🔁 Swap cancelled');
                return;
            }

            if (board[r][c] === 0) {
                this.showToast('⚠️ Cannot swap with empty tile');
                this.clearSwapSelection();
                return;
            }

            this.performSwap(r1, c1, r, c);
        }
    }

    static highlightSelectedTile(r, c) {
        const tiles = document.querySelectorAll('.tile');
        tiles.forEach(tile => {
            const tileR = parseInt(tile.getAttribute('data-r'));
            const tileC = parseInt(tile.getAttribute('data-c'));
            if (tileR === r && tileC === c) {
                tile.style.boxShadow = '0 0 30px rgba(233, 68, 96, 0.8), inset 0 0 30px rgba(233, 68, 96, 0.2)';
                tile.style.border = '3px solid var(--accent)';
                tile.style.transform += ' scale(1.05)';
            }
        });
    }

    static performSwap(r1, c1, r2, c2) {
        const game = this.currentGame;
        if (!game) return;

        game.saveUndoState();
        game.swapTiles(r1, c1, r2, c2);
        game.mergedThisMove.clear();

        GameUI.renderBoard(game);

        this.clearSwapSelection();
        this.showToast('🔄 Swapped tiles!');
        try { SoundManager.coin(); } catch (e) { }

        game.checkWinLose();

        if (game.gameWon) {
            this.handleLevelWin();
        } else if (game.gameOver) {
            this.handleLevelLoss();
        }

        this.updateAllCoinDisplays();
        this.saveState();
    }

    static clearSwapSelection() {
        this.swapSelectionMode = false;
        this.selectedTile = null;
        this.selectedTilePos = null;

        const tiles = document.querySelectorAll('.tile');
        tiles.forEach(tile => {
            tile.style.cursor = '';
            tile.style.boxShadow = '';
            tile.style.border = '';
            tile.style.transform = tile.style.transform
                .replace(' scale(1.02)', '')
                .replace(' scale(1.05)', '');
            tile.style.transition = '';
            tile.onclick = null;
        });
    }

    static cleanupSwapMode() {
        if (this.swapSelectionMode) {
            this.clearSwapSelection();
        }
    }

    static handleLevelWin() {
        const game = this.currentGame;
        if (!game) return;

        const stars = game.getStars();
        const reward = game.reward;

        if (typeof FirebaseService !== 'undefined') {
            FirebaseService.logLevelComplete(game.worldId, game.levelNum, stars, game.moves);
        }

        // Double reward if pending
        if (this.state.doubleRewardPending) {
            const doubledReward = reward * 2;
            this.state.coins += doubledReward;
            this.state.doubleRewardPending = false;
            this.showToast(`🌟 Double reward! +${doubledReward} coins`);
        } else {
            this.state.coins += reward;
        }

        this.state.totalWins++;
        this.state.levelsCompleted = (this.state.levelsCompleted || 0) + 1;

        const today = new Date().toDateString();
        if (this.state.lastPlayedDate === today) {
            // Already played today - no change
        } else if (this.state.lastPlayedDate === this.getYesterdayDate()) {
            this.state.currentStreak++;
        } else {
            this.state.currentStreak = 1;
        }
        this.state.lastPlayedDate = today;

        if (this.state.currentStreak > this.state.maxStreak) {
            this.state.maxStreak = this.state.currentStreak;
        }

        const key = `${game.worldId}-${game.levelNum}`;
        if (!this.state.stars[key] || stars > this.state.stars[key]) {
            this.state.stars[key] = stars;
        }

        let totalStars = 0;
        Object.values(this.state.stars).forEach(s => totalStars += (s || 0));
        this.state.totalStarsEarned = totalStars;

        this.saveState();

        // Submit score to Game Center
        if (typeof GameCenter !== 'undefined' && typeof GameCenter.submitScore === 'function') {
            GameCenter.submitScore(this.state.totalStarsEarned || 0);
        }

        // Save to Firebase leaderboard when level is won
        if (this.state.isLoggedIn && typeof FirebaseService !== 'undefined') {
            FirebaseService.saveUserData(this.state);
            FirebaseService.saveLeaderboardEntry({
                displayName: this.state.playerName || 'Player',
                totalStarsEarned: this.state.totalStarsEarned || 0,
                levelsCompleted: this.state.levelsCompleted || 0,
                photoURL: this.state.photoURL || null
            }).then(() => {
                console.log('✅ Leaderboard updated after level win');
            });
        }

        // Highlight winning tile right away
        GameUI.highlightWinTile(game);

        try { SoundManager.win(); } catch (e) { }

        // Start grand fireworks show & confetti before showing popup
        if (typeof window.FireworksManager !== 'undefined') {
            window.FireworksManager.start(4500);
        }
        this.fireConfetti();

        this.updateAllCoinDisplays();
        this.updatePlayerDisplay();

        if (typeof Achievements !== 'undefined') {
            Achievements.checkAll(game);
        }

        if (this.state.isLoggedIn && typeof FirebaseService !== 'undefined') {
            FirebaseService.saveUserData(this.state);
        }

        // Delay showing win modal popup by 2.2s so player can watch the grand fireworks!
        setTimeout(() => {
            GameUI.showWinModal(game, stars, reward);
        }, 2200);

        // Show review prompt on wins 3, 8, 13, etc. if not rated yet
        if (!this.state.hasRated && (this.state.totalWins === 3 || (this.state.totalWins > 3 && (this.state.totalWins - 3) % 5 === 0))) {
            setTimeout(() => {
                if (typeof PopupManager !== 'undefined' && PopupManager.showReviewPrompt) {
                    PopupManager.showReviewPrompt();
                }
            }, 3800);
        }
    }

    static handleLevelLoss() {
        const game = this.currentGame;
        if (!game) return;

        if (typeof FirebaseService !== 'undefined') {
            FirebaseService.logLevelFail(game.worldId, game.levelNum, game.moves);
        }

        // Update leaderboard even on loss
        if (this.state.isLoggedIn && typeof FirebaseService !== 'undefined') {
            FirebaseService.saveLeaderboardEntry({
                displayName: this.state.playerName || 'Player',
                totalStarsEarned: this.state.totalStarsEarned || 0,
                levelsCompleted: this.state.levelsCompleted || 0,
                photoURL: this.state.photoURL || null
            });
        }

        GameUI.showLossModal(game);
        try { SoundManager.lose(); } catch (e) { }
    }

    static getYesterdayDate() {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toDateString();
    }

    static fireConfetti() {
        const colors = ['#ff6b6b', '#f7c948', '#4ecdc4', '#45b7d1', '#96ceb4', '#ff6bff', '#ff9f43', '#a29bfe'];
        const container = document.getElementById('app');
        if (!container) return;

        for (let i = 0; i < 60; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.top = '-10px';
            confetti.style.width = Math.random() * 8 + 4 + 'px';
            confetti.style.height = Math.random() * 8 + 4 + 'px';
            confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
            confetti.style.animationDuration = Math.random() * 1.5 + 1 + 's';
            confetti.style.animationDelay = Math.random() * 0.5 + 's';
            confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
            confetti.style.position = 'fixed';
            confetti.style.pointerEvents = 'none';
            confetti.style.zIndex = '101';
            container.appendChild(confetti);

            setTimeout(() => confetti.remove(), 2500);
        }
    }

    static startDailyChallenge() {
        if (typeof DailyChallenge !== 'undefined') {
            DailyChallenge.start();
        } else {
            this.showToast('📅 Daily challenge coming soon!');
        }
    }

    // ============================================================
    // AUTHENTICATION UI METHODS
    // ============================================================
    static switchAuthTab(tab) {
        document.querySelectorAll('.auth-tab-btn').forEach(btn => {
            btn.style.color = 'var(--text-muted)';
            btn.style.fontWeight = '600';
            btn.style.borderBottomColor = 'transparent';
            if (btn.dataset.tab === tab) {
                btn.style.color = 'var(--text-primary)';
                btn.style.fontWeight = '700';
                btn.style.borderBottomColor = 'var(--accent-primary)';
            }
        });

        document.getElementById('auth-signin-content').style.display = tab === 'signin' ? 'block' : 'none';
        document.getElementById('auth-signup-content').style.display = tab === 'signup' ? 'block' : 'none';
    }

    static handleProfilePictureUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            this.showToast('❌ Please select an image file');
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            this.showToast('❌ Image must be under 2MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            const previewImg = document.getElementById('profile-preview-img');
            const previewIcon = document.getElementById('profile-preview-icon');

            previewImg.src = dataUrl;
            previewImg.style.display = 'block';
            previewIcon.style.display = 'none';

            this._profilePictureData = dataUrl;
            this.showToast('✅ Profile picture selected!');
        };
        reader.readAsDataURL(file);
    }

    // ===== AUTH HANDLERS =====
    static async handleGoogleSignIn() {
        if (typeof FirebaseService === 'undefined') {
            this.showToast('⚠️ Firebase not available');
            return;
        }
        try {
            const result = await FirebaseService.signInWithGoogle();
            if (result.success) {
                this.handleSuccessfulLogin(result.user, 'google');
            } else {
                this.showToast('❌ ' + result.error);
            }
        } catch (e) {
            this.showToast('❌ Google sign-in failed');
            console.error(e);
        }
    }

    static async handleEmailSignIn() {
        const email = document.getElementById('login-email')?.value?.trim();
        const password = document.getElementById('login-password')?.value;

        if (!email) {
            this.showToast('📧 Please enter your email');
            return;
        }
        if (!password || password.length < 6) {
            this.showToast('🔑 Password must be at least 6 characters');
            return;
        }

        if (typeof FirebaseService === 'undefined') {
            this.showToast('⚠️ Firebase not available');
            return;
        }

        try {
            const result = await FirebaseService.signInWithEmail(email, password);
            if (result.success) {
                this.handleSuccessfulLogin(result.user, 'email');
            } else {
                this.showToast('❌ ' + result.error);
            }
        } catch (e) {
            this.showToast('❌ Sign-in failed');
            console.error(e);
        }
    }

    static async handleEmailSignUp() {
        const firstName = document.getElementById('signup-firstname')?.value?.trim();
        const lastName = document.getElementById('signup-lastname')?.value?.trim();
        const displayName = document.getElementById('signup-displayname')?.value?.trim();
        const email = document.getElementById('signup-email')?.value?.trim();
        const password = document.getElementById('signup-password')?.value;
        const confirmPassword = document.getElementById('signup-confirm-password')?.value;

        if (!firstName) {
            this.showToast('📝 Please enter your first name');
            return;
        }
        if (!lastName) {
            this.showToast('📝 Please enter your last name');
            return;
        }
        if (!email) {
            this.showToast('📧 Please enter your email');
            return;
        }
        if (!password || password.length < 6) {
            this.showToast('🔑 Password must be at least 6 characters');
            return;
        }
        if (password !== confirmPassword) {
            this.showToast('❌ Passwords do not match');
            return;
        }

        const fullDisplayName = displayName || `${firstName} ${lastName}`;

        if (typeof FirebaseService === 'undefined') {
            this.showToast('⚠️ Firebase not available');
            return;
        }

        try {
            const result = await FirebaseService.signUpWithEmail(email, password, fullDisplayName);
            if (result.success) {
                if (this._profilePictureData) {
                    try {
                        await FirebaseService.uploadProfilePicture(this._profilePictureData);
                    } catch (e) {
                        console.warn('Profile picture upload failed:', e);
                    }
                }

                this.state.firstName = firstName;
                this.state.lastName = lastName;
                this.state.playerName = fullDisplayName;

                this.handleSuccessfulLogin(result.user, 'email');
            } else {
                this.showToast('❌ ' + result.error);
            }
        } catch (e) {
            this.showToast('❌ Account creation failed');
            console.error(e);
        }
    }

    static async handleForgotPassword() {
        const email = document.getElementById('login-email')?.value?.trim();

        if (!email) {
            this.showToast('📧 Please enter your email address first');
            return;
        }

        if (typeof FirebaseService === 'undefined') {
            this.showToast('⚠️ Firebase not available');
            return;
        }

        try {
            const result = await FirebaseService.sendPasswordReset(email);
            if (result.success) {
                this.showToast('📧 ' + result.message + ' Check your inbox!');
            } else {
                this.showToast('❌ ' + result.error);
            }
        } catch (e) {
            this.showToast('❌ Password reset failed');
            console.error(e);
        }
    }

    static async handleAnonymousSignIn() {
        if (typeof FirebaseService === 'undefined') {
            this.showToast('⚠️ Firebase not available');
            return;
        }
        try {
            const result = await FirebaseService.signInAnonymously();
            if (result.success) {
                this.handleSuccessfulLogin(result.user, 'anonymous');
            } else {
                this.showToast('❌ ' + result.error);
            }
        } catch (e) {
            this.showToast('❌ Anonymous sign-in failed');
            console.error(e);
        }
    }

    static handleSuccessfulLogin(user, method) {
        if (!user) return;

        this.state.isLoggedIn = true;
        this.state.userId = user.uid;
        this.state.loginProvider = method || user.providerData?.[0]?.providerId || 'unknown';

        // Reset offline level count on login if configured
        if (CONFIG.OFFLINE.RESET_ON_LOGIN) {
            this.state.offlineLevelsPlayed = 0;
            console.log('🔄 Offline level count reset on login');
        }

        if (user.displayName && user.displayName !== 'Player' && user.displayName !== 'Guest Player') {
            this.state.playerName = user.displayName;
        } else if (user.email) {
            this.state.playerName = user.email.split('@')[0];
        } else {
            const randomName = (typeof FirebaseService !== 'undefined' && FirebaseService.generateAnonymousPlayerName)
                ? FirebaseService.generateAnonymousPlayerName(user.uid)
                : `Player_${Math.floor(1000 + Math.random() * 9000)}`;
            this.state.playerName = randomName;
            if (user && user.updateProfile) {
                user.updateProfile({ displayName: randomName }).catch(() => {});
            }
        }
        if (user.email) this.state.email = user.email;
        if (user.photoURL) {
            this.state.photoURL = user.photoURL;
        } else if (this._profilePictureData) {
            this.state.photoURL = this._profilePictureData;
        }

        this._profilePictureData = null;

        this.saveState();
        this.updatePlayerDisplay();
        this.updateLoginButtonVisibility();
        this.updateOfflineIndicator();

        if (typeof FirebaseService !== 'undefined') {
            FirebaseService.loadUserData().then(cloudData => {
                if (cloudData) {
                    FirebaseService.mergeCloudData(cloudData);
                } else {
                    FirebaseService.saveUserData(this.state);
                }
            }).catch(() => { });

            // Automatically redeem pending URL referral code after login
            if (this.pendingReferralCode) {
                setTimeout(async () => {
                    const res = await FirebaseService.redeemReferralCode(this.pendingReferralCode);
                    if (res.success) {
                        this.showToast(res.message);
                    }
                    this.pendingReferralCode = null;
                }, 1000);
            }
        }

        PopupManager.close('confirm');
        Navigation.navigateTo('home');
        this.showToast('✅ Welcome, ' + this.state.playerName + '!');
    }

    static signOut() {
        if (typeof FirebaseService !== 'undefined') {
            FirebaseService.signOut();
        }
        this.state.isLoggedIn = false;
        this.state.playerName = 'Guest Player';
        this.state.email = null;
        this.state.photoURL = null;
        this.state.userId = null;
        this.saveState();
        this.updatePlayerDisplay();
        this.updateLoginButtonVisibility();
        this.updateOfflineIndicator();
        Navigation.navigateTo('home');
        this.showToast('👋 Signed out');
    }

    static showBannedNotice(reason) {
        if (typeof PopupManager !== 'undefined' && PopupManager.show) {
            PopupManager.show({
                icon: '🚫',
                title: 'Account Suspended',
                subtitle: 'Action Taken by Administrator',
                customContent: `
                    <div style="padding:10px 0;text-align:center;color:#cbd5e1;font-size:13px;line-height:1.6;">
                        Your account has been suspended from Block Rush 2K online services.<br><br>
                        <strong>Reason:</strong> <span style="color:#f87171;">${reason || 'Terms of Service violation'}</span><br><br>
                        If you believe this is a mistake, contact support at:<br>
                        <a href="mailto:tambanizwavhudimitambo@gmail.com" style="color:var(--gold,#f59e0b);">tambanizwavhudimitambo@gmail.com</a>
                    </div>
                `,
                confirmText: 'Acknowledge',
                showCancel: false,
                onConfirm: () => {
                    window.location.reload();
                }
            });
        } else {
            alert('Your account has been suspended by an administrator.');
        }
    }

    static syncCloudData() {
        if (typeof FirebaseService !== 'undefined' && this.state.isLoggedIn) {
            FirebaseService.saveUserData(this.state);
            this.showToast('☁️ Syncing to cloud...');
        } else if (typeof FirebaseService !== 'undefined') {
            this.showToast('☁️ Please sign in first to sync');
        } else {
            this.showToast('⚠️ Firebase not available');
        }
    }

    static resetAllProgress() {
        PopupManager.confirmReset();
    }

    static saveToLeaderboard() {
        if (!this.state.isLoggedIn) {
            this.showToast('⚠️ Please sign in first');
            return;
        }

        if (typeof FirebaseService === 'undefined') {
            this.showToast('⚠️ Firebase not available');
            return;
        }

        this.showToast('☁️ Saving to leaderboard...');

        FirebaseService.saveLeaderboardEntry({
            displayName: this.state.playerName || 'Player',
            totalStarsEarned: this.state.totalStarsEarned || 0,
            levelsCompleted: this.state.levelsCompleted || 0,
            photoURL: this.state.photoURL || null
        }).then(result => {
            if (result) {
                this.showToast('✅ Leaderboard updated!');
                if (typeof Leaderboard !== 'undefined') {
                    Leaderboard.render();
                }
            } else {
                this.showToast('❌ Failed to save');
            }
        });
    }

    static showToast(message) {
        const toast = document.getElementById('toast-msg');
        if (!toast) return;

        toast.textContent = message;
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';

        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(10px)';
        }, 2500);
    }

    static showTutorial() {
        if (typeof PopupManager !== 'undefined' && PopupManager.showTutorialPopup) {
            PopupManager.showTutorialPopup();
        } else {
            const modal = document.getElementById('modal-container');
            if (modal) {
                modal.innerHTML = `
                    <div class="modal-overlay">
                        <div class="modal" onclick="event.stopPropagation();">
                            <h2>📖 How to Play</h2>
                            <div style="text-align:left;padding:8px 0;">
                                <p style="margin:6px 0;">🎯 Merge tiles to reach the goal</p>
                                <p style="margin:6px 0;">👆 Swipe to move tiles</p>
                                <p style="margin:6px 0;">🔢 Two same numbers combine</p>
                                <p style="margin:6px 0;">⭐ Earn stars for performance</p>
                                <p style="margin:6px 0;">💰 Collect coins for power-ups</p>
                            </div>
                            <button class="btn btn-primary btn-block" onclick="document.getElementById('modal-container').innerHTML='';">Got it! 🚀</button>
                        </div>
                    </div>`;
            }
        }
    }

    static setupGameSwipe() {
        const board = document.querySelector('.board-wrapper');
        if (!board) return;

        let startX, startY, isSwiping = false;

        board.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            isSwiping = true;
        }, { passive: true });

        board.addEventListener('touchmove', (e) => {
            if (!isSwiping) return;
            e.preventDefault();
        }, { passive: false });

        board.addEventListener('touchend', (e) => {
            if (!isSwiping || !this.currentGame) {
                isSwiping = false;
                return;
            }

            if (document.getElementById('popup-overlay')?.classList.contains('active')) {
                isSwiping = false;
                return;
            }

            const touch = e.changedTouches[0];
            const dx = touch.clientX - startX;
            const dy = touch.clientY - startY;

            if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
                isSwiping = false;
                return;
            }

            let direction;
            if (Math.abs(dx) > Math.abs(dy)) {
                direction = dx > 0 ? 'right' : 'left';
            } else {
                direction = dy > 0 ? 'down' : 'up';
            }

            this.handleMove(direction);
            isSwiping = false;
        }, { passive: true });

        document.addEventListener('keydown', (e) => {
            if (!this.currentGame) return;

            if (document.getElementById('popup-overlay')?.classList.contains('active')) {
                return;
            }

            const keyMap = {
                'ArrowUp': 'up',
                'ArrowDown': 'down',
                'ArrowLeft': 'left',
                'ArrowRight': 'right',
                '1': 'undo',
                '2': 'shuffle',
                '3': 'remove',
                '4': 'swap',
                '5': 'ad'
            };

            const action = keyMap[e.key];
            if (action) {
                e.preventDefault();
                if (['up', 'down', 'left', 'right'].includes(action)) {
                    this.handleMove(action);
                } else if (action === 'undo') {
                    this.useUndo();
                } else if (action === 'shuffle') {
                    this.useShuffle();
                } else if (action === 'remove') {
                    this.useRemoveTile();
                } else if (action === 'swap') {
                    this.useSuperSwap();
                } else if (action === 'ad') {
                    this.watchAdExtraMove();
                }
            }
        });
    }

    static handleMove(direction) {
        if (!this.currentGame) return;

        if (this.swapSelectionMode) {
            this.showToast('⚠️ Finish swapping or cancel first');
            return;
        }

        const moved = this.currentGame.move(direction);

        if (moved) {
            this.state.totalMovesMade++;
            try {
                GameUI.renderBoard(this.currentGame);
            } catch (err) {
                console.error('Error in renderBoard:', err);
            }
            try {
                GameUI.updateGameUI(this.currentGame);
            } catch (err) {
                console.error('Error in updateGameUI:', err);
            }
            this.updateAllCoinDisplays();

            try { SoundManager.move(); } catch (e) { }

            if (this.currentGame.gameWon) {
                this.handleLevelWin();
            } else if (this.currentGame.gameOver) {
                this.handleLevelLoss();
            }
        } else {
            try { SoundManager.invalid(); } catch (e) { }
        }
    }

    // ============================================================
    // DATA EXPORT & ACCOUNT DELETION
    // ============================================================
    static async requestDataExport() {
        if (typeof PopupManager === 'undefined') {
            this.showToast('⚠️ Popup system not available');
            return;
        }

        const exportData = {
            exportDate: new Date().toISOString(),
            userId: this.state.userId || 'local',
            playerName: this.state.playerName || 'Guest',
            email: this.state.email || null,
            isLoggedIn: this.state.isLoggedIn,
            environment: this.state.adEnvironment,
            stats: {
                coins: this.state.coins || 0,
                totalStarsEarned: this.state.totalStarsEarned || 0,
                levelsCompleted: this.state.levelsCompleted || 0,
                highestTileEver: this.state.highestTileEver || 0,
                totalGamesPlayed: this.state.totalGamesPlayed || 0,
                totalWins: this.state.totalWins || 0,
                currentStreak: this.state.currentStreak || 0,
                maxStreak: this.state.maxStreak || 0,
                totalAdsWatched: this.state.totalAdsWatched || 0,
                powerUpsUsed: this.state.powerUpsUsed || 0,
                totalMovesMade: this.state.totalMovesMade || 0,
            },
            progress: {
                currentWorld: this.state.currentWorld || 0,
                currentLevel: this.state.currentLevel || 1,
                stars: this.state.stars || {},
                achievements: this.state.achievements || {},
                unlockedThemes: this.state.unlockedThemes || ['numbers'],
                activeTheme: this.state.activeTheme || 'numbers',
            },
            daily: {
                dailyChallengeDone: this.state.dailyChallengeDone || false,
                dailyChallengeDate: this.state.dailyChallengeDate || null,
                dailyProgress: this.state.dailyProgress || {},
            },
            settings: {
                soundOn: this.state.soundOn !== undefined ? this.state.soundOn : true,
                adsRemoved: this.state.adsRemoved || false,
            }
        };

        if (this.state.isLoggedIn && typeof FirebaseService !== 'undefined' && FirebaseService.initialized) {
            try {
                const cloudData = await FirebaseService.loadUserData();
                if (cloudData) {
                    exportData.cloudBackup = cloudData;
                }
            } catch (e) {
                console.warn('Could not fetch cloud data:', e);
            }
        }

        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        PopupManager.show({
            icon: '📥',
            title: 'Your Data is Ready',
            subtitle: 'Download your complete game data',
            body: `Data includes ${Object.keys(exportData.stats).length} stats, ${Object.keys(exportData.progress.stars).length} level records, and more.`,
            details: [
                { label: 'File Size', value: `${(blob.size / 1024).toFixed(1)} KB` },
                { label: 'Player', value: exportData.playerName },
                { label: 'Levels Completed', value: `${exportData.stats.levelsCompleted}` },
                { label: 'Total Stars', value: `${exportData.stats.totalStarsEarned}` },
            ],
            confirmText: '📥 Download JSON',
            cancelText: 'Close',
            confirmType: 'primary',
            onConfirm: () => {
                const a = document.createElement('a');
                a.href = url;
                a.download = `blockrush2k_data_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                this.showToast('✅ Data downloaded!');
            }
        });
    }

    static async requestAccountDeletion() {
        if (!this.state.isLoggedIn) {
            this.showToast('⚠️ Please sign in first');
            return;
        }

        if (typeof PopupManager === 'undefined') {
            this.showToast('⚠️ Popup system not available');
            return;
        }

        const totalStars = Object.values(this.state.stars || {}).reduce((a, b) => a + (b || 0), 0);
        const levelsCompleted = Object.values(this.state.stars || {}).filter(s => s > 0).length;

        PopupManager.show({
            icon: '⚠️',
            title: 'Delete Your Account?',
            subtitle: 'This action is permanent and irreversible',
            body: 'All your game data, progress, coins, stars, and achievements will be permanently deleted from our servers.',
            details: [
                { label: 'Player', value: this.state.playerName || 'Player' },
                { label: 'Email', value: this.state.email || 'Not provided' },
                { label: 'Levels Completed', value: `${levelsCompleted}` },
                { label: 'Total Stars', value: `${totalStars} ⭐` },
                { label: 'Coins', value: `${(this.state.coins || 0).toLocaleString()} Coins` },
                { label: 'Account Created', value: this.state.accountCreated || 'Unknown' },
            ],
            checkbox: {
                label: 'I understand this will permanently delete my account and all associated data. This cannot be undone.',
                checked: false
            },
            confirmText: '🗑️ Permanently Delete Account',
            cancelText: 'Cancel',
            confirmType: 'danger',
            onConfirm: async (confirmed) => {
                if (!confirmed) {
                    this.showToast('⚠️ Please confirm by checking the box');
                    return false;
                }

                PopupManager.close('cancel');
                this.showToast('🗑️ Deleting account...');

                try {
                    if (typeof FirebaseService !== 'undefined' && FirebaseService.initialized) {
                        const result = await FirebaseService.deleteAccount();
                        if (result.success) {
                            this.showToast('✅ Account deleted successfully');
                            localStorage.removeItem('blockRush2KSave');
                            localStorage.removeItem('blockFusionSave');
                            Object.assign(this.state, {
                                coins: 0,
                                stars: {},
                                achievements: {},
                                unlockedThemes: ['numbers'],
                                activeTheme: 'numbers',
                                levelsCompleted: 0,
                                totalStarsEarned: 0,
                                highestTileEver: 0,
                                isLoggedIn: false,
                                userId: null,
                                playerName: 'Guest Player',
                                email: null,
                                photoURL: null,
                                currentStreak: 0,
                                maxStreak: 0,
                                totalGamesPlayed: 0,
                                totalWins: 0,
                                totalAdsWatched: 0,
                                powerUpsUsed: 0,
                                totalMovesMade: 0,
                                dailyChallengeDone: false,
                                dailyChallengeDate: null,
                                dailyProgress: {},
                                adsRemoved: false,
                            });
                            this.saveState();
                            this.updateAllCoinDisplays();
                            this.updatePlayerDisplay();
                            this.updateLoginButtonVisibility();
                            Navigation.navigateTo('home');
                        } else {
                            this.showToast('❌ ' + result.error);
                        }
                    } else {
                        localStorage.removeItem('blockRush2KSave');
                        localStorage.removeItem('blockFusionSave');
                        this.showToast('✅ Local data cleared');
                        location.reload();
                    }
                } catch (err) {
                    this.showToast('❌ Failed to delete account: ' + err.message);
                    console.error(err);
                }
            }
        });
    }

    // ============================================================
    // ANDROID BRIDGE TEST METHODS
    // ============================================================
    static onAndroidBridgeReady() {
        console.log('📱 Android bridge ready callback from WebView');
        this.adBridgeReady = true;
        this.isAndroid = true;
        this.state.adEnvironment = 'android';
    }
    static testAndroidBridge() {
        // Diagnostic method for console only
        setTimeout(() => {
            if (typeof Android === 'undefined') {
                console.warn('⚠️ Android bridge not available yet');
                return;
            }

            console.log('📱 Testing Android Bridge...');
            try {
                if (Android.getDeviceInfo) {
                    console.log('Device Info:', Android.getDeviceInfo());
                }
                if (Android.getAdStatus) {
                    console.log('Ad Status:', Android.getAdStatus());
                }
                if (Android.getEnvironment) {
                    console.log('Environment:', Android.getEnvironment());
                }
                console.log('✅ Android Bridge ready!');
            } catch (e) {
                console.error('Android Bridge test failed:', e);
            }
        }, 500);
    }
    static showAndroidInfo() {
        if (!this.isAndroid) {
            this.showToast('❌ Not running on Android');
            return;
        }

        const info = this.getAndroidDeviceInfo();
        if (info) {
            PopupManager.show({
                icon: '📱',
                title: 'Android Device Info',
                subtitle: 'Running in WebView',
                details: [
                    { label: 'Device', value: info.model || 'Unknown' },
                    { label: 'Manufacturer', value: info.manufacturer || 'Unknown' },
                    { label: 'Android Version', value: info.version || 'Unknown' },
                    { label: 'App Version', value: info.appVersion || 'Unknown' },
                    { label: 'Ad Enabled', value: info.isAdEnabled ? '✅ Yes' : '❌ No' },
                    { label: 'Environment', value: info.platform || 'Android' },
                ],
                confirmText: 'OK',
                showCancel: false
            });
        } else {
            this.showToast('❌ Could not get device info');
        }
    }
}

// ============================================================
// INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    App.init();
    App.setupGameSwipe();

    // Initialization completed

    window.addEventListener('online', () => {
        App.showToast('🔄 Back online!');
        if (App.state.isLoggedIn && typeof FirebaseService !== 'undefined') {
            FirebaseService.saveUserData(App.state);
        }
    });

    window.addEventListener('offline', () => {
        App.showToast('📱 Playing offline');
    });
});

window.App = App;