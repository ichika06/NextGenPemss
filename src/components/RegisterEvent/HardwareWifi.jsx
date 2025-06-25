import { useState, useEffect, useRef } from "react"
import { X, Wifi, WifiOff, Search, RefreshCw, AlertCircle, UserPlus, Monitor, Clock } from "lucide-react"
import { useAuth } from "../../contexts/AuthContext"
import {
  collection,
  query,
  where,
  doc,
  onSnapshot,
  getDocs,
  updateDoc,
  getDoc,
  addDoc,
  increment,
  arrayUnion,
} from "firebase/firestore"
import { db, storage } from "../../firebase/config"
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage"
import { ref, onValue, set, off, remove } from "firebase/database"
import { database } from "../../firebase/config"
import * as XLSX from "xlsx"
import { deletePreRegisteredUser } from "../../pages/DeletePreregistered"
import { sendEmail, EmailTemplates } from "../../sendEmail"
import EventAttendanceWorkbook from "../../components/EventAttendanceWorkbook"
import StudentDetailsModal from "./StudentDetailsModal"
import { useAlert } from "../AlertProvider";

export default function HardwareWiFi({ eventId, onClose, onSuccess }) {
  // State variables
  const [registrationCount, setRegistrationCount] = useState(0)
  const [lastRegisteredName, setLastRegisteredName] = useState("")
  const { currentUser, currentUserData } = useAuth()
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState(null)
  const [onlineDevices, setOnlineDevices] = useState([])
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [scanResults, setScanResults] = useState([])
  const [lastScannedTag, setLastScannedTag] = useState("")
  const [matchFound, setMatchFound] = useState(false)
  const [matchedUser, setMatchedUser] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const [scanCount, setScanCount] = useState(0)
  const [continuousScan, setContinuousScan] = useState(true)
  const [isClosing, setIsClosing] = useState(false)

  const [scanAnimation, setScanAnimation] = useState(false)
  const [pulseAnimation, setPulseAnimation] = useState(false)
  const [successAnimation, setSuccessAnimation] = useState(false)

  const [showStudentModal, setShowStudentModal] = useState(false)
  const [studentModalData, setStudentModalData] = useState(null)
  const [eventModalData, setEventModalData] = useState(null)

  const refreshIntervalRef = useRef(null)
  const scanIntervalRef = useRef(null)
  const unsubscribeEventRef = useRef(null)
  const deviceListenersRef = useRef({})
  const heartbeatIntervalRef = useRef(null)
  const heartbeatCounterRef = useRef(0)
  const scanTimeoutRef = useRef(null)
  const processingScanRef = useRef(false)
  const { showAlert } = useAlert();

  // Set up real-time listener for attendee count when eventId is available
  useEffect(() => {
    if (!eventId) return

    const setupAttendeeCountListener = () => {
      try {
        const eventsRef = collection(db, "events")
        const eventQuery = query(eventsRef, where("id", "==", eventId))

        const unsubscribe = onSnapshot(
          eventQuery,
          (snapshot) => {
            if (snapshot.empty) {
              console.log("No matching event found")
              setRegistrationCount(0)
              return
            }

            const eventDoc = snapshot.docs[0]
            const eventData = eventDoc.data()

            if (eventData && typeof eventData.attendees === "number") {
              setRegistrationCount(eventData.attendees)
              console.log("Attendee count updated:", eventData.attendees)
            } else {
              console.log("No attendees field found or not a number")
              setRegistrationCount(0)
            }
          },
          (error) => {
            console.error("Error in attendee count listener:", error)
          },
        )

        // Setup attendance-sessions listener
        const attendanceSessionsRef = collection(db, "attendance-sessions")
        const attendanceQuery = query(attendanceSessionsRef, where("id", "==", eventId))

        const unsubscribeAttendance = onSnapshot(
          attendanceQuery,
          (snapshot) => {
            if (snapshot.empty) {
              console.log("No matching attendance session found")
              return
            }

            const attendanceDoc = snapshot.docs[0]
            const attendanceData = attendanceDoc.data()

            if (attendanceData && typeof attendanceData.attendees === "number") {
              console.log("Attendance session count updated:", attendanceData.attendees)
            } else {
              console.log("No attendees field found in attendance session or not a number")
            }
          },
          (error) => {
            console.error("Error in attendance session listener:", error)
          },
        )

        unsubscribeEventRef.current = unsubscribe
        unsubscribeAttendance.current = unsubscribeAttendance
      } catch (error) {
        console.error("Error setting up attendee count listener:", error)
      }
    }

    setupAttendeeCountListener()

    return () => {
      if (unsubscribeEventRef.current) {
        unsubscribeEventRef.current()
        unsubscribeEventRef.current = null
      }
    }
  }, [eventId])

  // Discover and monitor ESP32 devices from Firebase Realtime Database
  useEffect(() => {
    discoverDevices()

    // Set up periodic refresh
    refreshIntervalRef.current = setInterval(() => {
      if (!isRefreshing) {
        discoverDevices()
      }
    }, 10000) // Refresh every 10 seconds

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current)
      }
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current)
      }
      // Clean up device listeners
      Object.values(deviceListenersRef.current).forEach((unsubscribe) => {
        if (unsubscribe) unsubscribe()
      })
    }
  }, [])

  // Set up continuous scanning when device is selected
  useEffect(() => {
    if (selectedDevice && continuousScan) {
      setupDeviceListener(selectedDevice.id)
    }

    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current)
      }
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current)
      }
    }
  }, [selectedDevice, continuousScan])

  // Discover ESP32 devices from Firebase Realtime Database
  const discoverDevices = async () => {
    try {
      setError(null)
      const devicesRef = ref(database)
      onValue(
        devicesRef,
        async (snapshot) => {
          const data = snapshot.val()
          if (!data) {
            setOnlineDevices([])
            return
          }
          const devices = []
          // Collect all userIds that are in use
          const inUseUserIds = []
          Object.keys(data).forEach((deviceId) => {
            const deviceData = data[deviceId]
            if (deviceData && deviceData.status === "online") {
              const inUsedBy = deviceData["-last_inused"]?.In_used_by || null
              if (inUsedBy) inUseUserIds.push(inUsedBy)
            }
          })
          // Fetch user names from Firestore
          const userNamesMap = {}
          if (inUseUserIds.length > 0) {
            const usersRef = collection(db, "users")
            const q = query(usersRef, where("uid", "in", inUseUserIds))
            const querySnapshot = await getDocs(q)
            querySnapshot.forEach((doc) => {
              const d = doc.data()
              userNamesMap[d.uid] = d.displayName || d.name || d.email || d.uid
            })
          }
          // Build device list with user names
          Object.keys(data).forEach((deviceId) => {
            const deviceData = data[deviceId]
            if (deviceData && deviceData.status === "online") {
              const inUsedBy = deviceData["-last_inused"]?.In_used_by || null
              devices.push({
                id: deviceId,
                name: deviceData.name || deviceId,
                status: deviceData.status,
                signalStrength: deviceData.signalStrength || 0,
                lastSeen: deviceData.lastSeen ? new Date(deviceData.lastSeen) : new Date(),
                location: deviceData.location || "",
                command: deviceData.command || "",
                inUsedBy,
                inUsedByName: inUsedBy ? userNamesMap[inUsedBy] || inUsedBy : null,
              })
            }
          })
          setOnlineDevices(devices)
        },
        (error) => {
          console.error("Error fetching devices:", error)
          setError("Failed to fetch devices: " + error.message)
        },
      )
    } catch (error) {
      setError("Failed to discover devices: " + error.message)
    }
  }

  // Set up real-time listener for specific device with improved continuous scanning
  const setupDeviceListener = (deviceId) => {
    try {
      // Listen to scanned_data/scan/data under the device node
      const scanDataRef = ref(database, `${deviceId}/scanned_data/scan/data`)
      const unsubscribe = onValue(
        scanDataRef,
        (snapshot) => {
          const scanValue = snapshot.val()
          if (!scanValue) return

          // Prevent duplicate processing of the same tag
          if (scanValue !== lastScannedTag && !processingScanRef.current) {
            setLastScannedTag(scanValue)
            processScannedData(scanValue, deviceId)
          }
        },
        (error) => {
          console.error(`Error listening to device ${deviceId} scanned_data/scan/data:`, error)
          setError(`Failed to monitor device: ${error.message}`)
        },
      )
      // Store the unsubscribe function
      deviceListenersRef.current[deviceId] = unsubscribe
    } catch (error) {
      console.error("Error setting up device listener:", error)
      setError("Failed to set up device monitoring: " + error.message)
    }
  }

  // Helper to extract tag id from scan data
  const getTagIdFromScan = (scan) => {
    if (typeof scan === "string") return scan
    if (scan && typeof scan === "object") {
      return scan.uid || scan.tagId || scan.data || scan.id || scan.scan_id || ""
    }
    return ""
  }

  // Process the tag data to remove any known prefixes (similar to HardwareScanner)
  const processTagData = (data) => {
    let processedData = data.trim()

    // Remove "NDEF:T:en:" prefix if present (for NDEF formatted tags)
    if (processedData.startsWith("NDEF:T:en:")) {
      processedData = processedData.substring("NDEF:T:en:".length)
    }

    // Remove "#Ten" prefix if present
    if (processedData.startsWith("#Ten")) {
      processedData = processedData.substring(4)
    }

    return processedData
  }

  // Search Firestore for a matching tag
  const searchUserByNfcTag = async (tagValue) => {
    try {
      const usersRef = collection(db, "users")
      const q = query(usersRef, where("uid", "==", tagValue))
      const querySnapshot = await getDocs(q)

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0]
        const userData = userDoc.data()
        userData.id = userDoc.id
        return { exists: true, userData }
      } else {
        return { exists: false, userData: null }
      }
    } catch (error) {
      console.error("Firestore search error:", error)
      throw error
    }
  }

  // Check if user is already registered for an event
  const checkUserEventRegistration = async (userId, eventId) => {
    try {
      const attendeesRef = collection(db, "eventAttendees")
      const q = query(attendeesRef, where("userId", "==", userId), where("eventId", "==", eventId))

      const querySnapshot = await getDocs(q)
      return { isRegistered: !querySnapshot.empty }
    } catch (error) {
      console.error("Event registration check error:", error)
      throw error
    }
  }

  // Update file record in Firebase
  const updateFileRecord = async (eventId, fileName, filePath, downloadURL, fileSize, isPublic, storageFolder) => {
    const filesRef = collection(db, "files")
    const filesQuery = query(filesRef, where("relatedEventId", "==", eventId))
    const filesSnapshot = await getDocs(filesQuery)

    const attendanceFileDoc = filesSnapshot.docs.find((doc) => {
      const data = doc.data()
      return data.name.includes("attendees.xlsx")
    })

    if (attendanceFileDoc) {
      await updateDoc(attendanceFileDoc.ref, {
        name: fileName,
        path: filePath,
        downloadURL: downloadURL,
        size: fileSize,
        updatedAt: new Date().toISOString(),
      })
    } else {
      await addDoc(collection(db, "files"), {
        name: fileName,
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: fileSize,
        path: filePath,
        downloadURL: downloadURL,
        userId: currentUserData.uid,
        userName: currentUserData.email,
        folder: storageFolder,
        isPublic: isPublic,
        uploadedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sharedWith: [],
        relatedEventId: eventId,
      })
    }
  }

  // Update attendance sheet
  const updateAttendanceSheet = async (userData, eventData, eventId, registeredDate, registeredTimestamp) => {
    try {
      const standardFileName = `${eventData.title.replace(/\s+/g, "_")}_attendees.xlsx`
      const storageFolder = eventData.isPublic ? "public/events" : `${currentUserData.uid}/event_data`
      const standardFilePath = `${storageFolder}/${standardFileName}`

      const docsRef = collection(db, "eventDocuments")
      const docsQuery = query(docsRef, where("eventId", "==", eventId), where("documentType", "==", "attendeeSheet"))
      const docsSnapshot = await getDocs(docsQuery)

      const attendeeData = {
        name: userData.name,
        email: userData.email,
        registeredDate: registeredDate,
        status: userData.role || "Attendee",
        notes: `Registered via WiFi Hardware scan on ${new Date(registeredTimestamp).toLocaleString()}`,
      }

      let workbook
      let blob

      if (!docsSnapshot.empty) {
        const docData = docsSnapshot.docs[0].data()
        const fileUrl = docData.fileUrl

        try {
          const response = await fetch(fileUrl)
          const fileBlob = await response.blob()
          const data = await fileBlob.arrayBuffer()
          workbook = XLSX.read(data, { type: "array" })
        } catch (err) {
          console.error("Error processing existing Excel file:", err)
          const attendanceWorkbookResult = await new Promise((resolve) => {
            const tempComponent = new EventAttendanceWorkbook({
              eventData,
              onWorkbookCreated: (result) => resolve(result),
              showDownloadButton: false,
              initialAttendees: [attendeeData],
            })
            tempComponent.handleCreateWorkbook()
          })
          workbook = attendanceWorkbookResult.workbook
        }
      } else {
        const attendanceWorkbookResult = await new Promise((resolve) => {
          const tempComponent = new EventAttendanceWorkbook({
            eventData,
            onWorkbookCreated: (result) => resolve(result),
            showDownloadButton: false,
            initialAttendees: [attendeeData],
          })
          tempComponent.handleCreateWorkbook()
        })
        workbook = attendanceWorkbookResult.workbook
      }

      if (!docsSnapshot.empty) {
        const attendeesSheetName = "Event Attendees"
        if (workbook.SheetNames.includes(attendeesSheetName)) {
          const worksheet = workbook.Sheets[attendeesSheetName]
          const rawData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: "",
          })

          if (rawData.length >= 1) {
            let existingUserIndex = -1
            for (let i = 1; i < rawData.length; i++) {
              if (rawData[i][1] === userData.email) {
                existingUserIndex = i
                break
              }
            }

            if (existingUserIndex !== -1) {
              rawData[existingUserIndex] = [
                attendeeData.name,
                attendeeData.email,
                attendeeData.registeredDate,
                attendeeData.status,
                attendeeData.notes,
              ]
            } else {
              rawData.push([
                attendeeData.name,
                attendeeData.email,
                attendeeData.registeredDate,
                attendeeData.status,
                attendeeData.notes,
              ])
            }
          }

          const newWorksheet = XLSX.utils.aoa_to_sheet(rawData)
          workbook.Sheets[attendeesSheetName] = newWorksheet
        }
      }

      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      })

      blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })

      const fileRef = storageRef(storage, standardFilePath)
      await uploadBytes(fileRef, blob)
      const downloadURL = await getDownloadURL(fileRef)

      if (!docsSnapshot.empty) {
        const docRef = docsSnapshot.docs[0].ref
        await updateDoc(docRef, {
          fileUrl: downloadURL,
          fileName: standardFileName,
          updatedAt: new Date().toISOString(),
        })
      } else {
        await addDoc(collection(db, "eventDocuments"), {
          eventId: eventId,
          documentType: "attendeeSheet",
          fileUrl: downloadURL,
          fileName: standardFileName,
          isPublic: eventData.isPublic,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }

      await updateFileRecord(
        eventId,
        standardFileName,
        standardFilePath,
        downloadURL,
        blob.size,
        eventData.isPublic,
        storageFolder,
      )

      console.log("Attendance sheet updated successfully")
    } catch (err) {
      console.error("Error updating attendance sheet:", err)
      throw new Error("Failed to update attendance sheet")
    }
  }

  // Process scanned NFC data with enhanced continuous scanning logic (similar to HardwareScanner)
  const processScannedData = async (scannedData, deviceId) => {
    if (!scannedData || !eventId) return

    // Prevent concurrent processing
    if (processingScanRef.current) {
      console.log("Scan already in progress, skipping...")
      return
    }

    // Check if we're already processing this scan
    if (isScanning) {
      console.log("Waiting for previous scan to complete...")
      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!isScanning) {
            clearInterval(checkInterval)
            resolve()
          }
        }, 500) // Check every 500ms

        // Safety timeout after 5 seconds
        setTimeout(() => {
          clearInterval(checkInterval)
          setIsScanning(false) // Force reset scanning state
          resolve()
        }, 5000)
      })
    }

    processingScanRef.current = true
    setIsScanning(true)
    setScanAnimation(true) // Start scan animation
    setError(null)
    setScanCount((prev) => prev + 1)

    try {
      const tagId = processTagData(getTagIdFromScan(scannedData))
      if (!tagId) {
        throw new Error("Invalid tag data received")
      }

      console.log(`Processing tag: ${tagId}`)

      // Search for user by NFC tag
      const { exists, userData } = await searchUserByNfcTag(tagId)

      if (!exists) {
        throw new Error(
          showAlert({
          icon: "error",
          header: "NFC Scanned failed!",
          description: "No user found with this NFC card",
          variant: "error",
          position: window.innerWidth < 768 ? "top-center" : "top-right",
          animation: window.innerWidth < 768 ? "slide-down" : "slide-left",
          duration: 3000,
          headerColor: "#9c0505",
          descriptionColor: "#9c0505",
          borderColor: "#9c0505",
          width: window.innerWidth < 768 ? "sm" : "md",
          responsiveMode: window.innerWidth < 768 ? "inline" : "stack",
        })
        )
      }

      // Register user for the event
      await registerUserForEvent(userData, eventId, deviceId)
    } catch (error) {
      console.error("Error processing scanned data:", error)
      setError(error.message)
      setScanResults((prev) => [
        {
          timestamp: new Date(),
          tagId: typeof scannedData === "object" ? JSON.stringify(scannedData) : scannedData,
          device: deviceId,
          success: false,
          error: error.message,
        },
        ...prev.slice(0, 9),
      ])
    } finally {
      // Clear the command and scan data
      await sendCommandToDevice(deviceId, "")

      // Stop scan animation
      setScanAnimation(false)

      // Clean up scan data after processing
      setTimeout(async () => {
        try {
          const scanDataRef = ref(database, `${deviceId}/scanned_data/scan/data`)
          await remove(scanDataRef)
          console.log(`Deleted scan data for device ${deviceId}`)
        } catch (err) {
          console.error("Failed to delete scan data:", err)
        }
      }, 1500)

      processingScanRef.current = false
      setIsScanning(false) // This will reset manual scanning state
    }
  }

  // Enhanced user registration with full integration
  const registerUserForEvent = async (userData, eventId, deviceId) => {
    try {
      // Try to get event by doc ID
      const eventRef = doc(db, "events", eventId)
      const eventSnap = await getDoc(eventRef)

      if (eventSnap.exists()) {
        // --- Event registration logic ---
        const eventData = eventSnap.data()
        eventData.id = eventId

        if (!eventData.isLive) throw new Error(
          showAlert({
          icon: "error",
          header: "Event Registration",
          description: "This event is not accessible yet",
          variant: "error",
          position: window.innerWidth < 768 ? "top-center" : "top-right",
          animation: window.innerWidth < 768 ? "slide-down" : "slide-left",
          duration: 3000,
          headerColor: "#9c0505",
          descriptionColor: "#9c0505",
          borderColor: "#9c0505",
          width: window.innerWidth < 768 ? "sm" : "md",
          responsiveMode: window.innerWidth < 768 ? "inline" : "stack",
        })
        )

        // Check if user is already registered
        const { isRegistered } = await checkUserEventRegistration(
          userData.usersId || userData.studentId || userData.id,
          eventId,
        )
        
        if (isRegistered) throw new Error(  
        showAlert({
        icon: "info",
        header: "Event Registration",
        description: "This user is already registered for this event",
        variant: "info",
        position: window.innerWidth < 768 ? "top-center" : "top-right",
        animation: window.innerWidth < 768 ? "slide-down" : "slide-left",
        duration: 3000,
        headerColor: "#0062e2",
        descriptionColor: "#2076e7",
        borderColor: "#2076e7",
        width: window.innerWidth < 768 ? "sm" : "md",
        responsiveMode: window.innerWidth < 768 ? "inline" : "stack",
      })
        )

        const now = new Date()
        const registeredDate = now.toISOString().split("T")[0]

        await addDoc(collection(db, "eventAttendees"), {
          eventId,
          userId: userData.usersId || userData.studentId || userData.id,
          course: userData.course,
          userEmail: userData.email,
          userImageProfile: userData.profileImage,
          userName: userData.name || userData.displayName,
          registeredAt: now.toISOString(),
          status: userData.role,
          registeredByUserId: currentUser.uid,
          registeredByEmail: currentUser.email,
          registrationMethod: "WiFi-NFC",
          userDocId: userData.uid,
        })

        // Send confirmation email
        const emailData = {
          email: userData.email,
          userName: userData.name || userData.displayName,
          userId: userData.usersId || userData.studentId || userData.id,
          course: userData.course,
          userImageProfile: userData.profileImage,
          eventId: eventId,
          eventName: eventData.title,
          registeredAt: now.toISOString(),
          status: userData.role,
          registeredByUserId: currentUser.uid,
          registeredByEmail: currentUser.email,
          registrationMethod: "WiFi-NFC",
          userDocId: userData.uid,
        }

        await sendEmail({
          template: EmailTemplates.EVENT_REGISTRATION,
          data: emailData,
          onError: (error) => {
            console.error(`Failed to send confirmation email to ${userData.email}:`, error)
          },
        })

        // Delete pre-registered user if exists
        const deleteUser = async (userEventId) => {
          const result = await deletePreRegisteredUser(userEventId)
          if (result.success) {
            await updateDoc(doc(db, "events", eventId), {
              preRegisteredCount: increment(-1),
            })
          }
        }
        deleteUser(userData.uid + "_" + eventId)

        // Increment attendee count
        await updateDoc(doc(db, "events", eventId), {
          attendees: increment(1),
        })

        // Update attendance sheet
        await updateAttendanceSheet(userData, eventData, eventId, registeredDate, now.toISOString())

        // Show student details modal
        setStudentModalData(userData)
        setEventModalData(eventData)
        setShowStudentModal(true)

        // Update UI state
        setMatchFound(true)
        setMatchedUser(userData)
        setLastRegisteredName(userData.displayName || userData.name || userData.email)
        setSuccessAnimation(true) // Trigger success animation

        // Auto-reset for continuous scan mode
        if (continuousScan) {
          setTimeout(() => {
            setMatchFound(false)
            setMatchedUser(null)
            setSuccessAnimation(false) // Reset success animation
          }, 2000)
        } else {
          // Reset success animation after 3 seconds for single scan mode
          setTimeout(() => {
            setSuccessAnimation(false)
          }, 3000)
        }

        // Add to scan results
        setScanResults((prev) => [
          {
            timestamp: new Date(),
            tagId: userData.uid,
            user: userData,
            device: deviceId,
            success: true,
          },
          ...prev.slice(0, 9),
        ])

        // Only call onSuccess if NOT in continuous scan mode
        if (onSuccess && !continuousScan) {
          onSuccess(userData)
        }

        // Send acknowledgment to device
        await sendCommandToDevice(deviceId, "ACK")

        return { success: true, userData, eventData }
      } else {
        // --- Attendance session fallback ---
        return await registerUserForAttendanceSession(userData, eventId, deviceId)
      }
    } catch (error) {
      console.error("Error registering user for event/attendance:", error)
      if (error.message.includes("Unsupported field value: undefined (found in field course")) {
        throw new Error(
          showAlert({
          icon: "error",
          header: "Attendance Registration",
          description: "Access restricted to students only",
          variant: "error",
          position: window.innerWidth < 768 ? "top-center" : "top-right",
          animation: window.innerWidth < 768 ? "slide-down" : "slide-left",
          duration: 3000,
          headerColor: "#9c0505",
          descriptionColor: "#9c0505",
          borderColor: "#9c0505",
          width: window.innerWidth < 768 ? "sm" : "md",
          responsiveMode: window.innerWidth < 768 ? "inline" : "stack",
        })
        )
      }
      throw error
    }
  }

const registerUserForAttendanceSession = async (userData, attendanceSessionIdOrCode, deviceId) => {
  try {
    
    // Check if user has student role
    if (userData.role !== "student") {        
      throw new Error(
        showAlert({
        icon: "error",
        header: "Attendance Registration",
        description: "Only users with 'student' role can register for attendance sessions",
        variant: "error",
        position: window.innerWidth < 768 ? "top-center" : "top-right",
        animation: window.innerWidth < 768 ? "slide-down" : "slide-left",
        duration: 3000,
        headerColor: "#9c0505",
        descriptionColor: "#9c0505",
        borderColor: "#9c0505",
        width: window.innerWidth < 768 ? "sm" : "md",
        responsiveMode: window.innerWidth < 768 ? "inline" : "stack",
      })
      )
    }

    // Query attendance-sessions by id field (not doc ID)
    const attendanceSessionsRef = collection(db, "attendance-sessions")
    const attendanceQuery = query(attendanceSessionsRef, where("id", "==", attendanceSessionIdOrCode))
    const attendanceSnap = await getDocs(attendanceQuery)

    if (attendanceSnap.empty) {
      throw new Error(
        showAlert({
        icon: "error",
        header: "Attendance Registration",
        description: "Attendance session not found",
        variant: "error",
        position: window.innerWidth < 768 ? "top-center" : "top-right",
        animation: window.innerWidth < 768 ? "slide-down" : "slide-left",
        duration: 3000,
        headerColor: "#9c0505",
        descriptionColor: "#9c0505",
        borderColor: "#9c0505",
        width: window.innerWidth < 768 ? "sm" : "md",
        responsiveMode: window.innerWidth < 768 ? "inline" : "stack",
      })
      )
    }

    const attendanceDoc = attendanceSnap.docs[0]
    const attendanceData = attendanceDoc.data()

    // Improved duplicate check - check multiple possible identifiers
    const userIdentifiers = [
      userData.usersId,
      userData.studentId, 
      userData.id,
      userData.uid
    ].filter(Boolean) // Remove any undefined/null values

    const existingStudent = attendanceData.students?.find((student) => {
      // Check if any of the user's identifiers match any of the student's identifiers
      const studentIdentifiers = [
        student.studentId,
        student.userUID,
        student.id,
        student.usersId
      ].filter(Boolean)

      // Check for any overlap between user identifiers and student identifiers
      return userIdentifiers.some(userId => 
        studentIdentifiers.some(studentId => userId === studentId)
      ) || 
      // Also check email as a fallback identifier
      (userData.email && student.email && userData.email.toLowerCase() === student.email.toLowerCase())
    })

    if (existingStudent) {
      throw new Error(
        showAlert({
        icon: "info",
        header: "Attendance Registration",
        description: "This user is already registered for this attendance session",
        variant: "info",
        position: window.innerWidth < 768 ? "top-center" : "top-right",
        animation: window.innerWidth < 768 ? "slide-down" : "slide-left",
        duration: 3000,
        headerColor: "#0062e2",
        descriptionColor: "#2076e7",
        borderColor: "#2076e7",
        width: window.innerWidth < 768 ? "sm" : "md",
        responsiveMode: window.innerWidth < 768 ? "inline" : "stack",
      })
      )
    }

    const now = new Date()
    const studentData = {
      comment: "Checked in via WiFi NFC scan",
      course: userData.course || "BSCS",
      email: userData.email,
      isPresent: true,
      name: userData.name || userData.displayName,
      profileImageUrl: userData.profileImage || userData.profileImageUrl,
      studentId: userData.usersId || userData.studentId || userData.id,
      teacherName: attendanceData.teacherName || currentUser.displayName,
      timestamp: now.toISOString(),
      userUID: userData.uid,
    }

    // Add student to students array in attendance session
    const attendanceRef = doc(db, "attendance-sessions", attendanceDoc.id)
    await updateDoc(attendanceRef, {
      students: arrayUnion(studentData),
    })

    // Show student details modal
    setStudentModalData(userData)
    setEventModalData({ title: "Attendance Session", name: "Attendance Session" })
    setShowStudentModal(true)

    // UI updates
    setMatchFound(true)
    setMatchedUser(userData)
    setLastRegisteredName(userData.displayName || userData.name || userData.email)

    // Auto-reset for continuous scan mode
    if (continuousScan) {
      setTimeout(() => {
        setMatchFound(false)
        setMatchedUser(null)
      }, 2000)
    }

    // Add to scan results
    setScanResults((prev) => [
      {
        timestamp: new Date(),
        tagId: userData.uid,
        user: userData,
        device: deviceId,
        success: true,
      },
      ...prev.slice(0, 9),
    ])

    // Only call onSuccess if NOT in continuous scan mode
    if (onSuccess && !continuousScan) {
      onSuccess(userData)
    }

    // Send acknowledgment to device
    await sendCommandToDevice(deviceId, "ACK")

    return {
      success: true,
      userData,
      attendanceData: { ...attendanceData, id: attendanceDoc.id },
      type: "attendance-session",
    }
  } catch (error) {
    console.error("Error registering user for attendance session:", error)
    throw error
  }
}

  // Send command to ESP32 device
  const sendCommandToDevice = async (deviceId, command) => {
    try {
      const deviceRef = ref(database, `${deviceId}/command`)
      await set(deviceRef, command)
      console.log(`Sent command "${command}" to ${deviceId}`)
    } catch (error) {
      console.error("Error sending command to device:", error)
    }
  }

  // Refresh device list
  const refreshDevices = async () => {
    setIsRefreshing(true)
    setError(null)

    try {
      await discoverDevices()
    } catch (error) {
      setError("Failed to refresh devices: " + error.message)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Connect to selected ESP32 device
  const connectToDevice = async (device) => {
    try {
      setError(null)
      setSelectedDevice(device)
      heartbeatCounterRef.current = 1

      // Set heartbeat and in-use immediately
      await setDeviceInUse(device.id, currentUser.uid, heartbeatCounterRef.current)

      // Start heartbeat interval (every 8 seconds)
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = setInterval(() => {
        heartbeatCounterRef.current += 1
        setDeviceInUse(device.id, currentUser.uid, heartbeatCounterRef.current)
      }, 8000)

      // Send correct command based on continuousScan
      if (continuousScan) {
        await sendCommandToDevice(device.id, "READ ON")
      } else {
        await sendCommandToDevice(device.id, "READ")
      }

      console.log(`Connected to ${device.name} (${device.id})`)
    } catch (error) {
      setError("Failed to connect to device: " + error.message)
      setSelectedDevice(null)
    }
  }

  // Stop heartbeat when device is disconnected or deselected
  useEffect(() => {
    if (!selectedDevice) {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = null
      }
    }
  }, [selectedDevice])

  // Update disconnectDevice to clear heartbeat and in-use
  const disconnectDevice = async () => {
    try {
      if (selectedDevice) {
        // Send READ OFF command first
        await sendCommandToDevice(selectedDevice.id, "READ OFF")
        // Wait 150ms, then clear the command
        await new Promise((resolve) => setTimeout(resolve, 150))
        await sendCommandToDevice(selectedDevice.id, "")

        // Send CLOSE command to stop scanning
        await sendCommandToDevice(selectedDevice.id, "close")

        // Clear heartbeat and in-use
        await clearDeviceInUse(selectedDevice.id)

        // Stop heartbeat interval
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current)
          heartbeatIntervalRef.current = null
        }
        // Clean up listener
        if (deviceListenersRef.current[selectedDevice.id]) {
          off(ref(database, selectedDevice.id), "value", deviceListenersRef.current[selectedDevice.id])
          delete deviceListenersRef.current[selectedDevice.id]
        }
      }

      setSelectedDevice(null)
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current)
      }
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current)
      }
      processingScanRef.current = false
    } catch (error) {
      console.error("Error disconnecting device:", error)
      setError("Failed to disconnect device: " + error.message)
    }
  }

  // Helper to set heartbeat and in-use in RTDB
  const setDeviceInUse = async (deviceId, userId, heartbeatValue) => {
    try {
      const inUseRef = ref(database, `${deviceId}/-last_inused`)
      await set(inUseRef, {
        In_used_by: userId,
        heartbeat: heartbeatValue,
      })
    } catch (err) {
      console.error("Failed to set device in use:", err)
    }
  }

  // Helper to clear heartbeat and in-use in RTDB
  const clearDeviceInUse = async (deviceId) => {
    try {
      const inUseRef = ref(database, `${deviceId}/-last_inused`)
      await set(inUseRef, {
        In_used_by: null,
        heartbeat: null,
      })
    } catch (err) {
      console.error("Failed to clear device in use:", err)
    }
  }

  // Manual trigger scan with improved logic
  const handleScan = async () => {
    if (!selectedDevice) {
      setError("No device selected")
      return
    }

    if (isScanning || processingScanRef.current) {
      setError("Scan already in progress. Please wait.")
      return
    }

    try {
      // Set scanning state and animation for manual scans
      if (!continuousScan) {
        setIsScanning(true)
        setScanAnimation(true)
      }

      // Clear the command first
      await sendCommandToDevice(selectedDevice.id, "")
      // Wait a short moment to ensure the command is cleared before sending READ
      await new Promise((resolve) => setTimeout(resolve, 150))
      // Send READ command to trigger a scan
      await sendCommandToDevice(selectedDevice.id, "READ")
      console.log("Scan triggered manually")

      // Remove the timeout - let the scan continue until NFC is detected or error occurs
      // The scanning state will be reset in processScannedData or on error
    } catch (error) {
      setError("Failed to trigger scan: " + error.message)
      // Reset scanning state on error
      if (!continuousScan) {
        setIsScanning(false)
        setScanAnimation(false)
      }
    }
  }

  // Toggle continuous scanning with improved state management
  const toggleContinuousScan = async () => {
    const newContinuousScan = !continuousScan
    setContinuousScan(newContinuousScan)

    if (selectedDevice) {
      try {
        if (newContinuousScan) {
          // When enabling continuous scan, send READ ON command
          await sendCommandToDevice(selectedDevice.id, "READ ON")
          console.log("Continuous scanning enabled")
        } else {
          // When disabling continuous scan, send READ OFF command
          await sendCommandToDevice(selectedDevice.id, "READ OFF")
          // Wait a moment then clear the command
          await new Promise((resolve) => setTimeout(resolve, 150))
          await sendCommandToDevice(selectedDevice.id, "")
          console.log("Continuous scanning disabled")
        }
      } catch (err) {
        setError("Failed to toggle continuous scan: " + err.message)
        // Revert the state if command failed
        setContinuousScan(!newContinuousScan)
      }
    }
  }

  // Handle modal close with improved cleanup
  const handleClose = async () => {
    if (isClosing) return

    setIsClosing(true)

    try {
      // Send close command to selected device
      if (selectedDevice) {
        await sendCommandToDevice(selectedDevice.id, "close")
        // Clear heartbeat and in-use
        await clearDeviceInUse(selectedDevice.id)
        // Stop heartbeat interval
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current)
          heartbeatIntervalRef.current = null
        }
      }

      // Clear all intervals and timeouts
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current)
      }
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current)
      }

      // Clean up all device listeners
      Object.entries(deviceListenersRef.current).forEach(([deviceId, unsubscribe]) => {
        if (unsubscribe) {
          off(ref(database, deviceId), "value", unsubscribe)
        }
      })
      deviceListenersRef.current = {}

      // Unsubscribe from Firestore listener
      if (unsubscribeEventRef.current) {
        unsubscribeEventRef.current()
        unsubscribeEventRef.current = null
      }

      // Reset states
      setSelectedDevice(null)
      setError(null)
      setOnlineDevices([])
      processingScanRef.current = false

      onClose()
    } catch (error) {
      console.error("Error closing modal:", error)
      setError(`Error closing: ${error.message}`)
    } finally {
      setIsClosing(false)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = null
      }
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current)
        scanTimeoutRef.current = null
      }
      processingScanRef.current = false
    }
  }, [])

  // Format time ago
  const formatTimeAgo = (date) => {
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)

    if (minutes < 1) return "Just now"
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  useEffect(() => {
    if (selectedDevice && continuousScan && !isScanning) {
      setPulseAnimation(true)
      const pulseInterval = setInterval(() => {
        setPulseAnimation((prev) => !prev)
      }, 2000) // Pulse every 2 seconds

      return () => clearInterval(pulseInterval)
    } else {
      setPulseAnimation(false)
    }
  }, [selectedDevice, continuousScan, isScanning])

  // Add custom styles for animations
  const customStyles = `
    @keyframes fade-in {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes slide-up {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes scale-in {
      from { opacity: 0; transform: scale(0); }
      to { opacity: 1; transform: scale(1); }
    }
    
    .animate-fade-in {
      animation: fade-in 0.5s ease-out;
    }
    
    .animate-slide-up {
      animation: slide-up 0.6s ease-out;
    }
    
    .animate-scale-in {
      animation: scale-in 0.3s ease-out;
    }
  `

  // Add the style tag before the main div
  return (
    <>
      <style>{customStyles}</style>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70">
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 overflow-hidden max-h-[90vh] flex flex-col border border-gray-200 dark:border-zinc-700">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-zinc-700">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-zinc-100">WiFi NFC Scanner</h2>
            <button
              onClick={handleClose}
              disabled={isClosing}
              className="text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
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
                    <h3 className="text-lg font-medium text-gray-800 dark:text-zinc-100">Available ESP32 Devices</h3>
                    <button
                      onClick={refreshDevices}
                      disabled={isRefreshing}
                      className="flex items-center px-3 py-2 text-sm bg-blue-50 dark:bg-blue-900 hover:bg-blue-100 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-200 rounded-md transition-colors"
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                      Refresh
                    </button>
                  </div>

                  {error && (
                    <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md p-3 mb-4 flex items-start">
                      <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-300 mt-0.5 mr-2 flex-shrink-0" />
                      <p className="text-red-600 dark:text-red-200 text-sm">{error}</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {onlineDevices.length === 0 ? (
                      <div className="text-center py-8">
                        <WifiOff className="h-12 w-12 text-gray-400 dark:text-zinc-500 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-zinc-300">No ESP32 devices found</p>
                        <p className="text-sm text-gray-400 dark:text-zinc-400 mt-1">
                          Make sure your ESP32 NFC scanners are connected and active
                        </p>
                      </div>
                    ) : (
                      onlineDevices.map((device) => {
                        const isInUse = !!device.inUsedBy
                        return (
                          <div
                            key={device.id}
                            className={`border rounded-lg p-4 transition-colors ${
                              isInUse
                                ? "border-yellow-200 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900 cursor-not-allowed opacity-70"
                                : "border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900 hover:bg-green-100 dark:hover:bg-green-800 cursor-pointer"
                            }`}
                            onClick={!isInUse ? () => connectToDevice(device) : undefined}
                            style={isInUse ? { pointerEvents: "none" } : {}}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <div className="flex items-center">
                                  {isInUse ? (
                                    <Wifi className="h-5 w-5 text-yellow-600 dark:text-yellow-200 mr-3" />
                                  ) : (
                                    <Wifi className="h-5 w-5 text-green-600 dark:text-green-200 mr-3" />
                                  )}
                                  <div>
                                    <h4 className={`font-medium ${isInUse ? "text-yellow-800 dark:text-yellow-100" : "text-gray-800 dark:text-zinc-100"}`}>
                                      {device.name}
                                    </h4>
                                    <p className={`text-sm ${isInUse ? "text-yellow-700 dark:text-yellow-200" : "text-gray-600 dark:text-zinc-300"}`}>
                                      {device.id}
                                    </p>
                                    {device.location && <p className="text-xs text-gray-500 dark:text-zinc-400">{device.location}</p>}
                                    {device.command && (
                                      <p className="text-xs text-blue-600 dark:text-blue-300">Command: {device.command}</p>
                                    )}
                                    {isInUse && (
                                      <p className="text-xs text-yellow-700 dark:text-yellow-200 font-semibold mt-1">
                                        In used by: {device.inUsedByName || device.inUsedBy}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="flex items-center text-xs text-gray-500 dark:text-zinc-400">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {formatTimeAgo(device.lastSeen)}
                                </div>
                                <div
                                  className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${
                                    isInUse
                                      ? "bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-100"
                                      : "bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100"
                                  }`}
                                >
                                  {isInUse ? "in use" : device.status}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              ) : (
                // Scanner interface
                <div>
                  {/* Connected device info */}
                  <div className="flex items-center justify-between mb-6 p-4 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-lg">
                    <div className="flex items-center">
                      <Wifi className="h-5 w-5 text-green-600 dark:text-green-200 mr-3" />
                      <div>
                        <h4 className="font-medium text-green-800 dark:text-green-100">{selectedDevice.name}</h4>
                        <p className="text-sm text-green-600 dark:text-green-200">{selectedDevice.id}</p>
                        {selectedDevice.command && (
                          <p className="text-xs text-green-700 dark:text-green-300">Status: {selectedDevice.command}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={disconnectDevice}
                      className="text-sm text-green-700 dark:text-green-200 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>

                  {error && (
                    <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-md p-3 mb-4 flex items-start">
                      <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-300 mt-0.5 mr-2 flex-shrink-0" />
                      <p className="text-red-600 dark:text-red-200 text-sm">{error}</p>
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
                      <div className="relative w-11 h-6 bg-gray-200 dark:bg-zinc-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:after:bg-zinc-900 after:border-gray-300 dark:after:border-zinc-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      <span className="ml-3 text-sm font-medium text-gray-700 dark:text-zinc-200">Continuous Scanning</span>
                    </label>
                  </div>

                  {/* Scan button with unified animations */}
                  <div className="flex justify-center mb-6">
                    <div className="relative">
                      {(scanAnimation || isScanning || processingScanRef.current || (continuousScan && pulseAnimation)) && (
                        <div className="absolute inset-0 rounded-md">
                          <div className="absolute inset-0 rounded-md bg-blue-400 animate-ping opacity-20"></div>
                          <div className="absolute inset-0 rounded-md bg-blue-400 animate-pulse opacity-30"></div>
                        </div>
                      )}

                      <button
                        onClick={handleScan}
                        disabled={isScanning || processingScanRef.current}
                        className={`relative px-6 py-3 ${
                          isScanning || processingScanRef.current
                            ? "bg-blue-300"
                            : continuousScan
                            ? "bg-blue-300"
                            : "bg-blue-600 hover:bg-blue-700"
                        } text-white rounded-md font-medium transition-all duration-300 flex items-center transform ${
                          scanAnimation || isScanning || processingScanRef.current || (continuousScan && pulseAnimation)
                            ? "scale-105"
                            : "scale-100"
                        }`}
                      >
                        {isScanning || processingScanRef.current || (continuousScan && selectedDevice) ? (
                          <>
                            <div className="relative mr-2">
                              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            </div>
                            <span className="animate-pulse">{continuousScan ? "Continuous Scanning..." : "Scanning..."}</span>
                          </>
                        ) : (
                          <>
                            <Search
                              className={`h-5 w-5 mr-2 transition-transform duration-300 ${
                                scanAnimation || (continuousScan && pulseAnimation) ? "scale-110" : "scale-100"
                              }`}
                            />
                            {continuousScan ? "Trigger Scan Now" : "Scan NFC Tag"}
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Match result with animations */}
                  {matchFound && matchedUser && (
                    <div
                      className={`bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-md p-4 text-center mb-6 transition-all duration-500 transform ${
                        successAnimation ? "scale-105 shadow-lg" : "scale-100"
                      }`}
                    >
                      <div className="mb-2">
                        <div
                          className={`h-12 w-12 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mx-auto mb-2 transition-all duration-300 ${
                            successAnimation ? "animate-bounce" : ""
                          }`}
                        >
                          <UserPlus
                            className={`h-6 w-6 text-green-600 dark:text-green-200 transition-all duration-300 ${
                              successAnimation ? "scale-125" : "scale-100"
                            }`}
                          />
                        </div>
                        <h4 className="font-medium text-green-800 dark:text-green-100 animate-fade-in">Registration Successful!</h4>
                      </div>
                      <p className="text-sm text-green-700 dark:text-green-200 mb-2 animate-slide-up">
                        {matchedUser.displayName || matchedUser.name || matchedUser.email} has been registered to the
                        event.
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-200 animate-slide-up" style={{ animationDelay: "0.1s" }}>
                        Device: {selectedDevice.name}
                      </p>
                      {successAnimation && (
                        <div className="absolute top-2 right-2">
                          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center animate-scale-in">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Statistics */}
                  <div className="border-t border-gray-200 dark:border-zinc-700 pt-4 text-center mb-6">
                    <p className="text-sm text-gray-600 dark:text-zinc-300">
                      Total registrations: <span className="font-medium">{registrationCount}</span>
                    </p>
                    <p className="text-sm text-gray-600 dark:text-zinc-300">
                      Scans from this device: <span className="font-medium">{scanCount}</span>
                    </p>
                    {lastRegisteredName && (
                      <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">Last registered: {lastRegisteredName}</p>
                    )}
                  </div>

                  {/* Recent scan results */}
                  {scanResults.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-zinc-200 mb-3">Recent Scans</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {scanResults.map((result, index) => (
                          <div
                            key={index}
                            className={`p-3 rounded-md text-sm ${
                              result.success
                                ? "bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700"
                                : "bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700"
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                {result.success ? (
                                  <p className="text-green-800 dark:text-green-100 font-medium">
                                    {result.user.displayName || result.user.name || result.user.email}
                                  </p>
                                ) : (
                                  <p className="text-red-800 dark:text-red-100 font-medium">Scan Failed</p>
                                )}
                                <p className="text-xs text-gray-500 dark:text-zinc-400">
                                  {result.timestamp.toLocaleTimeString()} • {result.device}
                                </p>
                                <p className="text-xs text-gray-400 dark:text-zinc-500">
                                  UID: {typeof result.tagId === "object" ? JSON.stringify(result.tagId) : result.tagId}
                                </p>
                              </div>
                              <div
                                className={`px-2 py-1 rounded-full text-xs ${
                                  result.success
                                    ? "bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100"
                                    : "bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-100"
                                }`}
                              >
                                {result.success ? "Success" : "Failed"}
                              </div>
                            </div>
                            {result.error && <p className="text-xs text-red-600 dark:text-red-300 mt-1">{result.error}</p>}
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
          <div className="bg-gray-50 dark:bg-zinc-900 px-6 py-4 border-t border-gray-200 dark:border-zinc-700">
            <div className="flex justify-between items-center">
              <div className="text-xs text-gray-500 dark:text-zinc-400 flex items-center">
                <Monitor className="h-3 w-3 mr-1" />
                <span>
                  {selectedDevice
                    ? `Connected to ${selectedDevice.name}`
                    : `${onlineDevices.filter((d) => d.status === "online").length} devices online`}
                </span>
              </div>
              <button
                onClick={handleClose}
                disabled={isClosing}
                className={`px-4 py-2 ${
                  isClosing
                    ? "bg-gray-300 dark:bg-zinc-700"
                    : "bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700"
                } text-gray-700 dark:text-zinc-200 rounded-md font-medium transition-colors text-sm flex items-center`}
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
          {/* Student Details Modal */}
          {showStudentModal && (
            <StudentDetailsModal
              isVisible={showStudentModal}
              userData={studentModalData}
              eventData={eventModalData}
              registrationMethod="WiFi-NFC"
              onClose={() => {
                setShowStudentModal(false)
                setStudentModalData(null)
                setEventModalData(null)
              }}
              autoCloseDelay={2000}
            />
          )}
        </div>
      </div>
    </>
  )
}