# TaskMint Pro — Firebase Setup Guide

## ধাপ ১: Firebase Project তৈরি করো

1. https://console.firebase.google.com যাও
2. "Add project" ক্লিক করো
3. Project name দাও (যেমন: taskmint-pro)
4. Google Analytics: অফ রাখো (Optional)
5. "Create project" ক্লিক করো

## ধাপ ২: Realtime Database চালু করো

1. বাম মেনুতে **Build > Realtime Database** ক্লিক করো
2. "Create Database" ক্লিক করো
3. Location: **Singapore (asia-southeast1)** বাছাই করো
4. Security rules: **"Start in test mode"** বাছাই করো
5. "Enable" ক্লিক করো

## ধাপ ৩: Security Rules সেট করো

Database → Rules tab তে এই rules paste করো:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

"Publish" ক্লিক করো।

> ⚠️ Production এ যাওয়ার আগে rules আরো tight করো।

## ধাপ ৪: Web App Config নাও

1. Project Settings (⚙️) → "Your apps" section
2. **</>** (Web) icon ক্লিক করো
3. App nickname দাও, "Register app" ক্লিক করো
4. `firebaseConfig` object টা copy করো

## ধাপ ৫: script.js এ Config পেস্ট করো

`script.js` এর একদম উপরে এই section খোঁজো:

```javascript
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  ...
};
```

তোমার actual config দিয়ে replace করো।

## ধাপ ৬: Netlify তে Deploy করো

1. `index.html`, `script.js`, `style.css` তিনটা file Netlify তে upload করো
2. Done! সব device থেকে real-time sync হবে।

---

## ✅ কী কী এখন সব device থেকে দেখা যাবে:

- সব user registration
- সব withdrawal requests
- সব videos
- Admin panel এ সব data
- Real-time updates

