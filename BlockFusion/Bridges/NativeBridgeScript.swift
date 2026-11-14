import Foundation

/// JavaScript injection script that establishes native bridges and styling for iOS
enum NativeBridgeScript {
    static let scriptContent: String = """
    (function() {
        console.log('⚡ Initializing iOS Native Bridges...');
        
        // Mark document as native iOS app
        document.documentElement.classList.add('is-native-ios', 'is-native-app');
        if (document.body) {
            document.body.classList.add('is-native-ios', 'is-native-app');
        } else {
            document.addEventListener('DOMContentLoaded', function() {
                if (document.body) document.body.classList.add('is-native-ios', 'is-native-app');
            });
        }
        
        // Enforce iOS Safe Area padding and remove web artifacts
        try {
            var safeStyle = document.getElementById('ios-safe-area-rules');
            if (!safeStyle) {
                safeStyle = document.createElement('style');
                safeStyle.id = 'ios-safe-area-rules';
                safeStyle.textContent = `
                    :root {
                        --safe-area-top: 0px;
                        --safe-area-bottom: 0px;
                    }
                    #app {
                        padding-top: 0px !important;
                        padding-bottom: 0px !important;
                        box-sizing: border-box !important;
                    }
                    /* Remove all web download / smart tv / web notice artifacts */
                    a[href*="download"],
                    a[href*="/tv"],
                    button[onclick*="download"],
                    .download-only-web,
                    .web-only-download,
                    .store-web-notice,
                    .download-card,
                    .download-grid,
                    #adsbygoogle-js,
                    .adsbygoogle {
                        display: none !important;
                    }

                    /* Universal High-Contrast Visible Text Rules for iOS */
                    :root, html, body, #app {
                        color: #F1F5F9 !important;
                        -webkit-text-fill-color: initial;
                    }
                    h1, h2, h3, h4, h5, h6, .game-title, .world-name, .level-name {
                        color: #FFFFFF !important;
                        -webkit-text-fill-color: #FFFFFF !important;
                    }
                    .login-card, .login-container, .modal, .popup {
                        color: #F1F5F9 !important;
                    }
                    .login-card h2, .popup-title, .modal h2 {
                        color: #FFFFFF !important;
                        -webkit-text-fill-color: #FFFFFF !important;
                    }
                    .login-card p, .benefit-item, .item-desc, .popup-subtitle, .stat-label {
                        color: #CBD5E1 !important;
                        -webkit-text-fill-color: #CBD5E1 !important;
                    }
                    input, select, textarea {
                        color: #FFFFFF !important;
                        -webkit-text-fill-color: #FFFFFF !important;
                        background-color: #1E293B !important;
                    }
                    input::placeholder, textarea::placeholder {
                        color: #94A3B8 !important;
                        -webkit-text-fill-color: #94A3B8 !important;
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
        // 1. Core Native App Bridge
        // ==========================================
        window.iOS = {
            vibrate: function(type, force) { postToNative('hapticBridge', 'vibrate', { type: type || 'medium', force: !!force }); },
            setHapticsEnabled: function(enabled) { postToNative('hapticBridge', 'setEnabled', { enabled: !!enabled }); },
            logEvent: function(eventName, paramsJson) { postToNative('adBridge', 'logEvent', { name: eventName, params: paramsJson }); },
            share: function(text, url) { postToNative('socialBridge', 'share', { text: text, url: url }); },
            showGameCenter: function() { postToNative('gameCenterBridge', 'showDashboard'); },
            signInWithApple: function() { postToNative('socialBridge', 'performAppleSignIn'); },
            notifyScreenChanged: function(screen) { postToNative('appBridge', 'screenChanged', { screen: screen }); },
            showLogin: function() { postToNative('appBridge', 'showLogin'); },
            showDailyReward: function() { postToNative('appBridge', 'showDailyReward'); },
            initAds: function(bannerId, interId, rewardedId) { postToNative('adBridge', 'initAds', { bannerId: bannerId, interId: interId, rewardedId: rewardedId }); },
            showBannerAd: function(adUnitId) { postToNative('adBridge', 'showBannerAd', { adUnitId: adUnitId }); },
            hideBannerAd: function() { postToNative('adBridge', 'hideBannerAd'); },
            showInterstitialAd: function(adUnitId) { postToNative('adBridge', 'showInterstitialAd', { adUnitId: adUnitId }); },
            showRewardedAd: function(adUnitId) { postToNative('adBridge', 'showRewardedAd', { adUnitId: adUnitId }); }
        };

        window.onAppleSignInSuccess = async function(idToken, rawNonce, email, fullName) {
            try {
                if (typeof FirebaseService !== 'undefined') {
                    const res = (typeof FirebaseService.completeAppleSignInWithCredential === 'function')
                        ? await FirebaseService.completeAppleSignInWithCredential(idToken, rawNonce, email, fullName)
                        : await FirebaseService.signInWithApple(idToken, rawNonce, email, fullName);
                    if (res && res.success) {
                        if (typeof App !== 'undefined' && App.handleSuccessfulLogin) {
                            App.handleSuccessfulLogin(res.user, 'apple');
                            App.showToast('✅ Signed in with Apple!');
                        } else if (typeof App !== 'undefined' && App.onLoginSuccess) {
                            App.onLoginSuccess(res.user);
                            App.showToast('✅ Signed in with Apple!');
                        }
                    } else {
                        if (typeof App !== 'undefined' && App.showToast) App.showToast('❌ Apple Sign In failed: ' + (res ? res.error : 'unknown'));
                    }
                    if (typeof window._appleSignInResolve === 'function') {
                        window._appleSignInResolve(res);
                        window._appleSignInResolve = null;
                    }
                }
            } catch (e) {
                console.error('onAppleSignInSuccess error:', e);
            }
        };

        window.onAppleSignInError = function(errorMsg) {
            if (errorMsg !== 'Cancelled') {
                if (typeof App !== 'undefined' && App.showToast) {
                    App.showToast('⚠️ Apple Sign In: ' + errorMsg);
                }
            }
            if (typeof window._appleSignInResolve === 'function') {
                window._appleSignInResolve({ success: false, error: errorMsg });
                window._appleSignInResolve = null;
            }
        };

        // Apple Authentication Bridge
        window.AppleAuth = {
            signIn: function() { postToNative('socialBridge', 'performAppleSignIn'); },
            isAvailable: true
        };

        // Game Center Bridge
        window.GameCenter = {
            submitScore: function(score, leaderboardId) {
                postToNative('gameCenterBridge', 'submitScore', { score: score, leaderboardId: leaderboardId || 'main_leaderboard' });
            },
            reportAchievement: function(id, percent) {
                postToNative('gameCenterBridge', 'reportAchievement', { id: id, percent: percent || 100.0 });
            },
            showDashboard: function() {
                postToNative('gameCenterBridge', 'showDashboard');
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

        // ==========================================
        // 4. Backward Compatibility Shim (for legacy game scripts)
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
            vibrate: function(type, force) {
                postToNative('hapticBridge', 'vibrate', { type: type || 'medium', force: !!force });
            },
            setHapticsEnabled: function(enabled) {
                postToNative('hapticBridge', 'setEnabled', { enabled: !!enabled });
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
                return 'ios';
            },
            getFlavor: function() {
                return 'appstore';
            },
            isDebug: function() {
                return window.BUILD_VARIANT === 'qa';
            },
            getEnvironment: function() {
                return 'ios';
            },
            ping: function() {
                return 'pong';
            }
        };

        console.log('✅ iOS Native Bridges loaded and active');
    })();
    """
}
