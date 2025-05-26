/**
 * Enhanced Standalone NFC Writer component that supports both Web NFC API and hardware NFC Scanner.
 * Falls back to hardware NFC Scanner when Web NFC API is not supported.
 * @returns {JSX.Element} The Standalone NFC Writer component.
 */
import { useState, useEffect, useRef } from "react"
import { AlertCircle, CheckCircle, Smartphone, XCircle, Search, Database, ChevronLeft, RefreshCw, Usb, Signal } from "lucide-react"
import { db } from "../firebase/config" // Import your Firebase config
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore"
import { Link } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import NFCScanner from "../components/RegisterEvent/HardwareScanner"

export default function StandaloneNFCWriter() {
  // State for Web NFC API
  const [nfcSupported, setNfcSupported] = useState(null)
  const [hasPermission, setHasPermission] = useState(null)
  const [isWriting, setIsWriting] = useState(false)
  const [writeSuccess, setWriteSuccess] = useState(false)
  const [writeError, setWriteError] = useState(null)
  const [nfcController, setNfcController] = useState(null)
  const [nfcStoppingInProgress, setNfcStoppingInProgress] = useState(false)
  const [pendingWriteOperation, setPendingWriteOperation] = useState(null)
  
  // State for hardware NFC Scanner
  const [scanner, setScanner] = useState(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [scannerConnected, setScannerConnected] = useState(false)
  const [availablePorts, setAvailablePorts] = useState([])
  const [scannerDeviceName, setScannerDeviceName] = useState("")
  const [isCheckingForDevices, setIsCheckingForDevices] = useState(false)
  
  // Shared state
  const [userId, setUserId] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [searchType, setSearchType] = useState("documentId")
  const [isSearching, setIsSearching] = useState(false)
  const [userData, setUserData] = useState(null)
  const [searchError, setSearchError] = useState(null)
  const { currentUser, userRole } = useAuth()
  
  // Create a ref to store the scanner instance
  const scannerRef = useRef(null)

  // Function to determine the dashboard route based on user role
  const getDashboardRoute = () => {
    if (!currentUser) return "/login"
    switch (userRole) {
      case "admin":
        return "/admin"
      case "registrar":
        return "/registrar" 
      case "teacher":
        return "/teacher"
      case "student":
        return "/student"
      default:
        return "/events"
    }
  }

  // Fix for the cleanup function in the useEffect
useEffect(() => {
  const checkNFCSupport = async () => {
    if ("NDEFReader" in window) {
      setNfcSupported(true)
    } else {
      setNfcSupported(false)
      // Initialize NFC Scanner when Web NFC is not supported
      initializeNFCScanner()
    }
  }

  checkNFCSupport()
  
  // Cleanup function
  return () => {
    // Clean up NFC Scanner resources when component unmounts
    if (scannerRef.current) {
      // Check if the scanner has a disconnect method and call it
      if (scannerRef.current.disconnectDevice && typeof scannerRef.current.disconnectDevice === 'function') {
        try {
          scannerRef.current.disconnectDevice()
        } catch (error) {
          console.error("Error disconnecting NFC scanner:", error)
        }
      }
      // Clear the reference but don't call dispose() as it doesn't exist
      scannerRef.current = null
    }
  }
}, [])

  // Initialize the NFCScanner class
  const initializeNFCScanner = () => {
    if (!scannerRef.current) {
      console.log("Initializing NFCScanner class")
      scannerRef.current = new NFCScanner()
      setScanner(scannerRef.current)
      
      // Check for available devices initially
      checkForNFCDevices()
    }
  }

  // Check for available NFC Scanner devices
  const checkForNFCDevices = async () => {
    if (!scannerRef.current) return
    
    setIsCheckingForDevices(true)
    try {
      const result = await scannerRef.current.checkForDevices()
      setAvailablePorts(result.ports)
      console.log("Available ports:", result.ports)
      return result
    } catch (error) {
      console.error("Error checking for NFC devices:", error)
      setWriteError(`Unable to check for NFC devices: ${error.message}`)
      return { nfcScannerFound: false, ports: [] }
    } finally {
      setIsCheckingForDevices(false)
    }
  }

  // Connect to NFC Scanner hardware
  const connectToNFCScanner = async () => {
    if (!scannerRef.current) {
      initializeNFCScanner()
    }
    
    setIsConnecting(true)
    setWriteError(null)
    
    try {
      const result = await scannerRef.current.connectToDevice()
      console.log("Connected to NFC Scanner:", result)
      setScannerConnected(true)
      setScannerDeviceName(result.deviceName)
      return true
    } catch (error) {
      console.error("Failed to connect to NFC Scanner:", error)
      setWriteError(`Connection failed: ${error.message}`)
      setScannerConnected(false)
      return false
    } finally {
      setIsConnecting(false)
    }
  }

  // Disconnect from NFC Scanner hardware
  const disconnectFromNFCScanner = async () => {
    if (!scannerRef.current) return
    
    try {
      await scannerRef.current.disconnectDevice()
      setScannerConnected(false)
      setScannerDeviceName("")
    } catch (error) {
      console.error("Error disconnecting from NFC Scanner:", error)
    }
  }

  // Write to NFC tag using the hardware scanner
  const writeToNFCWithScanner = async (data) => {
    if (!scannerRef.current || !scannerConnected) {
      setWriteError("NFC Scanner not connected")
      return false
    }
    
    setIsWriting(true)
    setWriteError(null)
    
    try {
      const result = await scannerRef.current.writeNfcTag(data)
      console.log("Write result:", result)
      setWriteSuccess(true)
      
      setTimeout(() => {
        setWriteSuccess(false)
      }, 3000)
      
      return true
    } catch (error) {
      console.error("Error writing to NFC tag:", error)
      setWriteError(`Write failed: ${error.message}`)
      return false
    } finally {
      setIsWriting(false)
    }
  }

  // Reset states when changing search type
  useEffect(() => {
    setSearchError(null)
    setUserData(null)
  }, [searchType])

  // Effect to process pending write operation after NFC stopping completes (for Web NFC API)
  useEffect(() => {
    const processPendingWrite = async () => {
      if (pendingWriteOperation && !nfcStoppingInProgress && nfcSupported) {
        try {
          setIsWriting(true)
          setWriteError(null)
          console.log("Processing pending NFC write operation...")

          // Create a new NDEFReader instance for this operation
          const newNdef = new window.NDEFReader()

          // Create an AbortController
          const abortController = new AbortController()
          const signal = abortController.signal

          // Store reference to the controller
          setNfcController({
            reader: newNdef,
            abortController: abortController
          })

          // Write the userId to the NFC tag
          await newNdef.write({
            records: [
              {
                recordType: "text",
                data: pendingWriteOperation,
              },
            ],
          }, { signal })

          setWriteSuccess(true)
          setPendingWriteOperation(null)

          // Clean up NFC resources after successful write
          await stopNfcReading()

          setTimeout(() => {
            setWriteSuccess(false)
          }, 3000)
        } catch (error) {
          console.error("Error processing pending NFC write:", error)
          setWriteError(error.message)
          setPendingWriteOperation(null)
        } finally {
          setIsWriting(false)
        }
      }
    }

    processPendingWrite()
  }, [pendingWriteOperation, nfcStoppingInProgress, nfcSupported])

  // Clean up NFC resources when component unmounts (for Web NFC API)
  useEffect(() => {
    return () => {
      if (nfcController) {
        stopNfcReading()
      }
    }
  }, [nfcController])

  // Search for user in Firestore
  const searchUser = async () => {
    if (!searchQuery.trim()) {
      setSearchError("Please enter a search query")
      return
    }

    setIsSearching(true)
    setSearchError(null)
    setUserData(null)

    try {
      let userDoc

      if (searchType === "documentId") {
        // Search directly by document ID
        const docRef = doc(db, "users", searchQuery)
        const docSnap = await getDoc(docRef)

        if (docSnap.exists()) {
          userDoc = { id: docSnap.id, ...docSnap.data() }
        }
      } else {
        // Search by field (studentId, teacherId, etc.)
        const usersRef = collection(db, "users")
        const q = query(usersRef, where(searchType, "==", searchQuery))
        const querySnapshot = await getDocs(q)

        if (!querySnapshot.empty) {
          // Get the first matching document
          const doc = querySnapshot.docs[0]
          userDoc = { id: doc.id, ...doc.data() }
        }
      }

      if (userDoc) {
        setUserData(userDoc)
        setUserId(userDoc.id) // Set the document ID for NFC writing
      } else {
        setSearchError("No user found with the provided information")
      }
    } catch (error) {
      console.error("Error searching for user:", error)
      setSearchError(`Error searching for user: ${error.message}`)
    } finally {
      setIsSearching(false)
    }
  }

  // Stop NFC reading/scanning (for Web NFC API)
  const stopNfcReading = async () => {
    return new Promise((resolve) => {
      if (nfcController) {
        setNfcStoppingInProgress(true)
        console.log("Stopping NFC operation...")

        // Try to abort using the AbortController
        if (
          nfcController.abortController &&
          typeof nfcController.abortController.abort === "function"
        ) {
          try {
            nfcController.abortController.abort()
            console.log("NFC operation aborted via AbortController")
          } catch (error) {
            console.error("Error aborting NFC operation:", error)
          }
        }

        // For older browsers or fallback
        if (
          nfcController.reader &&
          typeof nfcController.reader.abort === "function"
        ) {
          try {
            nfcController.reader.abort()
            console.log("NFC operation aborted via reader")
          } catch (error) {
            console.error("Error aborting NFC reader:", error)
          }
        }

        // Clear states
        setNfcController(null)

        // Allow a small delay for resources to clean up properly
        setTimeout(() => {
          setNfcStoppingInProgress(false)
          console.log("NFC operation stopped completely")
          resolve()
        }, 300) // 300ms delay to ensure proper cleanup
      } else {
        // If no NFC controller exists, just resolve immediately
        resolve()
      }
    })
  }

  // Request NFC permissions (for Web NFC API)
  const requestPermission = async () => {
    try {
      setIsWriting(true)
      setWriteError(null)

      // First, ensure any previous NFC operations are stopped
      if (nfcController) {
        await stopNfcReading()
      }

      // Create a new NDEFReader instance
      const newNdef = new window.NDEFReader()

      // Create an AbortController
      const abortController = new AbortController()
      const signal = abortController.signal

      // Store reference to the controller
      setNfcController({
        reader: newNdef,
        abortController: abortController
      })

      // This will trigger the permission prompt
      await newNdef.scan({ signal })
      setHasPermission(true)
    } catch (error) {
      console.error("Error requesting NFC permission:", error)
      setHasPermission(false)
      setWriteError(error.message)
    } finally {
      setIsWriting(false)
    }
  }

  // Write to NFC tag (calls appropriate method based on available technology)
  const writeToNFC = async () => {
    if (!userId) {
      setWriteError("No user ID provided for NFC writing")
      return
    }

    try {
      if (nfcSupported) {
        // Use Web NFC API
        setIsWriting(true)
        setWriteError(null)

        // First ensure any previous NFC operations are stopped
        if (nfcController) {
          await stopNfcReading()
        }

        // Store the user ID for processing after NFC is fully stopped
        setPendingWriteOperation(userId)
      } else {
        // Use NFCScanner hardware
        if (!scannerConnected) {
          const connected = await connectToNFCScanner()
          if (!connected) return
        }
        
        // Write to tag using scanner
        await writeToNFCWithScanner(userId)
      }
    } catch (error) {
      console.error("Error preparing to write to NFC tag:", error)
      setWriteError(error.message)
      setIsWriting(false)
    }
  }

  // Reset the form
  const resetForm = async () => {
    // Make sure any ongoing NFC operations are stopped
    if (nfcSupported && nfcController) {
      await stopNfcReading()
    }

    setSearchQuery("")
    setUserData(null)
    setUserId("")
    setSearchError(null)
    setWriteError(null)
    setWriteSuccess(false)
    setPendingWriteOperation(null)
    setHasPermission(null) // Reset permission state as well
  }

  // Render the search form
  const renderSearchForm = () => {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Find User</h3>
          <p className="text-sm text-gray-600 mb-4">Search for a user by document ID or other identification fields</p>

          {/* Search type and query - Responsive layout */}
          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm w-full sm:w-auto"
            >
              <option value="documentId">Document ID</option>
              <option value="studentId">Student ID</option>
              <option value="teacherId">Teacher ID</option>
              <option value="employeeId">Employee ID</option>
              <option value="adminId">Admin ID</option>
              <option value="uid">Auth UID</option>
            </select>

            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Enter ${searchType}`}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={searchUser}
              disabled={isSearching}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md disabled:bg-gray-400 flex items-center justify-center space-x-2 w-full sm:w-auto"
            >
              {isSearching ? (
                <div className="animate-spin h-5 w-5 border-t-2 border-b-2 border-white rounded-full"></div>
              ) : (
                <Search className="h-5 w-5" />
              )}
              <span>Search</span>
            </button>
          </div>

          {searchError && (
            <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm flex items-start">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              <span>{searchError}</span>
            </div>
          )}
        </div>

        {userData && (
          <div className="p-4 border border-gray-200 rounded-md bg-gray-50">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center">
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              User Found
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="p-2 bg-white rounded border border-gray-100">
                <span className="font-medium text-gray-700">Document ID:</span>
                <span className="ml-1 break-all">{userData.id}</span>
              </div>

              {userData.name && (
                <div className="p-2 bg-white rounded border border-gray-100">
                  <span className="font-medium text-gray-700">Name:</span>
                  <span className="ml-1">{userData.name}</span>
                </div>
              )}

              {userData.role && (
                <div className="p-2 bg-white rounded border border-gray-100">
                  <span className="font-medium text-gray-700">Role:</span>
                  <span className="ml-1 capitalize">{userData.role}</span>
                </div>
              )}

              {userData.studentId && (
                <div className="p-2 bg-white rounded border border-gray-100">
                  <span className="font-medium text-gray-700">Student ID:</span>
                  <span className="ml-1">{userData.studentId}</span>
                </div>
              )}

              {userData.teacherId && (
                <div className="p-2 bg-white rounded border border-gray-100">
                  <span className="font-medium text-gray-700">Teacher ID:</span>
                  <span className="ml-1">{userData.teacherId}</span>
                </div>
              )}

              {userData.employeeId && (
                <div className="p-2 bg-white rounded border border-gray-100">
                  <span className="font-medium text-gray-700">Employee ID:</span>
                  <span className="ml-1">{userData.employeeId}</span>
                </div>
              )}

              {userData.adminId && (
                <div className="p-2 bg-white rounded border border-gray-100">
                  <span className="font-medium text-gray-700">Admin ID:</span>
                  <span className="ml-1">{userData.adminId}</span>
                </div>
              )}

              {userData.uid && (
                <div className="p-2 bg-white rounded border border-gray-100">
                  <span className="font-medium text-gray-700">Auth UID:</span>
                  <span className="ml-1 break-all">{userData.uid}</span>
                </div>
              )}
            </div>

            <div className="mt-5">
              {/* For Web NFC API */}
              {nfcSupported && (
                <button
                  onClick={hasPermission ? writeToNFC : requestPermission}
                  disabled={isWriting || nfcStoppingInProgress || writeSuccess} // <-- add writeSuccess here
                  className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md disabled:bg-gray-400 flex items-center justify-center space-x-2 transition-colors"
                >
                  {isWriting || nfcStoppingInProgress ? (
                    <div className="animate-spin h-5 w-5 border-t-2 border-b-2 border-white rounded-full"></div>
                  ) : (
                    <Smartphone className="h-5 w-5" />
                  )}
                  <span>
                    {hasPermission
                      ? isWriting
                        ? nfcStoppingInProgress
                          ? "Preparing NFC..."
                          : "Writing to NFC Card..."
                        : "Write to NFC Card"
                      : "Request NFC Permission"}
                  </span>
                </button>
              )}
              
              {/* For NFCScanner hardware */}
              {!nfcSupported && (
                <button
                  onClick={scannerConnected ? writeToNFC : connectToNFCScanner}
                  disabled={isWriting || isConnecting || writeSuccess} // <-- add writeSuccess here
                  className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md disabled:bg-gray-400 flex items-center justify-center space-x-2 transition-colors"
                >
                  {isWriting || isConnecting ? (
                    <div className="animate-spin h-5 w-5 border-t-2 border-b-2 border-white rounded-full"></div>
                  ) : (
                    scannerConnected ? <Signal className="h-5 w-5" /> : <Usb className="h-5 w-5" />
                  )}
                  <span>
                    {scannerConnected
                      ? isWriting
                        ? "Writing to NFC Card..."
                        : "Write to NFC Card"
                      : isConnecting
                        ? "Connecting to NFC Scanner..."
                        : "Connect to NFC Scanner"}
                  </span>
                </button>
              )}
            </div>
            
            {/* Scanner status display (only show when using scanner) */}
            {!nfcSupported && scannerConnected && (
              <div className="mt-2 p-2 bg-green-50 border border-green-100 rounded text-sm flex items-center text-green-700">
                <Signal className="h-4 w-4 mr-2" />
                <span>Connected to: {scannerDeviceName}</span>
              </div>
            )}
          </div>
        )}

        {/* Scanner device list (only when not connected and devices found) */}
        {!nfcSupported && !scannerConnected && availablePorts.length > 0 && (
          <div className="p-4 border border-gray-200 rounded-md bg-gray-50 mt-4">
            <h4 className="font-medium text-gray-900 mb-3">Available NFC Scanners</h4>
            <div className="space-y-2">
              {availablePorts.map((port, index) => (
                <div key={index} className="p-2 bg-white rounded border border-gray-100 flex justify-between items-center">
                  <div className="flex items-center">
                    <Usb className="h-4 w-4 mr-2 text-gray-500" />
                    <span>
                      {port.path || port.devicePath || `Device ${index + 1}`}
                      {port.vendorId && port.productId && (
                        <span className="text-xs text-gray-500 ml-2">
                          ({port.vendorId}:{port.productId})
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={checkForNFCDevices}
                disabled={isCheckingForDevices}
                className="flex items-center px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm text-gray-700"
              >
                {isCheckingForDevices ? (
                  <div className="animate-spin h-3 w-3 border-t-2 border-b-2 border-gray-700 rounded-full mr-1"></div>
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                <span>Refresh</span>
              </button>
            </div>
          </div>
        )}

        {(userData || searchError) && (
          <div className="flex justify-end mt-2">
            <button
              onClick={resetForm}
              disabled={isWriting || nfcStoppingInProgress || isConnecting}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md flex items-center space-x-2 transition-colors disabled:bg-gray-100 disabled:text-gray-400"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Reset</span>
            </button>
          </div>
        )}
      </div>
    )
  }

  // Render different states
  const renderContent = () => {
    // If write was successful
    if (writeSuccess) {
      return (
        <div className="flex flex-col items-center space-y-4 text-center p-6 bg-green-50 rounded-lg border border-green-200">
          <CheckCircle className="h-16 w-16 text-green-500" />
          <h3 className="text-xl font-medium">NFC Card Ready</h3>
          <p className="text-gray-700 max-w-md">
            The user ID was successfully written to the NFC card! The card is now ready to use.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-2 w-full sm:w-auto">
            <button
              onClick={() => {
                setWriteSuccess(false)
                // If using scanner, don't disconnect, just move back to search form
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md text-white flex items-center justify-center space-x-2 transition-colors"
            >
              <Smartphone className="h-5 w-5" />
              <span>Write Another Card</span>
            </button>
            <Link
              to={getDashboardRoute()}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md flex items-center justify-center space-x-2 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
        </div>
      )
    }

    // If NFC is not supported and no hardware scanner is connected yet
    if (nfcSupported === false && !scannerConnected && !scanner) {
      return (
        <div className="flex flex-col items-center space-y-4 text-center p-6 bg-yellow-50 rounded-lg border border-yellow-200">
          <AlertCircle className="h-16 w-16 text-yellow-500" />
          <h3 className="text-xl font-medium">NFC Not Available in Browser</h3>
          <p className="text-gray-700 max-w-md">
            Your browser doesn't support Web NFC API. Please connect an external NFC scanner to continue.
          </p>
          <button
            onClick={initializeNFCScanner}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md text-white flex items-center justify-center space-x-2 transition-colors"
          >
            <Usb className="h-5 w-5" />
            <span>Initialize NFC Scanner</span>
          </button>
        </div>
      )
    }

    // Show search form if we have Web NFC or NFCScanner available
    return (
      <div>
        <div className="flex items-center space-x-3 mb-6 border-b border-gray-200 pb-4">
          <Database className="h-7 w-7 text-indigo-500" />
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            NFC Card Writer
            {!nfcSupported && <span className="text-sm font-normal text-gray-500 ml-2">(Hardware Scanner Mode)</span>}
          </h2>
        </div>

        {/* If NFCScanner is initialized but not connected, show connect button */}
        {!nfcSupported && scanner && !scannerConnected && !userData && (
          <div className="mb-6 p-4 border border-gray-200 rounded-md bg-blue-50">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Connect NFC Scanner</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please connect your NFC Scanner device to continue. Make sure it's properly plugged in to your computer.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={connectToNFCScanner}
                disabled={isConnecting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md disabled:bg-gray-400 flex items-center justify-center space-x-2"
              >
                {isConnecting ? (
                  <div className="animate-spin h-5 w-5 border-t-2 border-b-2 border-white rounded-full"></div>
                ) : (
                  <Usb className="h-5 w-5" />
                )}
                <span>{isConnecting ? "Connecting..." : "Connect to NFC Scanner"}</span>
              </button>
              <button
                onClick={checkForNFCDevices}
                disabled={isCheckingForDevices}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md flex items-center justify-center space-x-2"
              >
                {isCheckingForDevices ? (
                  <div className="animate-spin h-5 w-5 border-t-2 border-b-2 border-gray-700 rounded-full"></div>
                ) : (
                  <RefreshCw className="h-5 w-5 mr-1" />
                )}
                <span>Check for Devices</span>
              </button>
            </div>
          </div>
        )}

        {/* Show error if attempt to write failed */}
        {writeError && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm flex items-start">
            <XCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Write Error</p>
              <p>{writeError}</p>
            </div>
          </div>
        )}

        {/* Connected NFC Scanner status */}
        {!nfcSupported && scannerConnected && !userData && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md text-sm flex items-start">
            <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">NFC Scanner Connected</p>
              <p>
                <span className="font-medium">Device:</span> {scannerDeviceName || "Unknown NFC Scanner"}
              </p>
              <button 
                onClick={disconnectFromNFCScanner}
                className="mt-2 px-2 py-1 bg-green-200 hover:bg-green-300 rounded text-xs text-green-800 flex items-center"
              >
                <XCircle className="h-3 w-3 mr-1" />
                Disconnect
              </button>
            </div>
          </div>
        )}

        {/* If using Web NFC API, show permission status */}
        {nfcSupported && hasPermission === false && (
          <div className="mb-4 p-3 bg-orange-100 text-orange-700 rounded-md text-sm flex items-start">
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">NFC Permission Required</p>
              <p>Please grant permission to use NFC functionality.</p>
              <button 
                onClick={requestPermission}
                className="mt-2 px-2 py-1 bg-orange-200 hover:bg-orange-300 rounded text-xs text-orange-800 flex items-center"
              >
                <Smartphone className="h-3 w-3 mr-1" />
                Request Permission
              </button>
            </div>
          </div>
        )}

        {/* Render the search form */}
        {renderSearchForm()}
      </div>
    )
  }

  // Main component render
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6 flex justify-between items-center">
        <Link
          to={getDashboardRoute()}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="h-5 w-5 mr-1" />
          <span>Back to Dashboard</span>
        </Link>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        {/* Main content rendering */}
        {renderContent()}
      </div>

      {/* App version footer */}
      <div className="mt-6 text-center text-xs text-gray-500">
        <p>NFC Card Writer v1.2.0</p>
        <p className="mt-1">
          {nfcSupported ? (
            <span className="inline-flex items-center text-green-600">
              <Signal className="h-3 w-3 mr-1" />
              Using Web NFC API
            </span>
          ) : (
            <span className="inline-flex items-center text-blue-600">
              <Usb className="h-3 w-3 mr-1" />
              Using Hardware NFC Scanner
            </span>
          )}
        </p>
      </div>
    </div>
  )
}