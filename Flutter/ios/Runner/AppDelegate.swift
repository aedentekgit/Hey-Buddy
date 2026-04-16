import Flutter
import UIKit
import GoogleMaps

@main
@objc class AppDelegate: FlutterAppDelegate {
  private func googleMapsAPIKey() -> String? {
    guard
      let path = Bundle.main.path(
        forResource: "GoogleService-Info",
        ofType: "plist"
      ),
      let plist = NSDictionary(contentsOfFile: path),
      let apiKey = plist["API_KEY"] as? String,
      !apiKey.isEmpty
    else {
      return nil
    }

    return apiKey
  }

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    if let apiKey = googleMapsAPIKey() {
      GMSServices.provideAPIKey(apiKey)
    }
    GeneratedPluginRegistrant.register(with: self)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
