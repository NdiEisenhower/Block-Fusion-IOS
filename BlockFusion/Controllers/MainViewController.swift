import UIKit
import WebKit
import StoreKit

final class MainViewController: UIViewController {
    
    private var webView: WKWebView!
    private let scriptBridge = ScriptBridge()
    private let preferences = PreferencesManager.shared
    
    private static let remoteGameUrl = "https://blockrush2k.kharitambe.co.za"
    
    // MARK: - Lifecycle
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 1.0)
        
        setupWebView()
        setupManagers()
        loadGame()
    }
    
    override var preferredStatusBarStyle: UIStatusBarStyle {
        return .lightContent
    }
    
    override var prefersStatusBarHidden: Bool {
        return true
    }
    
    override var prefersHomeIndicatorAutoHidden: Bool {
        return true
    }
    
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        return .portrait
    }
    
    // MARK: - Setup
    private func setupWebView() {
        let contentController = WKUserContentController()
        
        // Inject native bridge at document start
        let userScript = WKUserScript(
            source: NativeBridgeScript.scriptContent,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
        contentController.addUserScript(userScript)
        
        // Register message handlers
        contentController.add(scriptBridge, name: "adBridge")
        contentController.add(scriptBridge, name: "billingBridge")
        contentController.add(scriptBridge, name: "hapticBridge")
        contentController.add(scriptBridge, name: "socialBridge")
        contentController.add(scriptBridge, name: "appBridge")
        
        let config = WKWebViewConfiguration()
        config.userContentController = contentController
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        
        webView = WKWebView(frame: .zero, configuration: config)
        webView.backgroundColor = UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 1.0)
        webView.isOpaque = true
        webView.navigationDelegate = self
        webView.uiDelegate = self
        
        // Game UI feel: disable scroll bounce
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        
        scriptBridge.webView = webView
        scriptBridge.delegate = self
        
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }
    
    private func setupManagers() {
        AdMobManager.shared.presentingViewController = self
        AdMobManager.shared.delegate = self
        
        if #available(iOS 15.0, *) {
            StoreKitManager.shared.delegate = self
        }
    }
    
    // MARK: - Game Loading
    private func loadGame() {
        if preferences.useLocalAssets {
            // Check bundled WebAssets
            if let indexUrl = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "WebAssets") {
                let assetsDir = indexUrl.deletingLastPathComponent()
                print("📦 Loading local bundled game assets from: \(indexUrl.path)")
                webView.loadFileURL(indexUrl, allowingReadAccessTo: assetsDir)
                return
            } else if let indexUrl = Bundle.main.url(forResource: "index", withExtension: "html") {
                let assetsDir = indexUrl.deletingLastPathComponent()
                print("📦 Loading local bundled game assets (root) from: \(indexUrl.path)")
                webView.loadFileURL(indexUrl, allowingReadAccessTo: assetsDir)
                return
            }
        }
        
        // Online fallback
        let targetString = preferences.customQaUrl ?? Self.remoteGameUrl
        if let url = URL(string: targetString) {
            print("🌐 Loading remote game URL: \(url.absoluteString)")
            let request = URLRequest(url: url)
            webView.load(request)
        }
    }
    
    // MARK: - Deep Links
    func handleDeepLink(_ url: URL) {
        let route = url.host ?? url.path.replacingOccurrences(of: "/", with: "")
        let target: String
        switch route {
        case "store": target = "store"
        case "leaderboard": target = "leaderboard"
        case "daily": target = "daily"
        case "achievements": target = "achievements"
        case "settings": target = "settings"
        case "world": target = "world-select"
        default: target = "home"
        }
        
        scriptBridge.evaluateJavaScript("""
        if (typeof Navigation !== 'undefined' && typeof Navigation.navigateTo === 'function') {
            Navigation.navigateTo('\(target)');
        }
        """)
    }
}

// MARK: - WKNavigationDelegate
extension MainViewController: WKNavigationDelegate, WKUIDelegate {
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        print("✅ Game web view finished loading")
        
        // Notify cached prices to JS
        if #available(iOS 15.0, *) {
            let prices = StoreKitManager.shared.formattedPrices
            if !prices.isEmpty {
                scriptBridge.notifyPricesLoaded(prices: prices)
            }
        }
    }
    
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        
        // Local files, scheme handlers, or internal domain
        if url.isFileURL ||
           url.host == "blockrush2k.kharitambe.co.za" ||
           url.scheme == "local" ||
           url.absoluteString.hasPrefix("https://games-7b902") {
            decisionHandler(.allow)
            return
        }
        
        // External links open in default mobile Safari
        UIApplication.shared.open(url, options: [:], completionHandler: nil)
        decisionHandler(.cancel)
    }
}

// MARK: - StoreKitEventListener
extension MainViewController: StoreKitEventListener {
    func onPurchaseStarted(productId: String) {
        scriptBridge.notifyPurchaseStarted(productId: productId)
    }
    
    func onPurchaseSuccess(productId: String, orderId: String) {
        scriptBridge.notifyPurchaseSuccess(productId: productId, orderId: orderId)
    }
    
    func onPurchaseFailed(errorMessage: String) {
        scriptBridge.notifyPurchaseFailed(errorMessage: errorMessage)
    }
    
    func onPurchasesRestored(restoredProducts: [String]) {
        scriptBridge.notifyPurchasesRestored(products: restoredProducts)
    }
    
    func onPricesLoaded(prices: [String: String]) {
        scriptBridge.notifyPricesLoaded(prices: prices)
    }
}

// MARK: - AdMobEventListener
extension MainViewController: AdMobEventListener {
    func onAdBridgeReady() {
        scriptBridge.notifyAdBridgeReady()
    }
    
    func onRewardedAdCompleted(success: Bool) {
        scriptBridge.notifyRewardedCompleted(success: success)
    }
    
    func onInterstitialFailed() {
        scriptBridge.notifyInterstitialFailed()
    }
    
    func onBannerVisibilityChanged(visible: Bool, height: CGFloat) {
        // Adjust safe area or padding if necessary
    }
}

// MARK: - ScriptBridgeDelegate
extension MainViewController: ScriptBridgeDelegate {
    func openShareSheet(text: String, url: URL?) {
        var items: [Any] = [text]
        if let u = url { items.append(u) }
        
        let activityVC = UIActivityViewController(activityItems: items, applicationActivities: nil)
        if let popover = activityVC.popoverPresentationController {
            popover.sourceView = view
            popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 0, height: 0)
            popover.permittedArrowDirections = []
        }
        present(activityVC, animated: true)
    }
    
    func openStoreReview() {
        if #available(iOS 14.0, *), let scene = view.window?.windowScene {
            SKStoreReviewController.requestReview(in: scene)
        } else {
            SKStoreReviewController.requestReview()
        }
    }
    
    func exitApp() {
        UIApplication.shared.perform(#selector(NSXPCConnection.suspend))
    }
}
