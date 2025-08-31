# 🔔 Comprehensive Notification Preference System

## 🎯 Overview

The notification system now includes **robust user preference checking** at multiple levels to ensure users only receive notifications they want, when they want them.

## ✅ **Multi-Level Preference Checking**

### **Level 1: Global Notification Toggle**
```typescript
if (notificationSettings.notificationsEnabled === false) {
  // ❌ User has disabled ALL notifications - skip everything
  return;
}
```

### **Level 2: Push Notification Toggle**  
```typescript
if (notificationSettings.push === false) {
  // ❌ User has disabled push notifications - skip all push
  return;
}
```

### **Level 3: Category-Specific Toggles**
```typescript
if (notificationSettings.bankConnections === false) {
  // ❌ User has disabled bank connection notifications specifically
  return;
}

if (notificationSettings.security === false && isSecurityAlert) {
  // ❌ User has disabled security alerts
  return;
}
```

### **Level 4: Frequency Controls**
```typescript
// Minimal: Only critical security issues
if (frequency === 'minimal' && !isCritical) return;

// Important: Skip optional notifications  
if (frequency === 'important' && isOptional) return;

// All: Send everything (default)
```

### **Level 5: Quiet Hours**
```typescript
if (inQuietHours && !isCritical) {
  // 🔇 User in quiet time - skip non-critical notifications
  return;
}
```

## 📊 **Notification Priority Matrix**

| Webhook Type | Priority | Frequency Respect | Quiet Hours Respect | Security Override |
|-------------|----------|-------------------|-------------------|------------------|
| `ERROR` / `ITEM_LOGIN_REQUIRED` | 🔴 **Critical** | ❌ Always sends | ❌ Ignores quiet hours | ✅ Security setting |
| `USER_PERMISSION_REVOKED` | 🔴 **Critical** | ❌ Always sends | ❌ Ignores quiet hours | ✅ Security setting |
| `PENDING_EXPIRATION` | 🟡 **Medium** | ✅ Respects minimal | ✅ Respects quiet hours | ❌ Not security |
| `NEW_ACCOUNTS_AVAILABLE` | 🟡 **Optional** | ✅ Skipped in important/minimal | ✅ Respects quiet hours | ❌ Not security |
| `LOGIN_REPAIRED` | 🟢 **Info** | ✅ Respects frequency | ✅ Respects quiet hours | ❌ Not security |

## 🔧 **User Notification Settings Schema**

```typescript
interface NotificationSettings {
  // Master controls
  notificationsEnabled: boolean;    // Global on/off switch
  push: boolean;                   // Push notifications enabled
  
  // Category controls  
  bankConnections: boolean;        // Bank connection issues
  receipts: boolean;              // Receipt processing updates
  security: boolean;              // Security alerts & critical issues
  subscriptionUpdates: boolean;   // Billing & subscription changes
  tipsFeatures: boolean;          // Tips, tutorials, new features
  
  // Frequency control
  frequency: 'all' | 'important' | 'minimal';
  
  // Timing control
  quietHours: {
    enabled: boolean;
    startTime: string;  // "22:00"
    endTime: string;    // "07:00"
  };
}
```

## 🎛️ **Frequency Setting Behavior**

### **'all' (Default)**
- ✅ Receives all notification types
- ✅ Gets security alerts, connection issues, new accounts, repairs
- ✅ Gets tips, feature updates, non-critical info

### **'important'** 
- ✅ Receives security alerts and critical connection issues
- ✅ Gets connection expiration warnings
- ❌ Skips new account discovery notifications
- ❌ Skips tips and feature updates

### **'minimal'**
- ✅ Only security alerts and critical connection failures
- ❌ Skips connection expiration warnings
- ❌ Skips all optional notifications
- ❌ Skips tips and feature updates

## 🔇 **Quiet Hours Logic**

### **Non-Critical Notifications Delayed**
- Connection expiring warnings wait until after quiet hours
- New account discoveries wait until after quiet hours  
- Good news notifications wait until after quiet hours

### **Critical Notifications Always Sent**
- Security alerts ignore quiet hours
- Connection failures ignore quiet hours (users need immediate action)

### **Overnight Quiet Hours Support**
```typescript
// Handles cases like 22:00 to 07:00 (crosses midnight)
if (startTime > endTime) {
  inQuietHours = currentTime >= startTime || currentTime <= endTime;
}
```

## 🔒 **Privacy & User Control**

### **Preference Preservation**
- ✅ **Existing settings preserved** when updating push tokens
- ✅ **No overwriting** of user's carefully configured preferences  
- ✅ **Default settings** only applied to new users

### **Granular Control**
- Users can disable specific categories while keeping others
- Users can disable push while keeping in-app notifications
- Users can set frequency without losing category preferences

### **Fail-Safe Behavior**
- ✅ **No notification sent** if preferences can't be verified
- ✅ **Database errors** don't result in unwanted notifications
- ✅ **Missing settings** default to no notification

## 🧪 **Testing Scenarios**

### **User Preference Test Cases**

| Scenario | Global | Push | Bank | Security | Frequency | Expected Result |
|----------|--------|------|------|----------|-----------|----------------|
| All enabled | ✅ | ✅ | ✅ | ✅ | all | 📱 Send notification |
| Global disabled | ❌ | ✅ | ✅ | ✅ | all | ❌ No notification |
| Push disabled | ✅ | ❌ | ✅ | ✅ | all | ❌ No notification |
| Bank disabled | ✅ | ✅ | ❌ | ✅ | all | ❌ No notification |
| Security disabled + ERROR | ✅ | ✅ | ✅ | ❌ | all | ❌ No notification |
| Minimal frequency + PENDING_EXPIRATION | ✅ | ✅ | ✅ | ✅ | minimal | ❌ No notification |
| Important frequency + NEW_ACCOUNTS | ✅ | ✅ | ✅ | ✅ | important | ❌ No notification |
| Quiet hours + non-critical | ✅ | ✅ | ✅ | ✅ | all | ❌ No notification |
| Quiet hours + critical | ✅ | ✅ | ✅ | ✅ | all | 📱 Send notification |

## 📱 **Mobile App Integration**

### **ExpoNotificationService Updates**
```typescript
// ✅ Preserves existing user preferences
await notificationService.saveTokenToFirestore(userId);

// ✅ Check permissions before sending local notifications
const canSend = await notificationService.checkNotificationPermission(userId, 'bankConnections');
if (canSend) {
  await notificationService.scheduleProductionNotification('securityAlerts', title, body);
}
```

### **Settings Screen Integration**
The notification settings can be managed in your app's settings screen with toggles for:
- Master notification toggle
- Push notification toggle  
- Category-specific toggles (bank, receipts, security, etc.)
- Frequency selector (all/important/minimal)
- Quiet hours time picker

## 🚀 **Firebase Functions Integration**

### **Enhanced Webhook Processing**
```typescript
// Multiple levels of checking before sending push
const result = await sendPlaidConnectionPushNotification(
  userId, institutionName, type, title, message, itemId
);
```

### **Comprehensive Logging**
- ✅ **"📵 User X has disabled Y notifications"** - Clear skip reasons
- ✅ **"🔇 User X in quiet hours"** - Timing-based skips  
- ✅ **"📵 User X in minimal mode"** - Frequency-based skips
- ✅ **"✅ Push notification sent"** - Successful delivery

## 🎉 **Benefits**

### **For Users**
- **Complete control** over what notifications they receive
- **Granular settings** - can fine-tune experience
- **Quiet hours support** - no 3am notifications unless critical
- **Frequency control** - reduce notification fatigue
- **Security prioritization** - critical alerts always get through

### **For Your App**
- **Higher user satisfaction** - respects user preferences
- **Reduced uninstalls** - no notification spam
- **Better engagement** - users keep notifications enabled
- **Compliance ready** - robust privacy controls

## 🔍 **Monitoring & Analytics**

### **Track Notification Skipping**
Monitor Firebase Functions logs for:
- Skip reasons and frequency
- Most common disabled categories  
- Quiet hours usage patterns
- User preference trends

### **Optimize Notification Strategy**
- If many users disable bank connections → Review notification quality
- If many users set minimal → Review notification frequency
- If many users enable quiet hours → Consider default timing improvements

The notification preference system ensures **users stay in control** while still receiving the critical alerts they need to maintain their financial data integrity! 🎛️📱