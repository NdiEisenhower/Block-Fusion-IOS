import UIKit
import AVFoundation

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        
        // Configure audio session as .playback with .mixWithOthers so game audio plays
        // through the iPhone speaker even when the silent/ring switch is muted,
        // without interrupting user's background music or podcasts.
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            if #available(iOS 27.0, *) {
                session.activate(options: []) { success, error in
                    if let error = error {
                        print("⚠️ Audio session setup error: \(error)")
                    }
                }
            } else {
                DispatchQueue.global(qos: .userInitiated).async {
                    do {
                        try session.setActive(true)
                    } catch {
                        print("⚠️ Audio session setup error: \(error)")
                    }
                }
            }
        } catch {
            print("⚠️ Audio session setup error: \(error)")
        }
        
        return true
    }

    // MARK: UISceneSession Lifecycle
    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

    func application(_ application: UIApplication, didDiscardSceneSessions sceneSessions: Set<UISceneSession>) {
    }
}
