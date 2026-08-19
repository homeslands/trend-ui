# 🔗 Deep Linking Setup & Testing Guide

## 📋 OVERVIEW

App hỗ trợ 3 loại links:

1. **Deep Links**: `trendcoffee://history?order=123`
2. **Universal Links**: `https://order.cmsiot.net/history?order=123`
3. **Notification Links**: Backend gửi URL trong notification data

---

## ✅ ĐÃ CONFIG

### **Android (AndroidManifest.xml)**

```xml
<!-- Deep Links: trendcoffee:// -->
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="trendcoffee" />
</intent-filter>

<!-- Universal Links: https://order.cmsiot.net -->
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data 
    android:scheme="https"
    android:host="order.cmsiot.net" />
  <data 
    android:scheme="https"
    android:host="sandbox.order.cmsiot.net" />
</intent-filter>
```

### **Capacitor Config**

```typescript
server: {
  hostname: 'order.cmsiot.net',
  allowNavigation: [
    'order.cmsiot.net',
    'sandbox.order.cmsiot.net',
  ],
}
```

---

## 🚀 HOW IT WORKS

### **Timeline khi app nhận notification:**

```
Backend gửi notification
  ↓
{
  notification: {
    title: "Đơn hàng sẵn sàng",
    body: "Đơn hàng #581..."
  },
  data: {
    route: "https://sandbox.order.cmsiot.net/history?order=73d9c976e6",
    type: "order",
    ...
  }
}
  ↓
FCM → Device
  ↓
═══════════════════════════════════════
CASE 1: APP ĐANG MỞ (Foreground)
═══════════════════════════════════════
  ↓
PushNotifications.addListener('pushNotificationReceived')
  ↓
🔔 [FOREGROUND] Notification received: {...}
  ↓
1. Show local notification (notification bar)
2. Set state → trigger custom toast
3. Play sound
  ↓
User clicks "Xem chi tiết" trong toast
  ↓
navigateToNotificationUrl(data.route, navigate)
  ↓
deepLinkHandler.navigate("https://sandbox.order.cmsiot.net/history?order=...")
  ↓
Extract path → "/history?order=73d9c976e6"
  ↓
navigate("/history?order=73d9c976e6")
  ↓
✅ User thấy order detail page

═══════════════════════════════════════
CASE 2: APP BACKGROUND (Minimized)
═══════════════════════════════════════
  ↓
OS shows notification automatically
  ↓
User clicks notification
  ↓
App brought to foreground
  ↓
PushNotifications.addListener('pushNotificationActionPerformed')
  ↓
👆 [BACKGROUND] Notification clicked: {...}
  ↓
Extract URL: data.url || data.route
  ↓
navigateToNotificationUrl("https://sandbox.order.cmsiot.net/history?order=...")
  ↓
deepLinkHandler.navigate(url)
  ↓
Extract path → "/history?order=73d9c976e6"
  ↓
navigate("/history?order=73d9c976e6")
  ↓
✅ User thấy order detail page

═══════════════════════════════════════
CASE 3: APP KILLED (Closed completely)
═══════════════════════════════════════
  ↓
OS shows notification
  ↓
User clicks notification
  ↓
App launches (COLD START)
  ↓
🔗 [DeepLink] Handler initialized
App.addListener('appUrlOpen') setup
  ↓
App.getLaunchUrl() returns URL
  ↓
🔗 [DeepLink] App launched with URL: https://...
  ↓
deepLinkHandler.handleAppUrlOpen(url)
  ↓
Extract path → "/history?order=73d9c976e6"
  ↓
❓ Navigation callback ready?
  ├─ YES → navigate() ngay
  └─ NO → Save as pendingNavigation
  ↓
NotificationProvider mount
  ↓
deepLinkHandler.registerNavigationCallback(navigate)
  ↓
Process pending navigation
  ↓
navigate("/history?order=73d9c976e6")
  ↓
✅ User thấy order detail page
```

---

## 🧪 TESTING

### **Test 1: Deep Link (Custom Scheme)**

```bash
# Android - Dùng ADB
adb shell am start -W -a android.intent.action.VIEW \
  -d "trendcoffee://history?order=73d9c976e6" \
  com.trendcoffee.app

# Expected logs:
🔗 [DeepLink] App URL opened: trendcoffee://history?order=73d9c976e6
🔗 [DeepLink] Navigating to: /history?order=73d9c976e6

# Expected result:
✅ App opens
✅ Navigate to /history?order=73d9c976e6
✅ User sees order detail
```

### **Test 2: Universal Link (HTTPS)**

```bash
# Android - Dùng ADB
adb shell am start -W -a android.intent.action.VIEW \
  -d "https://sandbox.order.cmsiot.net/history?order=73d9c976e6" \
  com.trendcoffee.app

# Expected logs:
🔗 [DeepLink] App URL opened: https://sandbox.order.cmsiot.net/history?order=73d9c976e6
🔗 [DeepLink] Navigating to: /history?order=73d9c976e6

# Expected result:
✅ App opens (not browser!)
✅ Navigate to /history?order=73d9c976e6
```

### **Test 3: Notification Click (App Killed)**

```bash
# 1. Force close app:
adb shell am force-stop com.trendcoffee.app

# 2. Gửi notification từ backend:
POST /notification/send
{
  "userId": "...",
  "notification": {
    "title": "Test",
    "body": "Click me"
  },
  "data": {
    "route": "https://sandbox.order.cmsiot.net/history?order=123"
  }
}

# 3. Click notification

# Expected logs:
🔗 [DeepLink] App launched with URL: https://sandbox.order.cmsiot.net/history?order=123
🔗 [DeepLink] Navigation callback not ready, saved as pending
🔗 [DeepLink] Navigation callback registered
🔗 [DeepLink] Processing pending navigation: /history?order=123
🔗 [DeepLink] Processed pending notification after callback registration

# Expected result:
✅ App launches
✅ Navigate to /history?order=123 (after router ready)
```

### **Test 4: Notification Click (App Background)**

```bash
# 1. Minimize app
# 2. Gửi notification
# 3. Click notification

# Expected logs:
👆 [BACKGROUND] Notification clicked: {...}
👆 [BACKGROUND] Extracted URL: { final: "https://..." }
🔗 [DeepLink] Navigation callback registered
🔗 [DeepLink] Navigating to: /history?order=123

# Expected result:
✅ App brought to foreground
✅ Navigate to /history?order=123
```

### **Test 5: Notification Click (App Foreground)**

```bash
# 1. App đang mở
# 2. Gửi notification
# 3. Click "Xem chi tiết" trong toast

# Expected logs:
🔔 [FOREGROUND] Notification received: {...}
🔗 [DeepLink] Navigating to: /history?order=123

# Expected result:
✅ Navigate ngay
✅ No delay
```

---

## 🐛 DEBUGGING

### **Check Deep Link Handler State**

```javascript
// In browser console or ADB logcat
window.deepLinkHandler = deepLinkHandler

// Check if initialized
deepLinkHandler
// → { isSetup: true, navigationCallback: fn, pendingNavigation: null }

// Check pending navigation
deepLinkHandler.getPendingNavigation()
// → { path: "/history?order=123", timestamp: 1730808600000 }
// or null if no pending
```

### **Common Issues**

| Issue | Cause | Solution |
|-------|-------|----------|
| Deep link không mở app | Intent filter sai | Check AndroidManifest.xml |
| App mở nhưng không navigate | Callback chưa register | Check logs có "Navigation callback registered" |
| Navigate sai path | URL parsing lỗi | Check logs "Extracted URL" |
| Pending navigation expired | Cold start quá chậm | Increase timeout (30s → 60s) |

---

## 📊 SUPPORTED URL FORMATS

Backend có thể gửi bất kỳ format nào sau:

```typescript
// ✅ All supported:
data: { route: "https://order.cmsiot.net/history?order=123" }
data: { route: "https://sandbox.order.cmsiot.net/history?order=123" }
data: { route: "/history?order=123" }
data: { route: "trendcoffee://history?order=123" }
data: { url: "https://order.cmsiot.net/history?order=123" }
data: { url: "/history?order=123" }

// All extract to → "/history?order=123"
```

---

## 🎯 BENEFITS

### **Before (old approach):**
```
Notification → Hard to handle cold start
              → URL parsing phức tạp
              → Không support deep links
              → Có thể miss navigation
```

### **After (with Deep Links):**
```
✅ Universal Links: Click link ở bất kỳ đâu → mở app
✅ Deep Links: Custom scheme trendcoffee://
✅ Cold Start: Save pending → process when ready
✅ Đơn giản: Centralized handler
✅ Debug dễ: Clear logs
✅ Reliable: Không bao giờ miss navigation
```

---

## 🔥 ADVANCED USE CASES

### **Share Deep Link**

User có thể share link qua SMS/Email:

```
Gửi cho bạn: trendcoffee://history?order=123
```

Người nhận click → App mở (nếu có cài) → Navigate to order

### **QR Code**

Tạo QR code với deep link:

```
https://order.cmsiot.net/menu?branch=abc123
```

User scan → App mở → Navigate to menu của branch đó

### **Marketing Campaign**

```
https://order.cmsiot.net/promotions?campaign=summer2024
```

Click từ Facebook Ads → App mở → Navigate to promotions

---

## 🚀 PRODUCTION CHECKLIST

- [x] Android Intent Filters configured
- [x] Capacitor config updated
- [ ] iOS Info.plist configured (khi tạo iOS project)
- [x] Deep Link Handler implemented
- [x] Integrated with notification system
- [ ] Test trên real device
- [ ] Test all 3 app states (foreground/background/killed)
- [ ] Test both deep links and universal links
- [ ] Verify assetlinks.json for Universal Links (production)

---

## 📝 NEXT STEPS

1. **Build app:**
   ```bash
   npm run build
   npx cap sync android
   npx cap open android
   ```

2. **Test deep links** theo guide trên

3. **Setup Universal Links verification** (production):
   - Host file `.well-known/assetlinks.json` trên domain
   - Verify với: `https://order.cmsiot.net/.well-known/assetlinks.json`

---

**Deep Linking đã sẵn sàng!** 🎉

