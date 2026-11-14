import UIKit
import WebKit
import StoreKit
import GameKit
import AuthenticationServices

final class MainViewController: UIViewController {
    
    private var topBar: NativeTopBar!
    private var bottomBar: NativeBottomBar!
    private var webView: WKWebView!
    private let scriptBridge = ScriptBridge()
    private let preferences = PreferencesManager.shared
    
    private var topBarHeightConstraint: NSLayoutConstraint!
    private var bottomBarHeightConstraint: NSLayoutConstraint!
    private var currentScreen: String = "home"
    
    private static let remoteGameUrl = "https://blockrush2k.kharitambe.co.za"
    private var currentBannerHeight: CGFloat = 0
    
    // MARK: - Safe Area Handling
    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        updateSafeAreaInsets()
    }
    
    private func updateSafeAreaInsets() {
        let isGame = (currentScreen == "game")
        // webView.topAnchor is already constrained beneath topBar (which collapses to safeAreaLayoutGuide.topAnchor in game mode).
        // Adding another safeAreaInsets.top (~59px on Island devices) caused a huge dead gap.
        // We use 4pt in game mode for minimal clearance, and 0pt elsewhere.
        let top: CGFloat = isGame ? 4.0 : 0.0
        let bottom: CGFloat = isGame ? (view.safeAreaInsets.bottom > 0 ? max(view.safeAreaInsets.bottom, 6.0) : 0.0) : 0.0
        let js = """
        (function() {
            var el = document.getElementById('ios-safe-area-rules');
            if (!el) {
                el = document.createElement('style');
                el.id = 'ios-safe-area-rules';
                if (document.head) document.head.appendChild(el);
            }
            if (el) {
                el.textContent = `
                    :root {
                        --safe-area-top: \(top)px !important;
                        --safe-area-bottom: \(bottom)px !important;
                    }
                    #app {
                        padding-top: \(top)px !important;
                        padding-bottom: \(bottom)px !important;
                        box-sizing: border-box !important;
                    }
                `;
            }
        })();
        """
        webView?.evaluateJavaScript(js, completionHandler: nil)
    }

    // MARK: - Lifecycle
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 1.0)
        
        setupTopBar()
        setupBottomBar()
        setupWebView()
        setupManagers()
        loadGame()
    }
    
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // Ensure bottom navigation bar stays above webview and ads
        view.bringSubviewToFront(bottomBar)
    }
    
    override var preferredStatusBarStyle: UIStatusBarStyle {
        return .lightContent
    }
    
    // MARK: - View Setup
    private func setupTopBar() {
        topBar = NativeTopBar()
        topBar.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(topBar)
        
        topBar.onGameCenterTapped = { [weak self] in
            HapticManager.shared.selection()
            GameKitManager.shared.showGameCenterDashboard()
        }
        
        topBar.onAudioTapped = { [weak self] in
            HapticManager.shared.selection()
            guard let self = self else { return }
            let enabled = !self.preferences.soundEnabled
            self.preferences.soundEnabled = enabled
            self.topBar.setAudioEnabled(enabled)
            self.scriptBridge.evaluateJavaScript("""
            if (typeof SoundManager !== 'undefined') {
                SoundManager.enabled = \(enabled);
            }
            """)
        }
        
        topBar.onSettingsTapped = { [weak self] in
            HapticManager.shared.selection()
            self?.navigateToScreen("settings")
        }
        
        topBarHeightConstraint = topBar.heightAnchor.constraint(equalToConstant: 44)
        NSLayoutConstraint.activate([
            topBar.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            topBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            topBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            topBarHeightConstraint
        ])
    }
    
    private func setupBottomBar() {
        bottomBar = NativeBottomBar()
        bottomBar.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(bottomBar)
        
        bottomBar.onTabSelected = { [weak self] tab in
            guard let self = self else { return }
            HapticManager.shared.selection()
            print("🔘 Native bottom bar tab selected: \(tab.id) -> \(tab.targetScreen)")
            
            if tab.id == "daily" {
                self.showDailyReward()
                return
            }
            
            if tab.id == "ranks" {
                // Check if user is signed in
                self.scriptBridge.evaluateJavaScript("""
                (function() {
                    return !!(typeof FirebaseService !== 'undefined' && FirebaseService.currentUser && !FirebaseService.currentUser.isAnonymous);
                })();
                """) { [weak self] result, _ in
                    let isSignedIn = (result as? Bool) ?? false
                    if !isSignedIn {
                        self?.showLogin()
                    } else {
                        self?.navigateToScreen("leaderboard")
                    }
                }
                return
            }
            
            self.navigateToScreen(tab.targetScreen)
        }
        
        bottomBarHeightConstraint = bottomBar.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -58)
        NSLayoutConstraint.activate([
            bottomBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bottomBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bottomBar.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            bottomBarHeightConstraint
        ])
    }
    
    private func setupWebView() {
        let contentController = WKUserContentController()
        
        let userScript = WKUserScript(
            source: NativeBridgeScript.scriptContent,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
        contentController.addUserScript(userScript)
        
        contentController.add(scriptBridge, name: "adBridge")
        contentController.add(scriptBridge, name: "billingBridge")
        contentController.add(scriptBridge, name: "hapticBridge")
        contentController.add(scriptBridge, name: "socialBridge")
        contentController.add(scriptBridge, name: "appBridge")
        contentController.add(scriptBridge, name: "gameCenterBridge")
        
        let config = WKWebViewConfiguration()
        config.userContentController = contentController
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 1.0)
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        
        scriptBridge.webView = webView
        scriptBridge.delegate = self
        
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: topBar.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: bottomBar.topAnchor)
        ])
    }
    
    private func setupManagers() {
        AdMobManager.shared.presentingViewController = self
        AdMobManager.shared.delegate = self
        AdMobManager.shared.initialize()
        
        GameKitManager.shared.presentingViewController = self
        GameKitManager.shared.authenticateLocalPlayer()
        
        if #available(iOS 15.0, *) {
            StoreKitManager.shared.delegate = self
        }
    }
    
    // MARK: - Game Loading
    private func loadGame() {
        if preferences.useLocalAssets {
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
        
        let targetString = preferences.customQaUrl ?? Self.remoteGameUrl
        if let url = URL(string: targetString) {
            print("🌐 Loading game from URL: \(url.absoluteString)")
            var request = URLRequest(url: url)
            request.cachePolicy = .returnCacheDataElseLoad
            webView.load(request)
        }
    }
    
    func handleDeepLink(_ url: URL) {
        let host = url.host?.lowercased() ?? ""
        print("🔗 Deep link received: \(url.absoluteString)")
        if host == "leaderboard" || host == "ranks" {
            navigateToScreen("leaderboard")
        } else if host == "daily" {
            showDailyReward()
        } else if host == "store" || host == "shop" {
            navigateToScreen("store")
        }
    }
    
    private func navigateToScreen(_ screenId: String) {
        let js = """
        (function() {
            try {
                if (typeof Navigation !== 'undefined' && Navigation.navigateTo) {
                    Navigation.navigateTo('\(screenId)');
                } else if (typeof window.Navigation !== 'undefined') {
                    window.Navigation.navigateTo('\(screenId)');
                } else {
                    var target = document.getElementById('screen-\(screenId)');
                    if (target) {
                        document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
                        target.classList.add('active');
                    }
                }
            } catch(e) {
                console.error('Tab navigation error:', e);
            }
        })();
        """
        scriptBridge.evaluateJavaScript(js)
    }
}

// MARK: - WKNavigationDelegate
extension MainViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        print("✅ Web content finished loading")
        updateSafeAreaInsets()
        let sound = preferences.soundEnabled
        topBar.setAudioEnabled(sound)
    }
    
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        print("❌ Web view failed loading: \(error.localizedDescription)")
    }
    
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url {
            let scheme = url.scheme?.lowercased() ?? ""
            if scheme == "tel" || scheme == "mailto" || scheme == "sms" {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
                decisionHandler(.cancel)
                return
            }
        }
        decisionHandler(.allow)
    }
}

// MARK: - StoreKit Delegate
extension MainViewController: StoreKitEventListener {
    func onPurchaseStarted(productId: String) {
        print("🛒 Purchase started for: \(productId)")
    }
    
    func onPurchaseSuccess(productId: String, orderId: String) {
        HapticManager.shared.notification(type: .success)
        scriptBridge.evaluateJavaScript("""
        (function() {
            if (typeof window._purchasedProducts !== 'undefined') {
                window._purchasedProducts.push('\(productId)');
            }
            if ('\(productId)'.indexOf('remove_ads') !== -1) {
                window._isAdsRemoved = true;
            }
            if ('\(productId)'.indexOf('themes') !== -1) {
                window._isThemePackOwned = true;
            }
            if (typeof Store !== 'undefined' && typeof Store.handlePurchaseSuccess === 'function') {
                Store.handlePurchaseSuccess('\(productId)');
            }
        })();
        """)
    }
    
    func onPurchaseFailed(errorMessage: String) {
        HapticManager.shared.notification(type: .error)
        scriptBridge.evaluateJavaScript("""
        if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
            App.showToast('Purchase canceled or failed: \(errorMessage)');
        }
        """)
    }
    
    func onPurchasesRestored(restoredProducts: [String]) {
        HapticManager.shared.notification(type: .success)
        scriptBridge.evaluateJavaScript("""
        if (typeof App !== 'undefined' && typeof App.showToast === 'function') {
            App.showToast('✅ Purchases successfully restored!');
        }
        """)
    }
    
    func onPricesLoaded(prices: [String: String]) {
        if let data = try? JSONSerialization.data(withJSONObject: prices),
           let json = String(data: data, encoding: .utf8) {
            scriptBridge.evaluateJavaScript("window._cachedPrices = \(json);")
        }
    }
}

// MARK: - AdMobEventListener
extension MainViewController: AdMobEventListener {
    func onAdBridgeReady() {
        print("⚡ AdMob Bridge ready for presentation")
    }
    
    func onRewardedAdCompleted(success: Bool) {
        HapticManager.shared.notification(type: success ? .success : .warning)
        scriptBridge.evaluateJavaScript("""
        if (typeof window._rewardCallback === 'function') {
            window._rewardCallback(\(success));
            window._rewardCallback = null;
        }
        """)
    }
    
    func onInterstitialFailed() {
        print("⚠️ Native interstitial failed to present")
    }
    
    func onBannerVisibilityChanged(visible: Bool, height: CGFloat) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.currentBannerHeight = visible ? height : 0
            self.view.bringSubviewToFront(self.bottomBar)
            self.updateSafeAreaInsets()
        }
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
    
    func didChangeScreen(to screen: String) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.currentScreen = screen
            let isGame = (screen == "game")
            
            if !isGame {
                self.bottomBar.isHidden = false
                self.topBar.isHidden = false
                self.view.bringSubviewToFront(self.bottomBar)
                AdMobManager.shared.hideBannerAd()
            }
            self.bottomBar.isUserInteractionEnabled = !isGame
            
            UIView.animate(withDuration: 0.22, delay: 0, options: [.curveEaseInOut], animations: {
                self.topBar.alpha = isGame ? 0.0 : 1.0
                self.topBarHeightConstraint.constant = isGame ? 0 : 44
                
                self.bottomBar.alpha = isGame ? 0.0 : 1.0
                self.bottomBarHeightConstraint.constant = isGame ? 0 : -58
                
                self.view.layoutIfNeeded()
            }, completion: { _ in
                if isGame {
                    self.bottomBar.isHidden = true
                    self.topBar.isHidden = true
                } else {
                    self.view.bringSubviewToFront(self.bottomBar)
                }
            })
            
            if !isGame {
                self.bottomBar.selectTab(forScreen: screen)
            }
            self.updateSafeAreaInsets()
        }
    }
    
    func showLogin() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let authVC = NativeAuthViewController()
            authVC.scriptBridge = self.scriptBridge
            authVC.onAuthSuccess = { [weak self] in
                self?.navigateToScreen("leaderboard")
            }
            let nav = UINavigationController(rootViewController: authVC)
            nav.modalPresentationStyle = .formSheet
            if #available(iOS 15.0, *) {
                if let sheet = nav.sheetPresentationController {
                    sheet.detents = [.large()]
                    sheet.prefersGrabberVisible = true
                }
            }
            self.present(nav, animated: true)
        }
    }
    
    func showDailyReward() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            let dailyVC = NativeDailyRewardViewController()
            dailyVC.scriptBridge = self.scriptBridge
            dailyVC.onClaimReward = { [weak self] amount in
                self?.scriptBridge.evaluateJavaScript("""
                (function() {
                    try {
                        if (typeof App !== 'undefined') {
                            if (App.addCoins) App.addCoins(\(amount));
                            App.state.dailyChallengeDone = true;
                            if (App.saveState) App.saveState();
                            if (App.updateAllCoinDisplays) App.updateAllCoinDisplays();
                            if (App.showToast) App.showToast('🎉 Claimed +\(amount) Daily Coins!');
                        }
                    } catch(e) {
                        console.error('Daily reward claim sync error:', e);
                    }
                })();
                """)
            }
            dailyVC.modalPresentationStyle = .overFullScreen
            dailyVC.modalTransitionStyle = .crossDissolve
            self.present(dailyVC, animated: true)
        }
    }
}

// MARK: - Native Top Bar UI
final class NativeTopBar: UIView {
    let titleLabel = UILabel()
    let gameCenterButton = UIButton(type: .system)
    let audioButton = UIButton(type: .system)
    let settingsButton = UIButton(type: .system)
    
    var onGameCenterTapped: (() -> Void)?
    var onAudioTapped: (() -> Void)?
    var onSettingsTapped: (() -> Void)?
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupUI()
    }
    
    private func setupUI() {
        backgroundColor = UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 0.98)
        
        let bottomBorder = UIView()
        bottomBorder.backgroundColor = UIColor(white: 1.0, alpha: 0.08)
        bottomBorder.translatesAutoresizingMaskIntoConstraints = false
        addSubview(bottomBorder)
        
        titleLabel.text = "BLOCK RUSH"
        titleLabel.font = UIFont.systemFont(ofSize: 17, weight: .black)
        titleLabel.textColor = .white
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(titleLabel)
        
        let proBadge = UILabel()
        proBadge.text = " 2K "
        proBadge.font = UIFont.systemFont(ofSize: 10, weight: .heavy)
        proBadge.textColor = UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 1.0)
        proBadge.backgroundColor = UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 1.0)
        proBadge.layer.cornerRadius = 4
        proBadge.layer.masksToBounds = true
        proBadge.translatesAutoresizingMaskIntoConstraints = false
        addSubview(proBadge)
        
        let buttonsStack = UIStackView()
        buttonsStack.axis = .horizontal
        buttonsStack.spacing = 14
        buttonsStack.alignment = .center
        buttonsStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(buttonsStack)
        
        configureButton(gameCenterButton, symbolName: "trophy.circle.fill", tintColor: UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 1.0))
        gameCenterButton.addTarget(self, action: #selector(gcTapped), for: .touchUpInside)
        buttonsStack.addArrangedSubview(gameCenterButton)
        
        configureButton(audioButton, symbolName: "speaker.wave.2.fill", tintColor: UIColor(red: 56/255, green: 189/255, blue: 248/255, alpha: 1.0))
        audioButton.addTarget(self, action: #selector(soundTapped), for: .touchUpInside)
        buttonsStack.addArrangedSubview(audioButton)
        
        configureButton(settingsButton, symbolName: "gearshape.fill", tintColor: UIColor(red: 148/255, green: 163/255, blue: 184/255, alpha: 1.0))
        settingsButton.addTarget(self, action: #selector(settingsTapped), for: .touchUpInside)
        buttonsStack.addArrangedSubview(settingsButton)
        
        NSLayoutConstraint.activate([
            bottomBorder.leadingAnchor.constraint(equalTo: leadingAnchor),
            bottomBorder.trailingAnchor.constraint(equalTo: trailingAnchor),
            bottomBorder.bottomAnchor.constraint(equalTo: bottomAnchor),
            bottomBorder.heightAnchor.constraint(equalToConstant: 0.5),
            
            titleLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            titleLabel.centerYAnchor.constraint(equalTo: centerYAnchor),
            
            proBadge.leadingAnchor.constraint(equalTo: titleLabel.trailingAnchor, constant: 6),
            proBadge.centerYAnchor.constraint(equalTo: centerYAnchor),
            proBadge.heightAnchor.constraint(equalToConstant: 16),
            
            buttonsStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            buttonsStack.centerYAnchor.constraint(equalTo: centerYAnchor)
        ])
    }
    
    private func configureButton(_ button: UIButton, symbolName: String, tintColor: UIColor) {
        let config = UIImage.SymbolConfiguration(pointSize: 18, weight: .semibold)
        button.setImage(UIImage(systemName: symbolName, withConfiguration: config), for: .normal)
        button.tintColor = tintColor
        button.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            button.widthAnchor.constraint(equalToConstant: 32),
            button.heightAnchor.constraint(equalToConstant: 32)
        ])
    }
    
    func setAudioEnabled(_ enabled: Bool) {
        let name = enabled ? "speaker.wave.2.fill" : "speaker.slash.fill"
        let config = UIImage.SymbolConfiguration(pointSize: 18, weight: .semibold)
        audioButton.setImage(UIImage(systemName: name, withConfiguration: config), for: .normal)
        audioButton.tintColor = enabled ? UIColor(red: 56/255, green: 189/255, blue: 248/255, alpha: 1.0) : UIColor(red: 148/255, green: 163/255, blue: 184/255, alpha: 1.0)
    }
    
    @objc private func gcTapped() { onGameCenterTapped?() }
    @objc private func soundTapped() { onAudioTapped?() }
    @objc private func settingsTapped() { onSettingsTapped?() }
}

// MARK: - Native Bottom Navigation Bar UI
final class NativeBottomBar: UIView {
    
    struct TabItem {
        let id: String
        let title: String
        let symbolName: String
        let targetScreen: String
    }
    
    private let tabs: [TabItem] = [
        TabItem(id: "play", title: "Play", symbolName: "gamecontroller.fill", targetScreen: "home"),
        TabItem(id: "worlds", title: "Worlds", symbolName: "map.fill", targetScreen: "world-select"),
        TabItem(id: "daily", title: "Daily", symbolName: "calendar.badge.clock", targetScreen: "daily"),
        TabItem(id: "ranks", title: "Rankings", symbolName: "trophy.fill", targetScreen: "leaderboard"),
        TabItem(id: "shop", title: "Shop", symbolName: "bag.fill", targetScreen: "store")
    ]
    
    var onTabSelected: ((TabItem) -> Void)?
    private var buttonViews: [TabButtonView] = []
    private(set) var selectedIndex: Int = 0
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupUI()
    }
    
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        if !self.isUserInteractionEnabled || self.isHidden || self.alpha < 0.01 {
            return nil
        }
        if self.point(inside: point, with: event) {
            let tabWidth = bounds.width / CGFloat(max(1, buttonViews.count))
            let tappedIndex = Int(point.x / tabWidth)
            if tappedIndex >= 0 && tappedIndex < buttonViews.count {
                return buttonViews[tappedIndex]
            }
            return self
        }
        return super.hitTest(point, with: event)
    }
    
    private func setupUI() {
        backgroundColor = UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 0.98)
        
        let blurEffect = UIBlurEffect(style: .systemUltraThinMaterialDark)
        let blurView = UIVisualEffectView(effect: blurEffect)
        blurView.isUserInteractionEnabled = false
        blurView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(blurView)
        sendSubviewToBack(blurView)
        
        let topBorder = UIView()
        topBorder.isUserInteractionEnabled = false
        topBorder.backgroundColor = UIColor(white: 1.0, alpha: 0.08)
        topBorder.translatesAutoresizingMaskIntoConstraints = false
        addSubview(topBorder)
        
        let stackView = UIStackView()
        stackView.axis = .horizontal
        stackView.distribution = .fillEqually
        stackView.alignment = .fill
        stackView.isUserInteractionEnabled = true
        stackView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stackView)
        
        for (index, tab) in tabs.enumerated() {
            let btn = TabButtonView(item: tab, index: index)
            btn.addTarget(self, action: #selector(tabTouchDown(_:)), for: .touchDown)
            btn.addTarget(self, action: #selector(tabTapped(_:)), for: .touchUpInside)
            stackView.addArrangedSubview(btn)
            buttonViews.append(btn)
        }
        
        NSLayoutConstraint.activate([
            blurView.topAnchor.constraint(equalTo: topAnchor),
            blurView.leadingAnchor.constraint(equalTo: leadingAnchor),
            blurView.trailingAnchor.constraint(equalTo: trailingAnchor),
            blurView.bottomAnchor.constraint(equalTo: bottomAnchor),
            
            topBorder.topAnchor.constraint(equalTo: topAnchor),
            topBorder.leadingAnchor.constraint(equalTo: leadingAnchor),
            topBorder.trailingAnchor.constraint(equalTo: trailingAnchor),
            topBorder.heightAnchor.constraint(equalToConstant: 0.5),
            
            stackView.topAnchor.constraint(equalTo: topAnchor),
            stackView.leadingAnchor.constraint(equalTo: leadingAnchor),
            stackView.trailingAnchor.constraint(equalTo: trailingAnchor),
            stackView.bottomAnchor.constraint(equalTo: safeAreaLayoutGuide.bottomAnchor)
        ])
        
        updateSelection(index: 0, animated: false)
    }
    
    @objc private func tabTouchDown(_ sender: TabButtonView) {
        updateSelection(index: sender.index, animated: true)
    }
    
    @objc private func tabTapped(_ sender: TabButtonView) {
        let index = sender.index
        updateSelection(index: index, animated: true)
        onTabSelected?(tabs[index])
    }
    
    func selectTab(forScreen screen: String) {
        let index: Int
        switch screen {
        case "home", "game":
            index = 0
        case "world-select", "level-select":
            index = 1
        case "daily":
            index = 2
        case "leaderboard", "achievements":
            index = 3
        case "store":
            index = 4
        default:
            return
        }
        if index != selectedIndex {
            updateSelection(index: index, animated: true)
        }
    }
    
    private func updateSelection(index: Int, animated: Bool) {
        selectedIndex = index
        for (i, btn) in buttonViews.enumerated() {
            btn.setSelected(i == index, animated: animated)
        }
    }
}

// MARK: - Tab Button Component
final class TabButtonView: UIButton {
    let item: NativeBottomBar.TabItem
    let index: Int
    
    private let iconImageView = UIImageView()
    private let titleLabelCustom = UILabel()
    private let activeDot = UIView()
    
    private let activeColor = UIColor(red: 56/255, green: 189/255, blue: 248/255, alpha: 1.0)
    private let inactiveColor = UIColor(red: 100/255, green: 116/255, blue: 139/255, alpha: 1.0)
    
    init(item: NativeBottomBar.TabItem, index: Int) {
        self.item = item
        self.index = index
        super.init(frame: .zero)
        setupView()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        // Expand hit-test area by 10pt all around to guarantee touch responsiveness
        let expanded = bounds.insetBy(dx: -10, dy: -10)
        return expanded.contains(point)
    }
    
    private func setupView() {
        backgroundColor = .clear
        isExclusiveTouch = true
        isUserInteractionEnabled = true
        
        let config = UIImage.SymbolConfiguration(pointSize: 18, weight: .semibold)
        iconImageView.image = UIImage(systemName: item.symbolName, withConfiguration: config)
        iconImageView.contentMode = .scaleAspectFit
        iconImageView.tintColor = inactiveColor
        iconImageView.isUserInteractionEnabled = false
        iconImageView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(iconImageView)
        
        titleLabelCustom.text = item.title
        titleLabelCustom.font = UIFont.systemFont(ofSize: 10, weight: .bold)
        titleLabelCustom.textColor = inactiveColor
        titleLabelCustom.textAlignment = .center
        titleLabelCustom.isUserInteractionEnabled = false
        titleLabelCustom.translatesAutoresizingMaskIntoConstraints = false
        addSubview(titleLabelCustom)
        
        activeDot.backgroundColor = activeColor
        activeDot.layer.cornerRadius = 2
        activeDot.alpha = 0
        activeDot.isUserInteractionEnabled = false
        activeDot.translatesAutoresizingMaskIntoConstraints = false
        addSubview(activeDot)
        
        NSLayoutConstraint.activate([
            iconImageView.topAnchor.constraint(equalTo: topAnchor, constant: 6),
            iconImageView.centerXAnchor.constraint(equalTo: centerXAnchor),
            iconImageView.widthAnchor.constraint(equalToConstant: 22),
            iconImageView.heightAnchor.constraint(equalToConstant: 22),
            
            titleLabelCustom.topAnchor.constraint(equalTo: iconImageView.bottomAnchor, constant: 3),
            titleLabelCustom.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 2),
            titleLabelCustom.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -2),
            
            activeDot.topAnchor.constraint(equalTo: titleLabelCustom.bottomAnchor, constant: 2),
            activeDot.centerXAnchor.constraint(equalTo: centerXAnchor),
            activeDot.widthAnchor.constraint(equalToConstant: 4),
            activeDot.heightAnchor.constraint(equalToConstant: 4)
        ])
    }
    
    func setSelected(_ isSelected: Bool, animated: Bool) {
        let block = {
            self.iconImageView.tintColor = isSelected ? self.activeColor : self.inactiveColor
            self.titleLabelCustom.textColor = isSelected ? self.activeColor : self.inactiveColor
            self.activeDot.alpha = isSelected ? 1.0 : 0.0
            self.transform = isSelected ? CGAffineTransform(scaleX: 1.06, y: 1.06) : .identity
        }
        if animated {
            UIView.animate(withDuration: 0.15, delay: 0, options: [.curveEaseOut], animations: block)
        } else {
            block()
        }
    }
}

// MARK: - Fully Native Authentication View Controller
final class NativeAuthViewController: UIViewController, UITextFieldDelegate {
    
    weak var scriptBridge: ScriptBridge?
    var onAuthSuccess: (() -> Void)?
    
    private let scrollView = UIScrollView()
    private let contentView = UIView()
    
    private let segmentedControl = UISegmentedControl(items: ["Sign In", "Create Account"])
    private var appleSignInButton: ASAuthorizationAppleIDButton!
    
    // Register-specific fields
    private let nameContainer = UIView()
    private let nameTextField = UITextField()
    
    // Common fields
    private let emailContainer = UIView()
    private let emailTextField = UITextField()
    
    private let passwordContainer = UIView()
    private let passwordTextField = UITextField()
    
    // Register-specific confirm password
    private let confirmPasswordContainer = UIView()
    private let confirmPasswordTextField = UITextField()
    
    private let errorLabel = UILabel()
    private let actionButton = UIButton(type: .system)
    private let forgotPasswordButton = UIButton(type: .system)
    private let activityIndicator = UIActivityIndicatorView(style: .medium)
    
    private var isSignUpMode: Bool = false
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        setupKeyboardObservers()
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
    
    private func setupUI() {
        title = "Account"
        view.backgroundColor = UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 1.0)
        
        let closeItem = UIBarButtonItem(barButtonSystemItem: .close, target: self, action: #selector(closeTapped))
        navigationItem.rightBarButtonItem = closeItem
        navigationController?.navigationBar.tintColor = .white
        navigationController?.navigationBar.barStyle = .black
        
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.alwaysBounceVertical = true
        scrollView.keyboardDismissMode = .interactive
        view.addSubview(scrollView)
        
        contentView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(contentView)
        
        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(dismissKeyboard))
        contentView.addGestureRecognizer(tapGesture)
        
        // Header
        let iconLabel = UILabel()
        iconLabel.text = "🎮"
        iconLabel.font = UIFont.systemFont(ofSize: 44)
        iconLabel.textAlignment = .center
        iconLabel.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(iconLabel)
        
        let headerLabel = UILabel()
        headerLabel.text = "Block Rush 2K"
        headerLabel.font = UIFont.systemFont(ofSize: 22, weight: .black)
        headerLabel.textColor = .white
        headerLabel.textAlignment = .center
        headerLabel.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(headerLabel)
        
        let subheaderLabel = UILabel()
        subheaderLabel.text = "Sign in to sync your score and climb the leaderboard!"
        subheaderLabel.font = UIFont.systemFont(ofSize: 13, weight: .medium)
        subheaderLabel.textColor = UIColor(red: 148/255, green: 163/255, blue: 184/255, alpha: 1.0)
        subheaderLabel.textAlignment = .center
        subheaderLabel.numberOfLines = 0
        subheaderLabel.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(subheaderLabel)
        
        // Apple Sign In Button
        appleSignInButton = ASAuthorizationAppleIDButton(type: .signIn, style: .white)
        appleSignInButton.cornerRadius = 12
        appleSignInButton.addTarget(self, action: #selector(appleSignInTapped), for: .touchUpInside)
        appleSignInButton.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(appleSignInButton)
        
        // Divider
        let dividerContainer = UIStackView()
        dividerContainer.axis = .horizontal
        dividerContainer.alignment = .center
        dividerContainer.spacing = 10
        dividerContainer.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(dividerContainer)
        
        let leftLine = UIView()
        leftLine.backgroundColor = UIColor(white: 1.0, alpha: 0.15)
        let rightLine = UIView()
        rightLine.backgroundColor = UIColor(white: 1.0, alpha: 0.15)
        let orLabel = UILabel()
        orLabel.text = "OR CONTINUE WITH EMAIL"
        orLabel.font = UIFont.systemFont(ofSize: 11, weight: .bold)
        orLabel.textColor = UIColor(red: 100/255, green: 116/255, blue: 139/255, alpha: 1.0)
        
        dividerContainer.addArrangedSubview(leftLine)
        dividerContainer.addArrangedSubview(orLabel)
        dividerContainer.addArrangedSubview(rightLine)
        leftLine.heightAnchor.constraint(equalToConstant: 1).isActive = true
        rightLine.heightAnchor.constraint(equalToConstant: 1).isActive = true
        leftLine.widthAnchor.constraint(equalTo: rightLine.widthAnchor).isActive = true
        
        // Segmented Control
        segmentedControl.selectedSegmentIndex = 0
        segmentedControl.selectedSegmentTintColor = UIColor(red: 56/255, green: 189/255, blue: 248/255, alpha: 1.0)
        segmentedControl.setTitleTextAttributes([.foregroundColor: UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 1.0), .font: UIFont.systemFont(ofSize: 14, weight: .bold)], for: .selected)
        segmentedControl.setTitleTextAttributes([.foregroundColor: UIColor.white, .font: UIFont.systemFont(ofSize: 14, weight: .semibold)], for: .normal)
        segmentedControl.backgroundColor = UIColor(red: 30/255, green: 41/255, blue: 59/255, alpha: 1.0)
        segmentedControl.addTarget(self, action: #selector(segmentChanged), for: .valueChanged)
        segmentedControl.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(segmentedControl)
        
        // Fields Stack (Generous 16pt spacing)
        let fieldsStack = UIStackView()
        fieldsStack.axis = .vertical
        fieldsStack.spacing = 16
        fieldsStack.alignment = .fill
        fieldsStack.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(fieldsStack)
        
        configureField(container: nameContainer, textField: nameTextField, labelText: "PLAYER NAME", placeholder: "e.g. MasterBlocker", icon: "person.fill", isSecure: false)
        configureField(container: emailContainer, textField: emailTextField, labelText: "EMAIL ADDRESS", placeholder: "player@example.com", icon: "envelope.fill", isSecure: false)
        emailTextField.keyboardType = .emailAddress
        emailTextField.autocapitalizationType = .none
        emailTextField.autocorrectionType = .no
        
        configureField(container: passwordContainer, textField: passwordTextField, labelText: "PASSWORD", placeholder: "At least 6 characters", icon: "lock.fill", isSecure: true)
        configureField(container: confirmPasswordContainer, textField: confirmPasswordTextField, labelText: "CONFIRM PASSWORD", placeholder: "Repeat your password", icon: "lock.shield.fill", isSecure: true)
        
        nameContainer.isHidden = true
        confirmPasswordContainer.isHidden = true
        
        fieldsStack.addArrangedSubview(nameContainer)
        fieldsStack.addArrangedSubview(emailContainer)
        fieldsStack.addArrangedSubview(passwordContainer)
        fieldsStack.addArrangedSubview(confirmPasswordContainer)
        
        // Error label
        errorLabel.font = UIFont.systemFont(ofSize: 13, weight: .semibold)
        errorLabel.textColor = UIColor(red: 239/255, green: 68/255, blue: 68/255, alpha: 1.0)
        errorLabel.textAlignment = .center
        errorLabel.numberOfLines = 0
        errorLabel.isHidden = true
        fieldsStack.addArrangedSubview(errorLabel)
        
        // Action Button
        actionButton.setTitle("Sign In", for: .normal)
        actionButton.titleLabel?.font = UIFont.systemFont(ofSize: 16, weight: .bold)
        actionButton.setTitleColor(.white, for: .normal)
        actionButton.backgroundColor = UIColor(red: 56/255, green: 189/255, blue: 248/255, alpha: 1.0)
        actionButton.layer.cornerRadius = 14
        actionButton.addTarget(self, action: #selector(actionButtonTapped), for: .touchUpInside)
        actionButton.translatesAutoresizingMaskIntoConstraints = false
        actionButton.heightAnchor.constraint(equalToConstant: 50).isActive = true
        fieldsStack.addArrangedSubview(actionButton)
        
        // Forgot Password Button
        forgotPasswordButton.setTitle("Forgot Password?", for: .normal)
        forgotPasswordButton.setTitleColor(UIColor(red: 148/255, green: 163/255, blue: 184/255, alpha: 1.0), for: .normal)
        forgotPasswordButton.titleLabel?.font = UIFont.systemFont(ofSize: 13, weight: .semibold)
        forgotPasswordButton.addTarget(self, action: #selector(forgotPasswordTapped), for: .touchUpInside)
        fieldsStack.addArrangedSubview(forgotPasswordButton)
        
        // Loading Spinner
        activityIndicator.color = .white
        activityIndicator.hidesWhenStopped = true
        activityIndicator.translatesAutoresizingMaskIntoConstraints = false
        actionButton.addSubview(activityIndicator)
        
        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            
            contentView.topAnchor.constraint(equalTo: scrollView.topAnchor),
            contentView.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor),
            contentView.trailingAnchor.constraint(equalTo: scrollView.trailingAnchor),
            contentView.bottomAnchor.constraint(equalTo: scrollView.bottomAnchor),
            contentView.widthAnchor.constraint(equalTo: scrollView.widthAnchor),
            
            iconLabel.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 16),
            iconLabel.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            
            headerLabel.topAnchor.constraint(equalTo: iconLabel.bottomAnchor, constant: 6),
            headerLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            headerLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
            
            subheaderLabel.topAnchor.constraint(equalTo: headerLabel.bottomAnchor, constant: 4),
            subheaderLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 24),
            subheaderLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -24),
            
            appleSignInButton.topAnchor.constraint(equalTo: subheaderLabel.bottomAnchor, constant: 20),
            appleSignInButton.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 24),
            appleSignInButton.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -24),
            appleSignInButton.heightAnchor.constraint(equalToConstant: 48),
            
            dividerContainer.topAnchor.constraint(equalTo: appleSignInButton.bottomAnchor, constant: 20),
            dividerContainer.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 24),
            dividerContainer.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -24),
            
            segmentedControl.topAnchor.constraint(equalTo: dividerContainer.bottomAnchor, constant: 16),
            segmentedControl.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 24),
            segmentedControl.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -24),
            segmentedControl.heightAnchor.constraint(equalToConstant: 38),
            
            fieldsStack.topAnchor.constraint(equalTo: segmentedControl.bottomAnchor, constant: 20),
            fieldsStack.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 24),
            fieldsStack.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -24),
            fieldsStack.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -40),
            
            activityIndicator.centerYAnchor.constraint(equalTo: actionButton.centerYAnchor),
            activityIndicator.trailingAnchor.constraint(equalTo: actionButton.trailingAnchor, constant: -16)
        ])
    }
    
    private func configureField(container: UIView, textField: UITextField, labelText: String, placeholder: String, icon: String, isSecure: Bool) {
        container.translatesAutoresizingMaskIntoConstraints = false
        
        let label = UILabel()
        label.text = labelText
        label.font = UIFont.systemFont(ofSize: 11, weight: .bold)
        label.textColor = UIColor(red: 148/255, green: 163/255, blue: 184/255, alpha: 1.0)
        label.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(label)
        
        let fieldBox = UIView()
        fieldBox.backgroundColor = UIColor(red: 30/255, green: 41/255, blue: 59/255, alpha: 1.0)
        fieldBox.layer.cornerRadius = 12
        fieldBox.layer.borderWidth = 1
        fieldBox.layer.borderColor = UIColor(white: 1.0, alpha: 0.1).cgColor
        fieldBox.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(fieldBox)
        
        let iconView = UIImageView(image: UIImage(systemName: icon))
        iconView.tintColor = UIColor(red: 148/255, green: 163/255, blue: 184/255, alpha: 1.0)
        iconView.contentMode = .scaleAspectFit
        iconView.translatesAutoresizingMaskIntoConstraints = false
        fieldBox.addSubview(iconView)
        
        textField.placeholder = placeholder
        textField.textColor = .white
        textField.font = UIFont.systemFont(ofSize: 15, weight: .medium)
        textField.isSecureTextEntry = isSecure
        textField.attributedPlaceholder = NSAttributedString(string: placeholder, attributes: [.foregroundColor: UIColor(red: 100/255, green: 116/255, blue: 139/255, alpha: 1.0)])
        textField.delegate = self
        textField.translatesAutoresizingMaskIntoConstraints = false
        fieldBox.addSubview(textField)
        
        NSLayoutConstraint.activate([
            label.topAnchor.constraint(equalTo: container.topAnchor),
            label.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 4),
            
            fieldBox.topAnchor.constraint(equalTo: label.bottomAnchor, constant: 6),
            fieldBox.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            fieldBox.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            fieldBox.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            fieldBox.heightAnchor.constraint(equalToConstant: 48),
            
            iconView.leadingAnchor.constraint(equalTo: fieldBox.leadingAnchor, constant: 14),
            iconView.centerYAnchor.constraint(equalTo: fieldBox.centerYAnchor),
            iconView.widthAnchor.constraint(equalToConstant: 20),
            iconView.heightAnchor.constraint(equalToConstant: 20),
            
            textField.leadingAnchor.constraint(equalTo: iconView.trailingAnchor, constant: 12),
            textField.trailingAnchor.constraint(equalTo: fieldBox.trailingAnchor, constant: -14),
            textField.topAnchor.constraint(equalTo: fieldBox.topAnchor),
            textField.bottomAnchor.constraint(equalTo: fieldBox.bottomAnchor)
        ])
    }
    
    private func setupKeyboardObservers() {
        NotificationCenter.default.addObserver(self, selector: #selector(keyboardWillShow(_:)), name: UIResponder.keyboardWillShowNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(keyboardWillHide(_:)), name: UIResponder.keyboardWillHideNotification, object: nil)
    }
    
    @objc private func keyboardWillShow(_ notification: Notification) {
        if let frame = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect {
            scrollView.contentInset.bottom = frame.height + 20
            scrollView.verticalScrollIndicatorInsets.bottom = frame.height
        }
    }
    
    @objc private func keyboardWillHide(_ notification: Notification) {
        scrollView.contentInset.bottom = 0
        scrollView.verticalScrollIndicatorInsets.bottom = 0
    }
    
    @objc private func dismissKeyboard() {
        view.endEditing(true)
    }
    
    @objc private func closeTapped() {
        dismiss(animated: true, completion: nil)
    }
    
    @objc private func segmentChanged() {
        isSignUpMode = (segmentedControl.selectedSegmentIndex == 1)
        UIView.animate(withDuration: 0.25) {
            self.nameContainer.isHidden = !self.isSignUpMode
            self.confirmPasswordContainer.isHidden = !self.isSignUpMode
            self.forgotPasswordButton.isHidden = self.isSignUpMode
            self.actionButton.setTitle(self.isSignUpMode ? "Create Account" : "Sign In", for: .normal)
            self.errorLabel.isHidden = true
            self.contentView.layoutIfNeeded()
        }
    }
    
    @objc private func appleSignInTapped() {
        HapticManager.shared.impact(style: .medium)
        guard let bridge = scriptBridge else { return }
        AppleSignInManager.shared.performAppleSignIn(from: self, scriptBridge: bridge)
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { [weak self] in
            self?.dismiss(animated: true) {
                self?.onAuthSuccess?()
            }
        }
    }
    
    @objc private func forgotPasswordTapped() {
        let alert = UIAlertController(title: "Reset Password", message: "Enter your registered email address to receive password reset instructions.", preferredStyle: .alert)
        alert.addTextField { tf in
            tf.placeholder = "you@example.com"
            tf.text = self.emailTextField.text
            tf.keyboardType = .emailAddress
        }
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        alert.addAction(UIAlertAction(title: "Send", style: .default, handler: { [weak self] _ in
            guard let email = alert.textFields?.first?.text?.trimmingCharacters(in: .whitespacesAndNewlines), !email.isEmpty else { return }
            self?.scriptBridge?.evaluateJavaScript("if (typeof FirebaseService !== 'undefined') FirebaseService.sendPasswordReset('\(email)');")
            let confirmation = UIAlertController(title: "Sent", message: "If an account exists for \(email), a reset link has been sent.", preferredStyle: .alert)
            confirmation.addAction(UIAlertAction(title: "OK", style: .default))
            self?.present(confirmation, animated: true)
        }))
        present(alert, animated: true)
    }
    
    @objc private func actionButtonTapped() {
        dismissKeyboard()
        errorLabel.isHidden = true
        
        let email = emailTextField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let password = passwordTextField.text ?? ""
        
        guard !email.isEmpty else {
            showError("Please enter an email address.")
            return
        }
        guard email.contains("@") && email.contains(".") else {
            showError("Please enter a valid email address.")
            return
        }
        guard password.count >= 6 else {
            showError("Password must be at least 6 characters.")
            return
        }
        
        if isSignUpMode {
            let name = nameTextField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let confirm = confirmPasswordTextField.text ?? ""
            guard !name.isEmpty else {
                showError("Please enter your player name.")
                return
            }
            guard password == confirm else {
                showError("Passwords do not match.")
                return
            }
            performSignUp(name: name, email: email, password: password)
        } else {
            performSignIn(email: email, password: password)
        }
    }
    
    private func showError(_ message: String) {
        HapticManager.shared.notification(type: .error)
        errorLabel.text = "⚠️ " + message
        errorLabel.isHidden = false
    }
    
    private func setLoading(_ loading: Bool) {
        actionButton.isEnabled = !loading
        actionButton.setTitle(loading ? "" : (isSignUpMode ? "Create Account" : "Sign In"), for: .normal)
        if loading {
            activityIndicator.startAnimating()
        } else {
            activityIndicator.stopAnimating()
        }
    }
    
    private func performSignIn(email: String, password: String) {
        setLoading(true)
        let escapedEmail = email.replacingOccurrences(of: "'", with: "\\'")
        let escapedPassword = password.replacingOccurrences(of: "'", with: "\\'")
        
        let js = """
        (async function() {
            try {
                if (typeof FirebaseService !== 'undefined') {
                    const res = await FirebaseService.signInWithEmail('\(escapedEmail)', '\(escapedPassword)');
                    return JSON.stringify(res);
                }
                return JSON.stringify({ success: false, error: 'FirebaseService not loaded' });
            } catch(e) {
                return JSON.stringify({ success: false, error: e.message || 'Sign in failed' });
            }
        })();
        """
        
        scriptBridge?.evaluateJavaScript(js) { [weak self] (result: Any?, error: Error?) in
            DispatchQueue.main.async {
                self?.setLoading(false)
                if let str = result as? String,
                   let data = str.data(using: .utf8),
                   let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let success = dict["success"] as? Bool, success {
                    HapticManager.shared.notification(type: .success)
                    self?.dismiss(animated: true) {
                        self?.onAuthSuccess?()
                    }
                } else {
                    let err = (result as? String) ?? error?.localizedDescription ?? "Sign-in failed. Please check credentials."
                    self?.showError(err)
                }
            }
        }
    }
    
    private func performSignUp(name: String, email: String, password: String) {
        setLoading(true)
        let escapedName = name.replacingOccurrences(of: "'", with: "\\'")
        let escapedEmail = email.replacingOccurrences(of: "'", with: "\\'")
        let escapedPassword = password.replacingOccurrences(of: "'", with: "\\'")
        
        let js = """
        (async function() {
            try {
                if (typeof FirebaseService !== 'undefined') {
                    const res = await FirebaseService.signUpWithEmail('\(escapedEmail)', '\(escapedPassword)', '\(escapedName)');
                    return JSON.stringify(res);
                }
                return JSON.stringify({ success: false, error: 'FirebaseService not loaded' });
            } catch(e) {
                return JSON.stringify({ success: false, error: e.message || 'Sign up failed' });
            }
        })();
        """
        
        scriptBridge?.evaluateJavaScript(js) { [weak self] (result: Any?, error: Error?) in
            DispatchQueue.main.async {
                self?.setLoading(false)
                if let str = result as? String,
                   let data = str.data(using: .utf8),
                   let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let success = dict["success"] as? Bool, success {
                    HapticManager.shared.notification(type: .success)
                    self?.dismiss(animated: true) {
                        self?.onAuthSuccess?()
                    }
                } else {
                    let err = (result as? String) ?? error?.localizedDescription ?? "Registration failed. Please try again."
                    self?.showError(err)
                }
            }
        }
    }
    
    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        if textField == nameTextField {
            emailTextField.becomeFirstResponder()
        } else if textField == emailTextField {
            passwordTextField.becomeFirstResponder()
        } else if textField == passwordTextField {
            if isSignUpMode {
                confirmPasswordTextField.becomeFirstResponder()
            } else {
                actionButtonTapped()
            }
        } else {
            actionButtonTapped()
        }
        return true
    }
}

// MARK: - Fully Native Daily Reward Modal View Controller
final class NativeDailyRewardViewController: UIViewController {
    
    weak var scriptBridge: ScriptBridge?
    var onClaimReward: ((Int) -> Void)?
    
    private let rewardAmounts = [100, 250, 500, 750, 1000, 1500, 2500]
    private var currentDayIndex = 2 // Day 3 by default
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
    }
    
    private func setupUI() {
        view.backgroundColor = UIColor.black.withAlphaComponent(0.7)
        
        let dismissTap = UITapGestureRecognizer(target: self, action: #selector(closeTapped))
        view.addGestureRecognizer(dismissTap)
        
        // Card Container
        let card = UIView()
        card.backgroundColor = UIColor(red: 24/255, green: 32/255, blue: 47/255, alpha: 1.0)
        card.layer.cornerRadius = 24
        card.layer.borderWidth = 1.5
        card.layer.borderColor = UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 0.35).cgColor
        card.layer.shadowColor = UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 0.25).cgColor
        card.layer.shadowRadius = 25
        card.layer.shadowOpacity = 0.8
        card.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(card)
        
        let cardTap = UITapGestureRecognizer(target: nil, action: nil)
        card.addGestureRecognizer(cardTap)
        
        // Close Button
        let closeBtn = UIButton(type: .system)
        let closeConfig = UIImage.SymbolConfiguration(pointSize: 14, weight: .bold)
        closeBtn.setImage(UIImage(systemName: "xmark", withConfiguration: closeConfig), for: .normal)
        closeBtn.tintColor = UIColor(red: 148/255, green: 163/255, blue: 184/255, alpha: 1.0)
        closeBtn.backgroundColor = UIColor(white: 1.0, alpha: 0.08)
        closeBtn.layer.cornerRadius = 16
        closeBtn.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)
        closeBtn.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(closeBtn)
        
        // Icon
        let iconLabel = UILabel()
        iconLabel.text = "🎁"
        iconLabel.font = UIFont.systemFont(ofSize: 46)
        iconLabel.textAlignment = .center
        iconLabel.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(iconLabel)
        
        // Title
        let titleLabel = UILabel()
        titleLabel.text = "Daily Login Reward"
        titleLabel.font = UIFont.systemFont(ofSize: 22, weight: .black)
        titleLabel.textColor = .white
        titleLabel.textAlignment = .center
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(titleLabel)
        
        // Streak Pill
        let streakPill = UILabel()
        streakPill.text = "🔥 3 DAY STREAK"
        streakPill.font = UIFont.systemFont(ofSize: 12, weight: .black)
        streakPill.textColor = UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 1.0)
        streakPill.backgroundColor = UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 0.15)
        streakPill.layer.cornerRadius = 12
        streakPill.layer.masksToBounds = true
        streakPill.textAlignment = .center
        streakPill.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(streakPill)
        
        // 7-Day Grid
        let gridStack = UIStackView()
        gridStack.axis = .vertical
        gridStack.spacing = 8
        gridStack.alignment = .fill
        gridStack.distribution = .fillEqually
        gridStack.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(gridStack)
        
        let row1 = UIStackView()
        row1.axis = .horizontal
        row1.spacing = 8
        row1.distribution = .fillEqually
        
        let row2 = UIStackView()
        row2.axis = .horizontal
        row2.spacing = 8
        row2.distribution = .fillEqually
        
        gridStack.addArrangedSubview(row1)
        gridStack.addArrangedSubview(row2)
        
        for i in 0..<7 {
            let dayNum = i + 1
            let amount = rewardAmounts[i]
            let isClaimed = i < currentDayIndex
            let isToday = i == currentDayIndex
            let cell = createDayCard(day: dayNum, coins: amount, isClaimed: isClaimed, isToday: isToday)
            if i < 4 {
                row1.addArrangedSubview(cell)
            } else {
                row2.addArrangedSubview(cell)
            }
        }
        
        // Claim Button
        let claimBtn = UIButton(type: .system)
        let todayReward = rewardAmounts[currentDayIndex]
        claimBtn.setTitle("CLAIM +\(todayReward) COINS", for: .normal)
        claimBtn.titleLabel?.font = UIFont.systemFont(ofSize: 16, weight: .black)
        claimBtn.setTitleColor(UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 1.0), for: .normal)
        claimBtn.backgroundColor = UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 1.0)
        claimBtn.layer.cornerRadius = 16
        claimBtn.addTarget(self, action: #selector(claimTapped), for: .touchUpInside)
        claimBtn.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(claimBtn)
        
        NSLayoutConstraint.activate([
            card.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            card.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            card.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            card.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            
            closeBtn.topAnchor.constraint(equalTo: card.topAnchor, constant: 14),
            closeBtn.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -14),
            closeBtn.widthAnchor.constraint(equalToConstant: 32),
            closeBtn.heightAnchor.constraint(equalToConstant: 32),
            
            iconLabel.topAnchor.constraint(equalTo: card.topAnchor, constant: 20),
            iconLabel.centerXAnchor.constraint(equalTo: card.centerXAnchor),
            
            titleLabel.topAnchor.constraint(equalTo: iconLabel.bottomAnchor, constant: 4),
            titleLabel.centerXAnchor.constraint(equalTo: card.centerXAnchor),
            
            streakPill.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 8),
            streakPill.centerXAnchor.constraint(equalTo: card.centerXAnchor),
            streakPill.heightAnchor.constraint(equalToConstant: 24),
            streakPill.widthAnchor.constraint(greaterThanOrEqualToConstant: 130),
            
            gridStack.topAnchor.constraint(equalTo: streakPill.bottomAnchor, constant: 18),
            gridStack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 16),
            gridStack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16),
            
            claimBtn.topAnchor.constraint(equalTo: gridStack.bottomAnchor, constant: 20),
            claimBtn.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 16),
            claimBtn.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16),
            claimBtn.heightAnchor.constraint(equalToConstant: 52),
            claimBtn.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -20)
        ])
    }
    
    private func createDayCard(day: Int, coins: Int, isClaimed: Bool, isToday: Bool) -> UIView {
        let v = UIView()
        v.layer.cornerRadius = 10
        v.backgroundColor = isToday ? UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 0.18) : UIColor(red: 30/255, green: 41/255, blue: 59/255, alpha: 0.8)
        v.layer.borderWidth = isToday ? 1.5 : 0.5
        v.layer.borderColor = isToday ? UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 1.0).cgColor : UIColor(white: 1.0, alpha: 0.1).cgColor
        v.translatesAutoresizingMaskIntoConstraints = false
        
        let dayLbl = UILabel()
        dayLbl.text = "D\(day)"
        dayLbl.font = UIFont.systemFont(ofSize: 11, weight: .bold)
        dayLbl.textColor = isToday ? UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 1.0) : UIColor(red: 148/255, green: 163/255, blue: 184/255, alpha: 1.0)
        dayLbl.textAlignment = .center
        dayLbl.translatesAutoresizingMaskIntoConstraints = false
        v.addSubview(dayLbl)
        
        let coinLbl = UILabel()
        coinLbl.text = isClaimed ? "✓" : "+\(coins)"
        coinLbl.font = UIFont.systemFont(ofSize: 12, weight: .heavy)
        coinLbl.textColor = isClaimed ? UIColor(red: 34/255, green: 197/255, blue: 94/255, alpha: 1.0) : .white
        coinLbl.textAlignment = .center
        coinLbl.translatesAutoresizingMaskIntoConstraints = false
        v.addSubview(coinLbl)
        
        NSLayoutConstraint.activate([
            v.heightAnchor.constraint(equalToConstant: 54),
            dayLbl.topAnchor.constraint(equalTo: v.topAnchor, constant: 8),
            dayLbl.centerXAnchor.constraint(equalTo: v.centerXAnchor),
            coinLbl.bottomAnchor.constraint(equalTo: v.bottomAnchor, constant: -8),
            coinLbl.centerXAnchor.constraint(equalTo: v.centerXAnchor)
        ])
        
        return v
    }
    
    @objc private func claimTapped() {
        HapticManager.shared.notification(type: .success)
        let amount = rewardAmounts[currentDayIndex]
        dismiss(animated: true) { [weak self] in
            self?.onClaimReward?(amount)
        }
    }
    
    @objc private func closeTapped() {
        dismiss(animated: true, completion: nil)
    }
}
