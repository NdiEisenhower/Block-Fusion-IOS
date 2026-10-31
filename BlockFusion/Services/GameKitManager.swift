import Foundation
import GameKit
import UIKit

/// Manages native Apple Game Center integration (Leaderboards & Achievements)
final class GameKitManager: NSObject {
    static let shared = GameKitManager()
    
    private(set) var isAuthenticated = false
    weak var presentingViewController: UIViewController?
    
    private override init() {
        super.init()
    }
    
    // MARK: - Authentication
    func authenticateLocalPlayer() {
        let localPlayer = GKLocalPlayer.local
        localPlayer.authenticateHandler = { [weak self] gcAuthVC, error in
            guard let self = self else { return }
            
            if let vc = gcAuthVC {
                self.presentingViewController?.present(vc, animated: true)
                return
            }
            
            if localPlayer.isAuthenticated {
                self.isAuthenticated = true
                print("🎮 Game Center successfully authenticated: \(localPlayer.alias)")
            } else {
                self.isAuthenticated = false
                print("⚠️ Game Center authentication failed or disabled: \(error?.localizedDescription ?? "Unknown")")
            }
        }
    }
    
    // MARK: - Leaderboards
    func submitScore(_ score: Int, leaderboardId: String = "main_leaderboard") {
        guard isAuthenticated else { return }
        
        if #available(iOS 14.0, *) {
            GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local, leaderboardIDs: [leaderboardId]) { error in
                if let error = error {
                    print("⚠️ Failed to submit Game Center score: \(error.localizedDescription)")
                } else {
                    print("🏆 Score \(score) submitted to Game Center leaderboard '\(leaderboardId)'")
                }
            }
        } else {
            let scoreReporter = GKScore(leaderboardIdentifier: leaderboardId)
            scoreReporter.value = Int64(score)
            GKScore.report([scoreReporter]) { error in
                if let error = error {
                    print("⚠️ Failed to submit Game Center score: \(error.localizedDescription)")
                }
            }
        }
    }
    
    // MARK: - Achievements
    func reportAchievement(id: String, percentComplete: Double = 100.0) {
        guard isAuthenticated else { return }
        
        let achievement = GKAchievement(identifier: id)
        achievement.percentComplete = percentComplete
        achievement.showsCompletionBanner = true
        
        GKAchievement.report([achievement]) { error in
            if let error = error {
                print("⚠️ Failed to report Game Center achievement: \(error.localizedDescription)")
            } else {
                print("🌟 Game Center achievement '\(id)' reported (\(percentComplete)%)")
            }
        }
    }
    
    // MARK: - UI Presentation
    func showGameCenterDashboard() {
        guard let vc = presentingViewController else { return }
        
        let gcVC = GKGameCenterViewController(state: .default)
        gcVC.gameCenterDelegate = self
        vc.present(gcVC, animated: true)
    }
}

// MARK: - GKGameCenterControllerDelegate
extension GameKitManager: GKGameCenterControllerDelegate {
    func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true, completion: nil)
    }
}
