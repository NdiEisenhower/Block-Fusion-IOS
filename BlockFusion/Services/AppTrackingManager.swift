import Foundation
import AppTrackingTransparency
import AdSupport

/// Handles Apple App Tracking Transparency (ATT) authorization
final class AppTrackingManager {
    static let shared = AppTrackingManager()
    
    private init() {}
    
    func requestAuthorization(completion: @escaping (ATTrackingManager.AuthorizationStatus) -> Void) {
        if #available(iOS 14.5, *) {
            // Small delay to ensure the UI / window is fully loaded
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                ATTrackingManager.requestTrackingAuthorization { status in
                    DispatchQueue.main.async {
                        completion(status)
                    }
                }
            }
        } else {
            completion(.authorized)
        }
    }
    
    var isAuthorized: Bool {
        if #available(iOS 14.5, *) {
            return ATTrackingManager.trackingAuthorizationStatus == .authorized
        }
        return true
    }
}
