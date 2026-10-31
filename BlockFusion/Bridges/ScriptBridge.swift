import WebKit
import StoreKit

protocol ScriptBridgeDelegate: AnyObject {
    func openShareSheet(text: String, url: URL?)
    func openStoreReview()
    func exitApp()
}

/// Dispatches native commands between JavaScript and iOS
final class ScriptBridge: NSObject, WKScriptMessageHandler {
    weak var webView: WKWebView?
    weak var delegate: ScriptBridgeDelegate?
    
    private let preferences = PreferencesManager.shared
    
    // MARK: - Message Receiver
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else {
            return
        }
        
        switch message.name {
        case "adBridge":
            handleAdBridge(action: action, body: body)
            
        case "billingBridge":
            handleBillingBridge(action: action, body: body)
            
        case "hapticBridge":
            handleHapticBridge(action: action, body: body)
            
        case "socialBridge":
            handleSocialBridge(action: action, body: body)
            
        case "appBridge":
            handleAppBridge(action: action, body: body)
            
        case "gameCenterBridge":
            handleGameCenterBridge(action: action, body: body)
            
        default:
            break
        }
    }
    
    // MARK: - Ad Handler
    private func handleAdBridge(action: String, body: [String: Any]) {
        switch action {
        case "initAds":
            let banner = body["bannerId"] as? String
            let inter = body["interId"] as? String
            let reward = body["rewardedId"] as? String
            AdMobManager.shared.initialize(bannerId: banner, interId: inter, rewardedId: reward)
            
        case "showBannerAd":
            if let view = webView?.superview {
                AdMobManager.shared.showBannerAd(in: view)
            }
            
        case "hideBannerAd":
            AdMobManager.shared.hideBannerAd()
            
        case "showInterstitialAd":
            AdMobManager.shared.showInterstitialAd()
            
        case "showRewardedAd":
            AdMobManager.shared.showRewardedAd()
            
        default:
            break
        }
    }
    
    // MARK: - Billing Handler
    private func handleBillingBridge(action: String, body: [String: Any]) {
        if #available(iOS 15.0, *) {
            switch action {
            case "launchPurchase":
                if let productId = body["productId"] as? String {
                    StoreKitManager.shared.launchPurchase(productId: productId)
                }
                
            case "restorePurchases":
                StoreKitManager.shared.restorePurchases()
                
            case "setActiveTheme":
                if let themeId = body["themeId"] as? String {
                    preferences.activeTheme = themeId
                }
                
            default:
                break
            }
        }
    }
    
    // MARK: - Haptic Handler
    private func handleHapticBridge(action: String, body: [String: Any]) {
        if action == "vibrate" {
            let type = body["type"] as? String ?? "medium"
            switch type {
            case "light":
                HapticManager.shared.impact(style: .light)
            case "heavy":
                HapticManager.shared.impact(style: .heavy)
            case "selection":
                HapticManager.shared.selection()
            case "success":
                HapticManager.shared.notification(type: .success)
            case "error":
                HapticManager.shared.notification(type: .error)
            case "warning":
                HapticManager.shared.notification(type: .warning)
            default:
                HapticManager.shared.impact(style: .medium)
            }
        }
    }
    
    // MARK: - Social Handler
    private func handleSocialBridge(action: String, body: [String: Any]) {
        if action == "shareReferralCode" {
            let code = body["code"] as? String ?? ""
            let shareUrlStr = body["shareUrl"] as? String ?? "https://blockrush2k.kharitambe.co.za"
            let text = "🎮 Join me on Block Rush 2K! Use my referral code \(code) to get 500 BONUS COINS! Play here:"
            let url = URL(string: shareUrlStr)
            delegate?.openShareSheet(text: text, url: url)
        } else if action == "share" {
            let text = body["text"] as? String ?? "Play Block Rush 2K!"
            let urlStr = body["url"] as? String
            let url = urlStr.flatMap { URL(string: $0) }
            delegate?.openShareSheet(text: text, url: url)
        }
    }
    
    // MARK: - App Handler
    private func handleAppBridge(action: String, body: [String: Any]) {
        switch action {
        case "openStoreReview":
            delegate?.openStoreReview()
        case "exitApp":
            delegate?.exitApp()
        default:
            break
        }
    }
    
    // MARK: - Game Center Handler
    private func handleGameCenterBridge(action: String, body: [String: Any]) {
        switch action {
        case "submitScore":
            if let score = body["score"] as? Int {
                let leaderboardId = body["leaderboardId"] as? String ?? "main_leaderboard"
                GameKitManager.shared.submitScore(score, leaderboardId: leaderboardId)
            }
        case "reportAchievement":
            if let id = body["id"] as? String {
                let percent = body["percent"] as? Double ?? 100.0
                GameKitManager.shared.reportAchievement(id: id, percentComplete: percent)
            }
        case "showDashboard":
            GameKitManager.shared.showGameCenterDashboard()
        default:
            break
        }
    }
    
    // MARK: - JavaScript Evaluation
    func evaluateJavaScript(_ script: String) {
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(script) { _, error in
                if let error = error {
                    print("⚠️ JS evaluation error: \(error.localizedDescription) for script: \(script)")
                }
            }
        }
    }
    
    // MARK: - Dispatch to JavaScript
    func notifyAdBridgeReady() {
        evaluateJavaScript("window.onAdBridgeReady && window.onAdBridgeReady();")
    }
    
    func notifyRewardedCompleted(success: Bool) {
        evaluateJavaScript("window.onRewardedAdCompleted && window.onRewardedAdCompleted(\(success ? "true" : "false"));")
    }
    
    func notifyInterstitialFailed() {
        evaluateJavaScript("window.onInterstitialFailed && window.onInterstitialFailed();")
    }
    
    func notifyPurchaseStarted(productId: String) {
        evaluateJavaScript("""
        window.onPurchaseStarted && window.onPurchaseStarted('\(productId)');
        window.onPurchaseStateChanged && window.onPurchaseStateChanged(true, '\(productId)');
        """)
    }
    
    func notifyPurchaseSuccess(productId: String, orderId: String) {
        evaluateJavaScript("""
        window._isAdsRemoved = \(preferences.isAdsRemoved ? "true" : "false");
        window._isThemePackOwned = \(preferences.isThemePackOwned ? "true" : "false");
        window.onPurchaseStateChanged && window.onPurchaseStateChanged(false, '\(productId)');
        window.onPurchaseSuccess && window.onPurchaseSuccess('\(productId)', '\(orderId)');
        """)
    }
    
    func notifyPurchaseFailed(errorMessage: String) {
        let escaped = errorMessage.replacingOccurrences(of: "'", with: "\\'")
        evaluateJavaScript("""
        window.onPurchaseStateChanged && window.onPurchaseStateChanged(false, null);
        window.onPurchaseFailed && window.onPurchaseFailed('\(escaped)');
        """)
    }
    
    func notifyPurchasesRestored(products: [String]) {
        guard let jsonData = try? JSONSerialization.data(withJSONObject: products, options: []),
              let jsonString = String(data: jsonData, encoding: .utf8) else {
            return
        }
        evaluateJavaScript("""
        window._isAdsRemoved = \(preferences.isAdsRemoved ? "true" : "false");
        window._isThemePackOwned = \(preferences.isThemePackOwned ? "true" : "false");
        window._purchasedProducts = \(jsonString);
        window.onPurchasesRestored && window.onPurchasesRestored(\(jsonString));
        """)
    }
    
    func notifyPricesLoaded(prices: [String: String]) {
        guard let jsonData = try? JSONSerialization.data(withJSONObject: prices, options: []),
              let jsonString = String(data: jsonData, encoding: .utf8) else {
            return
        }
        evaluateJavaScript("""
        window._cachedPrices = \(jsonString);
        window.onPricesLoaded && window.onPricesLoaded(\(jsonString));
        """)
    }
}

