# Prompt: Implement Seamless In-App OTA Update System in Flutter

Please implement a seamless "In-App Update" feature for my Flutter application using the `ota_update` package. When an update is required, I want the user to see a popup with an "UPDATE NOW" button. When clicked, a progress bar should appear inside the dialog tracking the download (from 0% to 100%). Once it hits 100%, the Android system should automatically prompt the user to "Install" without them ever leaving the app or opening a web browser.

Please follow these exact technical steps to ensure it works on modern Android versions (Android 11+):

## Step 1: Dependencies and Gradle Setup
1. Add `ota_update` to my `pubspec.yaml`.
2. In `android/app/build.gradle` (or `build.gradle.kts`), enable core library desugaring inside the `compileOptions` block (`coreLibraryDesugaringEnabled = true` for Groovy, `isCoreLibraryDesugaringEnabled = true` for Kotlin).
3. In the same `build.gradle` file, add the following to the `dependencies` block: `coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")`. *(Note: Version 2.1.4 or higher is strictly required).*

## Step 2: Android XML & Manifest Configuration
1. Create a new file at `android/app/src/main/res/xml/filepaths.xml` with the following exact content:
```xml
<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <files-path name="internal_apk_storage" path="ota_update/"/>
</paths>
```

2. In `AndroidManifest.xml`, add these permissions at the top:
```xml
<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

3. Inside the `<application>` tag in `AndroidManifest.xml`, add the required receiver and provider exactly as follows:
```xml
<receiver android:name="sk.fourq.otaupdate.InstallResultReceiver" android:exported="false">
    <intent-filter>
        <action android:name="${applicationId}.ACTION_INSTALL_COMPLETE"/>
    </intent-filter>
</receiver>

<provider
    android:name="sk.fourq.otaupdate.OtaUpdateFileProvider"
    android:authorities="${applicationId}.ota_update_provider"
    android:exported="false"
    android:grantUriPermissions="true">
    <meta-data
        android:name="android.support.FILE_PROVIDER_PATHS"
        android:resource="@xml/filepaths" />
</provider>
```

## Step 3: Flutter UI Implementation
Create a function called `showInAppUpdateDialog(String downloadUrl)` that opens a non-dismissible `AlertDialog` using a `StatefulBuilder` (so the dialog can independently update its own progress UI). 
- State variables needed inside the dialog builder: `bool isDownloading = false`, `String downloadPercentage = "0"`, and `String updateStatusMessage = ""`.
- When the "UPDATE NOW" button is clicked, execute `OtaUpdate().execute(downloadUrl, destinationFilename: 'my-app-update.apk')` and listen to the event stream.
- Handle `OtaStatus.DOWNLOADING` to update the `LinearProgressIndicator` and percentage text.
- Handle `OtaStatus.INSTALLING` to change the text to "Preparing to install...".
- Handle `OtaStatus.INTERNAL_ERROR`, `OtaStatus.DOWNLOAD_ERROR`, and `OtaStatus.PERMISSION_NOT_GRANTED_ERROR` to show an error message and allow the user to try clicking the button again.
