import Foundation

/// JavaScript injection script that establishes complete compatibility with the Android bridge
enum NativeBridgeScript {
    static let scriptContent: String = """
    (function() {
        console.log('⚡ Initializing iOS Native Bridges (Android, Billing, Social, iOS)...');
        
        // Enforce iOS Safe Area padding to protect against notch & Dynamic Island
        try {
            var safeStyle = document.getElementById('ios-safe-area-rules');
            if (!safeStyle) {
                safeStyle = document.createElement('style');
                safeStyle.id = 'ios-safe-area-rules';
                safeStyle.textContent = `
                    :root {
                        --safe-area-top: env(safe-area-inset-top, 50px);
                        --safe-area-bottom: env(safe-area-inset-bottom, 24px);
                    }
                    #app {
                        padding-top: max(env(safe-area-inset-top, 0px), 50px) !important;
                        padding-bottom: max(env(safe-area-inset-bottom, 0px), 24px) !important;
                        box-sizing: border-box !important;
                    }
                `;
                if (document.head) {
                    document.head.appendChild(safeStyle);
                } else {
                    document.addEventListener('DOMContentLoaded', function() {
                        if (document.head) document.head.appendChild(safeStyle);
                    });
                }
            }
        } catch(e) {
            console.warn('Safe area injection error:', e);
        }

        window._cachedPrices = {};
        window._purchasedProducts = [];
        window._activeTheme = 'numbers';
        window._isAdsRemoved = false;
        window._isThemePackOwned = false;

        // Post message wrapper to native WKScriptMessageHandler
        function postToNative(handler, action, payload) {
            try {
                if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers[handler]) {
                    window.webkit.messageHandlers[handler].postMessage(Object.assign({ action: action }, payload || {}));
                } else {
                    console.warn('Native handler [' + handler + '] not registered yet');
                }
            } catch (err) {
                console.error('Bridge post error:', err);
            }
        }

        // ==========================================
        // 1. Android Bridge (AdMob + Billing fallback)
        // ==========================================
        window.Android = {
            initAds: function(bannerId, interId, rewardedId) {
                postToNative('adBridge', 'initAds', { bannerId: bannerId, interId: interId, rewardedId: rewardedId });
            },
            showBannerAd: function(adUnitId) {
                postToNative('adBridge', 'showBannerAd', { adUnitId: adUnitId });
            },
            hideBannerAd: function() {
                postToNative('adBridge', 'hideBannerAd');
            },
            showInterstitialAd: function(adUnitId) {
                postToNative('adBridge', 'showInterstitialAd', { adUnitId: adUnitId });
            },
            showRewardedAd: function(adUnitId) {
                postToNative('adBridge', 'showRewardedAd', { adUnitId: adUnitId });
            },
            launchPurchase: function(productId) {
                postToNative('billingBridge', 'launchPurchase', { productId: productId });
            },
            restorePurchases: function() {
                postToNative('billingBridge', 'restorePurchases');
            },
            getProductPrices: function() {
                return JSON.stringify(window._cachedPrices || {});
            },
            isBillingAvailable: function() {
                return true;
            },
            isThemePackOwned: function() {
                return !!window._isThemePackOwned;
            },
            isAdsRemoved: function() {
                return !!window._isAdsRemoved;
            },
            isAdEnabled: function() {
                return !window._isAdsRemoved;
            },
            vibrate: function() {
                postToNative('hapticBridge', 'vibrate');
            },
            exitApp: function() {
                postToNative('appBridge', 'exitApp');
            },
            openStoreReview: function() {
                postToNative('appBridge', 'openStoreReview');
            },
            getDeviceInfo: function() {
                return JSON.stringify({
                    platform: 'ios',
                    platformName: 'Apple iOS (App Store)',
                    model: 'iPhone',
                    os: 'iOS',
                    osVersion: '18.0',
                    isIos: true,
                    clientType: 'ios_native',
                    isTv: false,
                    isAdsRemoved: window._isAdsRemoved,
                    isThemePackOwned: window._isThemePackOwned
                });
            },
            logEvent: function(eventName, paramsJson) {
                postToNative('adBridge', 'logEvent', { name: eventName, params: paramsJson });
            },
            getPlatform: function() {
                return 'ios'; // Direct iOS platform identity
            },
            getFlavor: function() {
                return 'appstore';
            },
            isDebug: function() {
                return false;
            },
            getEnvironment: function() {
                return 'ios';
            },
            ping: function() {
                return 'pong';
            }
        };

        // ==========================================
        // 2. Billing Bridge (StoreKit 2)
        // ==========================================
        window.Billing = {
            launchPurchase: function(productId) {
                postToNative('billingBridge', 'launchPurchase', { productId: productId });
            },
            restorePurchases: function() {
                postToNative('billingBridge', 'restorePurchases');
            },
            isPaymentSupported: function() {
                return true;
            },
            getProductPrices: function() {
                return JSON.stringify(window._cachedPrices || {});
            },
            isBillingAvailable: function() {
                return true;
            },
            isThemePackOwned: function() {
                return !!window._isThemePackOwned;
            },
            isAdsRemoved: function() {
                return !!window._isAdsRemoved;
            },
            getPurchasedProducts: function() {
                return JSON.stringify(window._purchasedProducts || []);
            },
            setActiveTheme: function(themeId) {
                window._activeTheme = themeId;
                postToNative('billingBridge', 'setActiveTheme', { themeId: themeId });
            },
            getActiveTheme: function() {
                return window._activeTheme || 'numbers';
            },
            isTvDevice: function() {
                return false;
            }
        };

        // ==========================================
        // 3. Social Bridge (Native Share Sheet)
        // ==========================================
        window.Social = {
            shareReferralCode: function(code, shareUrl) {
                postToNative('socialBridge', 'shareReferralCode', { code: code, shareUrl: shareUrl });
            },
            sendFriendRequest: function(uid) {
                console.log('Social friend request:', uid);
            },
            acceptFriendRequest: function(uid) {
                console.log('Social accept request:', uid);
            },
            getFriendsList: function() {
                if (window.onFriendsListLoaded) window.onFriendsListLoaded([]);
            }
        };

        // Direct iOS namespace
        window.iOS = {
            vibrate: function() { postToNative('hapticBridge', 'vibrate'); },
            share: function(text, url) { postToNative('socialBridge', 'share', { text: text, url: url }); }
        };

        console.log('✅ iOS Native Bridges loaded and active');
    })();
    """
}
