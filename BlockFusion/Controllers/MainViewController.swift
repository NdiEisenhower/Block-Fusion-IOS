import UIKit
import WebKit
import StoreKit
import GameKit
import AuthenticationServices

final class MainViewController: UIViewController {
    
    private var topBar: NativeTopBar!
    private var bottomBar: NativeBottomBar!
    private var webView: WKWebView!
    let bannerContainer = UIView()
    private let scriptBridge = ScriptBridge()
    private let preferences = PreferencesManager.shared
    
    private var topBarHeightConstraint: NSLayoutConstraint!
    private var bottomBarHeightConstraint: NSLayoutConstraint!
    private var bannerBottomConstraint: NSLayoutConstraint!
    private var bannerHeightConstraint: NSLayoutConstraint!
    private var currentScreen: String = "home"
    var isUserLoggedIn: Bool = false
    
    private static let remoteGameUrl = "https://blockrush2k.kharitambe.co.za"
    private var currentBannerHeight: CGFloat = 0
    
    // MARK: - Safe Area Handling
    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        updateSafeAreaInsets()
    }
    
    private func updateSafeAreaInsets() {
        let isGame = (currentScreen == "game")
        let top: CGFloat = isGame ? 4.0 : 0.0
        let bottom: CGFloat = isGame ? 6.0 : 0.0
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
        overrideUserInterfaceStyle = .dark
        view.backgroundColor = UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 1.0)
        
        setupTopBar()
        setupBottomBar()
        setupBannerContainer()
        setupWebView()
        
        // Ensure navigation bars stay on top of the web view in the Z-order hierarchy
        view.bringSubviewToFront(bannerContainer)
        view.bringSubviewToFront(bottomBar)
        view.bringSubviewToFront(topBar)
        
        setupManagers()
        loadGame()
    }
    
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // Ensure bottom navigation bar stays above webview and ads
        view.bringSubviewToFront(bannerContainer)
        view.bringSubviewToFront(bottomBar)
        AdMobManager.shared.updateBannerLayout(in: bannerContainer)
    }
    
    // MARK: - Native Modals
    func presentNativeAuth(onSuccess: (() -> Void)? = nil) {
        let authVC = NativeAuthViewController()
        authVC.scriptBridge = scriptBridge
        authVC.onAuthSuccess = onSuccess
        let nav = UINavigationController(rootViewController: authVC)
        nav.overrideUserInterfaceStyle = .dark
        nav.modalPresentationStyle = .pageSheet
        if let sheet = nav.sheetPresentationController {
            sheet.detents = [.large()]
            sheet.prefersGrabberVisible = true
        }
        present(nav, animated: true)
    }
    
    func presentDailyReward() {
        let dailyVC = NativeDailyChallengeViewController()
        dailyVC.scriptBridge = scriptBridge
        let nav = UINavigationController(rootViewController: dailyVC)
        nav.overrideUserInterfaceStyle = .dark
        nav.modalPresentationStyle = .pageSheet
        if let sheet = nav.sheetPresentationController {
            sheet.detents = [.large()]
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
        
        topBar.onAudioTapped = { [weak self] in
            guard let self = self else { return }
            self.preferences.soundEnabled.toggle()
            self.topBar.setAudioEnabled(self.preferences.soundEnabled)
            HapticManager.shared.impact(style: .light)
            
            // Audible feedback on toggle (toggle_on plays bright chime, toggle_off plays soft click)
            if self.preferences.soundEnabled {
                NativeSoundManager.shared.play("toggle_on")
            } else {
                NativeSoundManager.shared.play("toggle_off")
            }
            
            let enabled = self.preferences.soundEnabled ? "true" : "false"
            self.scriptBridge.evaluateJavaScript("""
            if (typeof SoundManager !== 'undefined') {
                SoundManager.enabled = \(enabled);
            }
            if (typeof App !== 'undefined' && App.state) {
                App.state.soundOn = \(enabled);
                App.saveState();
            }
            if (typeof Navigation !== 'undefined' && typeof Navigation.renderSettings === 'function') {
                Navigation.renderSettings();
            }
            """)
        }
        
        topBar.onSignInTapped = { [weak self] in
            guard let self = self else { return }
            HapticManager.shared.selection()
            self.presentNativeAuth()
        }
        
        topBar.onLogOutTapped = { [weak self] in
            guard let self = self else { return }
            HapticManager.shared.impact(style: .medium)
            self.scriptBridge.evaluateJavaScript("""
            if (typeof App !== 'undefined' && typeof App.signOut === 'function') {
                App.signOut();
            }
            """)
            self.isUserLoggedIn = false
            self.topBar.setAuthState(isLoggedIn: false, displayName: nil)
        }
        
        topBar.onSettingsTapped = { [weak self] in
            guard let self = self else { return }
            HapticManager.shared.selection()
            self.bottomBar.selectTab(forScreen: "settings")
            let js = """
            (function() {
                if (typeof Navigation !== 'undefined' && typeof Navigation.navigateTo === 'function') {
                    Navigation.navigateTo('settings');
                }
            })();
            """
            self.scriptBridge.evaluateJavaScript(js)
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
    
    private func setupBannerContainer() {
        bannerContainer.accessibilityIdentifier = "bannerContainer"
        bannerContainer.backgroundColor = UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 1.0)
        bannerContainer.clipsToBounds = true
        bannerContainer.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(bannerContainer)
        
        bannerBottomConstraint = bannerContainer.bottomAnchor.constraint(equalTo: bottomBar.topAnchor)
        bannerHeightConstraint = bannerContainer.heightAnchor.constraint(equalToConstant: 0)
        
        NSLayoutConstraint.activate([
            bannerContainer.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bannerContainer.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bannerBottomConstraint,
            bannerHeightConstraint
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
        contentController.add(scriptBridge, name: "soundBridge")
        
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
        
        // Web view sits comfortably between top navigation bar and banner container
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: topBar.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: bannerContainer.topAnchor)
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
        case "leaderboard", "ranks": target = "leaderboard"
        case "daily": target = "daily"
        case "achievements": target = "achievements"
        case "settings": target = "settings"
        case "world", "worlds": target = "world-select"
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
            self.bannerHeightConstraint.constant = visible ? height : 0
            self.bannerContainer.isHidden = !visible
            self.updateSafeAreaInsets()
            UIView.animate(withDuration: 0.25) {
                self.view.layoutIfNeeded()
            }
        }
    }
}

// MARK: - ScriptBridgeDelegate
extension MainViewController: ScriptBridgeDelegate {
    var bannerContainerView: UIView? {
        return bannerContainer
    }
    
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
            
            self.bannerBottomConstraint.isActive = false
            if isGame {
                self.bannerBottomConstraint = self.bannerContainer.bottomAnchor.constraint(equalTo: self.view.safeAreaLayoutGuide.bottomAnchor)
            } else {
                self.bannerBottomConstraint = self.bannerContainer.bottomAnchor.constraint(equalTo: self.bottomBar.topAnchor)
            }
            self.bannerBottomConstraint.isActive = true
            
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
    
    func didTrackEvent(name: String, parameters: [String: Any]) {
        let screen = parameters["screen_name"] as? String ?? currentScreen
        let section = parameters["section_name"] as? String
        let element = parameters["element_name"] as? String
        
        switch name {
        case "screen_view":
            let title = parameters["page_title"] as? String ?? screen
            let prev = parameters["previous_screen"] as? String ?? "initial"
            print("📱 [iOS Telemetry] Screen View: [\(screen)] (Title: \(title), Prev: \(prev))")
        case "section_view":
            print("📑 [iOS Telemetry] Section View: [\(section ?? "unknown")] on screen [\(screen)]")
        case "section_click":
            print("👆 [iOS Telemetry] Click: [\(element ?? "unknown")] in section [\(section ?? "unknown")] on screen [\(screen)]")
        default:
            print("📊 [iOS Telemetry] Event [\(name)]: \(parameters)")
        }
    }
    
    func didChangeAuthStatus(isLoggedIn: Bool, displayName: String?) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.isUserLoggedIn = isLoggedIn
            self.topBar.setAuthState(isLoggedIn: isLoggedIn, displayName: displayName)
        }
    }
}

// MARK: - Native Top Bar UI
final class NativeTopBar: UIView {
    let titleLabel = UILabel()
    let audioButton = UIButton(type: .system)
    let menuButton = UIButton(type: .system)
    
    var onAudioTapped: (() -> Void)?
    var onSignInTapped: (() -> Void)?
    var onLogOutTapped: (() -> Void)?
    var onSettingsTapped: (() -> Void)?
    
    private var isUserLoggedIn: Bool = false
    private var currentDisplayName: String? = nil
    
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
        
        let rightStack = UIStackView()
        rightStack.axis = .horizontal
        rightStack.spacing = 10
        rightStack.alignment = .center
        rightStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rightStack)
        
        // Audio Toggle
        let audioConfig = UIImage.SymbolConfiguration(pointSize: 17, weight: .semibold)
        audioButton.setImage(UIImage(systemName: "speaker.wave.2.fill", withConfiguration: audioConfig), for: .normal)
        audioButton.tintColor = UIColor(red: 56/255, green: 189/255, blue: 248/255, alpha: 1.0)
        audioButton.translatesAutoresizingMaskIntoConstraints = false
        audioButton.addTarget(self, action: #selector(soundTapped), for: .touchUpInside)
        NSLayoutConstraint.activate([
            audioButton.widthAnchor.constraint(equalToConstant: 32),
            audioButton.heightAnchor.constraint(equalToConstant: 32)
        ])
        rightStack.addArrangedSubview(audioButton)
        
        // 3-Dot Action Bar Menu Button (Sign In / Log Out & Settings)
        let menuConfig = UIImage.SymbolConfiguration(pointSize: 15, weight: .bold)
        menuButton.setImage(UIImage(systemName: "ellipsis", withConfiguration: menuConfig), for: .normal)
        menuButton.tintColor = .white
        menuButton.backgroundColor = UIColor(white: 1.0, alpha: 0.12)
        menuButton.layer.cornerRadius = 16
        menuButton.layer.borderWidth = 1.0
        menuButton.layer.borderColor = UIColor(white: 1.0, alpha: 0.18).cgColor
        menuButton.showsMenuAsPrimaryAction = true
        menuButton.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            menuButton.widthAnchor.constraint(equalToConstant: 32),
            menuButton.heightAnchor.constraint(equalToConstant: 32)
        ])
        rightStack.addArrangedSubview(menuButton)
        
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
            
            rightStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -14),
            rightStack.centerYAnchor.constraint(equalTo: centerYAnchor)
        ])
        
        setAuthState(isLoggedIn: false, displayName: nil)
    }
    
    func setAudioEnabled(_ enabled: Bool) {
        let name = enabled ? "speaker.wave.2.fill" : "speaker.slash.fill"
        let config = UIImage.SymbolConfiguration(pointSize: 17, weight: .semibold)
        audioButton.setImage(UIImage(systemName: name, withConfiguration: config), for: .normal)
        audioButton.tintColor = enabled ? UIColor(red: 56/255, green: 189/255, blue: 248/255, alpha: 1.0) : UIColor(red: 148/255, green: 163/255, blue: 184/255, alpha: 1.0)
    }
    
    func setAuthState(isLoggedIn: Bool, displayName: String?) {
        self.isUserLoggedIn = isLoggedIn
        self.currentDisplayName = displayName
        
        let settingsAction = UIAction(
            title: "Settings",
            image: UIImage(systemName: "gearshape.fill")
        ) { [weak self] _ in
            self?.onSettingsTapped?()
        }
        
        if isLoggedIn {
            let name = (displayName?.isEmpty == false) ? displayName! : "Player"
            let playerAction = UIAction(
                title: name,
                image: UIImage(systemName: "person.crop.circle.fill"),
                attributes: .disabled
            ) { _ in }
            
            let logOutAction = UIAction(
                title: "Log Out",
                image: UIImage(systemName: "rectangle.portrait.and.arrow.right"),
                attributes: .destructive
            ) { [weak self] _ in
                self?.onLogOutTapped?()
            }
            
            menuButton.menu = UIMenu(title: "Account", children: [playerAction, settingsAction, logOutAction])
            menuButton.tintColor = UIColor(red: 56/255, green: 189/255, blue: 248/255, alpha: 1.0)
            menuButton.layer.borderColor = UIColor(red: 56/255, green: 189/255, blue: 248/255, alpha: 0.4).cgColor
            menuButton.backgroundColor = UIColor(red: 56/255, green: 189/255, blue: 248/255, alpha: 0.16)
        } else {
            let signInAction = UIAction(
                title: "Sign In",
                image: UIImage(systemName: "person.badge.plus")
            ) { [weak self] _ in
                self?.onSignInTapped?()
            }
            
            menuButton.menu = UIMenu(title: "Menu", children: [signInAction, settingsAction])
            menuButton.tintColor = .white
            menuButton.layer.borderColor = UIColor(white: 1.0, alpha: 0.18).cgColor
            menuButton.backgroundColor = UIColor(white: 1.0, alpha: 0.12)
        }
    }
    
    @objc private func soundTapped() { onAudioTapped?() }
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
        TabItem(id: "main", title: "Main", symbolName: "house.fill", targetScreen: "home"),
        TabItem(id: "worlds", title: "Worlds", symbolName: "globe.americas.fill", targetScreen: "world-select"),
        TabItem(id: "ranks", title: "Ranks", symbolName: "trophy.fill", targetScreen: "leaderboard"),
        TabItem(id: "store", title: "Store", symbolName: "bag.fill", targetScreen: "store"),
        TabItem(id: "settings", title: "Settings", symbolName: "gearshape.fill", targetScreen: "settings")
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
    
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        // Expand top hit-test area by 28pt so the elevated Ranks medallion catches taps
        let hitFrame = bounds.inset(by: UIEdgeInsets(top: -28, left: 0, bottom: 0, right: 0))
        return hitFrame.contains(point)
    }
    
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        if !self.isUserInteractionEnabled || self.isHidden || self.alpha < 0.01 {
            return nil
        }
        if self.point(inside: point, with: event) {
            // Check elevated ranks button first
            if buttonViews.count > 2 {
                let elevatedBtn = buttonViews[2]
                let pt = self.convert(point, to: elevatedBtn)
                if elevatedBtn.point(inside: pt, with: event) {
                    return elevatedBtn
                }
            }
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
        clipsToBounds = false
        backgroundColor = UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 0.95)
        layer.cornerRadius = 24
        layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
        
        // Ambient glow / drop shadow
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOpacity = 0.45
        layer.shadowRadius = 14
        layer.shadowOffset = CGSize(width: 0, height: -4)
        
        let blurEffect = UIBlurEffect(style: .systemUltraThinMaterialDark)
        let blurView = UIVisualEffectView(effect: blurEffect)
        blurView.isUserInteractionEnabled = false
        blurView.layer.cornerRadius = 24
        blurView.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
        blurView.layer.masksToBounds = true
        blurView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(blurView)
        sendSubviewToBack(blurView)
        
        let topBorder = UIView()
        topBorder.isUserInteractionEnabled = false
        topBorder.backgroundColor = UIColor(white: 1.0, alpha: 0.12)
        topBorder.translatesAutoresizingMaskIntoConstraints = false
        addSubview(topBorder)
        
        let stackView = UIStackView()
        stackView.axis = .horizontal
        stackView.distribution = .fillEqually
        stackView.alignment = .fill
        stackView.isUserInteractionEnabled = true
        stackView.clipsToBounds = false
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
            topBorder.heightAnchor.constraint(equalToConstant: 0.75),
            
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
        case "leaderboard", "achievements":
            index = 2
        case "store":
            index = 3
        case "settings":
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
    let isElevated: Bool
    
    // Regular Tab Views
    private let selectionPill = UIView()
    private let iconImageView = UIImageView()
    private let titleLabelCustom = UILabel()
    private let activeDot = UIView()
    
    // Elevated Center Medallion View (for Ranks)
    private let medallionView = UIView()
    
    private let activeColor = UIColor(red: 56/255, green: 189/255, blue: 248/255, alpha: 1.0)
    private let inactiveColor = UIColor(red: 100/255, green: 116/255, blue: 139/255, alpha: 1.0)
    private let goldActiveColor = UIColor(red: 251/255, green: 191/255, blue: 36/255, alpha: 1.0)
    private let goldMutedColor = UIColor(red: 217/255, green: 119/255, blue: 6/255, alpha: 0.9)
    
    init(item: NativeBottomBar.TabItem, index: Int) {
        self.item = item
        self.index = index
        self.isElevated = (item.id == "ranks")
        super.init(frame: .zero)
        setupView()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        if isElevated {
            // Expand upwards for the elevated circular medallion
            let expanded = bounds.inset(by: UIEdgeInsets(top: -26, left: -6, bottom: -6, right: -6))
            return expanded.contains(point)
        }
        return bounds.insetBy(dx: -6, dy: -6).contains(point)
    }
    
    private func setupView() {
        backgroundColor = .clear
        isExclusiveTouch = true
        isUserInteractionEnabled = true
        clipsToBounds = false
        
        if isElevated {
            setupElevatedView()
        } else {
            setupStandardView()
        }
    }
    
    private func setupStandardView() {
        // Soft glowing selection pill behind icon
        selectionPill.backgroundColor = UIColor(red: 56/255, green: 189/255, blue: 248/255, alpha: 0.16)
        selectionPill.layer.cornerRadius = 13
        selectionPill.layer.borderWidth = 1.0
        selectionPill.layer.borderColor = UIColor(red: 56/255, green: 189/255, blue: 248/255, alpha: 0.3).cgColor
        selectionPill.alpha = 0
        selectionPill.isUserInteractionEnabled = false
        selectionPill.translatesAutoresizingMaskIntoConstraints = false
        addSubview(selectionPill)
        
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
        activeDot.layer.cornerRadius = 1.5
        activeDot.layer.shadowColor = activeColor.cgColor
        activeDot.layer.shadowRadius = 4
        activeDot.layer.shadowOpacity = 0.8
        activeDot.layer.shadowOffset = .zero
        activeDot.alpha = 0
        activeDot.isUserInteractionEnabled = false
        activeDot.translatesAutoresizingMaskIntoConstraints = false
        addSubview(activeDot)
        
        NSLayoutConstraint.activate([
            selectionPill.centerXAnchor.constraint(equalTo: centerXAnchor),
            selectionPill.topAnchor.constraint(equalTo: topAnchor, constant: 4),
            selectionPill.widthAnchor.constraint(equalToConstant: 44),
            selectionPill.heightAnchor.constraint(equalToConstant: 26),
            
            iconImageView.centerXAnchor.constraint(equalTo: selectionPill.centerXAnchor),
            iconImageView.centerYAnchor.constraint(equalTo: selectionPill.centerYAnchor),
            iconImageView.widthAnchor.constraint(equalToConstant: 20),
            iconImageView.heightAnchor.constraint(equalToConstant: 20),
            
            titleLabelCustom.topAnchor.constraint(equalTo: selectionPill.bottomAnchor, constant: 2),
            titleLabelCustom.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 2),
            titleLabelCustom.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -2),
            
            activeDot.topAnchor.constraint(equalTo: titleLabelCustom.bottomAnchor, constant: 2),
            activeDot.centerXAnchor.constraint(equalTo: centerXAnchor),
            activeDot.widthAnchor.constraint(equalToConstant: 12),
            activeDot.heightAnchor.constraint(equalToConstant: 3)
        ])
    }
    
    private func setupElevatedView() {
        // Floating circular golden medallion lifted above navigation bar
        medallionView.backgroundColor = UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 1.0)
        medallionView.layer.cornerRadius = 24
        medallionView.layer.borderWidth = 3.5
        medallionView.layer.borderColor = UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 1.0).cgColor
        medallionView.layer.shadowColor = UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 0.65).cgColor
        medallionView.layer.shadowOffset = CGSize(width: 0, height: 3)
        medallionView.layer.shadowRadius = 8
        medallionView.layer.shadowOpacity = 0.6
        medallionView.isUserInteractionEnabled = false
        medallionView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(medallionView)
        
        let config = UIImage.SymbolConfiguration(pointSize: 21, weight: .bold)
        iconImageView.image = UIImage(systemName: item.symbolName, withConfiguration: config)
        iconImageView.contentMode = .scaleAspectFit
        iconImageView.tintColor = .white
        iconImageView.isUserInteractionEnabled = false
        iconImageView.translatesAutoresizingMaskIntoConstraints = false
        medallionView.addSubview(iconImageView)
        
        titleLabelCustom.text = item.title
        titleLabelCustom.font = UIFont.systemFont(ofSize: 10, weight: .heavy)
        titleLabelCustom.textColor = goldMutedColor
        titleLabelCustom.textAlignment = .center
        titleLabelCustom.isUserInteractionEnabled = false
        titleLabelCustom.translatesAutoresizingMaskIntoConstraints = false
        addSubview(titleLabelCustom)
        
        activeDot.backgroundColor = goldActiveColor
        activeDot.layer.cornerRadius = 1.5
        activeDot.layer.shadowColor = goldActiveColor.cgColor
        activeDot.layer.shadowRadius = 4
        activeDot.layer.shadowOpacity = 0.8
        activeDot.layer.shadowOffset = .zero
        activeDot.alpha = 0
        activeDot.isUserInteractionEnabled = false
        activeDot.translatesAutoresizingMaskIntoConstraints = false
        addSubview(activeDot)
        
        NSLayoutConstraint.activate([
            medallionView.centerXAnchor.constraint(equalTo: centerXAnchor),
            medallionView.topAnchor.constraint(equalTo: topAnchor, constant: -16),
            medallionView.widthAnchor.constraint(equalToConstant: 48),
            medallionView.heightAnchor.constraint(equalToConstant: 48),
            
            iconImageView.centerXAnchor.constraint(equalTo: medallionView.centerXAnchor),
            iconImageView.centerYAnchor.constraint(equalTo: medallionView.centerYAnchor),
            iconImageView.widthAnchor.constraint(equalToConstant: 24),
            iconImageView.heightAnchor.constraint(equalToConstant: 24),
            
            titleLabelCustom.topAnchor.constraint(equalTo: medallionView.bottomAnchor, constant: 2),
            titleLabelCustom.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 2),
            titleLabelCustom.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -2),
            
            activeDot.topAnchor.constraint(equalTo: titleLabelCustom.bottomAnchor, constant: 2),
            activeDot.centerXAnchor.constraint(equalTo: centerXAnchor),
            activeDot.widthAnchor.constraint(equalToConstant: 12),
            activeDot.heightAnchor.constraint(equalToConstant: 3)
        ])
    }
    
    func setSelected(_ isSelected: Bool, animated: Bool) {
        if isElevated {
            let block = {
                self.medallionView.transform = isSelected ? CGAffineTransform(scaleX: 1.10, y: 1.10) : .identity
                self.medallionView.layer.shadowRadius = isSelected ? 14 : 8
                self.medallionView.layer.shadowOpacity = isSelected ? 0.9 : 0.6
                self.titleLabelCustom.textColor = isSelected ? self.goldActiveColor : self.goldMutedColor
                self.activeDot.alpha = isSelected ? 1.0 : 0.0
            }
            if animated {
                UIView.animate(withDuration: 0.35, delay: 0, usingSpringWithDamping: 0.68, initialSpringVelocity: 0.5, options: [.allowUserInteraction], animations: block)
            } else {
                block()
            }
        } else {
            let block = {
                self.selectionPill.alpha = isSelected ? 1.0 : 0.0
                self.iconImageView.tintColor = isSelected ? self.activeColor : self.inactiveColor
                self.iconImageView.transform = isSelected ? CGAffineTransform(scaleX: 1.14, y: 1.14) : .identity
                self.titleLabelCustom.textColor = isSelected ? self.activeColor : self.inactiveColor
                self.activeDot.alpha = isSelected ? 1.0 : 0.0
            }
            if animated {
                UIView.animate(withDuration: 0.32, delay: 0, usingSpringWithDamping: 0.7, initialSpringVelocity: 0.5, options: [.allowUserInteraction], animations: block)
            } else {
                block()
            }
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
        overrideUserInterfaceStyle = .dark
        setupUI()
        setupKeyboardObservers()
        fetchOfflineStatus()
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        navigationController?.overrideUserInterfaceStyle = .dark
        navigationController?.navigationBar.tintColor = .white
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
    
    private func setupUI() {
        title = "Account"
        view.backgroundColor = UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 1.0)
        
        let closeItem = UIBarButtonItem(barButtonSystemItem: .close, target: self, action: #selector(closeTapped))
        navigationItem.rightBarButtonItem = closeItem
        
        let navBarAppearance = UINavigationBarAppearance()
        navBarAppearance.configureWithOpaqueBackground()
        navBarAppearance.backgroundColor = UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 1.0)
        navBarAppearance.titleTextAttributes = [
            .foregroundColor: UIColor.white,
            .font: UIFont.systemFont(ofSize: 18, weight: .bold)
        ]
        navBarAppearance.shadowColor = .clear
        
        navigationItem.standardAppearance = navBarAppearance
        navigationItem.scrollEdgeAppearance = navBarAppearance
        navigationItem.compactAppearance = navBarAppearance
        
        if let navBar = navigationController?.navigationBar {
            navBar.standardAppearance = navBarAppearance
            navBar.scrollEdgeAppearance = navBarAppearance
            navBar.compactAppearance = navBarAppearance
            navBar.tintColor = .white
            navBar.overrideUserInterfaceStyle = .dark
        }
        
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
        textField.tintColor = UIColor(red: 56/255, green: 189/255, blue: 248/255, alpha: 1.0)
        textField.keyboardAppearance = .dark
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
            var info = (typeof App !== 'undefined' && typeof App.getOfflineInfo === 'function') ? App.getOfflineInfo() : null;
            var max = info ? info.maxLevels : ((typeof CONFIG !== 'undefined' && CONFIG.OFFLINE) ? (parseInt(CONFIG.OFFLINE.MAX_LEVELS, 10) || 3) : 3);
            var remaining = info ? info.remaining : Math.max(0, max - ((typeof App !== 'undefined' && App.state) ? (App.state.offlineLevelsPlayed || 0) : 0));
            var label = (typeof App !== 'undefined' && typeof App.formatMovesLeft === 'function') ? App.formatMovesLeft(remaining, max) : (remaining + '/' + max + ' moves left');
            return JSON.stringify({ max: max, remaining: remaining, label: label, threshold: info ? info.warningThreshold : 2 });
        })();
        """) { [weak self] (result, _) in
            if let str = result as? String,
               let data = str.data(using: .utf8),
               let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let remaining = dict["remaining"] as? Int,
               let max = dict["max"] as? Int {
                let label = dict["label"] as? String ?? "\(remaining)/\(max) moves left"
                let threshold = dict["threshold"] as? Int ?? 2
                DispatchQueue.main.async {
                    self?.offlineLabel.text = "📱 Offline Mode: \(label)"
                    self?.guestButton.setTitle("Continue as Guest (\(label))", for: .normal)
                    if remaining <= threshold {
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
        
        let alert = UIAlertController(
            title: "Sign in with Apple Recommended",
            message: "On iOS, Sign in with Apple provides seamless 1-tap cloud sync. Google Web Sign-In is restricted on local iOS apps by Google OAuth policy.\n\nWould you like to use Sign in with Apple or Email?",
            preferredStyle: .actionSheet
        )
        alert.overrideUserInterfaceStyle = .dark
        
        alert.addAction(UIAlertAction(title: " Sign in with Apple (Recommended)", style: .default) { [weak self] _ in
            self?.appleSignInTapped()
        })
        
        alert.addAction(UIAlertAction(title: "✉️ Sign in with Email", style: .default) { [weak self] _ in
            self?.emailTextField.becomeFirstResponder()
        })
        
        alert.addAction(UIAlertAction(title: "Try Google Web Sign-In", style: .default) { [weak self] _ in
            self?.executeGoogleSignIn()
        })
        
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        
        if let popover = alert.popoverPresentationController {
            popover.sourceView = googleSignInButton
            popover.sourceRect = googleSignInButton.bounds
        }
        present(alert, animated: true)
    }
    
    private func executeGoogleSignIn() {
        setLoading(true)
        let body = """
        if (typeof App !== 'undefined' && App.handleGoogleSignIn) {
            await App.handleGoogleSignIn();
            return JSON.stringify({ success: true });
        }
        return JSON.stringify({ success: false, error: 'App not loaded' });
        """
        scriptBridge?.callAsyncJavaScript(body) { [weak self] result in
            DispatchQueue.main.async {
                self?.setLoading(false)
                switch result {
                case .success(let val):
                    if let str = val as? String, str.contains("success") {
                        self?.dismiss(animated: true) {
                            self?.onAuthSuccess?()
                        }
                    }
                case .failure:
                    break
                }
            }
        }
    }
    
    @objc private func anonymousSignInTapped() {
        HapticManager.shared.impact(style: .medium)
        setLoading(true)
        let body = """
        if (typeof App !== 'undefined' && App.handleAnonymousSignIn) {
            await App.handleAnonymousSignIn();
            return JSON.stringify({ success: true });
        }
        return JSON.stringify({ success: false, error: 'App not loaded' });
        """
        scriptBridge?.callAsyncJavaScript(body) { [weak self] result in
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
        alert.overrideUserInterfaceStyle = .dark
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
            confirmation.overrideUserInterfaceStyle = .dark
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
        let body = """
        if (typeof FirebaseService !== 'undefined') {
            const res = await FirebaseService.signInWithEmail(email, password);
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
        """
        
        scriptBridge?.callAsyncJavaScript(body, arguments: ["email": email, "password": password]) { [weak self] result in
            DispatchQueue.main.async {
                self?.setLoading(false)
                switch result {
                case .success(let val):
                    if let str = val as? String,
                       let data = str.data(using: .utf8),
                       let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                       let success = dict["success"] as? Bool, success {
                        HapticManager.shared.notification(type: .success)
                        self?.dismiss(animated: true) {
                            self?.onAuthSuccess?()
                        }
                    } else if let str = val as? String,
                              let data = str.data(using: .utf8),
                              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                              let err = dict["error"] as? String {
                        self?.showError(err)
                    } else {
                        self?.showError("Sign-in failed. Please check credentials.")
                    }
                case .failure(let err):
                    self?.showError(err.localizedDescription)
                }
            }
        }
    }
    
    private func performSignUp(firstName: String, lastName: String, fullDisplayName: String, email: String, password: String) {
        setLoading(true)
        let body = """
        if (typeof FirebaseService !== 'undefined') {
            const res = await FirebaseService.signUpWithEmail(email, password, displayName);
            if (res && res.success) {
                if (typeof App !== 'undefined') {
                    App.state.firstName = firstName;
                    App.state.lastName = lastName;
                    App.state.playerName = displayName;
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
        """
        
        let args: [String: Any] = [
            "email": email,
            "password": password,
            "displayName": fullDisplayName,
            "firstName": firstName,
            "lastName": lastName
        ]
        
        scriptBridge?.callAsyncJavaScript(body, arguments: args) { [weak self] result in
            DispatchQueue.main.async {
                self?.setLoading(false)
                switch result {
                case .success(let val):
                    if let str = val as? String,
                       let data = str.data(using: .utf8),
                       let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                       let success = dict["success"] as? Bool, success {
                        HapticManager.shared.notification(type: .success)
                        self?.dismiss(animated: true) {
                            self?.onAuthSuccess?()
                        }
                    } else if let str = val as? String,
                              let data = str.data(using: .utf8),
                              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                              let err = dict["error"] as? String {
                        self?.showError(err)
                    } else {
                        self?.showError("Registration failed. Please try again.")
                    }
                case .failure(let err):
                    self?.showError(err.localizedDescription)
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

// MARK: - Native Daily Challenge View Controller
final class NativeDailyChallengeViewController: UIViewController {
    
    weak var scriptBridge: ScriptBridge?
    
    private let scrollView = UIScrollView()
    private let contentView = UIView()
    
    private let headerStack = UIStackView()
    private let streakPill = UIView()
    private let streakLabel = UILabel()
    private let dateLabel = UILabel()
    
    // Main Challenge Card
    private let cardView = UIView()
    private let iconLabel = UILabel()
    private let challengeTitleLabel = UILabel()
    private let challengeDescLabel = UILabel()
    private let rewardBadge = UIView()
    private let rewardLabel = UILabel()
    
    private let progressTrack = UIView()
    private let progressFill = UIView()
    private var progressWidthConstraint: NSLayoutConstraint?
    private let progressTextLabel = UILabel()
    
    // Stats Card
    private let statsCard = UIView()
    private let statsHeaderLabel = UILabel()
    private let statLevelsLabel = UILabel()
    private let statMergesLabel = UILabel()
    private let statCoinsLabel = UILabel()
    private let statMovesLabel = UILabel()
    
    // Streak Row
    private let streakRow = UIStackView()
    
    // Buttons
    private let actionButton = UIButton(type: .system)
    private let secondaryButton = UIButton(type: .system)
    
    // State
    private var challengeGoal: Int = 50
    private var challengeReward: Int = 100
    private var challengeType: String = "merge"
    private var challengeIcon: String = "🎯"
    private var challengeDesc: String = "Complete today's daily challenge"
    private var isDone: Bool = false
    private var streakDays: Int = 1
    private var levelsCount: Int = 0
    private var mergesCount: Int = 0
    private var coinsCount: Int = 0
    private var movesCount: Int = 0
    private var highestTile: Int = 0
    
    override func viewDidLoad() {
        super.viewDidLoad()
        overrideUserInterfaceStyle = .dark
        setupUI()
        loadChallengeData()
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        navigationController?.overrideUserInterfaceStyle = .dark
        navigationController?.navigationBar.tintColor = .white
    }
    
    private func setupUI() {
        title = "Daily Challenge"
        view.backgroundColor = UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 1.0)
        
        let closeItem = UIBarButtonItem(barButtonSystemItem: .close, target: self, action: #selector(closeTapped))
        navigationItem.rightBarButtonItem = closeItem
        
        let navBarAppearance = UINavigationBarAppearance()
        navBarAppearance.configureWithOpaqueBackground()
        navBarAppearance.backgroundColor = UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 1.0)
        navBarAppearance.titleTextAttributes = [
            .foregroundColor: UIColor.white,
            .font: UIFont.systemFont(ofSize: 18, weight: .bold)
        ]
        navBarAppearance.shadowColor = .clear
        
        navigationItem.standardAppearance = navBarAppearance
        navigationItem.scrollEdgeAppearance = navBarAppearance
        navigationItem.compactAppearance = navBarAppearance
        
        if let navBar = navigationController?.navigationBar {
            navBar.standardAppearance = navBarAppearance
            navBar.scrollEdgeAppearance = navBarAppearance
            navBar.compactAppearance = navBarAppearance
            navBar.tintColor = .white
            navBar.overrideUserInterfaceStyle = .dark
        }
        
        scrollView.translatesAutoresizingMaskIntoConstraints = false
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
        
        // 1. Header Stack (Streak + Date)
        headerStack.axis = .horizontal
        headerStack.spacing = 10
        headerStack.alignment = .center
        headerStack.distribution = .equalCentering
        headerStack.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(headerStack)
        
        streakPill.backgroundColor = UIColor(red: 233/255, green: 69/255, blue: 96/255, alpha: 0.25)
        streakPill.layer.cornerRadius = 14
        streakPill.layer.borderWidth = 1
        streakPill.layer.borderColor = UIColor(red: 233/255, green: 69/255, blue: 96/255, alpha: 0.6).cgColor
        streakPill.translatesAutoresizingMaskIntoConstraints = false
        
        streakLabel.text = "🔥 1 Day Streak"
        streakLabel.font = UIFont.systemFont(ofSize: 13, weight: .bold)
        streakLabel.textColor = UIColor(red: 255/255, green: 107/255, blue: 107/255, alpha: 1.0)
        streakLabel.translatesAutoresizingMaskIntoConstraints = false
        streakPill.addSubview(streakLabel)
        
        NSLayoutConstraint.activate([
            streakLabel.topAnchor.constraint(equalTo: streakPill.topAnchor, constant: 5),
            streakLabel.bottomAnchor.constraint(equalTo: streakPill.bottomAnchor, constant: -5),
            streakLabel.leadingAnchor.constraint(equalTo: streakPill.leadingAnchor, constant: 12),
            streakLabel.trailingAnchor.constraint(equalTo: streakPill.trailingAnchor, constant: -12)
        ])
        
        dateLabel.font = UIFont.systemFont(ofSize: 13, weight: .semibold)
        dateLabel.textColor = UIColor(red: 148/255, green: 163/255, blue: 184/255, alpha: 1.0)
        dateLabel.translatesAutoresizingMaskIntoConstraints = false
        
        headerStack.addArrangedSubview(streakPill)
        headerStack.addArrangedSubview(dateLabel)
        
        // 2. Main Challenge Card
        cardView.backgroundColor = UIColor(red: 30/255, green: 41/255, blue: 59/255, alpha: 0.95)
        cardView.layer.cornerRadius = 18
        cardView.layer.borderWidth = 1.5
        cardView.layer.borderColor = UIColor(white: 1.0, alpha: 0.12).cgColor
        cardView.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(cardView)
        
        iconLabel.text = "🎯"
        iconLabel.font = UIFont.systemFont(ofSize: 42)
        iconLabel.translatesAutoresizingMaskIntoConstraints = false
        cardView.addSubview(iconLabel)
        
        challengeTitleLabel.text = "Today's Goal"
        challengeTitleLabel.font = UIFont.systemFont(ofSize: 18, weight: .bold)
        challengeTitleLabel.textColor = .white
        challengeTitleLabel.translatesAutoresizingMaskIntoConstraints = false
        cardView.addSubview(challengeTitleLabel)
        
        challengeDescLabel.text = "Merge tiles to complete today's goal"
        challengeDescLabel.font = UIFont.systemFont(ofSize: 14, weight: .medium)
        challengeDescLabel.textColor = UIColor(red: 203/255, green: 213/255, blue: 225/255, alpha: 1.0)
        challengeDescLabel.numberOfLines = 2
        challengeDescLabel.translatesAutoresizingMaskIntoConstraints = false
        cardView.addSubview(challengeDescLabel)
        
        rewardBadge.backgroundColor = UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 0.18)
        rewardBadge.layer.cornerRadius = 10
        rewardBadge.layer.borderWidth = 1
        rewardBadge.layer.borderColor = UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 0.5).cgColor
        rewardBadge.translatesAutoresizingMaskIntoConstraints = false
        cardView.addSubview(rewardBadge)
        
        rewardLabel.text = "🏆 Reward: +100 Coins"
        rewardLabel.font = UIFont.systemFont(ofSize: 13, weight: .bold)
        rewardLabel.textColor = UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 1.0)
        rewardLabel.translatesAutoresizingMaskIntoConstraints = false
        rewardBadge.addSubview(rewardLabel)
        
        NSLayoutConstraint.activate([
            rewardLabel.topAnchor.constraint(equalTo: rewardBadge.topAnchor, constant: 4),
            rewardLabel.bottomAnchor.constraint(equalTo: rewardBadge.bottomAnchor, constant: -4),
            rewardLabel.leadingAnchor.constraint(equalTo: rewardBadge.leadingAnchor, constant: 10),
            rewardLabel.trailingAnchor.constraint(equalTo: rewardBadge.trailingAnchor, constant: -10)
        ])
        
        // Progress Track & Fill
        progressTrack.backgroundColor = UIColor(white: 1.0, alpha: 0.08)
        progressTrack.layer.cornerRadius = 5
        progressTrack.layer.masksToBounds = true
        progressTrack.translatesAutoresizingMaskIntoConstraints = false
        cardView.addSubview(progressTrack)
        
        progressFill.backgroundColor = UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 1.0)
        progressFill.layer.cornerRadius = 5
        progressFill.translatesAutoresizingMaskIntoConstraints = false
        progressTrack.addSubview(progressFill)
        
        progressTextLabel.text = "Progress: 0%"
        progressTextLabel.font = UIFont.systemFont(ofSize: 12, weight: .semibold)
        progressTextLabel.textColor = UIColor(red: 148/255, green: 163/255, blue: 184/255, alpha: 1.0)
        progressTextLabel.translatesAutoresizingMaskIntoConstraints = false
        cardView.addSubview(progressTextLabel)
        
        NSLayoutConstraint.activate([
            iconLabel.leadingAnchor.constraint(equalTo: cardView.leadingAnchor, constant: 16),
            iconLabel.topAnchor.constraint(equalTo: cardView.topAnchor, constant: 16),
            iconLabel.widthAnchor.constraint(equalToConstant: 48),
            
            challengeTitleLabel.leadingAnchor.constraint(equalTo: iconLabel.trailingAnchor, constant: 12),
            challengeTitleLabel.trailingAnchor.constraint(equalTo: cardView.trailingAnchor, constant: -16),
            challengeTitleLabel.topAnchor.constraint(equalTo: cardView.topAnchor, constant: 16),
            
            challengeDescLabel.leadingAnchor.constraint(equalTo: challengeTitleLabel.leadingAnchor),
            challengeDescLabel.trailingAnchor.constraint(equalTo: cardView.trailingAnchor, constant: -16),
            challengeDescLabel.topAnchor.constraint(equalTo: challengeTitleLabel.bottomAnchor, constant: 4),
            
            rewardBadge.leadingAnchor.constraint(equalTo: challengeTitleLabel.leadingAnchor),
            rewardBadge.topAnchor.constraint(equalTo: challengeDescLabel.bottomAnchor, constant: 8),
            
            progressTrack.topAnchor.constraint(equalTo: rewardBadge.bottomAnchor, constant: 14),
            progressTrack.leadingAnchor.constraint(equalTo: cardView.leadingAnchor, constant: 16),
            progressTrack.trailingAnchor.constraint(equalTo: cardView.trailingAnchor, constant: -16),
            progressTrack.heightAnchor.constraint(equalToConstant: 10),
            
            progressFill.topAnchor.constraint(equalTo: progressTrack.topAnchor),
            progressFill.bottomAnchor.constraint(equalTo: progressTrack.bottomAnchor),
            progressFill.leadingAnchor.constraint(equalTo: progressTrack.leadingAnchor),
            
            progressTextLabel.topAnchor.constraint(equalTo: progressTrack.bottomAnchor, constant: 6),
            progressTextLabel.leadingAnchor.constraint(equalTo: cardView.leadingAnchor, constant: 16),
            progressTextLabel.trailingAnchor.constraint(equalTo: cardView.trailingAnchor, constant: -16),
            progressTextLabel.bottomAnchor.constraint(equalTo: cardView.bottomAnchor, constant: -16)
        ])
        
        progressWidthConstraint = progressFill.widthAnchor.constraint(equalTo: progressTrack.widthAnchor, multiplier: 0.0)
        progressWidthConstraint?.isActive = true
        
        // 3. Stats Card
        statsCard.backgroundColor = UIColor(red: 24/255, green: 32/255, blue: 47/255, alpha: 0.9)
        statsCard.layer.cornerRadius = 14
        statsCard.layer.borderWidth = 1
        statsCard.layer.borderColor = UIColor(white: 1.0, alpha: 0.08).cgColor
        statsCard.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(statsCard)
        
        statsHeaderLabel.text = "📊 Today's Activity"
        statsHeaderLabel.font = UIFont.systemFont(ofSize: 14, weight: .bold)
        statsHeaderLabel.textColor = .white
        statsHeaderLabel.translatesAutoresizingMaskIntoConstraints = false
        statsCard.addSubview(statsHeaderLabel)
        
        let row1 = UIStackView()
        row1.axis = .horizontal
        row1.distribution = .fillEqually
        row1.spacing = 10
        row1.translatesAutoresizingMaskIntoConstraints = false
        
        let row2 = UIStackView()
        row2.axis = .horizontal
        row2.distribution = .fillEqually
        row2.spacing = 10
        row2.translatesAutoresizingMaskIntoConstraints = false
        
        formatStat(label: statLevelsLabel, title: "Levels", val: "0")
        formatStat(label: statMergesLabel, title: "Merges", val: "0")
        formatStat(label: statCoinsLabel, title: "Coins", val: "0")
        formatStat(label: statMovesLabel, title: "Best Moves", val: "-")
        
        row1.addArrangedSubview(statLevelsLabel)
        row1.addArrangedSubview(statMergesLabel)
        row2.addArrangedSubview(statCoinsLabel)
        row2.addArrangedSubview(statMovesLabel)
        
        let statsStack = UIStackView(arrangedSubviews: [row1, row2])
        statsStack.axis = .vertical
        statsStack.spacing = 8
        statsStack.translatesAutoresizingMaskIntoConstraints = false
        statsCard.addSubview(statsStack)
        
        NSLayoutConstraint.activate([
            statsHeaderLabel.topAnchor.constraint(equalTo: statsCard.topAnchor, constant: 12),
            statsHeaderLabel.leadingAnchor.constraint(equalTo: statsCard.leadingAnchor, constant: 14),
            statsHeaderLabel.trailingAnchor.constraint(equalTo: statsCard.trailingAnchor, constant: -14),
            
            statsStack.topAnchor.constraint(equalTo: statsHeaderLabel.bottomAnchor, constant: 10),
            statsStack.leadingAnchor.constraint(equalTo: statsCard.leadingAnchor, constant: 14),
            statsStack.trailingAnchor.constraint(equalTo: statsCard.trailingAnchor, constant: -14),
            statsStack.bottomAnchor.constraint(equalTo: statsCard.bottomAnchor, constant: -14)
        ])
        
        // 4. Action Buttons
        actionButton.backgroundColor = UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 1.0)
        actionButton.setTitle("🎯 Play Challenge", for: .normal)
        actionButton.setTitleColor(UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 1.0), for: .normal)
        actionButton.titleLabel?.font = UIFont.systemFont(ofSize: 16, weight: .bold)
        actionButton.layer.cornerRadius = 14
        actionButton.layer.masksToBounds = true
        actionButton.addTarget(self, action: #selector(actionButtonTapped), for: .touchUpInside)
        actionButton.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(actionButton)
        
        secondaryButton.backgroundColor = UIColor(red: 30/255, green: 41/255, blue: 59/255, alpha: 1.0)
        secondaryButton.setTitle("Close", for: .normal)
        secondaryButton.setTitleColor(UIColor(red: 148/255, green: 163/255, blue: 184/255, alpha: 1.0), for: .normal)
        secondaryButton.titleLabel?.font = UIFont.systemFont(ofSize: 14, weight: .semibold)
        secondaryButton.layer.cornerRadius = 14
        secondaryButton.layer.borderWidth = 1
        secondaryButton.layer.borderColor = UIColor(white: 1.0, alpha: 0.1).cgColor
        secondaryButton.addTarget(self, action: #selector(closeTapped), for: .touchUpInside)
        secondaryButton.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(secondaryButton)
        
        NSLayoutConstraint.activate([
            headerStack.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 16),
            headerStack.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            headerStack.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
            
            cardView.topAnchor.constraint(equalTo: headerStack.bottomAnchor, constant: 14),
            cardView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            cardView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
            
            statsCard.topAnchor.constraint(equalTo: cardView.bottomAnchor, constant: 14),
            statsCard.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            statsCard.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
            
            actionButton.topAnchor.constraint(equalTo: statsCard.bottomAnchor, constant: 20),
            actionButton.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            actionButton.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
            actionButton.heightAnchor.constraint(equalToConstant: 50),
            
            secondaryButton.topAnchor.constraint(equalTo: actionButton.bottomAnchor, constant: 10),
            secondaryButton.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            secondaryButton.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
            secondaryButton.heightAnchor.constraint(equalToConstant: 44),
            secondaryButton.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -24)
        ])
    }
    
    private func formatStat(label: UILabel, title: String, val: String) {
        label.numberOfLines = 2
        label.textAlignment = .center
        label.backgroundColor = UIColor(white: 1.0, alpha: 0.04)
        label.layer.cornerRadius = 8
        label.layer.masksToBounds = true
        label.font = UIFont.systemFont(ofSize: 12)
        
        let attr = NSMutableAttributedString(string: "\(val)\n", attributes: [
            .font: UIFont.systemFont(ofSize: 15, weight: .bold),
            .foregroundColor: UIColor.white
        ])
        attr.append(NSAttributedString(string: title, attributes: [
            .font: UIFont.systemFont(ofSize: 11, weight: .semibold),
            .foregroundColor: UIColor(red: 148/255, green: 163/255, blue: 184/255, alpha: 1.0)
        ]))
        label.attributedText = attr
    }
    
    private func loadChallengeData() {
        let js = """
        (function() {
            if (typeof DailyChallenge !== 'undefined' && typeof DailyChallenge.checkDailyReset === 'function') {
                DailyChallenge.checkDailyReset();
            }
            var challenge = (typeof DailyChallenge !== 'undefined' && typeof DailyChallenge.getDailyChallenge === 'function')
                ? DailyChallenge.getDailyChallenge() : null;
            var s = (typeof App !== 'undefined' && App.state) ? App.state : {};
            var prog = s.dailyProgress || { levels: 0, merges: 0, coins: 0, moves: Infinity };
            return JSON.stringify({
                challenge: challenge,
                done: !!s.dailyChallengeDone,
                streak: s.currentStreak || s.streakDays || 1,
                progress: prog,
                highestTile: s.highestTileEver || 0,
                date: new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
            });
        })();
        """
        
        scriptBridge?.evaluateJavaScript(js) { [weak self] (result, _) in
            guard let self = self,
                  let str = result as? String,
                  let data = str.data(using: .utf8),
                  let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                return
            }
            
            DispatchQueue.main.async {
                self.parsePayload(dict)
            }
        }
    }
    
    private func parsePayload(_ dict: [String: Any]) {
        self.isDone = dict["done"] as? Bool ?? false
        self.streakDays = dict["streak"] as? Int ?? 1
        self.highestTile = dict["highestTile"] as? Int ?? 0
        let dateStr = dict["date"] as? String ?? "Today"
        
        streakLabel.text = "🔥 \(streakDays) Day Streak"
        dateLabel.text = "📅 \(dateStr)"
        
        if let prog = dict["progress"] as? [String: Any] {
            self.levelsCount = prog["levels"] as? Int ?? 0
            self.mergesCount = prog["merges"] as? Int ?? 0
            self.coinsCount = prog["coins"] as? Int ?? 0
            let rawMoves = prog["moves"] as? Int ?? -1
            self.movesCount = (rawMoves > 0 && rawMoves < 999999) ? rawMoves : -1
        }
        
        formatStat(label: statLevelsLabel, title: "Levels", val: "\(levelsCount)")
        formatStat(label: statMergesLabel, title: "Merges", val: "\(mergesCount)")
        formatStat(label: statCoinsLabel, title: "Coins", val: "\(coinsCount)")
        formatStat(label: statMovesLabel, title: "Best Moves", val: movesCount > 0 ? "\(movesCount)" : "-")
        
        var currentProgress = 0
        var goal = 50
        
        if let ch = dict["challenge"] as? [String: Any] {
            self.challengeIcon = ch["icon"] as? String ?? "🎯"
            self.challengeDesc = ch["desc"] as? String ?? "Complete today's challenge"
            self.challengeReward = ch["reward"] as? Int ?? 100
            self.challengeGoal = ch["goal"] as? Int ?? 50
            self.challengeType = ch["type"] as? String ?? "merge"
            goal = self.challengeGoal
            
            iconLabel.text = challengeIcon
            challengeDescLabel.text = challengeDesc
            rewardLabel.text = "🏆 Reward: +\(challengeReward) Coins"
            
            switch challengeType {
            case "reach":
                currentProgress = highestTile
                progressTextLabel.text = "Highest Tile: \(highestTile) / \(goal)"
            case "moves":
                currentProgress = movesCount > 0 ? movesCount : 0
                progressTextLabel.text = "Best Moves: \(movesCount > 0 ? "\(movesCount)" : "-") / \(goal)"
            case "levels":
                currentProgress = levelsCount
                progressTextLabel.text = "Levels Today: \(levelsCount) / \(goal)"
            case "coins":
                currentProgress = coinsCount
                progressTextLabel.text = "Coins Today: \(coinsCount) / \(goal)"
            default: // merge
                currentProgress = mergesCount
                progressTextLabel.text = "Merges: \(mergesCount) / \(goal)"
            }
        }
        
        let pct = goal > 0 ? min(1.0, max(0.0, Double(currentProgress) / Double(goal))) : (isDone ? 1.0 : 0.0)
        let pctInt = Int(pct * 100)
        
        if isDone {
            challengeTitleLabel.text = "✅ Completed!"
            cardView.layer.borderColor = UIColor(red: 34/255, green: 197/255, blue: 94/255, alpha: 0.8).cgColor
            cardView.backgroundColor = UIColor(red: 20/255, green: 35/255, blue: 45/255, alpha: 0.95)
            progressFill.backgroundColor = UIColor(red: 34/255, green: 197/255, blue: 94/255, alpha: 1.0)
            progressTextLabel.text = "✅ Completed today! Come back tomorrow."
            progressTextLabel.textColor = UIColor(red: 34/255, green: 197/255, blue: 94/255, alpha: 1.0)
            
            actionButton.setTitle("▶ Keep Playing", for: .normal)
            actionButton.backgroundColor = UIColor(red: 56/255, green: 189/255, blue: 248/255, alpha: 1.0)
            actionButton.setTitleColor(UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 1.0), for: .normal)
        } else if pct >= 1.0 {
            // Reached goal but not yet claimed!
            challengeTitleLabel.text = "🎉 Goal Reached!"
            progressFill.backgroundColor = UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 1.0)
            progressTextLabel.text = "Goal Reached! (100%)"
            actionButton.setTitle("💰 Claim +\(challengeReward) Coins", for: .normal)
            actionButton.backgroundColor = UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 1.0)
            actionButton.setTitleColor(UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 1.0), for: .normal)
        } else {
            challengeTitleLabel.text = "Today's Goal"
            progressTextLabel.text = "\(progressTextLabel.text ?? "") (\(pctInt)%)"
            actionButton.setTitle("🎯 Play to Complete", for: .normal)
            actionButton.backgroundColor = UIColor(red: 245/255, green: 158/255, blue: 11/255, alpha: 1.0)
            actionButton.setTitleColor(UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 1.0), for: .normal)
        }
        
        progressWidthConstraint?.isActive = false
        progressWidthConstraint = progressFill.widthAnchor.constraint(equalTo: progressTrack.widthAnchor, multiplier: CGFloat(isDone ? 1.0 : pct))
        progressWidthConstraint?.isActive = true
        UIView.animate(withDuration: 0.35) {
            self.cardView.layoutIfNeeded()
        }
    }
    
    @objc private func actionButtonTapped() {
        if !isDone && actionButton.title(for: .normal)?.contains("Claim") == true {
            // Claim Reward
            HapticManager.shared.notification(type: .success)
            let reward = self.challengeReward
            let nextStreak = self.streakDays + 1
            let js = """
            (function() {
                if (typeof App !== 'undefined' && App.state) {
                    App.state.coins = (App.state.coins || 0) + \(reward);
                    App.state.dailyChallengeDone = true;
                    App.state.currentStreak = \(nextStreak);
                    App.state.streakDays = \(nextStreak);
                    App.saveState();
                    App.updateAllCoinDisplays();
                    if (typeof FirebaseService !== 'undefined') {
                        FirebaseService.saveUserData(App.state);
                    }
                    App.showToast('🎉 +\(reward) Daily Challenge Reward Claimed!');
                }
            })();
            """
            scriptBridge?.evaluateJavaScript(js) { [weak self] (_, _) in
                DispatchQueue.main.async {
                    self?.isDone = true
                    self?.loadChallengeData()
                }
            }
            return
        }
        
        // Play / Keep Playing: Dismiss and launch game!
        HapticManager.shared.selection()
        dismiss(animated: true) { [weak self] in
            let js = """
            if (typeof App !== 'undefined' && typeof App.continueGame === 'function') {
                App.continueGame();
            } else if (typeof Navigation !== 'undefined') {
                Navigation.navigateTo('game');
            }
            """
            self?.scriptBridge?.evaluateJavaScript(js)
        }
    }
    
    @objc private func closeTapped() {
        dismiss(animated: true)
    }
}
