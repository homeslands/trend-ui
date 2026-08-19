# 📱 Android Push Notification Setup

## AndroidManifest.xml Configuration

Đảm bảo file `android/app/src/main/AndroidManifest.xml` có các permissions và cấu hình sau:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    
    <!-- Required permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
    <uses-permission android:name="android.permission.VIBRATE" />
    
    <application
        android:label="TREND Coffee"
        android:name="${applicationName}"
        android:icon="@mipmap/ic_launcher">
        
        <!-- Firebase Cloud Messaging -->
        <service
            android:name="com.google.firebase.messaging.FirebaseMessagingService"
            android:exported="false">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>
        
        <!-- ... other configurations ... -->
    </application>
</manifest>
```

## Build Configuration

File `android/app/build.gradle` cần có Firebase dependencies:

```gradle
dependencies {
    // ... other dependencies
    
    // Firebase Cloud Messaging
    implementation 'com.google.firebase:firebase-messaging:23.4.0'
    implementation 'com.google.firebase:firebase-analytics:21.5.0'
}
```

## Firebase Configuration

1. Download `google-services.json` từ Firebase Console
2. Đặt file vào `android/app/google-services.json`
3. Thêm vào `android/build.gradle`:

```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.4.0'
    }
}
```

4. Thêm vào `android/app/build.gradle`:

```gradle
apply plugin: 'com.google.gms.google-services'
```

## Testing

Sau khi build app, test notification từ Firebase Console hoặc backend API.

