# CocoaPods Configuration for Block Rush 2K (iOS)
# Note: Google Mobile Ads is already configured via Swift Package Manager in the Xcode project.
# You only need CocoaPods if your workflow requires it instead of Swift Package Manager.

platform :ios, '15.0'
use_frameworks!

target 'BlockFusion' do
  pod 'Google-Mobile-Ads-SDK', '~> 11.0'
end

post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.0'
    end
  end
end
