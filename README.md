# Block Rush 2K - iOS Application

Native iOS version of **Block Rush 2K** with full In-App Purchases (StoreKit 2), Google AdMob (Adaptive Banners, Interstitials, Rewarded Ads), App Tracking Transparency (ATT), Apple Taptic Engine haptics, offline asset bundling, and native JavaScript-to-Swift bridges matching the Android edition.

---

## 📱 Features

- **Native Swift Architecture**: Built using Swift and `WKWebView` with hardware acceleration, high refresh rate ProMotion display (up to 120Hz) support, and edge-to-edge layout for iPhone 16 / 15 / 14 Pro (Dynamic Island & Safe Area).
- **Bundled Offline Gameplay**: Complete web game assets (`HTML`, `CSS`, `JS`, `SVG`, `Audio`) are bundled inside the app for zero-latency instant launch and 100% offline gameplay, with fallback to remote server (`https://blockrush2k.kharitambe.co.za`).
- **StoreKit 2 In-App Purchases & Subscriptions**:
  - `coins_pack_3000` (Starter Pack - 3,000 Coins)
  - `coins_pack_5000` (Popular Pack - 5,000 Coins)
  - `coins_pack_15000` (Best Value - 15,000 Coins)
  - `remove_ads` (Permanent Non-Consumable ad removal)
  - `theme_neon` (Neon Cyber Theme)
  - `theme_wood` (Classic Wood Theme)
  - `buy_me_coffee` (Support Developer Tip)
  - `sub_offline_mode` (Auto-Renewable Monthly Subscription)
- **Local StoreKit Testing**: Includes `Products.storekit` preconfigured in the Xcode scheme so you can test all purchases and subscriptions directly in the iOS Simulator without needing an Apple Developer paid account or App Store Connect configuration.
- **Google AdMob Integration**:
  - Adaptive Sticky Banners pinned to bottom safe area
  - Interstitial Ads between game sessions
  - Rewarded Ads for earning bonus coins and perks
  - Official Google iOS Test IDs enabled in `DEBUG` builds
  - Production IDs enabled in `RELEASE` builds
- **App Tracking Transparency (ATT)**: Conforms to iOS 14.5+ Apple App Store Guideline 5.1.2 with `ATTrackingManager` prompt and `NSUserTrackingUsageDescription`.
- **Haptic Engine**: Taptic feedback via `UIImpactFeedbackGenerator` and `UINotificationFeedbackGenerator` for tile merges, combos, button presses, and purchases.
- **Native Social & Review**: Native iOS Share Sheet (`UIActivityViewController`) for referral codes and Store Review prompt (`SKStoreReviewController`).
- **Audio Session**: Configured with `.ambient` and `.mixWithOthers` so the game's audio never cuts out the user's background music or podcasts.

---

## 📁 Project Structure

```
Block-Fusion-IOS/
├── BlockFusion.xcodeproj/          # Main Xcode Project
│   ├── project.pbxproj             # Project definitions & SPM dependencies
│   └── xcshareddata/xcschemes/     # Preconfigured shared scheme with StoreKit
├── BlockFusion/
│   ├── App/
│   │   ├── AppDelegate.swift       # Audio session and application lifecycle
│   │   ├── SceneDelegate.swift     # Window and deep link management
│   │   └── Info.plist              # App permissions, AdMob ID, SKAdNetwork IDs
│   ├── Controllers/
│   │   └── MainViewController.swift# Root view controller hosting WKWebView
│   ├── Bridges/
│   │   ├── NativeBridgeScript.swift# Injected JS bridge (window.Android, Billing, Social, iOS)
│   │   └── ScriptBridge.swift      # WKScriptMessageHandler receiving JS calls
│   ├── Services/
│   │   ├── StoreKitManager.swift   # StoreKit 2 purchases, prices, restore
│   │   ├── AdMobManager.swift      # Google Mobile Ads SDK integration
│   │   ├── AppTrackingManager.swift# ATT authorization prompt
│   │   ├── HapticManager.swift     # iOS Taptic Engine feedback
│   │   └── PreferencesManager.swift# Local persistent settings & entitlements
│   ├── Configuration/
│   │   └── Products.storekit       # Xcode local StoreKit test environment
│   ├── Assets.xcassets/            # App icons (1024x1024) and theme colors
│   ├── LaunchScreen.storyboard     # Dark launch screen (#0F172A)
│   └── WebAssets/                  # Bundled game code (HTML, CSS, JS, Images)
├── Podfile                         # Optional CocoaPods alternative for AdMob
└── README.md
```

---

## 🚀 How to Run in Mac Xcode

### 1. Open the Project
Transfer or clone this repository to your Mac, and double-click:
```bash
open BlockFusion.xcodeproj
```

### 2. Configure Code Signing (Only for Physical Devices)
1. In the Xcode Project Navigator (left sidebar), select **BlockFusion** (the top blue project icon).
2. Under **Targets**, select **BlockFusion**.
3. Select the **Signing & Capabilities** tab.
4. Select your **Team** (personal free Apple ID or paid Developer Account).
5. Ensure the Bundle Identifier is `com.eisen.blockrush2k` (or your custom identifier).

### 3. Google Mobile Ads Dependency (Automatic via SPM)
The project is configured to resolve the official **Google Mobile Ads SDK** (`swift-package-manager-google-mobile-ads`) via Xcode's built-in Swift Package Manager.
- When you first open Xcode, it will automatically download and link the package.
- If prompted, click **File > Packages > Resolve Package Versions**.

*(Optional CocoaPods alternative: if you prefer CocoaPods, simply run `pod install` in the project root and open `BlockFusion.xcworkspace`).*

### 4. Run on Simulator or iPhone
1. In Xcode's top toolbar, choose your target device (e.g., **iPhone 16 Pro Simulator** or your connected physical iPhone).
2. Press **Cmd + R** (or the Play ▶ button) to build and run!

---

## 🛒 Testing In-App Purchases (Zero Setup Required!)

The project comes with a configured StoreKit testing configuration: `Products.storekit`.

1. Run the app in the **iOS Simulator**.
2. Navigate to **Store** inside the game.
3. Tap on any item (Coin Pack, Remove Ads, Wood Theme, Neon Theme, or Offline Pass).
4. A native StoreKit test purchase sheet will appear instantly!
5. Tap **Purchase** — the game immediately receives the purchase confirmation, plays the coin sound, and unlocks the item.
6. To test edge cases (refunds, expired subscriptions, declined cards):
   - In Xcode while the app is running, go to **Debug > StoreKit > Manage Transactions...**

---

## 🔄 Syncing Web Updates from `Block Rush 2K`

If you modify HTML, CSS, or JS in `F:\Projects\Websites\Personal\Block Rush 2K\public`:
Simply copy the files into `BlockFusion/WebAssets/` in this repo:
```bash
cp -R "F:/Projects/Websites/Personal/Block Rush 2K/public/*" "BlockFusion/WebAssets/"
```
Rebuild in Xcode — your updates will immediately reflect in the iOS app!

---

## 🛡️ App Store Submission Checklist

1. **AdMob Production IDs**: Before submitting to the App Store, verify your AdMob App ID and Ad Unit IDs in `AdMobManager.swift` and `BlockFusion/App/Info.plist`.
2. **App Store Connect In-App Purchases**: Create the 8 product IDs (`coins_pack_3000`, `coins_pack_5000`, `coins_pack_15000`, `remove_ads`, `theme_neon`, `theme_wood`, `buy_me_coffee`, `sub_offline_mode`) in App Store Connect matching `Products.storekit`.
3. **App Privacy Details**: Declare AdMob tracking and data usage under App Privacy in App Store Connect.
