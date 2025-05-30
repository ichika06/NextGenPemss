import { useState, useEffect, useRef } from "react"
import { X, Wifi, WifiOff, Search, RefreshCw, AlertCircle, UserPlus, Monitor, Signal, Clock } from "lucide-react"
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
} from "firebase/firestore"
import { db, storage } from "../../firebase/config"
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage"
import { ref, onValue, set, off, remove } from "firebase/database"
import { database } from "../../firebase/config"
import * as XLSX from "xlsx"
import { deletePreRegisteredUser } from "../../pages/DeletePreregistered"
import { sendEmail, EmailTemplates } from "../../sendEmail"
import EventAttendanceWorkbook from "../../components/EventAttendanceWorkbook"

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

  const refreshIntervalRef = useRef(null)
  const scanIntervalRef = useRef(null)
  const unsubscribeEventRef = useRef(null)
  const deviceListenersRef = useRef({})
  const heartbeatIntervalRef = useRef(null)
  const heartbeatCounterRef = useRef(0)

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

        unsubscribeEventRef.current = unsubscribe
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
          let userNamesMap = {}
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

  // Set up real-time listener for specific device
  const setupDeviceListener = (deviceId) => {
    try {
      // Listen to scanned_data/scan/data under the device node
      const scanDataRef = ref(database, `${deviceId}/scanned_data/scan/data`)
      const unsubscribe = onValue(
        scanDataRef,
        (snapshot) => {
          const scanValue = snapshot.val()
          if (!scanValue) return
          if (scanValue !== lastScannedTag) {
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

  // Process scanned NFC data with enhanced registration logic
  const processScannedData = async (scannedData, deviceId) => {
    if (!scannedData || !eventId) return

    setIsScanning(true)
    setError(null)
    setScanCount((prev) => prev + 1)

    try {
      const tagId = getTagIdFromScan(scannedData)
      if (!tagId) return

      // Search for user by NFC tag
      const { exists, userData } = await searchUserByNfcTag(tagId)

      if (!exists) {
        throw new Error("No user found with this NFC card")
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
      await sendCommandToDevice(deviceId, "")
      setIsScanning(false)
      setTimeout(async () => {
        try {
          const scanDataRef = ref(database, `${deviceId}/scanned_data/scan/data`)
          await remove(scanDataRef)
          console.log(`Deleted scan data for device ${deviceId}`)
        } catch (err) {
          console.error("Failed to delete scan data:", err)
        }
      }, 1500)
    }
  }

  // Enhanced user registration with full integration
  const registerUserForEvent = async (userData, eventId, deviceId) => {
    try {
      // Get event details
      const eventRef = doc(db, "events", eventId)
      const eventSnap = await getDoc(eventRef)

      if (!eventSnap.exists()) {
        throw new Error("Event not found")
      }

      const eventData = eventSnap.data()
      eventData.id = eventId

      if (!eventData.isLive) {
        throw new Error("This event is not accessible yet")
      }

      // Check if user is already registered
      const { isRegistered } = await checkUserEventRegistration(
        userData.usersId || userData.studentId || userData.id,
        eventId,
      )

      if (isRegistered) {
        throw new Error("This user is already registered for this event")
      }

      const now = new Date()
      const registeredDate = now.toISOString().split("T")[0]

      // Add user to attendees collection
      await addDoc(collection(db, "eventAttendees"), {
        eventId: eventId,
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
        console.log("userId Content: ", userEventId)
        const result = await deletePreRegisteredUser(userEventId)

        if (result.success) {
          await updateDoc(doc(db, "events", eventId), {
            preRegisteredCount: increment(-1),
          })
        } else {
          console.error("Failed to delete user:", result.error)
        }
      }

      deleteUser(userData.uid + "_" + eventId)

      // Increment attendee count
      await updateDoc(doc(db, "events", eventId), {
        attendees: increment(1),
      })

      // Update attendance sheet
      await updateAttendanceSheet(userData, eventData, eventId, registeredDate, now.toISOString())

      // Update UI state
      setMatchFound(true)
      setMatchedUser(userData)
      setLastRegisteredName(userData.displayName || userData.name || userData.email)

      // Auto-reset for continuous scan mode
      if (continuousScan) {
        setTimeout(() => {
          setMatchFound(false)
          setMatchedUser(null)
        }, 2000) // 2 seconds, adjust as needed
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

      if (onSuccess && !continuousScan) {
        onSuccess(userData)
      }

      // Send acknowledgment to device
      await sendCommandToDevice(deviceId, "ACK")

      return { success: true, userData, eventData }
    } catch (error) {
      console.error("Error registering user for event:", error)
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
    // No dependency on continuousScan, only selectedDevice
  }, [selectedDevice])

  // Update disconnectDevice to clear heartbeat and in-use
  const disconnectDevice = async () => {
    try {
      if (selectedDevice) {
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

  // Manual trigger scan
  const handleScan = async () => {
    if (!selectedDevice) {
      setError("No device selected")
      return
    }
    try {
      // Clear the command first
      await sendCommandToDevice(selectedDevice.id, "")
      // Wait a short moment to ensure the command is cleared before sending READ
      await new Promise((resolve) => setTimeout(resolve, 150))
      // Send READ command to trigger a scan
      await sendCommandToDevice(selectedDevice.id, "READ")
      console.log("Scan triggered manually")
    } catch (error) {
      setError("Failed to trigger scan: " + error.message)
    }
  }

  // Toggle continuous scanning
  const toggleContinuousScan = async () => {
    const newContinuousScan = !continuousScan
    setContinuousScan(newContinuousScan)
    if (selectedDevice) {
      if (newContinuousScan) {
        // When enabling continuous scan, send READ ON command
        try {
          await sendCommandToDevice(selectedDevice.id, "READ ON")
        } catch (err) {
          setError("Failed to send read ON command: " + err.message)
        }
      } else {
        // When disabling continuous scan, clear the command
        try {
          await sendCommandToDevice(selectedDevice.id, "READ OFF")
        } catch (err) {
          setError("Failed to clear command: " + err.message)
        }
      }
    }
  }

  // Handle modal close
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

      // Clear intervals
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current)
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
                    <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
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
                    onlineDevices.map((device) => {
                      const isInUse = !!device.inUsedBy
                      return (
                        <div
                          key={device.id}
                          className={`border rounded-lg p-4 transition-colors ${
                            isInUse
                              ? "border-yellow-200 bg-yellow-50 cursor-not-allowed opacity-70"
                              : "border-green-200 bg-green-50 hover:bg-green-100 cursor-pointer"
                          }`}
                          onClick={
                            !isInUse ? () => connectToDevice(device) : undefined
                          }
                          style={isInUse ? { pointerEvents: "none" } : {}}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="flex items-center">
                                {isInUse ? (
                                  <Wifi className="h-5 w-5 text-yellow-600 mr-3" />
                                ) : (
                                  <Wifi className="h-5 w-5 text-green-600 mr-3" />
                                )}
                                <div>
                                  <h4 className={`font-medium ${isInUse ? "text-yellow-800" : "text-gray-800"}`}>{device.name}</h4>
                                  <p className={`text-sm ${isInUse ? "text-yellow-700" : "text-gray-600"}`}>{device.id}</p>
                                  {device.location && <p className="text-xs text-gray-500">{device.location}</p>}
                                  {device.command && <p className="text-xs text-blue-600">Command: {device.command}</p>}
                                  {isInUse && (
                                    <p className="text-xs text-yellow-700 font-semibold mt-1">
                                      In used by: {device.inUsedByName || device.inUsedBy}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="text-right">
                              
                              <div className="flex items-center text-xs text-gray-500">
                                <Clock className="h-3 w-3 mr-1" />
                                {formatTimeAgo(device.lastSeen)}
                              </div>
                              <div
                                className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${
                                  isInUse
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-green-100 text-green-800"
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
                <div className="flex items-center justify-between mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center">
                    <Wifi className="h-5 w-5 text-green-600 mr-3" />
                    <div>
                      <h4 className="font-medium text-green-800">{selectedDevice.name}</h4>
                      <p className="text-sm text-green-600">{selectedDevice.id}</p>
                      {selectedDevice.command && (
                        <p className="text-xs text-green-700">Status: {selectedDevice.command}</p>
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
                    className={`px-6 py-3 ${
                      isScanning ? "bg-blue-300" : "bg-blue-600 hover:bg-blue-700"
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
                      {matchedUser.displayName || matchedUser.name || matchedUser.email} has been registered to the
                      event.
                    </p>
                    <p className="text-xs text-green-600">Device: {selectedDevice.name}</p>
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
                    <p className="text-xs text-gray-500 mt-1">Last registered: {lastRegisteredName}</p>
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
                            result.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
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
                            <div
                              className={`px-2 py-1 rounded-full text-xs ${
                                result.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                              }`}
                            >
                              {result.success ? "Success" : "Failed"}
                            </div>
                          </div>
                          {result.error && <p className="text-xs text-red-600 mt-1">{result.error}</p>}
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
                  : `${onlineDevices.filter((d) => d.status === "online").length} devices online`}
              </span>
            </div>
            <button
              onClick={handleClose}
              disabled={isClosing}
              className={`px-4 py-2 ${isClosing ? "bg-gray-300" : "bg-gray-100 hover:bg-gray-200"} text-gray-700 rounded-md font-medium transition-colors text-sm flex items-center`}
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
  )
}