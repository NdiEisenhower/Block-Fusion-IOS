import UIKit
import AppTrackingTransparency

#if canImport(GoogleMobileAds)
import GoogleMobileAds
#endif

protocol AdMobEventListener: AnyObject {
    func onAdBridgeReady()
    func onRewardedAdCompleted(success: Bool)
    func onInterstitialFailed()
    func onBannerVisibilityChanged(visible: Bool, height: CGFloat)
}

/// Google Mobile Ads (AdMob) Manager with full iOS 15/16/17/18+ support
final class AdMobManager: NSObject {
    static let shared = AdMobManager()
    
    // Ad Unit IDs
    #if DEBUG
    // Google Official Test Ad Unit IDs for iOS
    private var bannerAdUnitId = "ca-app-pub-3940256099942544/2934735716"
    private var interstitialAdUnitId = "ca-app-pub-3940256099942544/4411468910"
    private var rewardedAdUnitId = "ca-app-pub-3940256099942544/1712485313"
    #else
    // Production IDs (Fallback to test if not configured)
    private var bannerAdUnitId = "ca-app-pub-4255859216659691/6387045959"
    private var interstitialAdUnitId = "ca-app-pub-4255859216659691/7221704767"
    private var rewardedAdUnitId = "ca-app-pub-4255859216659691/3713704595"
    #endif
    
    weak var delegate: AdMobEventListener?
    weak var presentingViewController: UIViewController?
    
    private let preferences = PreferencesManager.shared
    private var isInitialized = false
    private var isBannerVisible = false
    
    #if canImport(GoogleMobileAds)
    private var bannerView: GADBannerView?
    private var interstitialAd: GADInterstitialAd?
    private var rewardedAd: GADRewardedAd?
    private var isInterstitialLoading = false
    private var isRewardedLoading = false
    #endif
    
    private override init() {
        super.init()
    }
    
    // MARK: - Initialization
    func initialize(bannerId: String? = nil, interId: String? = nil, rewardedId: String? = nil) {
        if let b = bannerId, !b.isEmpty { bannerAdUnitId = b }
        if let i = interId, !i.isEmpty { interstitialAdUnitId = i }
        if let r = rewardedId, !r.isEmpty { rewardedAdUnitId = r }
        
        AppTrackingManager.shared.requestAuthorization { [weak self] _ in
            self?.startSdk()
        }
    }
    
    private func startSdk() {
        #if canImport(GoogleMobileAds)
        GADMobileAds.sharedInstance().start { [weak self] status in
            guard let self = self else { return }
            self.isInitialized = true
            print("🚀 AdMob initialized on iOS")
            
            DispatchQueue.main.async {
                self.preloadAds()
                self.delegate?.onAdBridgeReady()
            }
        }
        #else
        isInitialized = true
        print("ℹ️ Mock AdMob initialized (GoogleMobileAds framework not linked)")
        DispatchQueue.main.async {
            self.delegate?.onAdBridgeReady()
        }
        #endif
    }
    
    private func preloadAds() {
        guard !preferences.isAdsRemoved else { return }
        loadInterstitial()
        loadRewarded()
    }
    
    // MARK: - Banner Ads
    func showBannerAd(in containerView: UIView) {
        guard !preferences.isAdsRemoved else {
            hideBannerAd()
            return
        }
        
        #if canImport(GoogleMobileAds)
        guard let vc = presentingViewController else { return }
        
        if bannerView == nil {
            let frame = CGRect(x: 0, y: 0, width: containerView.bounds.width, height: 50)
            let adSize = GADCurrentOrientationAnchoredAdaptiveBannerAdSizeWithWidth(containerView.bounds.width)
            let banner = GADBannerView(adSize: adSize)
            banner.adUnitID = bannerAdUnitId
            banner.rootViewController = vc
            banner.delegate = self
            banner.translatesAutoresizingMaskIntoConstraints = false
            containerView.addSubview(banner)
            
            NSLayoutConstraint.activate([
                banner.bottomAnchor.constraint(equalTo: containerView.safeAreaLayoutGuide.bottomAnchor),
                banner.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
                banner.widthAnchor.constraint(equalToConstant: adSize.size.width),
                banner.heightAnchor.constraint(equalToConstant: adSize.size.height)
            ])
            self.bannerView = banner
        }
        
        bannerView?.isHidden = false
        bannerView?.load(GADRequest())
        isBannerVisible = true
        delegate?.onBannerVisibilityChanged(visible: true, height: 50)
        #else
        print("📱 [Mock] Banner ad shown")
        isBannerVisible = true
        delegate?.onBannerVisibilityChanged(visible: true, height: 50)
        #endif
    }
    
    func hideBannerAd() {
        #if canImport(GoogleMobileAds)
        bannerView?.isHidden = true
        #endif
        isBannerVisible = false
        delegate?.onBannerVisibilityChanged(visible: false, height: 0)
    }
    
    // MARK: - Interstitial Ads
    func loadInterstitial() {
        guard !preferences.isAdsRemoved else { return }
        #if canImport(GoogleMobileAds)
        guard !isInterstitialLoading, interstitialAd == nil else { return }
        isInterstitialLoading = true
        
        let request = GADRequest()
        GADInterstitialAd.load(withAdUnitID: interstitialAdUnitId, request: request) { [weak self] ad, error in
            guard let self = self else { return }
            self.isInterstitialLoading = false
            if let error = error {
                print("❌ Failed to load interstitial ad: \(error.localizedDescription)")
                self.interstitialAd = nil
                return
            }
            self.interstitialAd = ad
            self.interstitialAd?.fullScreenContentDelegate = self
            print("✅ Interstitial ad loaded")
        }
        #endif
    }
    
    func showInterstitialAd() {
        guard !preferences.isAdsRemoved else {
            delegate?.onInterstitialFailed()
            return
        }
        
        #if canImport(GoogleMobileAds)
        guard let vc = presentingViewController, let ad = interstitialAd else {
            print("⚠️ Interstitial not ready, reloading...")
            loadInterstitial()
            delegate?.onInterstitialFailed()
            return
        }
        
        ad.present(fromRootViewController: vc)
        #else
        print("📱 [Mock] Interstitial ad presented")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            self.delegate?.onInterstitialFailed()
        }
        #endif
    }
    
    // MARK: - Rewarded Ads
    func loadRewarded() {
        #if canImport(GoogleMobileAds)
        guard !isRewardedLoading, rewardedAd == nil else { return }
        isRewardedLoading = true
        
        let request = GADRequest()
        GADRewardedAd.load(withAdUnitID: rewardedAdUnitId, request: request) { [weak self] ad, error in
            guard let self = self else { return }
            self.isRewardedLoading = false
            if let error = error {
                print("❌ Failed to load rewarded ad: \(error.localizedDescription)")
                self.rewardedAd = nil
                return
            }
            self.rewardedAd = ad
            self.rewardedAd?.fullScreenContentDelegate = self
            print("✅ Rewarded ad loaded")
        }
        #endif
    }
    
    func showRewardedAd(completion: ((Bool) -> Void)? = nil) {
        #if canImport(GoogleMobileAds)
        guard let vc = presentingViewController, let ad = rewardedAd else {
            print("⚠️ Rewarded ad not ready, loading...")
            loadRewarded()
            completion?(false)
            delegate?.onRewardedAdCompleted(success: false)
            return
        }
        
        ad.present(fromRootViewController: vc) { [weak self] in
            print("🎁 User earned rewarded reward")
            HapticManager.shared.notification(type: .success)
            completion?(true)
            self?.delegate?.onRewardedAdCompleted(success: true)
        }
        #else
        print("📱 [Mock] Rewarded ad presented - granting mock reward")
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            HapticManager.shared.notification(type: .success)
            completion?(true)
            self.delegate?.onRewardedAdCompleted(success: true)
        }
        #endif
    }
}

// MARK: - GAD Delegates
#if canImport(GoogleMobileAds)
extension AdMobManager: GADBannerViewDelegate {
    func bannerViewDidReceiveAd(_ bannerView: GADBannerView) {
        print("✅ Banner ad received")
        delegate?.onBannerVisibilityChanged(visible: true, height: bannerView.bounds.height)
    }
    
    func bannerView(_ bannerView: GADBannerView, didFailToReceiveAdWithError error: Error) {
        print("❌ Banner ad failed: \(error.localizedDescription)")
    }
}

extension AdMobManager: GADFullScreenContentDelegate {
    func adDidDismissFullScreenContent(_ ad: GADFullScreenPresentingAd) {
        print("📺 Ad dismissed")
        if ad is GADInterstitialAd {
            interstitialAd = nil
            loadInterstitial()
        } else if ad is GADRewardedAd {
            rewardedAd = nil
            loadRewarded()
        }
    }
    
    func ad(_ ad: GADFullScreenPresentingAd, didFailToPresentFullScreenContentWithError error: Error) {
        print("❌ Ad presentation failed: \(error.localizedDescription)")
        if ad is GADInterstitialAd {
            interstitialAd = nil
            loadInterstitial()
            delegate?.onInterstitialFailed()
        } else if ad is GADRewardedAd {
            rewardedAd = nil
            loadRewarded()
            delegate?.onRewardedAdCompleted(success: false)
        }
    }
}
#endif

