import Foundation
import StoreKit

protocol StoreKitEventListener: AnyObject {
    func onPurchaseStarted(productId: String)
    func onPurchaseSuccess(productId: String, orderId: String)
    func onPurchaseFailed(errorMessage: String)
    func onPurchasesRestored(restoredProducts: [String])
    func onPricesLoaded(prices: [String: String])
}

/// StoreKit 2 In-App Purchases and Subscriptions Manager for Block Rush 2K
@available(iOS 15.0, *)
final class StoreKitManager: NSObject {
    static let shared = StoreKitManager()
    
    // Product Identifiers
    static let productCoins3000 = "coins_pack_3000"
    static let productCoins5000 = "coins_pack_5000"
    static let productCoins15000 = "coins_pack_15000"
    static let productBuyCoffee = "buy_me_coffee"
    static let productRemoveAds = "remove_ads"
    static let productThemeNeon = "theme_neon"
    static let productThemeWood = "theme_wood"
    static let productSubOffline = "sub_offline_mode"
    
    static let allProductIds: Set<String> = [
        productCoins3000,
        productCoins5000,
        productCoins15000,
        productBuyCoffee,
        productRemoveAds,
        productThemeNeon,
        productThemeWood,
        productSubOffline
    ]
    
    weak var delegate: StoreKitEventListener?
    
    private(set) var availableProducts: [String: Product] = [:]
    private(set) var formattedPrices: [String: String] = [:]
    private var updateListenerTask: Task<Void, Error>?
    private let preferences = PreferencesManager.shared
    
    private override init() {
        super.init()
        updateListenerTask = listenForTransactions()
        
        Task {
            await loadProducts()
            await checkCurrentEntitlements()
        }
    }
    
    deinit {
        updateListenerTask?.cancel()
    }
    
    // MARK: - Load Products & Formatted Prices
    func loadProducts() async {
        do {
            let products = try await Product.products(for: Self.allProductIds)
            var prices: [String: String] = [:]
            var mapped: [String: Product] = [:]
            
            for product in products {
                mapped[product.id] = product
                prices[product.id] = product.displayPrice
            }
            
            await MainActor.run {
                self.availableProducts = mapped
                self.formattedPrices = prices
                self.delegate?.onPricesLoaded(prices: prices)
            }
            print("🛒 Loaded \(products.count) StoreKit products with localized prices")
        } catch {
            print("❌ Failed to load StoreKit products: \(error.localizedDescription)")
        }
    }
    
    // MARK: - Transaction Listener
    private func listenForTransactions() -> Task<Void, Error> {
        return Task.detached { [weak self] in
            for await result in Transaction.updates {
                do {
                    let transaction = try self?.checkVerified(result)
                    if let transaction = transaction {
                        await self?.handleTransaction(transaction)
                        await transaction.finish()
                    }
                } catch {
                    print("❌ Transaction verification failed: \(error)")
                }
            }
        }
    }
    
    // MARK: - Check Current Entitlements
    func checkCurrentEntitlements() async {
        var restored: [String] = []
        for await result in Transaction.currentEntitlements {
            do {
                let transaction = try checkVerified(result)
                await handleTransaction(transaction)
                restored.append(transaction.productID)
            } catch {
                print("❌ Failed to verify current entitlement: \(error)")
            }
        }
        
        if !restored.isEmpty {
            await MainActor.run {
                self.delegate?.onPurchasesRestored(restoredProducts: restored)
            }
        }
    }
    
    // MARK: - Launch Purchase
    func launchPurchase(productId: String) {
        guard let product = availableProducts[productId] else {
            Task {
                await loadProducts()
                guard let retryProduct = availableProducts[productId] else {
                    await MainActor.run {
                        self.delegate?.onPurchaseFailed(errorMessage: "Product '\(productId)' is currently unavailable.")
                    }
                    return
                }
                await self.performPurchase(product: retryProduct)
            }
            return
        }
        
        Task {
            await performPurchase(product: product)
        }
    }
    
    private func performPurchase(product: Product) async {
        await MainActor.run {
            self.delegate?.onPurchaseStarted(productId: product.id)
        }
        
        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                let transaction = try checkVerified(verification)
                await handleTransaction(transaction)
                await transaction.finish()
                
                await MainActor.run {
                    HapticManager.shared.notification(type: .success)
                    self.delegate?.onPurchaseSuccess(productId: product.id, orderId: String(transaction.id))
                }
                
            case .userCancelled:
                await MainActor.run {
                    self.delegate?.onPurchaseFailed(errorMessage: "Purchase cancelled")
                }
                
            case .pending:
                await MainActor.run {
                    self.delegate?.onPurchaseStarted(productId: product.id)
                }
                
            @unknown default:
                break
            }
        } catch {
            await MainActor.run {
                HapticManager.shared.notification(type: .error)
                self.delegate?.onPurchaseFailed(errorMessage: error.localizedDescription)
            }
        }
    }
    
    // MARK: - Restore Purchases
    func restorePurchases() {
        Task {
            do {
                try await AppStore.sync()
                await checkCurrentEntitlements()
                let restored = Array(preferences.purchasedProducts)
                await MainActor.run {
                    HapticManager.shared.notification(type: .success)
                    self.delegate?.onPurchasesRestored(restoredProducts: restored)
                }
            } catch {
                await MainActor.run {
                    self.delegate?.onPurchaseFailed(errorMessage: "Failed to restore: \(error.localizedDescription)")
                }
            }
        }
    }
    
    // MARK: - Helper Methods
    private func handleTransaction(_ transaction: Transaction) async {
        let productId = transaction.productID
        preferences.addPurchasedProduct(productId)
        
        if productId == Self.productRemoveAds {
            preferences.isAdsRemoved = true
        } else if productId == Self.productSubOffline {
            if let expirationDate = transaction.expirationDate {
                preferences.setOfflineSubscriptionExpiry(expirationDate.timeIntervalSince1970)
            } else {
                preferences.isOfflineSubscriptionActive = true
            }
        } else if productId == Self.productThemeNeon || productId == Self.productThemeWood {
            preferences.isThemePackOwned = true
        }
    }
    
    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .unverified(_, let error):
            throw error
        case .verified(let safe):
            return safe
        }
    }
}
