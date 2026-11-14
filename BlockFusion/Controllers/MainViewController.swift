import UIKit
import WebKit
import StoreKit
import GameKit

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
        setupManagers()
        loadGame()
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
            if (typeof Navigation !== 'undefined' && typeof Navigation.navigateTo === 'function') {
                Navigation.navigateTo('settings');
            }
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
            self.scriptBridge.evaluateJavaScript("""
            if (typeof Navigation !== 'undefined' && typeof Navigation.navigateTo === 'function') {
                Navigation.navigateTo('\(tab.targetScreen)');
            }
            """)
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
            
            // On gameplay screen, smoothly collapse the top and bottom bars so board & undo button have full height
            UIView.animate(withDuration: 0.22, delay: 0, options: [.curveEaseInOut], animations: {
                self.topBar.alpha = isGame ? 0.0 : 1.0
                self.topBar.isHidden = isGame
                self.topBarHeightConstraint.constant = isGame ? 0 : 44
                
                self.bottomBar.alpha = isGame ? 0.0 : 1.0
                self.bottomBar.isHidden = isGame
                self.bottomBarHeightConstraint.constant = isGame ? 0 : -58
                
                self.view.layoutIfNeeded()
            }, completion: nil)
            
            if !isGame {
                self.bottomBar.selectTab(forScreen: screen)
            }
            self.updateSafeAreaInsets()
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
    
    private func setupUI() {
        backgroundColor = UIColor(red: 15/255, green: 23/255, blue: 42/255, alpha: 0.98)
        
        let blurEffect = UIBlurEffect(style: .systemUltraThinMaterialDark)
        let blurView = UIVisualEffectView(effect: blurEffect)
        blurView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(blurView)
        sendSubviewToBack(blurView)
        
        let topBorder = UIView()
        topBorder.backgroundColor = UIColor(white: 1.0, alpha: 0.08)
        topBorder.translatesAutoresizingMaskIntoConstraints = false
        addSubview(topBorder)
        
        let stackView = UIStackView()
        stackView.axis = .horizontal
        stackView.distribution = .fillEqually
        stackView.alignment = .fill
        stackView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stackView)
        
        for (index, tab) in tabs.enumerated() {
            let btn = TabButtonView(item: tab, index: index)
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
            
            stackView.topAnchor.constraint(equalTo: topAnchor, constant: 4),
            stackView.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 4),
            stackView.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -4),
            stackView.heightAnchor.constraint(equalToConstant: 48)
        ])
        
        updateSelection(index: 0, animated: false)
    }
    
    @objc private func tabTapped(_ sender: TabButtonView) {
        let index = sender.index
        guard index != selectedIndex else {
            onTabSelected?(tabs[index])
            return
        }
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
final class TabButtonView: UIControl {
    let item: NativeBottomBar.TabItem
    let index: Int
    
    private let iconImageView = UIImageView()
    private let titleLabel = UILabel()
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
    
    private func setupView() {
        let config = UIImage.SymbolConfiguration(pointSize: 18, weight: .semibold)
        iconImageView.image = UIImage(systemName: item.symbolName, withConfiguration: config)
        iconImageView.contentMode = .scaleAspectFit
        iconImageView.tintColor = inactiveColor
        iconImageView.isUserInteractionEnabled = false
        iconImageView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(iconImageView)
        
        titleLabel.text = item.title
        titleLabel.font = UIFont.systemFont(ofSize: 10, weight: .bold)
        titleLabel.textColor = inactiveColor
        titleLabel.textAlignment = .center
        titleLabel.isUserInteractionEnabled = false
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        addSubview(titleLabel)
        
        activeDot.backgroundColor = activeColor
        activeDot.layer.cornerRadius = 2
        activeDot.alpha = 0
        activeDot.isUserInteractionEnabled = false
        activeDot.translatesAutoresizingMaskIntoConstraints = false
        addSubview(activeDot)
        
        NSLayoutConstraint.activate([
            iconImageView.topAnchor.constraint(equalTo: topAnchor, constant: 4),
            iconImageView.centerXAnchor.constraint(equalTo: centerXAnchor),
            iconImageView.widthAnchor.constraint(equalToConstant: 20),
            iconImageView.heightAnchor.constraint(equalToConstant: 20),
            
            titleLabel.topAnchor.constraint(equalTo: iconImageView.bottomAnchor, constant: 2),
            titleLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 2),
            titleLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -2),
            
            activeDot.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 2),
            activeDot.centerXAnchor.constraint(equalTo: centerXAnchor),
            activeDot.widthAnchor.constraint(equalToConstant: 4),
            activeDot.heightAnchor.constraint(equalToConstant: 4)
        ])
    }
    
    func setSelected(_ isSelected: Bool, animated: Bool) {
        let block = {
            self.iconImageView.tintColor = isSelected ? self.activeColor : self.inactiveColor
            self.titleLabel.textColor = isSelected ? self.activeColor : self.inactiveColor
            self.activeDot.alpha = isSelected ? 1.0 : 0.0
            self.transform = isSelected ? CGAffineTransform(scaleX: 1.06, y: 1.06) : .identity
        }
        if animated {
            UIView.animate(withDuration: 0.2, delay: 0, options: [.curveEaseOut], animations: block)
        } else {
            block()
        }
    }
}
