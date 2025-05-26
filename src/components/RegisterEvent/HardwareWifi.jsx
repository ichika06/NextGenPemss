import { useState, useEffect, useRef } from "react";
import { X, Wifi, WifiOff, Search, RefreshCw, AlertCircle, UserPlus, Monitor, Signal, Clock } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import {
  collection,
  query,
  where,
  doc,
  onSnapshot,
  getDocs,
  updateDoc,
  getDoc
} from "firebase/firestore";
import { db } from "../../firebase/config";
import { ref, onValue, set, off, remove } from "firebase/database";
import { database } from "../../firebase/config"; // Make sure you import the realtime database

/**
 * Component for WiFi NFC scanning
 * @param {Object} props Component props
 * @param {string} props.eventId The ID of the event
 * @param {Function} props.onClose Function to close the modal
 * @param {Function} props.onSuccess Function to call when registration is successful
 * @returns {JSX.Element} WiFi NFC component
 */

export default function HardwareWiFi({
  eventId,
  onClose,
  onSuccess
}) {
  // State variables
  const [registrationCount, setRegistrationCount] = useState(0);
  const [lastRegisteredName, setLastRegisteredName] = useState("");
  const { currentUser, currentUserData } = useAuth();
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const [onlineDevices, setOnlineDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [scanResults, setScanResults] = useState([]);
  const [lastScannedTag, setLastScannedTag] = useState("");
  const [matchFound, setMatchFound] = useState(false);
  const [matchedUser, setMatchedUser] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [continuousScan, setContinuousScan] = useState(true);
  const [isClosing, setIsClosing] = useState(false);

  const refreshIntervalRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const unsubscribeEventRef = useRef(null);
  const deviceListenersRef = useRef({});

  // Set up real-time listener for attendee count when eventId is available
  useEffect(() => {
    if (!eventId) return;

    const setupAttendeeCountListener = () => {
      try {
        const eventsRef = collection(db, "events");
        const eventQuery = query(
          eventsRef,
          where("id", "==", eventId)
        );
        
        const unsubscribe = onSnapshot(eventQuery, (snapshot) => {
          if (snapshot.empty) {
            console.log("No matching event found");
            setRegistrationCount(0);
            return;
          }

          const eventDoc = snapshot.docs[0];
          const eventData = eventDoc.data();

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

        unsubscribeEventRef.current = unsubscribe;
      } catch (error) {
        console.error("Error setting up attendee count listener:", error);
      }
    };

    setupAttendeeCountListener();

    return () => {
      if (unsubscribeEventRef.current) {
        unsubscribeEventRef.current();
        unsubscribeEventRef.current = null;
      }
    };
  }, [eventId]);

  // Discover and monitor ESP32 devices from Firebase Realtime Database
  useEffect(() => {
    discoverDevices();
    
    // Set up periodic refresh
    refreshIntervalRef.current = setInterval(() => {
      if (!isRefreshing) {
        discoverDevices();
      }
    }, 10000); // Refresh every 10 seconds

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
      // Clean up device listeners
      Object.values(deviceListenersRef.current).forEach(unsubscribe => {
        if (unsubscribe) unsubscribe();
      });
    };
  }, []);

  // Set up continuous scanning when device is selected
  useEffect(() => {
    if (selectedDevice && continuousScan) {
      setupDeviceListener(selectedDevice.id);
    }

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, [selectedDevice, continuousScan]);

  // Discover ESP32 devices from Firebase Realtime Database
  const discoverDevices = async () => {
    try {
      setError(null);
      // Listen to the root of the database to get all ESP32 clients
      const devicesRef = ref(database);
      onValue(devicesRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          setOnlineDevices([]);
          return;
        }
        const devices = [];
        // Iterate through all ESP32 clients
        Object.keys(data).forEach(deviceId => {
          const deviceData = data[deviceId];
          // Only add device if status is 'online'
          if (deviceData && deviceData.status === "online") {
            devices.push({
              id: deviceId,
              name: deviceData.name || deviceId,
              status: deviceData.status,
              signalStrength: deviceData.signalStrength || 0,
              lastSeen: deviceData.lastSeen ? new Date(deviceData.lastSeen) : new Date(),
              location: deviceData.location || "",
              command: deviceData.command || "",
            });
          }
        });
        setOnlineDevices(devices);
      }, (error) => {
        console.error("Error fetching devices:", error);
        setError("Failed to fetch devices: " + error.message);
      });
    } catch (error) {
      setError("Failed to discover devices: " + error.message);
    }
  };

  // Set up real-time listener for specific device
  const setupDeviceListener = (deviceId) => {
    try {
      // Listen to scanned_data/scan/data under the device node
      const scanDataRef = ref(database, `${deviceId}/scanned_data/scan/data`);
      const unsubscribe = onValue(scanDataRef, (snapshot) => {
        const scanValue = snapshot.val();
        if (!scanValue) return;
        if (scanValue !== lastScannedTag) {
          setLastScannedTag(scanValue);
          processScannedData(scanValue, deviceId);
        }
      }, (error) => {
        console.error(`Error listening to device ${deviceId} scanned_data/scan/data:`, error);
        setError(`Failed to monitor device: ${error.message}`);
      });
      // Store the unsubscribe function
      deviceListenersRef.current[deviceId] = unsubscribe;
    } catch (error) {
      console.error("Error setting up device listener:", error);
      setError("Failed to set up device monitoring: " + error.message);
    }
  };

  // Helper to extract tag id from scan data
  const getTagIdFromScan = (scan) => {
    if (typeof scan === "string") return scan;
    if (scan && typeof scan === "object") {
      return scan.uid || scan.tagId || scan.data || scan.id || scan.scan_id || "";
    }
    return "";
  };

  // Process scanned NFC data
  const processScannedData = async (scannedData, deviceId) => {
    if (!scannedData || !eventId) return;

    setIsScanning(true);
    setError(null);
    setScanCount(prev => prev + 1);

    try {
      const tagId = getTagIdFromScan(scannedData);
      if (!tagId) return;
      // Look up user by the scanned UID in Firestore
      const usersRef = collection(db, "users");
      const userQuery = query(usersRef, where("uid", "==", tagId));
      const userSnapshot = await getDocs(userQuery);

      if (userSnapshot.empty) {
        // Try alternative lookup methods if direct UID lookup fails
        const userDocRef = doc(db, "users", tagId);
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
          throw new Error("No user found with this NFC card");
        }
        const userData = { uid: userDoc.id, ...userDoc.data() };
        await registerUser(userData, tagId, deviceId);
      } else {
        const userData = { uid: userSnapshot.docs[0].id, ...userSnapshot.docs[0].data() };
        await registerUser(userData, tagId, deviceId);
      }
    } catch (error) {
      console.error("Error processing scanned data:", error);
      setError(error.message);
      // Add failed scan to results
      setScanResults(prev => [{
        timestamp: new Date(),
        tagId: typeof scannedData === "object" ? JSON.stringify(scannedData) : scannedData,
        device: deviceId,
        success: false,
        error: error.message
      }, ...prev.slice(0, 9)]);
    } finally {
      // Always clear the command after scan attempt (success or fail)
      await sendCommandToDevice(deviceId, "");
      setIsScanning(false);
      // Schedule deletion of scan data after 1.5 seconds
      setTimeout(async () => {
        try {
          const scanDataRef = ref(database, `${deviceId}/scanned_data/scan/data`);
          await remove(scanDataRef);
          console.log(`Deleted scan data for device ${deviceId}`);
        } catch (err) {
          console.error("Failed to delete scan data:", err);
        }
      }, 1500);
    }
  };

  // Register user to event
  const registerUser = async (userData, tagId, deviceId) => {
    try {
      // Add user to event's attendees in Firestore
      const eventsRef = collection(db, "events");
      const eventQuery = query(eventsRef, where("id", "==", eventId));
      const eventSnapshot = await getDocs(eventQuery);
      if (eventSnapshot.empty) {
        throw new Error("Event not found");
      }
      const eventDoc = eventSnapshot.docs[0];
      const eventDocRef = doc(db, "events", eventDoc.id);
      const eventData = eventDoc.data();
      // Add user to attendees array if not already present
      let attendees = Array.isArray(eventData.attendeesList) ? eventData.attendeesList : [];
      if (!attendees.includes(userData.uid)) {
        attendees.push(userData.uid);
      }
      // Increment attendees count
      const attendeesCount = typeof eventData.attendees === "number" ? eventData.attendees + 1 : 1;
      await updateDoc(eventDocRef, {
        attendeesList: attendees,
        attendees: attendeesCount
      });
      setRegistrationCount(attendeesCount);
      setMatchFound(true);
      setMatchedUser(userData);
      setLastRegisteredName(userData.displayName || userData.name || userData.email);
      // Add to scan results
      setScanResults(prev => [{
        timestamp: new Date(),
        tagId: tagId,
        user: userData,
        device: deviceId,
        success: true
      }, ...prev.slice(0, 9)]);
      if (onSuccess) {
        onSuccess(userData);
      }
      // Optionally, send acknowledgment back to ESP32
      await sendCommandToDevice(deviceId, "ACK");
      // Clear the command after successful scan
      await sendCommandToDevice(deviceId, "");
    } catch (error) {
      throw new Error("Failed to register user: " + error.message);
    }
  };

  // Send command to ESP32 device
  const sendCommandToDevice = async (deviceId, command) => {
    try {
      const deviceRef = ref(database, `${deviceId}/command`);
      await set(deviceRef, command);
      console.log(`Sent command "${command}" to ${deviceId}`);
    } catch (error) {
      console.error("Error sending command to device:", error);
    }
  };

  // Refresh device list
  const refreshDevices = async () => {
    setIsRefreshing(true);
    setError(null);
    
    try {
      await discoverDevices();
    } catch (error) {
      setError("Failed to refresh devices: " + error.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Connect to selected ESP32 device
  const connectToDevice = async (device) => {
    try {
      setError(null);
      setSelectedDevice(device);
      
      // Send READ command to the ESP32 to start scanning
      await sendCommandToDevice(device.id, "READ");
      
      console.log(`Connected to ${device.name} (${device.id})`);
      
    } catch (error) {
      setError("Failed to connect to device: " + error.message);
      setSelectedDevice(null);
    }
  };

  // Disconnect from device
  const disconnectDevice = async () => {
    try {
      if (selectedDevice) {
        // Send CLOSE command to stop scanning
        await sendCommandToDevice(selectedDevice.id, "close");
        
        // Clean up listener
        if (deviceListenersRef.current[selectedDevice.id]) {
          off(ref(database, selectedDevice.id), 'value', deviceListenersRef.current[selectedDevice.id]);
          delete deviceListenersRef.current[selectedDevice.id];
        }
      }
      
      setSelectedDevice(null);
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    } catch (error) {
      console.error("Error disconnecting device:", error);
      setError("Failed to disconnect device: " + error.message);
    }
  };

  // Manual trigger scan
  const handleScan = async () => {
    if (!selectedDevice) {
      setError("No device selected");
      return;
    }
    try {
      // Clear the command first
      await sendCommandToDevice(selectedDevice.id, "");
      // Wait a short moment to ensure the command is cleared before sending READ
      await new Promise(resolve => setTimeout(resolve, 150));
      // Send READ command to trigger a scan
      await sendCommandToDevice(selectedDevice.id, "READ");
      console.log("Scan triggered manually");
    } catch (error) {
      setError("Failed to trigger scan: " + error.message);
    }
  };

  // Toggle continuous scanning
  const toggleContinuousScan = async () => {
    const newContinuousScan = !continuousScan;
    setContinuousScan(newContinuousScan);
    if (selectedDevice) {
      if (newContinuousScan) {
        // When enabling continuous scan, send READ ON command
        try {
          await sendCommandToDevice(selectedDevice.id, "READ ON");
        } catch (err) {
          setError("Failed to send READ ON command: " + err.message);
        }
      } else {
        // Optionally, you may want to clear the command or send a stop command here
        try {
          await sendCommandToDevice(selectedDevice.id, "");
        } catch (err) {
          setError("Failed to clear command: " + err.message);
        }
      }
    }
  };

  // Handle modal close
  const handleClose = async () => {
    if (isClosing) return;

    setIsClosing(true);

    try {
      // Send close command to selected device
      if (selectedDevice) {
        await sendCommandToDevice(selectedDevice.id, "close");
      }

      // Clear intervals
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }

      // Clean up all device listeners
      Object.entries(deviceListenersRef.current).forEach(([deviceId, unsubscribe]) => {
        if (unsubscribe) {
          off(ref(database, deviceId), 'value', unsubscribe);
        }
      });
      deviceListenersRef.current = {};

      // Unsubscribe from Firestore listener
      if (unsubscribeEventRef.current) {
        unsubscribeEventRef.current();
        unsubscribeEventRef.current = null;
      }

      // Reset states
      setSelectedDevice(null);
      setError(null);
      setOnlineDevices([]);

      onClose();
    } catch (error) {
      console.error("Error closing modal:", error);
      setError(`Error closing: ${error.message}`);
    } finally {
      setIsClosing(false);
    }
  };

  // Get signal strength color
  const getSignalColor = (strength) => {
    if (strength >= 80) return "text-green-600";
    if (strength >= 60) return "text-yellow-600";
    if (strength >= 40) return "text-orange-600";
    return "text-red-600";
  };

  // Format time ago
  const formatTimeAgo = (date) => {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">WiFi NFC Scanner</h2>
          <button
            onClick={handleClose}
            disabled={isClosing}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-6">
            {!selectedDevice ? (
              // Device selection screen
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-medium text-gray-800">Available ESP32 Devices</h3>
                  <button
                    onClick={refreshDevices}
                    disabled={isRefreshing}
                    className="flex items-center px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md transition-colors"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 flex items-start">
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}

                <div className="space-y-3">
                  {onlineDevices.length === 0 ? (
                    <div className="text-center py-8">
                      <WifiOff className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">No ESP32 devices found</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Make sure your ESP32 NFC scanners are connected and active
                      </p>
                    </div>
                  ) : (
                    onlineDevices.map((device) => (
                      <div
                        key={device.id}
                        className={`border rounded-lg p-4 transition-colors ${
                          device.status === "online"
                            ? "border-green-200 bg-green-50 hover:bg-green-100 cursor-pointer"
                            : "border-gray-200 bg-gray-50"
                        }`}
                        onClick={() => device.status === "online" && connectToDevice(device)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="flex items-center">
                              {device.status === "online" ? (
                                <Wifi className="h-5 w-5 text-green-600 mr-3" />
                              ) : (
                                <WifiOff className="h-5 w-5 text-gray-400 mr-3" />
                              )}
                              <div>
                                <h4 className="font-medium text-gray-800">{device.name}</h4>
                                <p className="text-sm text-gray-600">{device.id}</p>
                                {device.location && (
                                  <p className="text-xs text-gray-500">{device.location}</p>
                                )}
                                {device.command && (
                                  <p className="text-xs text-blue-600">
                                    Command: {device.command}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <div className="flex items-center justify-end mb-1">
                              <Signal className={`h-4 w-4 mr-1 ${getSignalColor(device.signalStrength)}`} />
                              <span className={`text-sm font-medium ${getSignalColor(device.signalStrength)}`}>
                                {device.signalStrength}%
                              </span>
                            </div>
                            <div className="flex items-center text-xs text-gray-500">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatTimeAgo(device.lastSeen)}
                            </div>
                            <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${
                              device.status === "online"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-600"
                            }`}>
                              {device.status}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              // Scanner interface
              <div>
                {/* Connected device info */}
                <div className="flex items-center justify-between mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center">
                    <Wifi className="h-5 w-5 text-green-600 mr-3" />
                    <div>
                      <h4 className="font-medium text-green-800">{selectedDevice.name}</h4>
                      <p className="text-sm text-green-600">{selectedDevice.id}</p>
                      {selectedDevice.command && (
                        <p className="text-xs text-green-700">
                          Status: {selectedDevice.command}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={disconnectDevice}
                    className="text-sm text-green-700 hover:text-red-600 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 flex items-start">
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}

                {/* Continuous scan toggle */}
                <div className="flex items-center justify-center mb-6">
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

                {/* Scan button */}
                <div className="flex justify-center mb-6">
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
                        Processing...
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
                  <div className="bg-green-50 border border-green-200 rounded-md p-4 text-center mb-6">
                    <div className="mb-2">
                      <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <UserPlus className="h-6 w-6 text-green-600" />
                      </div>
                      <h4 className="font-medium text-green-800">Registration Successful!</h4>
                    </div>
                    <p className="text-sm text-green-700 mb-2">
                      {matchedUser.displayName || matchedUser.name || matchedUser.email} has been registered to the event.
                    </p>
                    <p className="text-xs text-green-600">
                      Device: {selectedDevice.name}
                    </p>
                  </div>
                )}

                {/* Statistics */}
                <div className="border-t border-gray-200 pt-4 text-center mb-6">
                  <p className="text-sm text-gray-600">
                    Total registrations: <span className="font-medium">{registrationCount}</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Scans from this device: <span className="font-medium">{scanCount}</span>
                  </p>
                  {lastRegisteredName && (
                    <p className="text-xs text-gray-500 mt-1">
                      Last registered: {lastRegisteredName}
                    </p>
                  )}
                </div>

                {/* Recent scan results */}
                {scanResults.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Scans</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {scanResults.map((result, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-md text-sm ${
                            result.success 
                              ? "bg-green-50 border border-green-200"
                              : "bg-red-50 border border-red-200"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              {result.success ? (
                                <p className="text-green-800 font-medium">
                                  {result.user.displayName || result.user.name || result.user.email}
                                </p>
                              ) : (
                                <p className="text-red-800 font-medium">Scan Failed</p>
                              )}
                              <p className="text-xs text-gray-500">
                                {result.timestamp.toLocaleTimeString()} • {result.device}
                              </p>
                              <p className="text-xs text-gray-400">
                                UID: {typeof result.tagId === "object" ? JSON.stringify(result.tagId) : result.tagId}
                              </p>
                            </div>
                            <div className={`px-2 py-1 rounded-full text-xs ${
                              result.success
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}>
                              {result.success ? "Success" : "Failed"}
                            </div>
                          </div>
                          {result.error && (
                            <p className="text-xs text-red-600 mt-1">{result.error}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div className="text-xs text-gray-500 flex items-center">
              <Monitor className="h-3 w-3 mr-1" />
              <span>
                {selectedDevice
                  ? `Connected to ${selectedDevice.name}`
                  : `${onlineDevices.filter(d => d.status === "online").length} devices online`
                }
              </span>
            </div>
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
  );
}