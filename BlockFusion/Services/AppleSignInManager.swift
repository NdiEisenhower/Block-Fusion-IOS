import Foundation
import AuthenticationServices
import CryptoKit
import UIKit

/// Manages native Sign In with Apple via AuthenticationServices
final class AppleSignInManager: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    static let shared = AppleSignInManager()
    
    weak var presentingViewController: UIViewController?
    weak var scriptBridge: ScriptBridge?
    private var currentNonce: String?
    
    private override init() {
        super.init()
    }
    
    // MARK: - Sign In Request
    func performAppleSignIn(from viewController: UIViewController, scriptBridge: ScriptBridge) {
        self.presentingViewController = viewController
        self.scriptBridge = scriptBridge
        
        let nonce = randomNonceString()
        currentNonce = nonce
        
        let appleIDProvider = ASAuthorizationAppleIDProvider()
        let request = appleIDProvider.createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = sha256(nonce)
        
        let authorizationController = ASAuthorizationController(authorizationRequests: [request])
        authorizationController.delegate = self
        authorizationController.presentationContextProvider = self
        authorizationController.performRequests()
    }
    
    // MARK: - ASAuthorizationControllerDelegate
    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let identityTokenData = appleIDCredential.identityToken,
              let idTokenString = String(data: identityTokenData, encoding: .utf8),
              let nonce = currentNonce else {
            scriptBridge?.evaluateJavaScript("if (window.onAppleSignInError) window.onAppleSignInError('Invalid Apple ID credentials');")
            return
        }
        
        var fullNameDict: [String: String] = [:]
        if let nameComponents = appleIDCredential.fullName {
            if let givenName = nameComponents.givenName { fullNameDict["givenName"] = givenName }
            if let familyName = nameComponents.familyName { fullNameDict["familyName"] = familyName }
        }
        
        let email = appleIDCredential.email ?? ""
        let fullNameJson: String
        if let data = try? JSONSerialization.data(withJSONObject: fullNameDict),
           let jsonStr = String(data: data, encoding: .utf8) {
            fullNameJson = jsonStr
        } else {
            fullNameJson = "{}"
        }
        
        print("🍏 [Apple Sign In] Successfully authenticated identity token, sending to bridge")
        let js = "if (window.onAppleSignInSuccess) { window.onAppleSignInSuccess('\(idTokenString)', '\(nonce)', '\(email)', \(fullNameJson)); }"
        scriptBridge?.evaluateJavaScript(js)
    }
    
    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        let authError = error as? ASAuthorizationError
        if authError?.code == .canceled {
            print("🍏 [Apple Sign In] User cancelled authentication dialog")
            scriptBridge?.evaluateJavaScript("if (window.onAppleSignInError) window.onAppleSignInError('Cancelled');")
        } else {
            let msg = error.localizedDescription.replacingOccurrences(of: "'", with: "\\'")
            print("⚠️ [Apple Sign In] Authorization error: \(msg)")
            scriptBridge?.evaluateJavaScript("if (window.onAppleSignInError) window.onAppleSignInError('\(msg)');")
        }
    }
    
    // MARK: - ASAuthorizationControllerPresentationContextProviding
    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        if let window = presentingViewController?.view.window {
            return window
        }
        if let keyWindow = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .flatMap({ $0.windows })
            .first(where: { $0.isKeyWindow }) {
            return keyWindow
        }
        return UIWindow()
    }
    
    // MARK: - Crypto Helpers
    private func randomNonceString(length: Int = 32) -> String {
        precondition(length > 0)
        var randomBytes = [UInt8](repeating: 0, count: length)
        let errorCode = SecRandomCopyBytes(kSecRandomDefault, randomBytes.count, &randomBytes)
        if errorCode != errSecSuccess {
            fatalError("Unable to generate nonce. SecRandomCopyBytes failed with OSStatus \(errorCode)")
        }
        
        let charset: [Character] =
            Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        
        let nonce = randomBytes.map { byte in
            charset[Int(byte) % charset.count]
        }
        return String(nonce)
    }
    
    private func sha256(_ input: String) -> String {
        let inputData = Data(input.utf8)
        let hashedData = SHA256.hash(data: inputData)
        let hashString = hashedData.compactMap {
            String(format: "%02x", $0)
        }.joined()
        return hashString
    }
}

