import { useState, useEffect } from "react"
import { X, Cpu, PlugZap, UserPlus, Bluetooth, Wifi, Usb } from "lucide-react"
import HardwareUSB from './HardwareUSB';
import HardwareWiFi from './HardwareWifi';

/**
 * Component for hardware NFC scanner registration
 * @param {Object} props Component props
 * @param {string} props.eventId The ID of the event
 * @param {Function} props.onClose Function to close the modal
 * @param {Function} props.onSuccess Function to call when registration is successful
 * @returns {JSX.Element} Hardware NFC scanner component
 */
export default function HardwareNFCScanner({
  eventId,
  onClose,
  onSuccess,
}) {
  const [isConnected, setIsConnected] = useState(false)
  const [registrationCount, setRegistrationCount] = useState(0)
  const [lastRegisteredName, setLastRegisteredName] = useState("")
  const [isRegistering, setIsRegistering] = useState(false)
  const [connectionMethod, setConnectionMethod] = useState(null)
  const [error, setError] = useState(null)
  const [showUSBModal, setShowUSBModal] = useState(false);
  const [showWiFiModal, setShowWiFiModal] = useState(false);

  const handleConnectDevice = () => {
    if (!connectionMethod) {
      setError("Please select a connection method")
      return
    }
    
    // Reset any previous errors
    setError(null)
    
    // If USB selected, show the USB modal instead of connecting directly
    if (connectionMethod === "usb") {
      setShowUSBModal(true)
      return
    }

    // If WiFi selected, show the WiFi modal instead of connecting directly
    if (connectionMethod === "wifi") {
      setShowWiFiModal(true)
      return
    }

    // For other connection methods, simulate connecting
    setIsRegistering(true)

    // Different connection methods could have different connection times
    const connectionTimes = {
      bluetooth: 2000,
    }

    setTimeout(
      () => {
        setIsConnected(true)
        setIsRegistering(false)
      },
      connectionMethod ? connectionTimes[connectionMethod] : 1500,
    )
  }

  const disconnectDevice = () => {
    setIsConnected(false)
    setConnectionMethod(null)
  }

  const getConnectionIcon = () => {
    switch (connectionMethod) {
      case "bluetooth":
        return <Bluetooth className="h-5 w-5" />
      case "usb":
        return <Usb className="h-5 w-5" />
      case "wifi":
        return <Wifi className="h-5 w-5" />
      default:
        return <PlugZap className="h-5 w-5" />
    }
  }

  const getConnectionLabel = () => {
    switch (connectionMethod) {
      case "bluetooth":
        return "Bluetooth"
      case "usb":
        return "USB/Wired"
      case "wifi":
        return "WiFi/Wireless"
      default:
        return "Unknown"
    }
  }

  const handleUSBSuccess = () => {
    setShowUSBModal(false);
    setIsConnected(true);
    setConnectionMethod("usb");
    onSuccess && onSuccess();
  }

  const handleWiFiSuccess = (userData) => {
    setShowWiFiModal(false);
    setIsConnected(true);
    setConnectionMethod("wifi");
    if (userData) {
      setLastRegisteredName(userData.name);
      setRegistrationCount(prev => prev + 1);
    }
    onSuccess && onSuccess(userData);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden border border-gray-200 dark:border-zinc-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-zinc-700">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-zinc-100">Hardware NFC Scanner</h2>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* USB Modal */}
        {showUSBModal && (
          <HardwareUSB
            eventId={eventId}
            onClose={() => setShowUSBModal(false)}
            // onSuccess={handleUSBSuccess}
          />
        )}

        {/* WiFi Modal */}
        {showWiFiModal && (
          <HardwareWiFi
            eventId={eventId}
            onClose={() => setShowWiFiModal(false)}
            onSuccess={handleWiFiSuccess}
          />
        )}

        <div className="px-6 py-6">
          {!isConnected ? (
            <div className="text-center">
              <div className="bg-green-50 dark:bg-green-900 p-4 rounded-full mx-auto mb-4 w-20 h-20 flex items-center justify-center">
                <Cpu className="h-10 w-10 text-green-600 dark:text-green-300" />
              </div>

              <h3 className="text-lg font-medium text-gray-800 dark:text-zinc-100 mb-2">Connect Your Hardware Scanner</h3>
              <p className="text-gray-600 dark:text-zinc-300 mb-6">
                Select a connection method and connect your NFC hardware device to begin registering attendees.
              </p>

              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 dark:text-zinc-200 mb-3">Connection Method</h4>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div
                    className={`cursor-pointer flex flex-col items-center justify-between rounded-md border-2 p-4 hover:bg-gray-50 dark:hover:bg-zinc-900
                      ${connectionMethod === "usb" ? "border-green-500 dark:border-green-400" : "border-gray-200 dark:border-zinc-700"}`}
                    onClick={() => setConnectionMethod("usb")}
                    role="button"
                    tabIndex={0}
                    aria-label="Connect via USB"
                  >
                    <Usb className="mb-2 h-6 w-6" />
                    <span className="text-sm font-medium">USB/Wired</span>
                  </div>

                  {/* WiFi/Wireless Option */}
                  <div
                    className={`cursor-pointer flex flex-col items-center justify-between rounded-md border-2 p-4 hover:bg-gray-50 dark:hover:bg-zinc-900
                      ${connectionMethod === "wifi" ? "border-green-500 dark:border-green-400" : "border-gray-200 dark:border-zinc-700"}`}
                    onClick={() => setConnectionMethod("wifi")}
                    role="button"
                    tabIndex={0}
                    aria-label="Connect via WiFi"
                  >
                    <Wifi className="mb-2 h-6 w-6" />
                    <span className="text-sm font-medium">WiFi/Wireless</span>
                  </div>
                </div>
              </div>

              {error && <p className="text-red-600 dark:text-red-300 text-sm mb-3">{error}</p>}

              <button
                onClick={handleConnectDevice}
                disabled={isRegistering || !connectionMethod}
                className={`w-full py-3 px-4 rounded-md font-medium flex items-center justify-center gap-2 ${
                  isRegistering || !connectionMethod
                    ? "bg-gray-100 dark:bg-zinc-900 text-gray-400 dark:text-zinc-500 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700 text-white"
                }`}
                aria-busy={isRegistering}
              >
                {getConnectionIcon()}
                <span className="ml-2">
                  {isRegistering ? `Connecting via ${getConnectionLabel()}...` : "Connect Device"}
                </span>
              </button>

              {!connectionMethod && !error && (
                <p className="text-amber-600 dark:text-amber-300 text-sm mt-2">Please select a connection method</p>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center mb-4">
                <div className="bg-green-100 dark:bg-green-900 p-2 rounded-full">{getConnectionIcon()}</div>
                <div className="ml-3">
                  <div className="text-sm text-gray-500 dark:text-zinc-400">Device Status</div>
                  <div className="font-medium text-green-600 dark:text-green-300">Connected via {getConnectionLabel()}</div>
                </div>
                <div className="ml-auto flex gap-2">
                  <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 text-xs px-2 py-1 rounded-full">Ready</span>
                  <button 
                    onClick={disconnectDevice} 
                    className="text-xs text-gray-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                    aria-label="Disconnect device"
                  >
                    Disconnect
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-gray-600 dark:text-zinc-300 text-sm">Registrations</div>
                  <div className="font-medium">{registrationCount}</div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-gray-600 dark:text-zinc-300 text-sm">Last Registered</div>
                  <div className="font-medium">{lastRegisteredName || "No one yet"}</div>
                </div>
              </div>

              <div className="text-center mb-6">
                <p className="text-gray-600 dark:text-zinc-300 mb-2">Scan an NFC tag or card to register an attendee.</p>
                <p className="text-gray-500 dark:text-zinc-400 text-sm">The scanner is actively listening for NFC tags.</p>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-700">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 border border-gray-300 dark:border-zinc-700 rounded-md text-gray-700 dark:text-zinc-200 font-medium hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}