/**
 * Environment detection utilities
 */

// Check if running in Electron
export const isElectron = () => {
  // Check if window.electronAPI exists (our exposed API)
  if (window.electronAPI && window.electronAPI.isElectron === true) {
    return true;
  }
  
  // Additional checks if needed
  const userAgent = navigator.userAgent.toLowerCase();
  return userAgent.indexOf(' electron/') > -1;
};

// Get appropriate API for the current environment
export const getSerialAPI = () => {
  if (isElectron()) {
    // Return Electron's API
    return window.electronAPI;
  } else {
    // Return web fallback API or null
    return {
      // For functions that are Electron-only, return reasonable defaults
      listPorts: () => Promise.resolve([]),
      connectPort: () => Promise.resolve({ success: false, reason: 'Web version' }),
      sendData: () => Promise.resolve({ success: false, reason: 'Web version' }),
      closePort: () => Promise.resolve({ success: false, reason: 'Web version' }),
      checkDriverStatus: () => Promise.resolve({ webVersion: true }),
      installDriver: () => Promise.resolve({ success: false, reason: 'Web version' }),
      checkInstallPath: () => Promise.resolve({ webVersion: true })
    };
  }
};

// This can be used in components to show/hide desktop-only features
export const isPlatformCompatible = (feature) => {
  switch (feature) {
    case 'serial':
      // Serial port is only available in Electron
      return isElectron();
    case 'drivers':
      // Driver installation is only available in Electron
      return isElectron();
    case 'qrScan':
      // QR scanning might be available in both
      return true;
    default:
      return true;
  }
};