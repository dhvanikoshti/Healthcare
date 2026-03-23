/**
 * Generates a stable fingerprint for the current device/system.
 * This is used to group sessions from different browsers on the same physical hardware.
 */
export const getSystemFingerprint = () => {
  const {
    hardwareConcurrency,
    deviceMemory,
    userAgent
  } = navigator;
  
  const {
    width,
    height,
    colorDepth
  } = screen;
  
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Identify OS
  let os = "Unknown OS";
  if (/Windows/i.test(userAgent)) os = "Windows";
  else if (/Macintosh/i.test(userAgent)) os = "MacOS";
  else if (/Android/i.test(userAgent)) os = "Android";
  else if (/iPhone|iPad/i.test(userAgent)) os = "iOS";
  else if (/Linux/i.test(userAgent)) os = "Linux";

  // Concatenate stable properties to form an ID
  // Note: deviceMemory is not available in Firefox, so we fallback to 'unknown'
  const ram = deviceMemory || 'unknown';
  const cpu = hardwareConcurrency || 'unknown';
  
  const rawId = `${os}-${cpu}-${ram}-${width}x${height}-${colorDepth}-${timezone}`;
  
  // Simple hash function to make it a cleaner ID
  let hash = 0;
  for (let i = 0; i < rawId.length; i++) {
    const char = rawId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  
  return `system_${Math.abs(hash).toString(36)}`;
};

/**
 * Gets a human-readable name for the current device system.
 */
export const getSystemName = () => {
  const ua = window.navigator.userAgent;
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Android/i.test(ua)) return "Android Device";
  if (/iPhone|iPad/i.test(ua)) return "iOS Device";
  if (/Linux/i.test(ua)) return "Linux System";
  return "Unknown System";
};

/**
 * Gets the current browser name.
 */
export const getBrowserName = () => {
  const ua = window.navigator.userAgent;
  if (/Edg/i.test(ua)) return "Edge";
  if (/Chrome/i.test(ua)) return "Chrome";
  if (/Firefox/i.test(ua)) return "Firefox";
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return "Safari";
  return "Browser";
};
