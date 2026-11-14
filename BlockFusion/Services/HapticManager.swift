import UIKit

/// Manages high-precision iOS Taptic Engine feedback
final class HapticManager {
    static let shared = HapticManager()
    
    private let lightImpact = UIImpactFeedbackGenerator(style: .light)
    private let mediumImpact = UIImpactFeedbackGenerator(style: .medium)
    private let heavyImpact = UIImpactFeedbackGenerator(style: .heavy)
    private let notificationGenerator = UINotificationFeedbackGenerator()
    private let selectionGenerator = UISelectionFeedbackGenerator()
    
    private init() {
        prepare()
    }
    
    func prepare() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.lightImpact.prepare()
            self.mediumImpact.prepare()
            self.heavyImpact.prepare()
            self.notificationGenerator.prepare()
            self.selectionGenerator.prepare()
        }
    }
    
    func impact(style: UIImpactFeedbackGenerator.FeedbackStyle = .medium) {
        guard PreferencesManager.shared.hapticsEnabled else { return }
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            switch style {
            case .light:
                self.lightImpact.impactOccurred()
                self.lightImpact.prepare()
            case .medium:
                self.mediumImpact.impactOccurred()
                self.mediumImpact.prepare()
            case .heavy:
                self.heavyImpact.impactOccurred()
                self.heavyImpact.prepare()
            case .rigid:
                if #available(iOS 13.0, *) {
                    let gen = UIImpactFeedbackGenerator(style: .rigid)
                    gen.impactOccurred()
                } else {
                    self.heavyImpact.impactOccurred()
                }
            case .soft:
                if #available(iOS 13.0, *) {
                    let gen = UIImpactFeedbackGenerator(style: .soft)
                    gen.impactOccurred()
                } else {
                    self.lightImpact.impactOccurred()
                }
            @unknown default:
                self.mediumImpact.impactOccurred()
            }
        }
    }
    
    /// Forces haptic feedback regardless of enabled setting (e.g., when confirming toggle actions)
    func forceImpact(style: UIImpactFeedbackGenerator.FeedbackStyle = .medium) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            switch style {
            case .light:
                self.lightImpact.impactOccurred()
                self.lightImpact.prepare()
            case .medium:
                self.mediumImpact.impactOccurred()
                self.mediumImpact.prepare()
            case .heavy:
                self.heavyImpact.impactOccurred()
                self.heavyImpact.prepare()
            case .rigid:
                if #available(iOS 13.0, *) {
                    let gen = UIImpactFeedbackGenerator(style: .rigid)
                    gen.impactOccurred()
                } else {
                    self.heavyImpact.impactOccurred()
                }
            case .soft:
                if #available(iOS 13.0, *) {
                    let gen = UIImpactFeedbackGenerator(style: .soft)
                    gen.impactOccurred()
                } else {
                    self.lightImpact.impactOccurred()
                }
            @unknown default:
                self.mediumImpact.impactOccurred()
            }
        }
    }
    
    /// Forces selection feedback regardless of enabled setting
    func forceSelection() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.selectionGenerator.selectionChanged()
            self.selectionGenerator.prepare()
        }
    }
    
    func notification(type: UINotificationFeedbackGenerator.FeedbackType) {
        guard PreferencesManager.shared.hapticsEnabled else { return }
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.notificationGenerator.notificationOccurred(type)
            self.notificationGenerator.prepare()
        }
    }
    
    func selection() {
        guard PreferencesManager.shared.hapticsEnabled else { return }
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.selectionGenerator.selectionChanged()
            self.selectionGenerator.prepare()
        }
    }
}
