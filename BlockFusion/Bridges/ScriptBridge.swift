import AVFoundation
import AudioToolbox
import UIKit
import WebKit
import StoreKit

protocol ScriptBridgeDelegate: AnyObject {
    var bannerContainerView: UIView? { get }
    func openShareSheet(text: String, url: URL?)
    func openStoreReview()
    func exitApp()
    func didChangeScreen(to screen: String)
    func showLogin()
    func showDailyReward()
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
            
        case "soundBridge":
            handleSoundBridge(action: action, body: body)
            
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
            
        case "showBannerAd", "showBanner":
            if let container = delegate?.bannerContainerView ?? webView?.superview {
                AdMobManager.shared.showBannerAd(in: container)
            }
            
        case "hideBannerAd", "hideBanner":
            AdMobManager.shared.hideBannerAd()
            
        case "showInterstitialAd", "showInterstitial":
            AdMobManager.shared.showInterstitialAd()
            
        case "showRewardedAd", "showRewarded":
            AdMobManager.shared.showRewardedAd()
            
        case "logEvent":
            let name = body["name"] as? String ?? "unknown"
            let params = body["params"] as? String ?? "{}"
            print("📊 [iOS Tracking] Native Log: [\(name)] -> \(params)")
            
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
    
    // MARK: - Sound Handler
    private func handleSoundBridge(action: String, body: [String: Any]) {
        if action == "play" {
            let sound = body["sound"] as? String ?? "click"
            NativeSoundManager.shared.play(sound)
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
        } else if action == "performAppleSignIn" {
            let presentingVC = (delegate as? UIViewController) ?? webView?.window?.rootViewController ?? UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .flatMap({ $0.windows })
                .first(where: { $0.isKeyWindow })?.rootViewController
            if let vc = presentingVC {
                AppleSignInManager.shared.performAppleSignIn(from: vc, scriptBridge: self)
            }
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
        case "screenChanged":
            if let screen = body["screen"] as? String {
                delegate?.didChangeScreen(to: screen)
            }
        case "showLogin":
            delegate?.showLogin()
        case "showDailyReward":
            delegate?.showDailyReward()
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
    func evaluateJavaScript(_ script: String, completion: ((Any?, Error?) -> Void)? = nil) {
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(script) { result, error in
                if let error = error {
                    print("⚠️ JS evaluation error: \(error.localizedDescription) for script: \(script)")
                }
                completion?(result, error)
            }
        }
    }
    
    func callAsyncJavaScript(_ functionBody: String, arguments: [String: Any] = [:], completion: ((Result<Any, Error>) -> Void)? = nil) {
        DispatchQueue.main.async { [weak self] in
            if #available(iOS 14.0, *) {
                self?.webView?.callAsyncJavaScript(functionBody, arguments: arguments, in: nil, in: .page) { result in
                    switch result {
                    case .success(let val):
                        completion?(.success(val))
                    case .failure(let err):
                        print("⚠️ JS async error: \(err.localizedDescription)")
                        completion?(.failure(err))
                    }
                }
            } else {
                self?.evaluateJavaScript(functionBody) { res, err in
                    if let err = err {
                        completion?(.failure(err))
                    } else {
                        completion?(.success(res ?? ()))
                    }
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


// MARK: - Native Sound Manager
/// High-performance zero-latency native iOS sound system for game effects (AVAudioPlayer PCM)
final class NativeSoundManager: NSObject {
    static let shared = NativeSoundManager()
    
    private var soundData: [String: Data] = [:]
    private var players: [String: [AVAudioPlayer]] = [:]
    private var playerIndex: [String: Int] = [:]
    
    override private init() {
        super.init()
        setupAudioSession()
        preloadSounds()
    }
    
    func setupAudioSession() {
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
                try session.setActive(true)
            } catch {
                print("⚠️ Audio session error: \(error)")
            }
        }
    }
    
    private func preloadSounds() {
        let soundDefs: [(name: String, gen: () -> Data)] = [
            ("click", { Self.makeTone(freqStart: 523, freqEnd: 784, duration: 0.07, decayRate: 14) }),
            ("toggle_on", { Self.makeTone(freqStart: 523, freqEnd: 880, duration: 0.09, decayRate: 11) }),
            ("toggle_off", { Self.makeTone(freqStart: 659, freqEnd: 440, duration: 0.07, decayRate: 16) }),
            ("merge", { Self.makeTone(freqStart: 440, freqEnd: 659, duration: 0.08, decayRate: 12) }),
            ("mergeTier2", { Self.makeTone(freqStart: 587, freqEnd: 880, duration: 0.10, decayRate: 10) }),
            ("mergeTier3", { Self.makeTone(freqStart: 659, freqEnd: 1046, duration: 0.12, decayRate: 9) }),
            ("mergeTier4", { Self.makeTone(freqStart: 784, freqEnd: 1318, duration: 0.20, decayRate: 7) }),
            ("win", { Self.makeTone(freqStart: 523, freqEnd: 1046, duration: 0.28, decayRate: 6) }),
            ("coin", { Self.makeTone(freqStart: 1318, freqEnd: 1760, duration: 0.09, decayRate: 14) }),
            ("powerup", { Self.makeTone(freqStart: 320, freqEnd: 960, duration: 0.15, decayRate: 8) }),
            ("pop", { Self.makeTone(freqStart: 360, freqEnd: 240, duration: 0.06, decayRate: 18) })
        ]
        
        for def in soundDefs {
            let data = def.gen()
            soundData[def.name] = data
            var pool: [AVAudioPlayer] = []
            for _ in 0..<2 {
                if let player = try? AVAudioPlayer(data: data) {
                    player.prepareToPlay()
                    player.volume = 1.0
                    pool.append(player)
                }
            }
            players[def.name] = pool
            playerIndex[def.name] = 0
        }
    }
    
    func play(_ sound: String) {
        if sound != "toggle_off" {
            guard PreferencesManager.shared.soundEnabled else { return }
        }
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            guard let pool = self.players[sound], !pool.isEmpty else { return }
            let idx = self.playerIndex[sound] ?? 0
            let player = pool[idx]
            player.currentTime = 0
            player.play()
            self.playerIndex[sound] = (idx + 1) % pool.count
        }
    }
    
    // Generates valid 16-bit mono PCM WAV data in memory
    static func makeTone(freqStart: Double, freqEnd: Double, duration: Double, sampleRate: Double = 44100.0, decayRate: Double = 12.0) -> Data {
        let numSamples = Int(sampleRate * duration)
        var pcm = Data()
        pcm.reserveCapacity(numSamples * 2)
        
        var phase: Double = 0
        for i in 0..<numSamples {
            let t = Double(i) / sampleRate
            let progress = t / duration
            let currentFreq = freqStart + (freqEnd - freqStart) * progress
            let deltaPhase = 2.0 * .pi * currentFreq / sampleRate
            phase += deltaPhase
            
            // Soft sine wave with exponential decay
            let amplitude = exp(-decayRate * t)
            let raw = sin(phase) * amplitude
            let clamped = max(-1.0, min(1.0, raw))
            let sampleVal = Int16(clamped * 32760.0)
            withUnsafeBytes(of: sampleVal.littleEndian) { pcm.append(contentsOf: $0) }
        }
        
        let dataSize = UInt32(pcm.count)
        var header = Data()
        header.reserveCapacity(44)
        
        // "RIFF"
        header.append(contentsOf: [0x52, 0x49, 0x46, 0x46])
        let chunkSize = UInt32(36 + dataSize)
        withUnsafeBytes(of: chunkSize.littleEndian) { header.append(contentsOf: $0) }
        // "WAVE"
        header.append(contentsOf: [0x57, 0x41, 0x56, 0x45])
        // "fmt "
        header.append(contentsOf: [0x66, 0x6D, 0x74, 0x20])
        let subchunk1Size = UInt32(16)
        withUnsafeBytes(of: subchunk1Size.littleEndian) { header.append(contentsOf: $0) }
        let audioFormat = UInt16(1) // PCM
        withUnsafeBytes(of: audioFormat.littleEndian) { header.append(contentsOf: $0) }
        let numChannels = UInt16(1) // Mono
        withUnsafeBytes(of: numChannels.littleEndian) { header.append(contentsOf: $0) }
        let sRate = UInt32(sampleRate)
        withUnsafeBytes(of: sRate.littleEndian) { header.append(contentsOf: $0) }
        let byteRate = UInt32(sampleRate * 1 * 2)
        withUnsafeBytes(of: byteRate.littleEndian) { header.append(contentsOf: $0) }
        let blockAlign = UInt16(2)
        withUnsafeBytes(of: blockAlign.littleEndian) { header.append(contentsOf: $0) }
        let bitsPerSample = UInt16(16)
        withUnsafeBytes(of: bitsPerSample.littleEndian) { header.append(contentsOf: $0) }
        // "data"
        header.append(contentsOf: [0x64, 0x61, 0x74, 0x61])
        withUnsafeBytes(of: dataSize.littleEndian) { header.append(contentsOf: $0) }
        
        return header + pcm
    }
}
