import React from 'react';

function UninstallInfo() {
  // Only show in Electron environment
  if (!window.electronAPI?.isElectron) {
    return null;
  }

  return (
    <div className="mt-4 p-4 bg-gray-100 rounded-lg">
      <h3 className="text-lg font-medium mb-2">Application Information</h3>
      <p>This application is installed on your system. To uninstall:</p>
      <ul className="list-disc ml-5 mt-2">
        <li>Windows: Use Control Panel &gt; Programs &gt; Uninstall a Program</li>
        <li>macOS: Drag the application from Applications to Trash</li>
        <li>Linux: Use your package manager or delete the AppImage</li>
      </ul>
      
      <div className="mt-3">
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={() => {
            if (window.electronAPI?.checkInstallPath) {
              window.electronAPI.checkInstallPath();
            } else {
              alert('This feature is only available in the installed application.');
            }
          }}
        >
          Show Installation Path
        </button>
      </div>
    </div>
  );
}

export default UninstallInfo;