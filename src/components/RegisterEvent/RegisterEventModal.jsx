import { useState, useEffect } from "react";
import { X, Smartphone, QrCode, Cpu, AlertCircle, CheckCircle2 } from "lucide-react";

/**
 * Modal for selecting registration method for an event
 * @param {Object} props Component props
 * @param {string} props.eventId The ID of the event
 * @param {Function} props.onClose Function to close the modal
 * @param {Function} props.onSelectOption Function called when an option is selected
 * @returns {JSX.Element} Registration options modal
 */
export default function RegistrationOptionsModal({ eventId, onClose, onSelectOption }) {
  const [isNFCSupported, setIsNFCSupported] = useState(false);
  
  useEffect(() => {
    // Check if NFC is supported on this device
    setIsNFCSupported("NDEFReader" in window);
  }, []);

  const handleOptionSelect = (option) => {
    if (onSelectOption) {
      onSelectOption(option);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Select Registration Method</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="px-6 py-4">
          <p className="text-gray-600 mb-4">
            Choose how you would like to register attendees for this event.
          </p>
          
          <div className="space-y-3">
            {/* Hardware NFC Scanner Option */}
            <button
              onClick={() => handleOptionSelect("hardware-nfc")}
              className="w-full flex items-center p-4 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors text-left group relative"
            >
              <div className="bg-indigo-100 p-2 rounded-full mr-4">
                <Cpu className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-800 flex items-center">
                  Hardware NFC Scanner
                  <span className="ml-2 text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                    Recommended
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Use a dedicated NFC scanner device for faster registration
                </p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            
            {/* Current Device NFC Scanner Option */}
            <button
              onClick={() => isNFCSupported && handleOptionSelect("device-nfc")}
              disabled={!isNFCSupported}
              className={`w-full flex items-center p-4 border rounded-lg text-left group relative ${
                isNFCSupported
                  ? "border-green-200 hover:bg-green-50 transition-colors"
                  : "border-gray-200 bg-gray-50 cursor-not-allowed"
              }`}
            >
              <div className={`p-2 rounded-full mr-4 ${isNFCSupported ? "bg-green-100" : "bg-gray-100"}`}>
                <Smartphone className={`h-5 w-5 ${isNFCSupported ? "text-green-600" : "text-gray-400"}`} />
              </div>
              <div className="flex-1">
                <div className={`font-medium ${isNFCSupported ? "text-gray-800" : "text-gray-400"}`}>
                  Current Device NFC Scanner
                </div>
                <p className={`text-sm mt-1 ${isNFCSupported ? "text-gray-600" : "text-gray-400"}`}>
                  {isNFCSupported 
                    ? "Use this device's built-in NFC reader" 
                    : "Your current device does not support NFC"}
                </p>
              </div>
              {!isNFCSupported && (
                <AlertCircle className="h-5 w-5 text-gray-400 ml-2" />
              )}
              {isNFCSupported && (
                <CheckCircle2 className="h-5 w-5 text-green-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
            
            {/* QR Code Option */}
            <button
              onClick={() => handleOptionSelect("qr-code")}
              className="w-full flex items-center p-4 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors text-left group relative"
            >
              <div className="bg-purple-100 p-2 rounded-full mr-4">
                <QrCode className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-800">
                  Generate QR Code
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Create a QR code that attendees can scan to register
                </p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        </div>
        
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}