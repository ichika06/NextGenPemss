import { useState, useEffect, useRef } from "react";
import { X, Cpu, Save, Download, AlertCircle, Search, Usb, FileText, UserPlus, RefreshCw } from "lucide-react";
import NFCScanner from "./HardwareScanner"; // Import the NFCScanner class
import { useAuth } from "../../contexts/AuthContext";
import {
  collection,
  query,
  where,
  doc,
  onSnapshot,
  getDoc
} from "firebase/firestore";
import { db } from "../../firebase/config";

/**
 * Component for hardware USB NFC scanning, reading and writing
 * @param {Object} props Component props
 * @param {string} props.eventId The ID of the event
 * @param {Function} props.onClose Function to close the modal
 * @param {Function} props.onSuccess Function to call when registration is successful
 * @returns {JSX.Element} Hardware USB component
 */

export default function HardwareUSB({
  eventId,
  onClose,
  onSuccess
}) {
  // State variables
  const [registrationCount, setRegistrationCount] = useState(0);
  const [lastRegisteredName, setLastRegisteredName] = useState("");
  const { currentUser, currentUserData } = useAuth();
  const [writeText, setWriteText] = useState("");
  const [mode, setMode] = useState("read"); // read, write
  const [showDriverInstructions, setShowDriverInstructions] = useState(false);
  const [readResult, setReadResult] = useState("");
  const [status, setStatus] = useState("Idle");
  const [isConnected, setIsConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [siliconLabsDeviceFound, setSiliconLabsDeviceFound] = useState(false);
  const [matchFound, setMatchFound] = useState(false);
  const [matchedUser, setMatchedUser] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [lastScannedTag, setLastScannedTag] = useState("");
  const [continuousScan, setContinuousScan] = useState(true);
  const [pauseScanning, setPauseScanning] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [deviceName, setDeviceName] = useState("");

  // Create a ref for the NFCScanner instance
  const nfcScanner = useRef(new NFCScanner());
  const scanTimeoutRef = useRef(null);
  const connectionMonitorRef = useRef(null);
  const unsubscribeEventRef = useRef(null);

  // Check for devices on mount
  useEffect(() => {
    const checkDevices = async () => {
      try {
        const { nfcScannerFound, ports } = await nfcScanner.current.checkForDevices();
        setSiliconLabsDeviceFound(nfcScannerFound);
      } catch (error) {
        setError(error.message);
      }
    };

    // Check if Web Serial API is available
    if (typeof navigator !== "undefined" && navigator.serial) {
      checkDevices();
      const interval = setInterval(checkDevices, 5000); // refresh ports list periodically
      return () => clearInterval(interval);
    } else {
      setError("Web Serial API is not supported in this browser. Please use Chrome or Edge.");
    }
  }, []);

  // Set up real-time listener for attendee count when eventId is available
  useEffect(() => {
    if (!eventId) return;

    // Set up Firestore listener for real-time updates
    const setupAttendeeCountListener = () => {
      try {
        const eventsRef = collection(db, "events");
        const eventQuery = query(
          eventsRef,
          where("id", "==", eventId)
        );
        
        // Create a real-time listener
        const unsubscribe = onSnapshot(eventQuery, (snapshot) => {
          if (snapshot.empty) {
            console.log("No matching event found");
            setRegistrationCount(0);
            return;
          }

          // Get the first matching document
          const eventDoc = snapshot.docs[0];
          const eventData = eventDoc.data();

          // Check if attendees field exists and is a number
          if (eventData && typeof eventData.attendees === "number") {
            setRegistrationCount(eventData.attendees);
            console.log("Attendee count updated:", eventData.attendees);
          } else {
            console.log("No attendees field found or not a number");
            setRegistrationCount(0);
          }
        }, (error) => {
          console.error("Error in attendee count listener:", error);
        });

        // Store the unsubscribe function
        unsubscribeEventRef.current = unsubscribe;
      } catch (error) {
        console.error("Error setting up attendee count listener:", error);
      }
    };

    // Set up the listener
    setupAttendeeCountListener();

    // Clean up the listener when the component unmounts or eventId changes
    return () => {
      if (unsubscribeEventRef.current) {
        unsubscribeEventRef.current();
        unsubscribeEventRef.current = null;
      }
    };
  }, [eventId]);

  useEffect(() => {
    // Update the NFCScanner with the current user whenever it changes
    if (nfcScanner.current) {
      nfcScanner.current.setCurrentUser(currentUser);
      nfcScanner.current.setCurrentUserData(currentUserData);
    }
  }, [currentUser, currentUserData]);

  // Clean up scanning timeout on unmount
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
      if (connectionMonitorRef.current) {
        clearInterval(connectionMonitorRef.current);
      }
      if (unsubscribeEventRef.current) {
        unsubscribeEventRef.current();
      }
    };
  }, []);

  // Effect to handle continuous scanning
  useEffect(() => {
    // If we're connected, in read mode, continuous scanning is enabled, and we're not currently scanning
    if (isConnected && mode === "read" && continuousScan && !isScanning && !pauseScanning) {
      // Set up the next scan
      scanTimeoutRef.current = setTimeout(() => {
        handleScan();
      }, 2000); // Wait 2 seconds between scans
    }

    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, [isConnected, mode, continuousScan, isScanning, pauseScanning]);

  // Connect to the USB device
  const connectToDevice = async () => {
    setIsConnecting(true);
    setError(null);
    setStatus("Connecting to device...");
    
    try {
      const result = await nfcScanner.current.connectToDevice();
      setIsConnected(result.connected);
      setStatus(result.status);

      if (result.deviceName) {
        setDeviceName(result.deviceName);
      }

      // Start connection monitoring after successful connection
      if (result.connected) {
        // Setup connection monitoring
        connectionMonitorRef.current = setInterval(() => {
          if (!nfcScanner.current.isConnected) {
            setStatus("Connection lost. Attempting to reconnect...");
            setIsConnected(false);

            // Try to reconnect
            nfcScanner.current.handlePortChange()
              .then(reconnectResult => {
                setIsConnected(reconnectResult.connected);
                setStatus(reconnectResult.status);
              })
              .catch(err => {
                setError("Reconnection failed: " + err.message);
              });
          }
        }, 5000); // Check every 5 seconds
      }
    } catch (error) {
      // Check for the specific "Failed to open serial port" error
      if (error.message && error.message.includes("Failed to open serial port")) {
        setError("Please unmount-remount the Device to the usb port or try other usb port then try again");
      } else {
        setError(error.message);
      }
      setStatus("Connection failed");
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect from the USB device
  const disconnectDevice = async () => {
    try {
      // Clear any pending scan timeouts
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }

      // Clear connection monitoring
      if (connectionMonitorRef.current) {
        clearInterval(connectionMonitorRef.current);
        connectionMonitorRef.current = null;
      }

      const result = await nfcScanner.current.disconnectDevice();
      setIsConnected(result.connected);
      setStatus(result.status);
      return result;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  // Toggle continuous scanning
  const toggleContinuousScan = async () => {
    const newContinuousScan = !continuousScan;
    setContinuousScan(newContinuousScan);

    // If connected, send the appropriate command
    if (isConnected && nfcScanner.current && typeof nfcScanner.current.sendCommandToDevice === "function") {
      try {
        if (newContinuousScan) {
          await nfcScanner.current.sendCommandToDevice("READ ON");
        } else {
          await nfcScanner.current.sendCommandToDevice("READ OFF");
        }
      } catch (err) {
        setError("Failed to send command: " + err.message);
      }
    }

    // If turning it off, clear any pending scan timeouts
    if (!newContinuousScan && scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
  };

  // Handle scanning NFC tag
  const handleScan = async () => {
    if (!isConnected) {
      setError("Device not connected");
      return;
    }

    // If not in continuous mode, send the READ command before scanning
    if (!continuousScan && nfcScanner.current && typeof nfcScanner.current.sendCommandToDevice === "function") {
      try {
        await nfcScanner.current.sendCommandToDevice("");
        await new Promise((resolve) => setTimeout(resolve, 150));
        await nfcScanner.current.sendCommandToDevice("READ");
      } catch (err) {
        setError("Failed to send READ command: " + err.message);
        return;
      }
    }

    setError(null);
    setIsScanning(true);
    setStatus("Waiting for NFC tag...");

    try {
      // Scan the NFC tag
      const scanResult = await nfcScanner.current.readNfcTag();
      setLastScannedTag(scanResult.tagData);
      setReadResult(scanResult.fullResponse || scanResult.tagData);
      setStatus("Scan successful! Searching database...");
      setScanCount(prev => prev + 1);

      // Search for matching user
      await verifyUserAndRegister(scanResult.tagData);
    } catch (error) {
      setError(error.message);
      setStatus(`Scan failed: ${error.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Write to NFC tag
  const handleWrite = async () => {
    if (!isConnected) {
      setError("Device not connected");
      return;
    }

    if (!writeText) {
      setError("Please enter text to write");
      return;
    }

    // Pause continuous scanning temporarily
    setPauseScanning(true);
    setError(null);
    setIsScanning(true);
    setStatus("Waiting for NFC tag to write...");

    try {
      const writeResult = await nfcScanner.current.writeNfcTag(writeText);
      setStatus("Write successful!");
      setReadResult(writeResult.fullResponse || "Write successful: " + writeText);
      // Switch back to read mode after successful write
      setMode("read");
    } catch (error) {
      setError(error.message);
      setStatus("Write failed");
    } finally {
      setIsScanning(false);
      // Resume continuous scanning
      setPauseScanning(false);
    }
  };

  // Fetch user's name from Firestore
  const fetchUserName = async (userId) => {
    try {
      const userDocRef = doc(db, "users", userId);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        return userData.name || userData.displayName || userData.email || userId;
      }
      return userId;
    } catch (error) {
      console.error("Failed to fetch user name:", error);
      return userId;
    }
  };

  // Verify user and register for event
  const verifyUserAndRegister = async (nfcData) => {
    setIsSearching(true);
    setStatus("Card detected, verifying...");

    try {
      // Use our NFCScanner class to find the user
      const { exists, userData } = await nfcScanner.current.searchUserByNfcTag(nfcData);

      if (!exists) {
        throw new Error("No matching user found for this NFC card");
      }

      // Register the user for the event
      await nfcScanner.current.registerUserForEvent(userData, eventId, currentUser);

      // Fetch and display the user's name BEFORE deleting temporary data
      console.log("userData for fetchUserName:", userData);
      const userId = userData.uid || userData.id || userData.userId;
      console.log("Fetching user name for userId:", userId);
      const userName = await fetchUserName(userId);
      setLastRegisteredName(userName !== userId ? userName : "Unknown User");

      // Update UI with success information
      setMatchFound(true);
      setMatchedUser(userData);
      setStatus(`Successfully registered ${userName}!`);

      // Only call onSuccess if NOT in continuous scan mode
      if (onSuccess && !continuousScan) {
        onSuccess(userData);
      }

      // In continuous mode, auto-hide the success after a short delay
      if (continuousScan) {
        setTimeout(() => {
          setMatchFound(false);
          setMatchedUser(null);
        }, 2000);
      }

      return true;
    } catch (error) {
      setError(error.message);
      setStatus(`Registration failed: ${error.message}`);
      return false;
    } finally {
      setIsSearching(false);
    }
  };

  // Handle modal close with cleanup
  const handleClose = async () => {
    // Prevent multiple close attempts
    if (isClosing) return;

    setIsClosing(true);

    try {
      // If connected, disconnect first and wait for it to complete
      if (isConnected) {
        setStatus("Disconnecting...");
        await disconnectDevice();
      }

      // Unsubscribe from the Firestore listener
      if (unsubscribeEventRef.current) {
        unsubscribeEventRef.current();
        unsubscribeEventRef.current = null;
      }

      // Reset all relevant states
      setIsConnected(false);
      setIsScanning(false);
      setPauseScanning(false);
      setContinuousScan(true);
      setError(null);
      setStatus("Idle");
      setDeviceName("");

      // Clear any pending scan timeouts
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }

      // Clear connection monitoring
      if (connectionMonitorRef.current) {
        clearInterval(connectionMonitorRef.current);
        connectionMonitorRef.current = null;
      }

      // Call the original onClose callback
      onClose();
    } catch (error) {
      console.error("Error closing modal:", error);
      setError(`Error closing: ${error.message}`);
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Hardware USB NFC Scanner</h2>
          <button
            onClick={handleClose}
            disabled={isClosing}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-6">
          {showDriverInstructions ? (
            // Driver installation instructions
            <div className="text-center">
              <div className="bg-blue-50 p-4 rounded-full mx-auto mb-4 w-20 h-20 flex items-center justify-center">
                <Download className="h-10 w-10 text-blue-600" />
              </div>

              <h3 className="text-lg font-medium text-gray-800 mb-2">USB Driver Installation</h3>
              <div className="text-left mb-6">
                <p className="text-gray-600 mb-3">
                  To use the NFC scanner with your computer, you need to install the appropriate USB drivers:
                </p>
                <ol className="list-decimal pl-5 text-gray-600 space-y-2">
                  <li>Download the driver by clicking the zip download button below.</li>
                  <li>Extract the zip file, then run either <b>CP210xVCPInstaller_x64.exe</b> or <b>CP210xVCPInstaller_x86.exe</b> depending on your computer's architecture (64-bit or 32-bit).</li>
                  <li>Wait for the driver installation to complete.</li>
                  <li>Restart your browser if needed.</li>
                </ol>
                <p className="text-gray-600 mt-3">
                  After installing the drivers, click "Continue" to proceed with connecting your device.
                </p>
              </div>

              <div className="flex gap-3 mb-4">
                <a
                  href="https://firebasestorage.googleapis.com/v0/b/nextgen-pemss.firebasestorage.app/o/drivers%2FPEMMS_Windows_Drivers.zip?alt=media&token=f91c0167-6402-4c80-a60b-a20dfa86ca29"
                  target="_blank"
                  download
                  rel="noopener noreferrer"
                  className="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-md font-medium transition-colors text-center"
                >
                  Download Zip Driver and Install
                </a>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDriverInstructions(false)}
                  className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          ) : !isConnected ? (
            // Connection screen
            <div className="text-center">
              <div className="bg-green-50 p-4 rounded-full mx-auto mb-4 w-20 h-20 flex items-center justify-center">
                <Usb className="h-10 w-10 text-green-600" />
              </div>

              <h3 className="text-lg font-medium text-gray-800 mb-2">Connect Your NFC Scanner</h3>
              <p className="text-gray-600 mb-6">
                Connect your ESP32 NFC scanner device via USB and click "Connect Device" to begin scanning tags.
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 text-left flex items-start">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              {siliconLabsDeviceFound && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4 text-left flex items-start">
                  <Usb className="h-5 w-5 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
                  <p className="text-green-600 text-sm">NFC Scanner device detected! Click "Connect Device" to continue.</p>
                </div>
              )}

              <div className="flex gap-3 mb-4">
                <button
                  onClick={() => setShowDriverInstructions(true)}
                  className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md font-medium transition-colors"
                >
                  Driver Instructions
                </button>
                <button
                  onClick={connectToDevice}
                  disabled={isConnecting}
                  className={`flex-1 py-2 px-4 ${isConnecting ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-md font-medium transition-colors flex items-center justify-center`}
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                      Connecting...
                    </>
                  ) : (
                    "Connect Device"
                  )}
                </button>
              </div>

              <div className="text-xs text-gray-500 text-center">
                {siliconLabsDeviceFound ?
                  "Device detected. Click Connect to continue." :
                  "No device detected. Connect your NFC Scanner device and refresh."
                }
              </div>
            </div>
          ) : (
            // Scanner UI - shown after successful connection
            <div>
              {/* Status bar */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <div className={`h-3 w-3 rounded-full mr-2 ${isScanning ? 'bg-yellow-400 animate-pulse' : 'bg-green-500'}`}></div>
                  <span className="text-sm font-medium text-gray-700">
                    {isScanning ? 'Scanning...' : 'Connected'}
                    {deviceName && ` to ${deviceName}`}
                  </span>
                </div>
                <button
                  onClick={disconnectDevice}
                  disabled={isClosing}
                  className="text-sm text-gray-500 hover:text-red-600 transition-colors"
                >
                  Disconnect
                </button>
              </div>

              {/* Mode selector */}
              <div className="flex border border-gray-200 rounded-md overflow-hidden mb-6">
                <button
                  onClick={() => setMode("read")}
                  className={`flex-1 py-2 text-center ${mode === "read"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                    }`}
                >
                  Read NFC Tags
                </button>
                {/* <button
                  onClick={() => setMode("write")}
                  className={`flex-1 py-2 text-center ${mode === "write"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                    }`}
                >
                  Write NFC Tags
                </button> */}
              </div>

              {/* Status message */}
              <div className="text-center mb-4">
                <p className="text-sm font-medium text-gray-700">{status}</p>
              </div>

              {/* Error message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 text-left flex items-start">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              {/* Write mode UI */}
              {mode === "write" && (
                <div className="mb-6">
                  <label htmlFor="write-text" className="block text-sm font-medium text-gray-700 mb-1">Text to Write</label>
                  <div className="flex gap-2">
                    <input
                      id="write-text"
                      type="text"
                      value={writeText}
                      onChange={(e) => setWriteText(e.target.value)}
                      placeholder="Enter text to write to NFC tag"
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
                    />
                    <button
                      onClick={handleWrite}
                      disabled={isScanning || !writeText}
                      className={`px-4 py-2 ${isScanning || !writeText
                        ? "bg-blue-300"
                        : "bg-blue-600 hover:bg-blue-700"
                        } text-white rounded-md transition-colors flex items-center`}
                    >
                      {isScanning ? (
                        <>
                          <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                          Writing...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-1" />
                          Write
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Read mode UI */}
              {mode === "read" && (
                <div className="space-y-6">
                  {/* Continuous scan toggle */}
                  <div className="flex items-center justify-center mb-2">
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={continuousScan}
                        onChange={toggleContinuousScan}
                        className="sr-only peer"
                      />
                      <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      <span className="ml-3 text-sm font-medium text-gray-700">Continuous Scanning</span>
                    </label>
                  </div>

                  {/* Manual scan button */}
                  <div className="flex justify-center">
                    <button
                      onClick={handleScan}
                      disabled={isScanning}
                      className={`px-6 py-3 ${isScanning
                        ? "bg-blue-300"
                        : "bg-blue-600 hover:bg-blue-700"
                        } text-white rounded-md font-medium transition-colors flex items-center`}
                    >
                      {isScanning ? (
                        <>
                          <RefreshCw className="animate-spin h-5 w-5 mr-2" />
                          Scanning...
                        </>
                      ) : (
                        <>
                          <Search className="h-5 w-5 mr-2" />
                          {continuousScan ? "Trigger Scan Now" : "Scan NFC Tag"}
                        </>
                      )}
                    </button>
                  </div>

                  {/* Match result */}
                  {matchFound && matchedUser && (
                    <div className="bg-green-50 border border-green-200 rounded-md p-4 text-center">
                      <div className="mb-2">
                        <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                          <UserPlus className="h-6 w-6 text-green-600" />
                        </div>
                        <h4 className="font-medium text-green-800">Registration Successful!</h4>
                      </div>
                      <p className="text-sm text-green-700 mb-2">
                        {matchedUser.name || matchedUser.displayName || matchedUser.email} has been registered to the event.
                      </p>
                      <p className="text-xs text-green-600">
                        NFC Tag ID: {lastScannedTag.substring(0, 8)}...
                      </p>
                    </div>
                  )}

                  {/* Statistics */}
                  <div className="border-t border-gray-200 pt-4 text-center">
                    <p className="text-sm text-gray-600">
                      Total registrations: <span className="font-medium">{registrationCount}</span>
                    </p>
                    {lastRegisteredName && lastRegisteredName !== "No one yet" && (
                      <p className="text-xs text-gray-500 mt-1">
                        Last registered: {lastRegisteredName}
                      </p>
                    )}
                    {continuousScan && (
                      <p className="text-xs text-blue-600 mt-1">
                        Continuous scanning active - Place NFC tags near the reader
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Result display */}
              {readResult && (
                <div className="mt-6 border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Last Result:</h4>
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                    <pre className="text-xs text-gray-600 overflow-auto max-h-32 whitespace-pre-wrap">
                      {readResult}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div className="text-xs text-gray-500 flex items-center">
              <Cpu className="h-3 w-3 mr-1" />
              <span>
                {scanCount > 0 ? `${scanCount} scans completed` : "Ready to scan"}
              </span>
            </div>
            <div>
              <button
                onClick={handleClose}
                disabled={isClosing}
                className={`px-4 py-2 ${isClosing ? 'bg-gray-300' : 'bg-gray-100 hover:bg-gray-200'} text-gray-700 rounded-md font-medium transition-colors text-sm flex items-center`}
              >
                {isClosing ? (
                  <>
                    <RefreshCw className="animate-spin h-3 w-3 mr-1" />
                    Closing...
                  </>
                ) : (
                  "Close"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}