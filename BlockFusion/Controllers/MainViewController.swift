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
        let top = isGame ? max(view.safeAreaInsets.top, 8.0) : 0.0
        let bottom = isGame ? (view.safeAreaInsets.bottom > 0 ? max(view.safeAreaInsets.bottom, 6.0) : 0.0) : 0.0
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
        
        // Ensure navigation bars stay on top of the web view in the Z-order hierarchy
        view.bringSubviewToFront(bottomBar)
        view.bringSubviewToFront(topBar)
        
        setupManagers()
        loadGame()
    }
    
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // Ensure bottom navigation bar stays above webview and ads
        view.bringSubviewToFront(bottomBar)
    }
    
    // MARK: - Native Modals
    func presentNativeAuth(onSuccess: (() -> Void)? = nil) {
        let authVC = NativeAuthViewController()
        authVC.scriptBridge = scriptBridge
        authVC.onAuthSuccess = onSuccess
        let nav = UINavigationController(rootViewController: authVC)
        nav.modalPresentationStyle = .pageSheet
        if let sheet = nav.sheetPresentationController {
            sheet.detents = [.large()]
            sheet.prefersGrabberVisible = true
        }
        present(nav, animated: true)
    }
    
    func presentDailyReward() {
        let dailyVC = NativeDailyRewardViewController()
        dailyVC.scriptBridge = scriptBridge
        let nav = UINavigationController(rootViewController: dailyVC)
        nav.modalPresentationStyle = .pageSheet
        if let sheet = nav.sheetPresentationController {
            sheet.detents = [.medium(), .large()]
            sheet.prefersGrabberVisible = true
        }
        present(nav, animated: true)
    }
    
    override var preferredStatusBarStyle: UIStatusBarStyle {
        return .lightContent
    }
    
    override var prefersStatusBarHidden: Bool {
        return false
    }
    
    override var prefersHomeIndicatorAutoHidden: Bool {
        return false
    }
    
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        return .portrait
    }
    
    // MARK: - Setup UI
    private func setupTopBar() {
        topBar = NativeTopBar()
        topBar.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(topBar)
        
        topBar.setAudioEnabled(preferences.soundEnabled)
        
        topBar.onGameCenterTapped = { [weak self] in
            HapticManager.shared.impact(style: .medium)
            GameKitManager.shared.showGameCenterDashboard()
        }
        
        topBar.onAudioTapped = { [weak self] in
            guard let self = self else { return }
            self.preferences.soundEnabled.toggle()
            self.topBar.setAudioEnabled(self.preferences.soundEnabled)
            HapticManager.shared.impact(style: .light)
            let enabled = self.preferences.soundEnabled ? "true" : "false"
            self.scriptBridge.evaluateJavaScript("""
            if (typeof SoundManager !== 'undefined') {
                SoundManager.enabled = \(enabled);
            }
            """)
        }
        
        topBar.onSettingsTapped = { [weak self] in
            HapticManager.shared.selection()
            self?.scriptBridge.evaluateJavaScript("""
            (function() {
                try {
                    if (typeof Navigation !== 'undefined' && typeof Navigation.navigateTo === 'function') {
                        Navigation.navigateTo('settings');
                    }
                } catch(e) {}
            })();
            """)
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
            let js = """
            (function() {
                try {
                    if (typeof Navigation !== 'undefined' && typeof Navigation.navigateTo === 'function') {
                        Navigation.navigateTo('\(tab.targetScreen)');
                    } else if (typeof window.Navigation !== 'undefined') {
                        window.Navigation.navigateTo('\(tab.targetScreen)');
                    } else {
                        var target = document.getElementById('screen-\(tab.targetScreen)');
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
            self.scriptBridge.evaluateJavaScript(js)
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
        contentController.add(scriptBridge, name: "gameCenterBridge")
        
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
        
        // Web view sits comfortably between top navigation bar and bottom navigation bar
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
        
        GameKitManager.shared.presentingViewController = self
        GameKitManager.shared.authenticateLocalPlayer()
        
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
        
        bottomBar.selectTab(forScreen: target)
        
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
        
        // Update Safe Area Insets dynamically
        updateSafeAreaInsets()
        
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
        
        // Local files, scheme handlers, internal domain, or blank pages
        if url.isFileURL ||
           url.host == "blockrush2k.kharitambe.co.za" ||
           url.scheme == "local" ||
           url.absoluteString.hasPrefix("https://games-7b902") ||
           url.absoluteString == "about:blank" {
            decisionHandler(.allow)
            return
        }
        
        // Allow subframe requests (e.g., ad iframes or embedded media) inside the web view
        if let targetFrame = navigationAction.targetFrame, !targetFrame.isMainFrame {
            decisionHandler(.allow)
            return
        }
        
        // External links in main frame: ONLY open Safari if user explicitly tapped a link
        if navigationAction.navigationType == .linkActivated {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
            decisionHandler(.cancel)
            return
        }
        
        // Cancel automatic external redirects/navigation in main frame without opening Safari
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
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.currentBannerHeight = visible ? height : 0
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
            }
            self.bottomBar.isUserInteractionEnabled = !isGame
            
            // On gameplay screen, smoothly collapse the top and bottom bars so board & undo button have full height
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
            self?.presentNativeAuth()
        }
    }
    
    func showDailyReward() {
        DispatchQueue.main.async { [weak self] in
            self?.presentDailyReward()
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
    
    private let headerIcon = UILabel()
    private let titleLabel = UILabel()
    private let subtitleLabel = UILabel()
    private let offlineBanner = UIView()
    private let offlineLabel = UILabel()
    
    private var appleSignInButton: ASAuthorizationAppleIDButton!
    private let googleSignInButton = UIButton(type: .system)
    private let anonymousSignInButton = UIButton(type: .system)
    
    private let segmentedControl = UISegmentedControl(items: ["Sign In", "Register"])
    
    // Sign Up Fields
    private let nameStack = UIStackView()
    private let firstNameContainer = UIView()
    private let firstNameTextField = UITextField()
    private let lastNameContainer = UIView()
    private let lastNameTextField = UITextField()
    private let displayNameContainer = UIView()
    private let displayNameTextField = UITextField()
    
    // Common Fields
    private let emailContainer = UIView()
    private let emailTextField = UITextField()
    private let passwordContainer = UIView()
    private let passwordTextField = UITextField()
    
    // Sign Up Confirm Password
    private let confirmPasswordContainer = UIView()
    private let confirmPasswordTextField = UITextField()
    
    private let errorLabel = UILabel()
    private let actionButton = UIButton(type: .system)
    private let forgotPasswordButton = UIButton(type: .system)
    private let activityIndicator = UIActivityIndicatorView(style: .medium)
    
    // Guest & Back Buttons
    private let guestButton = UIButton(type: .system)
    private let backButton = UIButton(type: .system)
    
    private var isSignUpMode: Bool = false
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        setupKeyboardObservers()
        fetchOfflineStatus()
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
        scrollView.keyboardDismissMode = .onDrag
        view.addSubview(scrollView)
        
        contentView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(contentView)
        
        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            
            contentView.topAnchor.constraint(equalTo: scrollView.topAnchor),
            contentView.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor),
            contentView.trailingAnchor.constraint(equalTo: scrollView.trailingAnchor),
            contentView.bottomAnchor.constraint(equalTo: scrollView.bottomAnchor),
            contentView.widthAnchor.constraint(equalTo: scrollView.widthAnchor)
        ])
        
        // Header
        headerIcon.text = "👑"
        headerIcon.font = UIFont.systemFont(ofSize: 42)
        headerIcon.textAlignment = .center
        headerIcon.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(headerIcon)
        
        titleLabel.text = "Welcome to Block Rush 2K"
        titleLabel.font = UIFont.systemFont(ofSize: 22, weight: .bold)
        titleLabel.textColor = .white
        titleLabel.textAlignment = .center
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(titleLabel)
        
        subtitleLabel.text = "Sign in or create an account to save your progress"
        subtitleLabel.font = UIFont.systemFont(ofSize: 13, weight: .medium)
        subtitleLabel.textColor = UIColor(red: 148/255, green: 163/255, blue: 184/255, alpha: 1.0)
        subtitleLabel.textAlignment = .center
        subtitleLabel.numberOfLines = 2
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(subtitleLabel)
        
        // Offline Banner
        offlineBanner.backgroundColor = UIColor(white: 1.0, alpha: 0.06)
        offlineBanner.layer.cornerRadius = 10
        offlineBanner.layer.borderWidth = 1
        offlineBanner.layer.borderColor = UIColor(white: 1.0, alpha: 0.1).cgColor
        offlineBanner.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(offlineBanner)
        
        offlineLabel.text = "📱 Offline Mode: Sign in for unlimited cloud play & rewards"
        offlineLabel.font = UIFont.systemFont(ofSize: 12, weight: .semibold)
        offlineLabel.textColor = UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 1.0)
        offlineLabel.textAlignment = .center
        offlineLabel.numberOfLines = 2
        offlineLabel.translatesAutoresizingMaskIntoConstraints = false
        offlineBanner.addSubview(offlineLabel)
        
        NSLayoutConstraint.activate([
            offlineLabel.topAnchor.constraint(equalTo: offlineBanner.topAnchor, constant: 8),
            offlineLabel.bottomAnchor.constraint(equalTo: offlineBanner.bottomAnchor, constant: -8),
            offlineLabel.leadingAnchor.constraint(equalTo: offlineBanner.leadingAnchor, constant: 12),
            offlineLabel.trailingAnchor.constraint(equalTo: offlineBanner.trailingAnchor, constant: -12)
        ])
        
        // Apple Sign In Button
        appleSignInButton = ASAuthorizationAppleIDButton(type: .signIn, style: .white)
        appleSignInButton.cornerRadius = 12
        appleSignInButton.addTarget(self, action: #selector(appleSignInTapped), for: .touchUpInside)
        appleSignInButton.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(appleSignInButton)
        
        // Google Sign In Button
        googleSignInButton.backgroundColor = UIColor(red: 66/255, green: 133/255, blue: 244/255, alpha: 1.0)
        googleSignInButton.setTitle("G  Sign in with Google", for: .normal)
        googleSignInButton.setTitleColor(.white, for: .normal)
        googleSignInButton.titleLabel?.font = UIFont.systemFont(ofSize: 15, weight: .bold)
        googleSignInButton.layer.cornerRadius = 12
        googleSignInButton.layer.masksToBounds = true
        googleSignInButton.addTarget(self, action: #selector(googleSignInTapped), for: .touchUpInside)
        googleSignInButton.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(googleSignInButton)
        
        // Continue Anonymously Button
        anonymousSignInButton.backgroundColor = UIColor(red: 30/255, green: 41/255, blue: 59/255, alpha: 1.0)
        anonymousSignInButton.setTitle("👤  Continue Anonymously", for: .normal)
        anonymousSignInButton.setTitleColor(.white, for: .normal)
        anonymousSignInButton.titleLabel?.font = UIFont.systemFont(ofSize: 14, weight: .semibold)
        anonymousSignInButton.layer.cornerRadius = 12
        anonymousSignInButton.layer.borderWidth = 1
        anonymousSignInButton.layer.borderColor = UIColor(white: 1.0, alpha: 0.12).cgColor
        anonymousSignInButton.addTarget(self, action: #selector(anonymousSignInTapped), for: .touchUpInside)
        anonymousSignInButton.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(anonymousSignInButton)
        
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
        
        // Fields Stack
        let fieldsStack = UIStackView()
        fieldsStack.axis = .vertical
        fieldsStack.spacing = 14
        fieldsStack.alignment = .fill
        fieldsStack.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(fieldsStack)
        
        // First & Last Name side-by-side for Register mode
        nameStack.axis = .horizontal
        nameStack.spacing = 10
        nameStack.distribution = .fillEqually
        nameStack.translatesAutoresizingMaskIntoConstraints = false
        
        configureField(container: firstNameContainer, textField: firstNameTextField, labelText: "FIRST NAME", placeholder: "First name", icon: "person.fill", isSecure: false)
        firstNameTextField.autocapitalizationType = .words
        configureField(container: lastNameContainer, textField: lastNameTextField, labelText: "LAST NAME", placeholder: "Last name", icon: "person.fill", isSecure: false)
        lastNameTextField.autocapitalizationType = .words
        
        nameStack.addArrangedSubview(firstNameContainer)
        nameStack.addArrangedSubview(lastNameContainer)
        nameStack.isHidden = true
        fieldsStack.addArrangedSubview(nameStack)
        
        configureField(container: displayNameContainer, textField: displayNameTextField, labelText: "DISPLAY NAME (OPTIONAL)", placeholder: "e.g. MasterBlocker", icon: "sparkles", isSecure: false)
        displayNameContainer.isHidden = true
        fieldsStack.addArrangedSubview(displayNameContainer)
        
        configureField(container: emailContainer, textField: emailTextField, labelText: "EMAIL ADDRESS", placeholder: "player@example.com", icon: "envelope.fill", isSecure: false)
        emailTextField.keyboardType = .emailAddress
        emailTextField.autocapitalizationType = .none
        emailTextField.autocorrectionType = .no
        fieldsStack.addArrangedSubview(emailContainer)
        
        configureField(container: passwordContainer, textField: passwordTextField, labelText: "PASSWORD", placeholder: "At least 6 characters", icon: "lock.fill", isSecure: true)
        fieldsStack.addArrangedSubview(passwordContainer)
        
        configureField(container: confirmPasswordContainer, textField: confirmPasswordTextField, labelText: "CONFIRM PASSWORD", placeholder: "Repeat your password", icon: "lock.shield.fill", isSecure: true)
        confirmPasswordContainer.isHidden = true
        fieldsStack.addArrangedSubview(confirmPasswordContainer)
        
        // Forgot Password Button
        forgotPasswordButton.setTitle("Forgot password?", for: .normal)
        forgotPasswordButton.setTitleColor(UIColor(red: 148/255, green: 163/255, blue: 184/255, alpha: 1.0), for: .normal)
        forgotPasswordButton.titleLabel?.font = UIFont.systemFont(ofSize: 13, weight: .semibold)
        forgotPasswordButton.addTarget(self, action: #selector(forgotPasswordTapped), for: .touchUpInside)
        fieldsStack.addArrangedSubview(forgotPasswordButton)
        
        // Error Label
        errorLabel.textColor = UIColor(red: 239/255, green: 68/255, blue: 68/255, alpha: 1.0)
        errorLabel.font = UIFont.systemFont(ofSize: 13, weight: .semibold)
        errorLabel.numberOfLines = 0
        errorLabel.textAlignment = .center
        errorLabel.isHidden = true
        fieldsStack.addArrangedSubview(errorLabel)
        
        // Action Button
        actionButton.backgroundColor = UIColor(red: 56/255, green: 189/255, blue: 248/255, alpha: 1.0)
        actionButton.setTitle("Sign In", for: .normal)
        actionButton.setTitleColor(UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 1.0), for: .normal)
        actionButton.titleLabel?.font = UIFont.systemFont(ofSize: 16, weight: .bold)
        actionButton.layer.cornerRadius = 14
        actionButton.layer.masksToBounds = true
        actionButton.heightAnchor.constraint(equalToConstant: 48).isActive = true
        actionButton.addTarget(self, action: #selector(actionButtonTapped), for: .touchUpInside)
        fieldsStack.addArrangedSubview(actionButton)
        
        activityIndicator.hidesWhenStopped = true
        activityIndicator.color = UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 1.0)
        activityIndicator.translatesAutoresizingMaskIntoConstraints = false
        actionButton.addSubview(activityIndicator)
        
        // Guest & Back Buttons
        guestButton.setTitle("Continue as Guest", for: .normal)
        guestButton.setTitleColor(UIColor(red: 148/255, green: 163/255, blue: 184/255, alpha: 1.0), for: .normal)
        guestButton.titleLabel?.font = UIFont.systemFont(ofSize: 13, weight: .semibold)
        guestButton.addTarget(self, action: #selector(guestTapped), for: .touchUpInside)
        fieldsStack.addArrangedSubview(guestButton)
        
        backButton.setTitle("← Back to Game", for: .normal)
        backButton.setTitleColor(UIColor(red: 100/255, green: 116/255, blue: 139/255, alpha: 1.0), for: .normal)
        backButton.titleLabel?.font = UIFont.systemFont(ofSize: 13, weight: .medium)
        backButton.addTarget(self, action: #selector(backToGameTapped), for: .touchUpInside)
        fieldsStack.addArrangedSubview(backButton)
        
        NSLayoutConstraint.activate([
            headerIcon.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 18),
            headerIcon.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            
            titleLabel.topAnchor.constraint(equalTo: headerIcon.bottomAnchor, constant: 6),
            titleLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            titleLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
            
            subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 4),
            subtitleLabel.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 24),
            subtitleLabel.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -24),
            
            offlineBanner.topAnchor.constraint(equalTo: subtitleLabel.bottomAnchor, constant: 14),
            offlineBanner.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            offlineBanner.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
            
            appleSignInButton.topAnchor.constraint(equalTo: offlineBanner.bottomAnchor, constant: 14),
            appleSignInButton.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            appleSignInButton.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
            appleSignInButton.heightAnchor.constraint(equalToConstant: 48),
            
            googleSignInButton.topAnchor.constraint(equalTo: appleSignInButton.bottomAnchor, constant: 10),
            googleSignInButton.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            googleSignInButton.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
            googleSignInButton.heightAnchor.constraint(equalToConstant: 46),
            
            anonymousSignInButton.topAnchor.constraint(equalTo: googleSignInButton.bottomAnchor, constant: 10),
            anonymousSignInButton.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            anonymousSignInButton.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
            anonymousSignInButton.heightAnchor.constraint(equalToConstant: 44),
            
            dividerContainer.topAnchor.constraint(equalTo: anonymousSignInButton.bottomAnchor, constant: 16),
            dividerContainer.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            dividerContainer.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
            
            segmentedControl.topAnchor.constraint(equalTo: dividerContainer.bottomAnchor, constant: 14),
            segmentedControl.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            segmentedControl.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
            segmentedControl.heightAnchor.constraint(equalToConstant: 38),
            
            fieldsStack.topAnchor.constraint(equalTo: segmentedControl.bottomAnchor, constant: 18),
            fieldsStack.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            fieldsStack.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
            fieldsStack.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -32),
            
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
        
        let inputWrapper = UIView()
        inputWrapper.backgroundColor = UIColor(red: 30/255, green: 41/255, blue: 59/255, alpha: 1.0)
        inputWrapper.layer.cornerRadius = 10
        inputWrapper.layer.borderWidth = 1.5
        inputWrapper.layer.borderColor = UIColor(white: 1.0, alpha: 0.1).cgColor
        inputWrapper.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(inputWrapper)
        
        let iconView = UIImageView(image: UIImage(systemName: icon))
        iconView.tintColor = UIColor(red: 100/255, green: 116/255, blue: 139/255, alpha: 1.0)
        iconView.contentMode = .scaleAspectFit
        iconView.translatesAutoresizingMaskIntoConstraints = false
        inputWrapper.addSubview(iconView)
        
        textField.placeholder = placeholder
        textField.attributedPlaceholder = NSAttributedString(string: placeholder, attributes: [.foregroundColor: UIColor(red: 100/255, green: 116/255, blue: 139/255, alpha: 1.0)])
        textField.textColor = .white
        textField.font = UIFont.systemFont(ofSize: 15)
        textField.isSecureTextEntry = isSecure
        textField.delegate = self
        textField.translatesAutoresizingMaskIntoConstraints = false
        inputWrapper.addSubview(textField)
        
        NSLayoutConstraint.activate([
            label.topAnchor.constraint(equalTo: container.topAnchor),
            label.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 4),
            label.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            
            inputWrapper.topAnchor.constraint(equalTo: label.bottomAnchor, constant: 6),
            inputWrapper.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            inputWrapper.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            inputWrapper.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            inputWrapper.heightAnchor.constraint(equalToConstant: 44),
            
            iconView.leadingAnchor.constraint(equalTo: inputWrapper.leadingAnchor, constant: 12),
            iconView.centerYAnchor.constraint(equalTo: inputWrapper.centerYAnchor),
            iconView.widthAnchor.constraint(equalToConstant: 18),
            iconView.heightAnchor.constraint(equalToConstant: 18),
            
            textField.leadingAnchor.constraint(equalTo: iconView.trailingAnchor, constant: 10),
            textField.trailingAnchor.constraint(equalTo: inputWrapper.trailingAnchor, constant: -12),
            textField.centerYAnchor.constraint(equalTo: inputWrapper.centerYAnchor),
            textField.heightAnchor.constraint(equalTo: inputWrapper.heightAnchor)
        ])
    }
    
    private func fetchOfflineStatus() {
        scriptBridge?.evaluateJavaScript("""
        (function() {
            var max = (typeof CONFIG !== 'undefined' && CONFIG.OFFLINE) ? (CONFIG.OFFLINE.MAX_LEVELS || 5) : 5;
            var played = (typeof App !== 'undefined' && App.state) ? (App.state.offlineLevelsPlayed || 0) : 0;
            return JSON.stringify({ max: max, remaining: Math.max(0, max - played) });
        })();
        """) { [weak self] (result, _) in
            if let str = result as? String,
               let data = str.data(using: .utf8),
               let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let remaining = dict["remaining"] as? Int,
               let max = dict["max"] as? Int {
                DispatchQueue.main.async {
                    self?.offlineLabel.text = "📱 Offline Mode: \(remaining) of \(max) moves remaining"
                    if remaining <= 2 {
                        self?.offlineBanner.layer.borderColor = UIColor(red: 239/255, green: 68/255, blue: 68/255, alpha: 0.6).cgColor
                        self?.offlineLabel.textColor = UIColor(red: 239/255, green: 68/255, blue: 68/255, alpha: 1.0)
                    }
                }
            }
        }
    }
    
    private func setupKeyboardObservers() {
        NotificationCenter.default.addObserver(self, selector: #selector(keyboardWillShow), name: UIResponder.keyboardWillShowNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(keyboardWillHide), name: UIResponder.keyboardWillHideNotification, object: nil)
    }
    
    @objc private func keyboardWillShow(_ note: Notification) {
        guard let frame = note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else { return }
        scrollView.contentInset.bottom = frame.height + 20
        scrollView.verticalScrollIndicatorInsets.bottom = frame.height + 20
    }
    
    @objc private func keyboardWillHide(_ note: Notification) {
        scrollView.contentInset.bottom = 0
        scrollView.verticalScrollIndicatorInsets.bottom = 0
    }
    
    @objc private func closeTapped() {
        dismissKeyboard()
        dismiss(animated: true)
    }
    
    @objc private func backToGameTapped() {
        dismissKeyboard()
        scriptBridge?.evaluateJavaScript("if (typeof App !== 'undefined' && App.closeLogin) App.closeLogin();")
        dismiss(animated: true)
    }
    
    @objc private func guestTapped() {
        dismissKeyboard()
        scriptBridge?.evaluateJavaScript("if (typeof App !== 'undefined' && App.skipLogin) App.skipLogin();")
        dismiss(animated: true)
    }
    
    @objc private func segmentChanged() {
        dismissKeyboard()
        isSignUpMode = (segmentedControl.selectedSegmentIndex == 1)
        nameStack.isHidden = !isSignUpMode
        displayNameContainer.isHidden = !isSignUpMode
        confirmPasswordContainer.isHidden = !isSignUpMode
        forgotPasswordButton.isHidden = isSignUpMode
        actionButton.setTitle(isSignUpMode ? "Create Account" : "Sign In", for: .normal)
        errorLabel.isHidden = true
        view.layoutIfNeeded()
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
    
    @objc private func googleSignInTapped() {
        HapticManager.shared.impact(style: .medium)
        setLoading(true)
        scriptBridge?.evaluateJavaScript("""
        (async function() {
            try {
                if (typeof App !== 'undefined' && App.handleGoogleSignIn) {
                    await App.handleGoogleSignIn();
                    return JSON.stringify({ success: true });
                }
                return JSON.stringify({ success: false, error: 'App not loaded' });
            } catch(e) {
                return JSON.stringify({ success: false, error: e.message });
            }
        })();
        """) { [weak self] (_, _) in
            DispatchQueue.main.async {
                self?.setLoading(false)
                self?.dismiss(animated: true) {
                    self?.onAuthSuccess?()
                }
            }
        }
    }
    
    @objc private func anonymousSignInTapped() {
        HapticManager.shared.impact(style: .medium)
        setLoading(true)
        scriptBridge?.evaluateJavaScript("""
        (async function() {
            try {
                if (typeof App !== 'undefined' && App.handleAnonymousSignIn) {
                    await App.handleAnonymousSignIn();
                    return JSON.stringify({ success: true });
                }
                return JSON.stringify({ success: false, error: 'App not loaded' });
            } catch(e) {
                return JSON.stringify({ success: false, error: e.message });
            }
        })();
        """) { [weak self] (_, _) in
            DispatchQueue.main.async {
                self?.setLoading(false)
                self?.dismiss(animated: true) {
                    self?.onAuthSuccess?()
                }
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
            let escaped = email.replacingOccurrences(of: "'", with: "\\'")
            self?.scriptBridge?.evaluateJavaScript("if (typeof FirebaseService !== 'undefined') FirebaseService.sendPasswordReset('\(escaped)');")
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
        
        if isSignUpMode {
            let firstName = firstNameTextField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let lastName = lastNameTextField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let displayName = displayNameTextField.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let confirmPassword = confirmPasswordTextField.text ?? ""
            
            guard !firstName.isEmpty else {
                showError("Please enter your first name.")
                return
            }
            guard !lastName.isEmpty else {
                showError("Please enter your last name.")
                return
            }
            guard !email.isEmpty && email.contains("@") && email.contains(".") else {
                showError("Please enter a valid email address.")
                return
            }
            guard password.count >= 6 else {
                showError("Password must be at least 6 characters.")
                return
            }
            guard password == confirmPassword else {
                showError("Passwords do not match.")
                return
            }
            
            let fullDisplayName = displayName.isEmpty ? "\(firstName) \(lastName)" : displayName
            performSignUp(firstName: firstName, lastName: lastName, fullDisplayName: fullDisplayName, email: email, password: password)
        } else {
            guard !email.isEmpty else {
                showError("Please enter your email address.")
                return
            }
            guard password.count >= 6 else {
                showError("Password must be at least 6 characters.")
                return
            }
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
                    if (res && res.success) {
                        if (typeof App !== 'undefined' && App.handleSuccessfulLogin) {
                            App.handleSuccessfulLogin(res.user, 'email');
                        }
                        return JSON.stringify({ success: true, user: res.user });
                    } else {
                        return JSON.stringify({ success: false, error: (res && res.error) || 'Invalid credentials' });
                    }
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
    
    private func performSignUp(firstName: String, lastName: String, fullDisplayName: String, email: String, password: String) {
        setLoading(true)
        let escapedFirst = firstName.replacingOccurrences(of: "'", with: "\\'")
        let escapedLast = lastName.replacingOccurrences(of: "'", with: "\\'")
        let escapedName = fullDisplayName.replacingOccurrences(of: "'", with: "\\'")
        let escapedEmail = email.replacingOccurrences(of: "'", with: "\\'")
        let escapedPassword = password.replacingOccurrences(of: "'", with: "\\'")
        
        let js = """
        (async function() {
            try {
                if (typeof FirebaseService !== 'undefined') {
                    const res = await FirebaseService.signUpWithEmail('\(escapedEmail)', '\(escapedPassword)', '\(escapedName)');
                    if (res && res.success) {
                        if (typeof App !== 'undefined') {
                            App.state.firstName = '\(escapedFirst)';
                            App.state.lastName = '\(escapedLast)';
                            App.state.playerName = '\(escapedName)';
                            if (App.handleSuccessfulLogin) {
                                App.handleSuccessfulLogin(res.user, 'email');
                            }
                        }
                        return JSON.stringify({ success: true, user: res.user });
                    } else {
                        return JSON.stringify({ success: false, error: (res && res.error) || 'Registration failed' });
                    }
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
    
    private func dismissKeyboard() {
        view.endEditing(true)
    }
    
    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        if textField == firstNameTextField {
            lastNameTextField.becomeFirstResponder()
        } else if textField == lastNameTextField {
            displayNameTextField.becomeFirstResponder()
        } else if textField == displayNameTextField {
            emailTextField.becomeFirstResponder()
        } else if textField == emailTextField {
            passwordTextField.becomeFirstResponder()
        } else if textField == passwordTextField {
            if isSignUpMode {
                confirmPasswordTextField.becomeFirstResponder()
            } else {
                actionButtonTapped()
            }
        } else if textField == confirmPasswordTextField {
            actionButtonTapped()
        }
        return true
    }
}

// MARK: - Native Daily Reward View Controller
final class NativeDailyRewardViewController: UIViewController {
    
    weak var scriptBridge: ScriptBridge?
    
    private let rewards = [100, 200, 300, 500, 750, 1000, 2000]
    private var currentStreak: Int = 1
    private var isClaimedToday: Bool = false
    
    private let titleLabel = UILabel()
    private let subtitleLabel = UILabel()
    private let gridStack = UIStackView()
    private let claimButton = UIButton(type: .system)
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        loadDailyStatus()
    }
    
    private func setupUI() {
        title = "Daily Streak Reward"
        view.backgroundColor = UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 1.0)
        
        let closeItem = UIBarButtonItem(barButtonSystemItem: .close, target: self, action: #selector(closeTapped))
        navigationItem.rightBarButtonItem = closeItem
        navigationController?.navigationBar.tintColor = .white
        navigationController?.navigationBar.barStyle = .black
        
        titleLabel.text = "📅 7-Day Login Streak"
        titleLabel.font = UIFont.systemFont(ofSize: 22, weight: .bold)
        titleLabel.textColor = .white
        titleLabel.textAlignment = .center
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(titleLabel)
        
        subtitleLabel.text = "Check in every day to claim bonus gold coins!"
        subtitleLabel.font = UIFont.systemFont(ofSize: 13, weight: .medium)
        subtitleLabel.textColor = UIColor(red: 148/255, green: 163/255, blue: 184/255, alpha: 1.0)
        subtitleLabel.textAlignment = .center
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(subtitleLabel)
        
        gridStack.axis = .vertical
        gridStack.spacing = 10
        gridStack.distribution = .fillEqually
        gridStack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(gridStack)
        
        claimButton.backgroundColor = UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 1.0)
        claimButton.setTitle("💰 Claim Daily Reward", for: .normal)
        claimButton.setTitleColor(UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 1.0), for: .normal)
        claimButton.titleLabel?.font = UIFont.systemFont(ofSize: 16, weight: .bold)
        claimButton.layer.cornerRadius = 14
        claimButton.layer.masksToBounds = true
        claimButton.addTarget(self, action: #selector(claimTapped), for: .touchUpInside)
        claimButton.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(claimButton)
        
        NSLayoutConstraint.activate([
            titleLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 20),
            titleLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            titleLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            
            subtitleLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 6),
            subtitleLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            subtitleLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            
            gridStack.topAnchor.constraint(equalTo: subtitleLabel.bottomAnchor, constant: 20),
            gridStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            gridStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            
            claimButton.topAnchor.constraint(equalTo: gridStack.bottomAnchor, constant: 24),
            claimButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            claimButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            claimButton.heightAnchor.constraint(equalToConstant: 50),
            claimButton.bottomAnchor.constraint(lessThanOrEqualTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -20)
        ])
    }
    
    private func loadDailyStatus() {
        scriptBridge?.evaluateJavaScript("""
        (function() {
            var s = (typeof App !== 'undefined' && App.state) ? App.state : {};
            return JSON.stringify({
                streak: s.streakDays || 1,
                claimed: !!s.dailyChallengeDone
            });
        })();
        """) { [weak self] (result, _) in
            if let str = result as? String,
               let data = str.data(using: .utf8),
               let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                let streak = dict["streak"] as? Int ?? 1
                let claimed = dict["claimed"] as? Bool ?? false
                DispatchQueue.main.async {
                    self?.currentStreak = max(1, min(7, streak))
                    self?.isClaimedToday = claimed
                    self?.renderGrid()
                    self?.updateClaimButton()
                }
            } else {
                DispatchQueue.main.async {
                    self?.renderGrid()
                    self?.updateClaimButton()
                }
            }
        }
    }
    
    private func renderGrid() {
        gridStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        
        let row1 = UIStackView()
        row1.axis = .horizontal
        row1.spacing = 8
        row1.distribution = .fillEqually
        
        let row2 = UIStackView()
        row2.axis = .horizontal
        row2.spacing = 8
        row2.distribution = .fillEqually
        
        for day in 1...7 {
            let card = createDayCard(day: day, reward: rewards[day - 1])
            if day <= 4 {
                row1.addArrangedSubview(card)
            } else {
                row2.addArrangedSubview(card)
            }
        }
        
        gridStack.addArrangedSubview(row1)
        gridStack.addArrangedSubview(row2)
    }
    
    private func createDayCard(day: Int, reward: Int) -> UIView {
        let card = UIView()
        card.layer.cornerRadius = 10
        card.translatesAutoresizingMaskIntoConstraints = false
        card.heightAnchor.constraint(equalToConstant: 74).isActive = true
        
        let isPast = day < currentStreak || (day == currentStreak && isClaimedToday)
        let isCurrent = day == currentStreak && !isClaimedToday
        
        if isCurrent {
            card.backgroundColor = UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 0.2)
            card.layer.borderWidth = 2
            card.layer.borderColor = UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 1.0).cgColor
        } else if isPast {
            card.backgroundColor = UIColor(red: 16/255, green: 185/255, blue: 129/255, alpha: 0.15)
            card.layer.borderWidth = 1
            card.layer.borderColor = UIColor(red: 16/255, green: 185/255, blue: 129/255, alpha: 0.5).cgColor
        } else {
            card.backgroundColor = UIColor(red: 30/255, green: 41/255, blue: 59/255, alpha: 1.0)
            card.layer.borderWidth = 1
            card.layer.borderColor = UIColor(white: 1.0, alpha: 0.08).cgColor
        }
        
        let dayLabel = UILabel()
        dayLabel.text = "Day \(day)"
        dayLabel.font = UIFont.systemFont(ofSize: 11, weight: .bold)
        dayLabel.textColor = isCurrent ? UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 1.0) : UIColor(red: 148/255, green: 163/255, blue: 184/255, alpha: 1.0)
        dayLabel.textAlignment = .center
        dayLabel.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(dayLabel)
        
        let iconLabel = UILabel()
        iconLabel.text = isPast ? "✅" : (day == 7 ? "👑" : "💰")
        iconLabel.font = UIFont.systemFont(ofSize: 18)
        iconLabel.textAlignment = .center
        iconLabel.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(iconLabel)
        
        let rewardLabel = UILabel()
        rewardLabel.text = "+\(reward)"
        rewardLabel.font = UIFont.systemFont(ofSize: 12, weight: .heavy)
        rewardLabel.textColor = .white
        rewardLabel.textAlignment = .center
        rewardLabel.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(rewardLabel)
        
        NSLayoutConstraint.activate([
            dayLabel.topAnchor.constraint(equalTo: card.topAnchor, constant: 6),
            dayLabel.centerXAnchor.constraint(equalTo: card.centerXAnchor),
            
            iconLabel.centerYAnchor.constraint(equalTo: card.centerYAnchor),
            iconLabel.centerXAnchor.constraint(equalTo: card.centerXAnchor),
            
            rewardLabel.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -6),
            rewardLabel.centerXAnchor.constraint(equalTo: card.centerXAnchor)
        ])
        
        return card
    }
    
    private func updateClaimButton() {
        if isClaimedToday {
            claimButton.isEnabled = false
            claimButton.backgroundColor = UIColor(red: 30/255, green: 41/255, blue: 59/255, alpha: 1.0)
            claimButton.setTitle("✅ Claimed for Today!", for: .normal)
            claimButton.setTitleColor(UIColor(red: 148/255, green: 163/255, blue: 184/255, alpha: 1.0), for: .normal)
        } else {
            let reward = rewards[currentStreak - 1]
            claimButton.isEnabled = true
            claimButton.backgroundColor = UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 1.0)
            claimButton.setTitle("💰 Claim +\(reward) Coins", for: .normal)
            claimButton.setTitleColor(UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 1.0), for: .normal)
        }
    }
    
    @objc private func claimTapped() {
        guard !isClaimedToday else { return }
        let reward = rewards[currentStreak - 1]
        let nextStreak = currentStreak >= 7 ? 1 : currentStreak + 1
        
        HapticManager.shared.notification(type: .success)
        
        let js = """
        (function() {
            if (typeof App !== 'undefined' && App.state) {
                App.state.coins = (App.state.coins || 0) + \(reward);
                App.state.dailyChallengeDone = true;
                App.state.streakDays = \(nextStreak);
                App.saveState();
                App.updateAllCoinDisplays();
                if (typeof FirebaseService !== 'undefined') {
                    FirebaseService.saveUserData(App.state);
                }
                App.showToast('🎉 +\(reward) Daily Bonus Coins Claimed!');
            }
        })();
        """
        
        scriptBridge?.evaluateJavaScript(js) { [weak self] (_, _) in
            DispatchQueue.main.async {
                self?.isClaimedToday = true
                self?.renderGrid()
                self?.updateClaimButton()
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                    self?.dismiss(animated: true)
                }
            }
        }
    }
    
    @objc private func closeTapped() {
        dismiss(animated: true)
    }
}
