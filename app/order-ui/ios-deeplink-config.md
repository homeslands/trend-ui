# iOS Deep Link Configuration

## Khi tạo iOS project, cần thêm vào `Info.plist`:

```xml
<!-- Deep Links -->
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>com.trendcoffee.app</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>trendcoffee</string>
    </array>
  </dict>
</array>

<!-- Universal Links -->
<key>com.apple.developer.associated-domains</key>
<array>
  <string>applinks:order.cmsiot.net</string>
  <string>applinks:sandbox.order.cmsiot.net</string>
</array>
```

## Chạy lệnh:

```bash
npx cap sync ios
npx cap open ios
```

Sau đó rebuild app để apply changes.

