// Ad Management Service - Unified for Web and Android
class AdService {
    static config = {
        // AdMob IDs (for Android)
        admob: {
            banner: 'ca-app-pub-4255859216659691/6387045959',
            interstitial: 'ca-app-pub-4255859216659691/7221704767',
            rewarded: 'ca-app-pub-4255859216659691/3713704595'
        },
        // Google AdMob Test Ad Unit IDs (Used in Debug mode)
        admobTest: {
            banner: 'ca-app-pub-3940256099942544/6300978111',
            interstitial: 'ca-app-pub-3940256099942544/1033173712',
            rewarded: 'ca-app-pub-3940256099942544/5224354917'
        },
        // Huawei Production Ad Unit IDs
        huawei: {
            banner: 'j6jq1ihvcy',
            interstitial: 'x0vj83nysr',
            rewarded: 'l89s206qf0'
        },
        // Huawei Test Ad Unit IDs (Used in Debug mode)
        huaweiTest: {
            banner: 'testw6vs28auh3',
            interstitial: 'testb4znbuh3n2',
            rewarded: 'testx9dtjwj8hp'
        },
        // Apple iOS Production Ad Unit IDs
        ios: {
            appId: 'ca-app-pub-4255859216659691~4111326402',
            banner: 'ca-app-pub-4255859216659691/6387045959',
            interstitial: 'ca-app-pub-4255859216659691/7221704767',
            rewarded: 'ca-app-pub-4255859216659691/3713704595'
        },
        // Apple iOS Test Ad Unit IDs (Debug mode)
        iosTest: {
            appId: 'ca-app-pub-3940256099942544~1458002511',
            banner: 'ca-app-pub-3940256099942544/2934735716',
            interstitial: 'ca-app-pub-3940256099942544/4411468910',
            rewarded: 'ca-app-pub-3940256099942544/1712485313'
        },
        // AdSense IDs (for Web)
        adsense: {
            banner: 'ca-pub-4255859216659691/6387045959',
            interstitial: 'ca-pub-4255859216659691/7221704767',
            rewarded: 'ca-pub-4255859216659691/3713704595'
        },
        // Platform-specific ads disabling configuration:
        // Controls which platforms have ads disabled (e.g. for store review processes)
        // Can be object: { huawei: true, google: false, web: false }
        // Array: ['huawei'] | ['google'] | ['huawei', 'google'] | ['both'] | ['all'] | []
        // String: 'huawei' | 'google' | 'web' | 'both' | 'all' | 'none'
        disabledPlatforms: {
            huawei: false,  // Ads enabled on Huawei platform
            google: false,  // Ads enabled on Google platform
            web: false,     // Ads enabled on Web platform
            ios: false      // Ads enabled on Apple iOS platform
        },
        // Configurable interstitial frequency (number of rounds/game plays before showing ad)
        interstitialFrequency: 3
    };

    static env = null; // 'web' | 'android'
    static platform = 'web'; // 'web' | 'google' | 'huawei'
    static adsEnabled = true;
    static interstitialCount = 0;
    static gamePlayCount = 0;
    static lastInterstitialTime = 0;
    static isInitialized = false;
    static androidBannerShown = false;

    static init() {
        console.log('📢 AdService.init() called');
        this.detectEnvironment();
        this.platform = this.detectPlatform();
        this.updateAdsStatus();

        console.log(`📢 AdService initialized in ${this.env} mode (${this.platform} platform). Ads Enabled: ${this.adsEnabled}`);

        if (!this.adsEnabled) {
            console.log(`🚫 Ads are disabled for platform: [${this.platform}]`);
            this.hideBannerAd();
            return;
        }

        this.isInitialized = true;

        if (this.env === 'android' || this.env === 'ios') {
            this.initAdMob();
            // REMOVE HTML banner when in Android mode
            this.removeHtmlBannerContainer();
        } else {
            this.initAdSense();
        }
    }

    static getPlatform() {
        return this.platform || this.detectPlatform();
    }

    static detectPlatform() {
        // 1. Check URL overrides
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const platformParam = urlParams.get('platform') || urlParams.get('adPlatform') || urlParams.get('flavor');
            if (platformParam) {
                const p = platformParam.toLowerCase();
                if (p === 'huawei' || p === 'hms') return 'huawei';
                if (p === 'google' || p === 'admob' || p === 'playstore') return 'google';
                if (p === 'ios' || p === 'apple' || p === 'appstore') return 'ios';
                if (p === 'web') return 'web';
            }

            const disabledParam = urlParams.get('disabledAds') || urlParams.get('disableAds');
            if (disabledParam) {
                this.setDisabledPlatforms(disabledParam);
            }
        } catch (e) {}

        // 2. Check global variables / Android native bridge signals
        if (typeof window.PLATFORM === 'string') return window.PLATFORM.toLowerCase();
        if (typeof window.BUILD_FLAVOR === 'string') {
            const f = window.BUILD_FLAVOR.toLowerCase();
            if (f.includes('huawei')) return 'huawei';
            if (f.includes('google')) return 'google';
            if (f.includes('ios') || f.includes('apple')) return 'ios';
        }

        // Direct iOS bridge detection
        if (typeof window.iOS !== 'undefined' || (typeof window.webkit !== 'undefined' && window.webkit.messageHandlers && window.webkit.messageHandlers.adBridge)) {
            return 'ios';
        }

        if (typeof window.Android !== 'undefined' && window.Android !== null) {
            try {
                if (typeof window.Android.getPlatform === 'function') {
                    const p = window.Android.getPlatform();
                    if (p) {
                        const pl = p.toLowerCase();
                        if (pl === 'ios' || pl === 'apple') return 'ios';
                        return pl;
                    }
                }
                if (typeof window.Android.getEnvironment === 'function' && window.Android.getEnvironment() === 'ios') {
                    return 'ios';
                }
                if (typeof window.Android.getFlavor === 'function') {
                    const f = window.Android.getFlavor();
                    if (f) return f.toLowerCase();
                }
                if (window.Android.isHuawei || window.Android.isHMS) return 'huawei';
                if (window.Android.isGoogle) return 'google';
            } catch (e) {}
        }

        // 3. UserAgent checks for Huawei
        const userAgent = navigator.userAgent || navigator.vendor || window.opera || '';
        if (/huawei|hmsCore|harmonyos/i.test(userAgent)) {
            return 'huawei';
        }

        // 4. Fallback based on env
        if (this.env === 'android') {
            return 'google';
        }

        return 'web';
    }

    static isPlatformAdsDisabled(platformToTest = null) {
        const platform = (platformToTest || this.platform || 'web').toLowerCase();

        let disabledRules = this.config.disabledPlatforms;
        if (typeof CONFIG !== 'undefined' && typeof CONFIG.DISABLED_ADS_PLATFORMS !== 'undefined') {
            disabledRules = CONFIG.DISABLED_ADS_PLATFORMS;
        }

        if (disabledRules === true || disabledRules === 'all') return true;
        if (disabledRules === false || disabledRules === 'none') return false;

        if (Array.isArray(disabledRules)) {
            if (disabledRules.includes('all')) return true;
            if (disabledRules.includes('both') && (platform === 'huawei' || platform === 'google')) return true;
            return disabledRules.map(s => String(s).toLowerCase()).includes(platform);
        }

        if (typeof disabledRules === 'string') {
            const str = disabledRules.toLowerCase();
            if (str === 'all') return true;
            if (str === 'none') return false;
            if (str === 'both') return platform === 'huawei' || platform === 'google';
            return str.split(',').map(s => s.trim()).includes(platform);
        }

        if (typeof disabledRules === 'object' && disabledRules !== null) {
            if (disabledRules.all) return true;
            if (disabledRules.both && (platform === 'huawei' || platform === 'google')) return true;
            return !!disabledRules[platform];
        }

        return false;
    }

    static updateAdsStatus() {
        this.platform = this.detectPlatform();
        this.adsEnabled = this.isAdEnabled();
    }

    static setDisabledPlatforms(setting) {
        if (typeof setting === 'string') {
            const val = setting.toLowerCase().trim();
            if (val.includes(',')) {
                this.config.disabledPlatforms = val.split(',').map(s => s.trim());
            } else if (val === 'both') {
                this.config.disabledPlatforms = ['huawei', 'google'];
            } else if (val === 'none') {
                this.config.disabledPlatforms = [];
            } else if (val === 'all') {
                this.config.disabledPlatforms = ['all'];
            } else {
                this.config.disabledPlatforms = [val];
            }
        } else {
            this.config.disabledPlatforms = setting;
        }

        if (typeof CONFIG !== 'undefined') {
            CONFIG.DISABLED_ADS_PLATFORMS = this.config.disabledPlatforms;
        }

        this.updateAdsStatus();
        if (!this.adsEnabled) {
            this.hideBannerAd();
        }
    }

    static disableAdsForPlatform(platform) {
        let current = this.config.disabledPlatforms;
        if (typeof current === 'string' || Array.isArray(current)) {
            let list = Array.isArray(current) ? [...current] : [current];
            if (!list.includes(platform)) list.push(platform);
            this.setDisabledPlatforms(list);
        } else if (typeof current === 'object' && current !== null) {
            current[platform] = true;
            this.setDisabledPlatforms(current);
        } else {
            this.setDisabledPlatforms([platform]);
        }
    }

    static enableAdsForPlatform(platform) {
        let current = this.config.disabledPlatforms;
        if (Array.isArray(current)) {
            let list = current.filter(p => p !== platform && p !== 'all' && p !== 'both');
            this.setDisabledPlatforms(list);
        } else if (typeof current === 'object' && current !== null) {
            current[platform] = false;
            this.setDisabledPlatforms(current);
        } else {
            this.setDisabledPlatforms([]);
        }
    }

    static isDebugMode() {
        if (typeof window.Android !== 'undefined' && window.Android !== null && typeof window.Android.isDebug === 'function') {
            try {
                if (window.Android.isDebug()) return true;
            } catch (e) {}
        }
        try {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('debug') === 'true' || urlParams.get('testAds') === 'true') return true;
        } catch (e) {}
        return false;
    }

    static getAdUnitIds(targetPlatform = null) {
        const platform = (targetPlatform || this.platform || 'web').toLowerCase();
        const isDebug = this.isDebugMode();

        if (platform === 'ios' || platform === 'apple') {
            if (isDebug) {
                console.log('🐞 Debug build active: Using iOS Test Ad Units');
                return this.config.iosTest;
            }
            return this.config.ios;
        }

        if (platform === 'huawei') {
            if (isDebug) {
                console.log('🐞 Debug build active: Using Huawei Test Ad Units');
                return this.config.huaweiTest;
            }
            return this.config.huawei;
        }

        if (platform === 'google' || platform === 'android') {
            if (isDebug) {
                console.log('🐞 Debug build active: Using AdMob Test Ad Units');
                return this.config.admobTest;
            }
            return this.config.admob;
        }

        return this.config.adsense;
    }

    static detectEnvironment() {
        const isNativeBridge = (typeof window.Android !== 'undefined' && window.Android !== null) ||
                               (typeof window.iOS !== 'undefined') ||
                               (typeof window.webkit !== 'undefined' && window.webkit.messageHandlers && window.webkit.messageHandlers.adBridge) ||
                               (typeof window.AdMob !== 'undefined');

        if (isNativeBridge) {
            const p = this.detectPlatform();
            this.env = (p === 'ios') ? 'ios' : 'android';
            console.log(`📱 Native bridge environment detected (${this.env}) - HTML banner will be removed`);
        } else {
            this.env = 'web';
            console.log('🌐 Web environment detected');
        }

        try {
            const urlParams = new URLSearchParams(window.location.search);
            const envOverride = urlParams.get('adEnv');
            if (envOverride === 'android' || envOverride === 'web') {
                this.env = envOverride;
                console.log(`📍 Ad environment overridden to: ${this.env}`);
                if (this.env === 'android') {
                    this.removeHtmlBannerContainer();
                }
            }
        } catch (e) {
            // Ignore URL parsing errors
        }
    }

    // ============================================================
    // REMOVE HTML BANNER - CRITICAL FOR ANDROID
    // ============================================================
    static removeHtmlBannerContainer() {
        console.log('🗑️ Removing HTML banner container for Android...');

        // Method 1: Remove the banner-ad container entirely
        const bannerContainer = document.getElementById('banner-ad');
        if (bannerContainer) {
            bannerContainer.style.display = 'none';
            bannerContainer.innerHTML = '';
            console.log('✅ HTML banner container hidden');
        }

        // Method 2: Also remove any other ad containers that might exist
        const adContainers = document.querySelectorAll('.banner-ad-container, .ad-container, [class*="banner-ad"]');
        adContainers.forEach(el => {
            el.style.display = 'none';
            el.innerHTML = '';
        });

        // Method 3: If there's a parent container with padding for ads, remove it
        const appContainer = document.getElementById('app');
        if (appContainer) {
            // Remove any margin/padding that was added for banner ads
            appContainer.style.paddingTop = '0';
            appContainer.style.paddingBottom = '0';
        }

        // Method 4: Hide any ad placeholder text
        const adPlaceholders = document.querySelectorAll('.banner-ad-placeholder, .ad-placeholder');
        adPlaceholders.forEach(el => {
            el.style.display = 'none';
        });

        console.log('✅ All HTML banner ads removed for Android');
    }

    // ============================================================
    // ANDROID (AdMob) INITIALIZATION
    // ============================================================
    static initAdMob() {
        console.log('📱 Initializing Ads for Android/Huawei...');

        // Check if Android bridge is available
        if (typeof window.Android !== 'undefined' && window.Android !== null) {
            try {
                if (typeof window.Android.initAds === 'function') {
                    const ids = this.getAdUnitIds();
                    window.Android.initAds(ids.banner || "", ids.interstitial || "", ids.rewarded || "");
                    console.log('✅ Ads initialized via Android bridge');

                    // Load Android native banner
                    this.loadAndroidBanner();
                    this.loadInterstitialAd();
                    this.loadRewardedAd();
                    return;
                } else {
                    console.warn('Android.initAds not available');
                }
            } catch (e) {
                console.warn('Android bridge init failed:', e);
            }
        }

        // Fallback: Try AdMob web SDK
        if (typeof window.AdMob !== 'undefined') {
            try {
                if (typeof window.AdMob.init === 'function') {
                    window.AdMob.init({
                        appId: this.config.admob.banner.split('/')[0]
                    });
                    console.log('✅ AdMob initialized via web SDK');
                    this.loadAndroidBanner();
                    this.loadInterstitialAd();
                    this.loadRewardedAd();
                    return;
                }
            } catch (e) {
                console.warn('AdMob web SDK init failed:', e);
            }
        }

        // No AdMob available - show fallback (but still remove HTML banner)
        console.warn('⚠️ AdMob not available, using fallback');
        this.showFallbackAds();
    }

    // ============================================================
    // ANDROID NATIVE BANNER (AdMob)
    // ============================================================
    static loadAndroidBanner() {
        if (!this.adsEnabled) return;
        console.log('📱 Loading Android native banner...');

        // Show native Android banner via bridge
        if (typeof window.Android !== 'undefined' && window.Android !== null) {
            try {
                if (typeof window.Android.showBannerAd === 'function') {
                    const ids = this.getAdUnitIds();
                    window.Android.showBannerAd(ids.banner || "");
                    this.androidBannerShown = true;
                    console.log('✅ Android native banner shown');
                    return;
                }
            } catch (e) {
                console.warn('Android showBannerAd failed:', e);
            }
        }

        // Try AdMob web SDK fallback
        if (typeof window.AdMob !== 'undefined') {
            try {
                if (typeof window.AdMob.showBanner === 'function') {
                    window.AdMob.showBanner({
                        id: this.config.admob.banner,
                        position: 'bottom'
                    });
                    this.androidBannerShown = true;
                    console.log('✅ AdMob web SDK banner shown');
                    return;
                }
            } catch (e) {
                console.warn('AdMob web SDK banner failed:', e);
            }
        }

        console.warn('⚠️ Could not show Android native banner');
    }

    static showAndroidBanner() {
        if (!this.adsEnabled) return;

        // Only show if not already shown
        if (this.androidBannerShown) {
            console.log('📱 Android banner already shown');
            return;
        }

        this.loadAndroidBanner();
    }

    static hideAndroidBanner() {
        console.log('📱 Hiding Android native banner...');
        if (typeof window.Android !== 'undefined' && window.Android !== null) {
            try {
                if (typeof window.Android.hideBannerAd === 'function') {
                    window.Android.hideBannerAd();
                    this.androidBannerShown = false;
                    console.log('✅ Android native banner hidden');
                    return;
                }
            } catch (e) {
                console.warn('Android hideBannerAd failed:', e);
            }
        }

        // Try AdMob web SDK
        if (typeof window.AdMob !== 'undefined') {
            try {
                if (typeof window.AdMob.hideBanner === 'function') {
                    window.AdMob.hideBanner();
                    this.androidBannerShown = false;
                    console.log('✅ AdMob web SDK banner hidden');
                    return;
                }
            } catch (e) {
                console.warn('AdMob web SDK hide banner failed:', e);
            }
        }
    }

    // ============================================================
    // WEB (AdSense) BANNER
    // ============================================================
    static initAdSense() {
        console.log('🌐 Initializing AdSense for Web...');
        // Keep HTML banner for web
        this.loadBannerAd();
        this.loadInterstitialAd();
        this.loadRewardedAd();
    }

    // ============================================================
    // BANNER ADS (Unified)
    // ============================================================
    static loadBannerAd() {
        if (!this.adsEnabled || !this.isInitialized) return;

        // If on Android, use native banner and remove HTML
        if (this.env === 'android') {
            this.removeHtmlBannerContainer();
            this.loadAndroidBanner();
            return;
        }

        // Web - use HTML banner
        const container = document.getElementById('banner-ad');
        if (!container) return;
        container.innerHTML = '';
        this.loadAdSenseBanner(container);
    }

    static ensureAdSenseScript() {
        if (typeof document === 'undefined') return;
        if (document.getElementById('adsbygoogle-js')) return;

        const bannerStr = (this.config.adsense && this.config.adsense.banner) || 'ca-pub-4255859216659691/6387045959';
        const client = bannerStr.split('/')[0] || 'ca-pub-4255859216659691';

        const script = document.createElement('script');
        script.id = 'adsbygoogle-js';
        script.async = true;
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
        script.crossOrigin = 'anonymous';
        document.head.appendChild(script);
    }

    static loadAdSenseBanner(container) {
        if (!container) return;

        // Container remains hidden until an ad is confirmed filled
        container.style.display = 'none';
        container.classList.remove('has-ad');

        const bannerStr = (this.config.adsense && this.config.adsense.banner) || 'ca-pub-4255859216659691/6387045959';
        const parts = bannerStr.split('/');
        const client = parts[0] || 'ca-pub-4255859216659691';
        const slot = parts[1] || '6387045959';

        this.ensureAdSenseScript();

        try {
            container.innerHTML = `
                <ins class="adsbygoogle"
                     style="display:inline-block;width:100%;max-height:60px;"
                     data-ad-client="${client}"
                     data-ad-slot="${slot}"
                     data-ad-format="horizontal"
                     data-full-width-responsive="false"></ins>
            `;

            const ins = container.querySelector('ins.adsbygoogle');
            const checkAdStatus = () => {
                if (!ins || !container) return;
                const status = ins.getAttribute('data-ad-status');
                if (status === 'unfilled') {
                    // Ad unfilled: keep container completely hidden and empty
                    container.style.display = 'none';
                    container.classList.remove('has-ad');
                    container.innerHTML = '';
                } else if (status === 'filled' || (ins.childNodes.length > 0 && ins.offsetHeight > 20)) {
                    // Ad is rendered and filled
                    container.style.display = 'flex';
                    container.classList.add('has-ad');
                } else {
                    container.style.display = 'none';
                    container.classList.remove('has-ad');
                }
            };

            const observer = new MutationObserver(() => checkAdStatus());
            observer.observe(ins, { attributes: true, attributeFilter: ['data-ad-status'], childList: true });

            setTimeout(checkAdStatus, 1500);
            setTimeout(checkAdStatus, 3500);
            setTimeout(() => {
                if (container && !container.classList.contains('has-ad')) {
                    container.style.display = 'none';
                    container.classList.remove('has-ad');
                    container.innerHTML = '';
                }
            }, 4500);

            (window.adsbygoogle = window.adsbygoogle || []).push({});
            return;
        } catch (e) {
            console.warn('AdSense banner push error:', e);
            container.style.display = 'none';
            container.classList.remove('has-ad');
            container.innerHTML = '';
        }
    }

    static showBannerAd() {
        if (!this.adsEnabled || !this.isInitialized) return;

        if (this.env === 'android' || this.env === 'ios') {
            this.showAndroidBanner();
        } else {
            const container = document.getElementById('banner-ad');
            if (container) {
                this.loadBannerAd();
            }
        }
    }

    static hideBannerAd() {
        if (this.env === 'android') {
            this.hideAndroidBanner();
        } else {
            const container = document.getElementById('banner-ad');
            if (container) {
                container.style.display = 'none';
                container.classList.remove('has-ad');
                container.innerHTML = '';
            }
        }
    }

    // ============================================================
    // INTERSTITIAL ADS
    // ============================================================
    static loadInterstitialAd() {
        if (!this.adsEnabled || !this.isInitialized) return;
        console.log('📺 Interstitial ad loaded');
    }

    static recordGamePlay() {
        if (!this.isAdEnabled()) return;
        this.gamePlayCount++;
        const frequency = (typeof CONFIG !== 'undefined' && CONFIG.ADS && CONFIG.ADS.INTERSTITIAL_GAME_COUNT_FREQUENCY)
                            || this.config.interstitialFrequency
                            || 3;

        console.log(`🎮 Game play recorded: ${this.gamePlayCount}/${frequency}`);

        if (this.gamePlayCount >= frequency) {
            this.gamePlayCount = 0;
            this.showInterstitialAd(true);
        }
    }

    static showInterstitialAd(force = false) {
        if (!this.isAdEnabled()) return;

        const frequency = (typeof CONFIG !== 'undefined' && CONFIG.ADS && CONFIG.ADS.INTERSTITIAL_GAME_COUNT_FREQUENCY)
                            || this.config.interstitialFrequency
                            || 3;

        if (!force) {
            this.gamePlayCount++;
            if (this.gamePlayCount < frequency) return;
        }

        this.gamePlayCount = 0;
        this.lastInterstitialTime = Date.now();

        if (this.env === 'android') {
            this.showAdMobInterstitial();
        } else {
            this.showAdSenseInterstitial();
        }
    }

    static showAdMobInterstitial() {
        if (typeof window.Android !== 'undefined' && window.Android !== null) {
            try {
                if (typeof window.Android.showInterstitialAd === 'function') {
                    const ids = this.getAdUnitIds();
                    window.Android.showInterstitialAd(ids.interstitial || "");
                    console.log('📱 Native interstitial shown');
                    return;
                }
            } catch (e) {
                console.warn('Android interstitial failed:', e);
            }
        }

        if (typeof App !== 'undefined') {
            App.showToast('📺 Loading ad...');
            setTimeout(() => {
                App.showToast('📺 Ad completed');
            }, 2000);
        }
    }

    static showAdSenseInterstitial() {
        if (typeof App !== 'undefined') {
            App.showToast('📺 Loading ad...');
            setTimeout(() => {
                App.showToast('📺 Ad completed');
            }, 2000);
        }
    }

    // ============================================================
    // REWARDED ADS
    // ============================================================
    static loadRewardedAd() {
        if (!this.adsEnabled || !this.isInitialized) return;
        console.log('🎁 Rewarded ad loaded');
    }

    static showRewardedAd(callback) {
        if (!this.adsEnabled || !this.isInitialized) {
            if (callback) callback(true);
            return;
        }

        if (this.env === 'android') {
            this.showAdMobRewarded(callback);
        } else {
            this.showAdSenseRewarded(callback);
        }
    }

    static showAdMobRewarded(callback) {
        if (typeof window.Android !== 'undefined' && window.Android !== null) {
            try {
                if (typeof window.Android.showRewardedAd === 'function') {
                    window._rewardCallback = callback;
                    const ids = this.getAdUnitIds();
                    window.Android.showRewardedAd(ids.rewarded || "");
                    return;
                }
            } catch (e) {
                console.warn('Android rewarded ad failed:', e);
            }
        }

        if (typeof App !== 'undefined') {
            App.showToast('📺 Watching ad...');
        }
        setTimeout(() => {
            console.log('✅ Reward earned (fallback)');
            if (callback) callback(true);
        }, 2000);
    }

    static showAdSenseRewarded(callback) {
        if (typeof App !== 'undefined') {
            App.showToast('📺 Watching ad...');
        }
        setTimeout(() => {
            console.log('✅ Reward earned (fallback)');
            if (callback) callback(true);
        }, 2000);
    }

    // ============================================================
    // REWARD SYSTEM
    // ============================================================
    static rewardUser(type, callback) {
        if (typeof App !== 'undefined') {
            App.showToast('🎁 Watching ad...');
        }

        this.showRewardedAd((success) => {
            if (success) {
                switch (type) {
                    case 'coins':
                        const reward = 50 + Math.floor(Math.random() * 100);
                        if (typeof App !== 'undefined' && App.state) {
                            App.state.coins = (App.state.coins || 0) + reward;
                            App.state.totalAdsWatched = (App.state.totalAdsWatched || 0) + 1;
                            App.saveState();
                            App.updateAllCoinDisplays();
                            App.showToast(`💰 +${reward} coins from ad!`);
                        }
                        break;
                    case 'extra_move':
                        if (typeof App !== 'undefined' && App.currentGame) {
                            App.currentGame.spawnTile();
                            App.currentGame.spawnTile();
                            GameUI.renderBoard(App.currentGame);
                            App.showToast('🎁 Extra tiles spawned!');
                        }
                        break;
                    case 'double_reward':
                        if (typeof App !== 'undefined') {
                            App.state.doubleRewardPending = true;
                            App.saveState();
                            App.showToast('✨ Next reward will be doubled!');
                        }
                        break;
                    case 'free_undo':
                        if (typeof App !== 'undefined') {
                            App.state.freeUndoAvailable = true;
                            App.saveState();
                            App.showToast('↩️ Free undo available!');
                        }
                        break;
                    default:
                        if (typeof App !== 'undefined') {
                            App.showToast('🎁 Thanks for watching!');
                        }
                }

                if (typeof Achievements !== 'undefined') {
                    Achievements.check();
                }

                if (callback) callback(true);
            } else {
                if (typeof App !== 'undefined') {
                    App.showToast('❌ Ad failed to load, try again');
                }
                if (callback) callback(false);
            }
        });
    }

    // ============================================================
    // FALLBACK ADS
    // ============================================================
    static showFallbackAds() {
        console.log('📢 Fallback ads handler: no ads loaded');
        this.adsEnabled = false;

        // Hide HTML banner completely when no ad is loaded
        this.hideBannerAd();
    }

    // ============================================================
    // UTILITY METHODS
    // ============================================================
    static isRewardedAdAvailable() {
        if (!this.adsEnabled) return false;
        if (typeof App !== 'undefined' && App.state && App.state.adsRemoved) return false;
        if (typeof CONFIG !== 'undefined' && !CONFIG.isAdsUiEnabled()) return false;

        // Native Android bridge check
        if (typeof window.Android !== 'undefined' && window.Android !== null) {
            if (typeof window.Android.isRewardedAdLoaded === 'function') {
                try {
                    return window.Android.isRewardedAdLoaded();
                } catch (e) { }
            }
            return typeof window.Android.showRewardedAd === 'function';
        }

        if (typeof Android !== 'undefined' && typeof Android.showRewardedAd === 'function') {
            if (typeof Android.isRewardedAdLoaded === 'function') {
                try {
                    return Android.isRewardedAdLoaded();
                } catch (e) { }
            }
            return true;
        }

        // Explicit test / debug override
        if (this.isDebugMode()) {
            return true;
        }

        // On Web without an active rewarded ad provider, return false to prevent showing non-working watch ad buttons
        return false;
    }

    static isAndroidEnv() {
        return this.env === 'android';
    }

    static isWebEnv() {
        return this.env === 'web';
    }

    static getEnvironment() {
        return this.env;
    }

    static removeAds() {
        this.adsEnabled = false;
        this.hideBannerAd();
        if (typeof App !== 'undefined') {
            App.state.adsRemoved = true;
            App.saveState();
            App.showToast('🚫 Ads removed permanently!');
        }
    }

    static isAdEnabled(platformToCheck = null) {
        if (typeof App !== 'undefined' && App.state && App.state.adsRemoved) {
            return false;
        }
        if (typeof window !== 'undefined' && window.Android && typeof window.Android.isAdEnabled === 'function') {
            return window.Android.isAdEnabled();
        }
        if (typeof Android !== 'undefined' && typeof Android.isAdEnabled === 'function') {
            return Android.isAdEnabled();
        }
        return !this.isPlatformAdsDisabled(platformToCheck);
    }

    static isAdInitialized() {
        return this.isInitialized;
    }
}

window.AdService = AdService;