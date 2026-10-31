import Foundation

/// Manages local persistent preferences for Block Rush 2K (matches Android PreferencesManager)
final class PreferencesManager {
    static let shared = PreferencesManager()
    
    private let defaults = UserDefaults.standard
    
    private enum Keys {
        static let adsRemoved = "blockfusion_ads_removed"
        static let offlineSubActive = "blockfusion_offline_sub_active"
        static let offlineSubExpiry = "blockfusion_offline_sub_expiry"
        static let activeTheme = "blockfusion_active_theme"
        static let purchasedProducts = "blockfusion_purchased_products"
        static let themePackOwned = "blockfusion_theme_pack_owned"
        static let soundEnabled = "blockfusion_sound_enabled"
        static let hapticsEnabled = "blockfusion_haptics_enabled"
        static let customQaUrl = "blockfusion_qa_url"
        static let useLocalAssets = "blockfusion_use_local_assets"
    }
    
    private init() {
        defaults.register(defaults: [
            Keys.adsRemoved: false,
            Keys.offlineSubActive: false,
            Keys.activeTheme: "numbers",
            Keys.themePackOwned: false,
            Keys.soundEnabled: true,
            Keys.hapticsEnabled: true,
            Keys.useLocalAssets: true
        ])
    }
    
    // MARK: - Ads & Purchases
    var isAdsRemoved: Bool {
        get { defaults.bool(forKey: Keys.adsRemoved) }
        set { defaults.set(newValue, forKey: Keys.adsRemoved) }
    }
    
    var isOfflineSubscriptionActive: Bool {
        get {
            let active = defaults.bool(forKey: Keys.offlineSubActive)
            let expiry = defaults.double(forKey: Keys.offlineSubExpiry)
            if active && expiry > 0 {
                return Date().timeIntervalSince1970 < expiry
            }
            return active
        }
        set { defaults.set(newValue, forKey: Keys.offlineSubActive) }
    }
    
    func setOfflineSubscriptionExpiry(_ timestamp: TimeInterval) {
        defaults.set(timestamp, forKey: Keys.offlineSubExpiry)
        defaults.set(timestamp > Date().timeIntervalSince1970, forKey: Keys.offlineSubActive)
    }
    
    var isThemePackOwned: Bool {
        get { defaults.bool(forKey: Keys.themePackOwned) }
        set { defaults.set(newValue, forKey: Keys.themePackOwned) }
    }
    
    var activeTheme: String {
        get { defaults.string(forKey: Keys.activeTheme) ?? "numbers" }
        set { defaults.set(newValue, forKey: Keys.activeTheme) }
    }
    
    var purchasedProducts: Set<String> {
        get {
            let list = defaults.stringArray(forKey: Keys.purchasedProducts) ?? []
            return Set(list)
        }
        set {
            defaults.set(Array(newValue), forKey: Keys.purchasedProducts)
        }
    }
    
    func addPurchasedProduct(_ id: String) {
        var products = purchasedProducts
        products.insert(id)
        purchasedProducts = products
        
        if id == "remove_ads" {
            isAdsRemoved = true
        } else if id.starts(with: "theme_") {
            isThemePackOwned = true
        } else if id == "sub_offline_mode" {
            isOfflineSubscriptionActive = true
        }
    }
    
    var useLocalAssets: Bool {
        get { defaults.bool(forKey: Keys.useLocalAssets) }
        set { defaults.set(newValue, forKey: Keys.useLocalAssets) }
    }
    
    var customQaUrl: String? {
        get { defaults.string(forKey: Keys.customQaUrl) }
        set { defaults.set(newValue, forKey: Keys.customQaUrl) }
    }
}

