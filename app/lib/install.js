// UA chooses which help section starts expanded; it never gates app features.
// Huawei/HarmonyOS versions vary, so do not infer native/PWA install support.
export function installPlatform(ua = navigator.userAgent) {
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'safari';
  if (/HuaweiBrowser|HUAWEI Browser|HarmonyOS|OpenHarmony/i.test(ua)) return 'huawei';
  return 'other';
}
