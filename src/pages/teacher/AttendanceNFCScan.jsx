import { useState, useEffect, useRef } from "react"
import { toast } from "react-toastify"
import { doc, updateDoc, arrayUnion, collection, query, where, getDocs } from "firebase/firestore"
import { db } from "../../firebase/config"
import { Shield, UserCheck, AlertCircle, CheckCircle, Wifi, ArrowLeft } from "lucide-react"
import { useSearchParams } from "react-router-dom"
import useFirestoreChecker from "../../components/reuseChecker/FirestoreCheckerHook"

export default function NFCScanner() {
  const [searchParams] = useSearchParams()
  const [attendanceData, setAttendanceData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [lastScannedStudent, setLastScannedStudent] = useState(null)
  const [scannedStudents, setScannedStudents] = useState([])
  const [nfcEnabled, setNfcEnabled] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState("")
  const [error, setError] = useState(null)
  const [nfcController, setNfcController] = useState(null)
  const [scanMessage, setScanMessage] = useState("")
  const animationFrameRef = useRef(null)
  const pulseElementRef = useRef(null)

  // Import the FirestoreChecker hook
  const { checkUserByNfcData, loading: hookLoading, error: hookError } = useFirestoreChecker()

  // Get attendance code from URL
  const attendanceCode = searchParams.get("code")

  // Check if NFC is supported and fetch attendance data
  useEffect(() => {
    const checkNFCSupport = async () => {
      try {
        if ("NDEFReader" in window) {
          setNfcEnabled(true)
        } else {
          setError("NFC is not supported by your browser or device.")
        }
      } catch (err) {
        console.error("Error checking NFC support:", err)
        setError("Failed to initialize NFC. Please check device permissions.")
      }
    }

    const fetchAttendanceData = async () => {
      if (!attendanceCode) {
        setError("No attendance code provided")
        setLoading(false)
        return
      }

      try {
        // Query Firestore for the attendance session with the matching attendanceCode field
        const attendanceQuery = query(
          collection(db, "attendance-sessions"),
          where("attendanceCode", "==", attendanceCode),
        )

        const querySnapshot = await getDocs(attendanceQuery)

        if (querySnapshot.empty) {
          setError("Attendance session not found")
        } else {
          // Get the first document that matches the query
          const docSnap = querySnapshot.docs[0]
          const data = { id: docSnap.id, ...docSnap.data() }

          // Check if session has expired
          const now = new Date()
          const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null

          if (expiresAt && expiresAt < now) {
            setError("This attendance session has expired")
          } else if (!data.active) {
            setError("This attendance session is no longer active")
          } else {
            setAttendanceData(data)

            // Initialize scanned students array if it exists
            if (data.students && Array.isArray(data.students)) {
              setScannedStudents(data.students)
            }
          }
        }
      } catch (err) {
        console.error("Error fetching attendance data:", err)
        setError("Failed to load attendance session")
      } finally {
        setLoading(false)
      }
    }

    checkNFCSupport()
    fetchAttendanceData()
  }, [attendanceCode])

  // Update time remaining countdown
  useEffect(() => {
    if (!attendanceData?.expiresAt) return

    const updateTimeRemaining = () => {
      const now = new Date()
      const expiresAt = new Date(attendanceData.expiresAt)

      if (expiresAt <= now) {
        setTimeRemaining("Expired")
        return
      }

      const timeDiff = expiresAt - now
      const hours = Math.floor(timeDiff / (1000 * 60 * 60))
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000)

      setTimeRemaining(
        `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
      )
    }

    updateTimeRemaining()
    const interval = setInterval(updateTimeRemaining, 1000)

    return () => clearInterval(interval)
  }, [attendanceData])

  // NFC scanning animation
  useEffect(() => {
    if (scanning && pulseElementRef.current) {
      let scale = 1
      let opacity = 0.8
      let growing = true

      const animatePulse = () => {
        if (pulseElementRef.current) {
          if (growing) {
            scale += 0.01
            opacity -= 0.01

            if (scale >= 1.5) {
              growing = false
            }
          } else {
            scale -= 0.01
            opacity += 0.01

            if (scale <= 1) {
              growing = true
            }
          }

          pulseElementRef.current.style.transform = `scale(${scale})`
          pulseElementRef.current.style.opacity = opacity
          animationFrameRef.current = requestAnimationFrame(animatePulse)
        }
      }

      animationFrameRef.current = requestAnimationFrame(animatePulse)

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
      }
    }
  }, [scanning])

  // Start NFC reading
  const startNFCScanning = async () => {
    if (!nfcEnabled) {
      toast.error("NFC is not available on this device")
      return
    }

    if (!attendanceData) {
      toast.error("No active attendance session")
      return
    }

    try {
      setScanning(true)
      setScanMessage("Starting NFC scanner...")

      const ndef = new window.NDEFReader()

      // Create an AbortController for proper cleanup
      const abortController = new AbortController()
      const signal = abortController.signal

      // Store reference to both for later cleanup
      setNfcController({
        reader: ndef,
        abortController: abortController,
      })

      await ndef.scan({ signal })
      setScanMessage("Scanning for NFC card...")
      toast.success("NFC scanner activated")

      ndef.addEventListener(
        "reading",
        async (event) => {
          try {
            // Process the NFC reading with event data
            handleNFCReading(event)
          } catch (error) {
            console.error("Error processing NFC data:", error)
            toast.error("Failed to process NFC data")
          }
        },
        { signal },
      )

      ndef.addEventListener(
        "error",
        (error) => {
          console.error("NFC Error:", error)
          toast.error("NFC Error: " + error.message)
        },
        { signal },
      )
    } catch (error) {
      console.error("Error starting NFC scan:", error)
      toast.error("Failed to start NFC scanning: " + error.message)
      setScanning(false)
    }
  }

  // Stop NFC reading
  const stopNFCScanning = () => {
    if (nfcController) {
      console.log("Stopping NFC scanning...")

      // Try to abort using the AbortController
      if (nfcController.abortController && typeof nfcController.abortController.abort === "function") {
        try {
          nfcController.abortController.abort()
          console.log("NFC scanning aborted via AbortController")
        } catch (error) {
          console.error("Error aborting NFC scan:", error)
        }
      }

      // For older browsers or fallback
      if (nfcController.reader && typeof nfcController.reader.abort === "function") {
        try {
          nfcController.reader.abort()
          console.log("NFC scanning aborted via reader")
        } catch (error) {
          console.error("Error aborting NFC reader:", error)
        }
      }

      // Clear the controller reference
      setNfcController(null)
      setScanning(false)
      toast.info("NFC scanning stopped")
    }
  }

  // Wait for NFC scanner to properly stop
  const waitForNFCScannerToStop = async () => {
    setScanMessage("Stopping NFC scanner...")

    // Stop the scanner
    stopNFCScanning()

    // Wait a moment to ensure scanner is fully stopped
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log("NFC scanner cleanup complete")
        resolve()
      }, 500) // 500ms delay to ensure proper cleanup
    })
  }

  // Handle NFC card reading
  const handleNFCReading = async ({ message }) => {
    try {
      if (!message || !message.records || message.records.length === 0) {
        toast.error("No data found on NFC card")
        return
      }

      setScanMessage("Card detected, verifying...")

      // Process the NFC reading - extract text data from message records
      let nfcData = ""

      for (const record of message.records) {
        if (record.recordType === "text") {
          const textDecoder = new TextDecoder(record.encoding)
          nfcData = textDecoder.decode(record.data)
          break
        }
      }

      if (!nfcData) {
        toast.error("Could not read text data from NFC card")
        return
      }

      console.log("NFC Card data:", nfcData)

      // Use the FirestoreChecker hook to check for student by NFC data
      const { exists, userData } = await checkUserByNfcData(nfcData)

      if (!exists) {
        toast.error("Student card not registered in system")
        return
      }

      // Check if student already checked in
      const existingStudent = scannedStudents.find((student) => student.studentId === userData.studentId)

      if (existingStudent) {
        toast.info(`${userData.name} has already checked in`)
        return
      }

      // Check if student's section matches the attendance session section
      if (userData.section && attendanceData.section && userData.section !== attendanceData.section) {
        toast.warn(`${userData.name} is not enrolled in section ${attendanceData.section}`)
        return
      }

      // Create attendance record
      const attendanceRecord = {
        teacherName: attendanceData.teacherName,
        course: attendanceData.course,
        userUID: userData.uid,
        studentId: userData.studentId,
        profileImageUrl: userData.profileImage || null,
        isPresent: true,
        email: userData.email,
        name: userData.name,
        section: userData.section || "N/A", // Include section info in the record
        timestamp: new Date().toISOString(),
        comment: "Checked in via NFC card",
      }

      // Add student to attendance session - updating by document ID
      await updateDoc(doc(db, "attendance-sessions", attendanceData.id), {
        students: arrayUnion(attendanceRecord),
      })

      // Update local state
      setLastScannedStudent(attendanceRecord)
      setScannedStudents((prev) => [...prev, attendanceRecord])

      toast.success(`${attendanceRecord.name} checked in successfully!`)

      // Play success sound if available
      try {
        const audio = new Audio("/success-sound.mp3")
        audio.play().catch((e) => console.log("Audio playback failed:", e))
      } catch (err) {
        console.log("Sound not available:", err)
      }
    } catch (error) {
      console.error("Error processing NFC card:", error)
      toast.error("Failed to process student card")
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="w-16 h-16 border-t-4 border-purple-500 border-solid rounded-full animate-spin mb-4"></div>
        <p className="text-lg text-gray-700">Loading attendance session...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6 sm:p-8">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2 text-center">Error</h2>
          <p className="text-lg text-gray-700 mb-6 text-center">{error}</p>
          <button
            onClick={() => window.history.back()}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm py-4 px-4 sm:px-6 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h1 className="text-xl font-bold text-gray-800">NFC Attendance Scanner</h1>
            <p className="text-sm text-gray-500 mt-1 hidden sm:block">
              {attendanceData?.course} • {attendanceData?.section}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="px-3 py-1 rounded-full text-sm font-medium"
              style={{
                backgroundColor: attendanceData?.active ? "#dcfce7" : "#fee2e2",
                color: attendanceData?.active ? "#166534" : "#991b1b",
              }}
            >
              {attendanceData?.active ? "Active" : "Inactive"}
            </span>
            <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
              {timeRemaining || "N/A"}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-4 sm:p-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Session Info & Scanner */}
            <div className="lg:col-span-1 space-y-6">
              {/* Attendance Information Card */}
              <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <Shield className="w-5 h-5 mr-2 text-purple-600" />
                  Session Information
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Course</p>
                    <p className="text-base font-medium truncate">{attendanceData?.course}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Section</p>
                    <p className="text-base font-medium">{attendanceData?.section}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Room</p>
                    <p className="text-base font-medium">{attendanceData?.room}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Teacher</p>
                    <p className="text-base font-medium truncate">{attendanceData?.teacherName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Date</p>
                    <p className="text-base font-medium">{attendanceData?.date}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Time Remaining</p>
                    <p className="text-base font-medium">{timeRemaining || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* NFC Scanner */}
              <div className="bg-white rounded-xl shadow-md p-5 sm:p-6 text-center">
                <div className="mb-5">
                  <h2 className="text-lg font-semibold text-gray-800 mb-2">NFC Card Scanner</h2>
                  <p className="text-gray-600 text-sm">Tap student NFC cards to record attendance</p>
                </div>

                {nfcEnabled ? (
                  <div className="flex flex-col items-center">
                    {/* NFC Animation Circle */}
                    <div className="relative w-36 h-36 sm:w-48 sm:h-48 mb-6">
                      <div
                        className="absolute inset-0 bg-purple-500 rounded-full opacity-80 flex items-center justify-center"
                        ref={pulseElementRef}
                      >
                        <Wifi className="w-16 h-16 sm:w-20 sm:h-20 text-white" />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Shield className="w-12 h-12 sm:w-16 sm:h-16 text-white" />
                      </div>
                    </div>

                    {/* Scanning Status */}
                    <div className="mb-5">
                      {scanning ? (
                        <p className="text-green-600 font-medium flex items-center justify-center">
                          <span className="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                          {scanMessage || "Scanning for NFC cards..."}
                        </p>
                      ) : (
                        <p className="text-gray-500">Scanner idle</p>
                      )}
                    </div>

                    {/* Start/Stop Scanning Button */}
                    <button
                      onClick={scanning ? stopNFCScanning : startNFCScanning}
                      className={`font-bold py-3 px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors w-full ${
                        scanning
                          ? "bg-red-500 hover:bg-red-600 text-white focus:ring-red-500"
                          : "bg-purple-600 hover:bg-purple-700 text-white focus:ring-purple-500"
                      }`}
                    >
                      {scanning ? "Stop Scanning" : "Start NFC Scanner"}
                    </button>
                  </div>
                ) : (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                    <p className="text-yellow-800 text-sm">
                      NFC is not supported by your browser or device. Please use a compatible device.
                    </p>
                  </div>
                )}
              </div>

              {/* Last Scanned Student Info - Mobile Only */}
              {lastScannedStudent && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-5 sm:p-6 lg:hidden">
                  <div className="flex items-center mb-4">
                    <CheckCircle className="w-6 h-6 text-green-500 mr-2 flex-shrink-0" />
                    <h3 className="text-lg font-semibold text-green-800 truncate">Student Successfully Checked In</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-green-700">Name</p>
                      <p className="text-base font-medium truncate">{lastScannedStudent.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-green-700">Student ID</p>
                      <p className="text-base font-medium">{lastScannedStudent.studentId}</p>
                    </div>
                    <div>
                      <p className="text-sm text-green-700">Email</p>
                      <p className="text-base font-medium truncate">{lastScannedStudent.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-green-700">Time</p>
                      <p className="text-base font-medium">
                        {new Date(lastScannedStudent.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Attendance List & Last Scanned */}
            <div className="lg:col-span-2 space-y-6">
              {/* Last Scanned Student Info - Desktop Only */}
              {lastScannedStudent && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-6 hidden lg:block">
                  <div className="flex items-center mb-4">
                    <CheckCircle className="w-8 h-8 text-green-500 mr-3 flex-shrink-0" />
                    <h3 className="text-xl font-semibold text-green-800">Student Successfully Checked In</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-green-700">Name</p>
                      <p className="text-lg font-medium">{lastScannedStudent.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-green-700">Student ID</p>
                      <p className="text-lg font-medium">{lastScannedStudent.studentId}</p>
                    </div>
                    <div>
                      <p className="text-sm text-green-700">Email</p>
                      <p className="text-lg font-medium">{lastScannedStudent.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-green-700">Time</p>
                      <p className="text-lg font-medium">
                        {new Date(lastScannedStudent.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Students Attendance List */}
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="px-5 sm:px-6 py-4 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-800">Students Checked In</h2>
                      <p className="text-gray-600 text-sm">
                        {scannedStudents.length} {scannedStudents.length === 1 ? "student" : "students"} present
                      </p>
                    </div>
                    <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
                      {scannedStudents.length} / {attendanceData?.capacity || "∞"}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  {scannedStudents.length > 0 ? (
                    <div className="min-w-full divide-y divide-gray-200">
                      {/* Table Header - Desktop */}
                      <div className="hidden sm:flex bg-gray-50">
                        <div className="px-6 py-3 w-2/5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Student
                        </div>
                        <div className="px-6 py-3 w-1/5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Student ID
                        </div>
                        <div className="px-6 py-3 w-1/5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Time
                        </div>
                        <div className="px-6 py-3 w-1/5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </div>
                      </div>

                      {/* Table Body */}
                      <div className="bg-white divide-y divide-gray-200">
                        {scannedStudents.map((student, index) => (
                          <div
                            key={index}
                            className={`flex flex-col sm:flex-row ${index % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                          >
                            {/* Mobile View - Card Style */}
                            <div className="p-4 sm:hidden">
                              <div className="flex items-center mb-2">
                                {student.profileImageUrl ? (
                                  <img
                                    className="h-10 w-10 rounded-full mr-3"
                                    src={student.profileImageUrl || "/placeholder.svg"}
                                    alt={student.name}
                                  />
                                ) : (
                                  <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center mr-3">
                                    <UserCheck className="h-6 w-6 text-purple-600" />
                                  </div>
                                )}
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{student.name}</div>
                                  <div className="text-sm text-gray-500 truncate">{student.email}</div>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                <div>
                                  <span className="text-xs text-gray-500">ID:</span>{" "}
                                  <span className="text-sm">{student.studentId}</span>
                                </div>
                                <div>
                                  <span className="text-xs text-gray-500">Time:</span>{" "}
                                  <span className="text-sm">{new Date(student.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <div className="col-span-2 mt-1">
                                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                    Present
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Desktop View - Table Style */}
                            <div className="hidden sm:flex sm:items-center sm:w-2/5 px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10">
                                  {student.profileImageUrl ? (
                                    <img
                                      className="h-10 w-10 rounded-full"
                                      src={student.profileImageUrl || "/placeholder.svg"}
                                      alt={student.name}
                                    />
                                  ) : (
                                    <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                                      <UserCheck className="h-6 w-6 text-purple-600" />
                                    </div>
                                  )}
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm leading-5 font-medium text-gray-900">{student.name}</div>
                                  <div className="text-sm leading-5 text-gray-500">{student.email}</div>
                                </div>
                              </div>
                            </div>
                            <div className="hidden sm:flex sm:items-center sm:w-1/5 px-6 py-4 whitespace-nowrap">
                              <div className="text-sm leading-5 text-gray-900">{student.studentId}</div>
                            </div>
                            <div className="hidden sm:flex sm:items-center sm:w-1/5 px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm leading-5 text-gray-900">
                                  {new Date(student.timestamp).toLocaleTimeString()}
                                </div>
                                <div className="text-xs leading-5 text-gray-500">
                                  {new Date(student.timestamp).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                            <div className="hidden sm:flex sm:items-center sm:w-1/5 px-6 py-4 whitespace-nowrap">
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                Present
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center text-gray-500">
                      <UserCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p>No students have checked in yet</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Start the NFC scanner and have students tap their cards
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white py-4 px-4 sm:px-6 shadow-inner mt-6">
        <div className="max-w-6xl mx-auto text-center text-gray-500 text-sm">
          <p>NextGen-Pemss • Teacher View</p>
          <p className="text-xs mt-1">Scan student cards to record attendance</p>
        </div>
      </footer>
    </div>
  )
}

