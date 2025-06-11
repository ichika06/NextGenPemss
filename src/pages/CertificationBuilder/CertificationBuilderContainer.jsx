"use client"

import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../contexts/AuthContext"
import html2canvas from "html2canvas"
import { jsPDF } from "jspdf"
import { collection, addDoc, doc, getDocs, query, orderBy, deleteDoc, where, updateDoc } from "firebase/firestore"
import { ref, uploadString, getDownloadURL, uploadBytes } from "firebase/storage"
import { db, storage } from "../../firebase/config"
import { sendEmail, EmailTemplates } from "../../sendEmail"
import { ChevronUp, ChevronDown, Trash2 } from "lucide-react"
import certificateTemplates from "./certificate-templates"
import Swal from "sweetalert2"

// Import components
import Toolbar from "./toolbar"
import CertificatePreview from "./certificate-preview"
import ElementsSection from "./elements-section"
import DesignSection from "./design-section"
import TemplatesSection from "./templates-section"

// Add a function to parse and replace placeholders in text content
const parsePlaceholders = (text, event) => {
  if (!text || !event) return text

  // Use regex to find all placeholders in curly braces with exact pattern matching
  return text.replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, (match, key) => {
    // Check if the key exists in the event data
    if (event[key] !== undefined) {
      return event[key]
    }
    // If key doesn't exist, return the original placeholder
    return match
  })
}

// Add a new function to parse and replace attendee placeholders after the existing parsePlaceholders function
const parseAttendeePlaceholders = (text, attendee) => {
  if (!text || !attendee) return text

  // Use regex to find all placeholders in curly braces with exact pattern matching
  return text.replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, (match, key) => {
    // Check if the key exists in the attendee data
    if (attendee[key] !== undefined) {
      return attendee[key]
    }
    // If key doesn't exist, return the original placeholder
    return match
  })
}

// Add a function to apply blur to an image
const applyBlurToImage = async (imageUrl, blurAmount, opacity) => {
  return new Promise((resolve, reject) => {
    if (!imageUrl) {
      resolve(null)
      return
    }

    // If no blur is needed, return the original image
    if (blurAmount === 0) {
      resolve(imageUrl)
      return
    }

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      // Create a canvas to apply the blur
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")

      // Set canvas dimensions to match the image
      canvas.width = img.width
      canvas.height = img.height

      // Draw the image on the canvas
      ctx.drawImage(img, 0, 0)

      // Apply blur using a simple box blur algorithm
      if (blurAmount > 0) {
        // Use a stack blur implementation or another blur algorithm
        // For simplicity, we'll use CSS filter and a second canvas
        const blurCanvas = document.createElement("canvas")
        blurCanvas.width = img.width
        blurCanvas.height = img.height
        const blurCtx = blurCanvas.getContext("2d")

        // Draw the original image
        blurCtx.drawImage(img, 0, 0)

        // Apply multiple passes of box blur for better quality
        const passes = Math.min(10, Math.ceil(blurAmount / 2))
        const boxSize = Math.ceil(blurAmount / passes)

        for (let i = 0; i < passes; i++) {
          boxBlur(blurCanvas, 0, 0, blurCanvas.width, blurCanvas.height, boxSize, false)
          boxBlur(blurCanvas, 0, 0, blurCanvas.width, blurCanvas.height, boxSize, true)
        }

        // Apply opacity
        ctx.globalAlpha = opacity
        ctx.drawImage(blurCanvas, 0, 0)
        ctx.globalAlpha = 1.0
      }

      // Convert canvas to data URL
      const blurredImageUrl = canvas.toDataURL("image/png")
      resolve(blurredImageUrl)
    }

    img.onerror = (err) => {
      console.error("Error loading image for blur:", err)
      resolve(imageUrl) // Return original on error
    }

    img.src = imageUrl
  })
}

// Box blur helper function
const boxBlur = (canvas, x, y, width, height, radius, horizontal) => {
  const ctx = canvas.getContext("2d")
  const imageData = ctx.getImageData(x, y, width, height)
  const pixels = imageData.data
  const div = 2 * radius + 1

  // Temporary array for storing pixel values
  const tempPixels = new Uint8ClampedArray(pixels.length)

  for (let i = 0; i < pixels.length; i++) {
    tempPixels[i] = pixels[i]
  }

  // Apply blur in one direction (horizontal or vertical)
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0,
        count = 0

      // Calculate the range for the blur
      const startX = Math.max(0, j - radius)
      const endX = Math.min(width - 1, j + radius)
      const startY = Math.max(0, i - radius)
      const endY = Math.min(height - 1, i + radius)

      if (horizontal) {
        // Horizontal blur
        for (let k = startX; k <= endX; k++) {
          const index = (i * width + k) * 4
          r += tempPixels[index]
          g += tempPixels[index + 1]
          b += tempPixels[index + 2]
          a += tempPixels[index + 3]
          count++
        }
      } else {
        // Vertical blur
        for (let k = startY; k <= endY; k++) {
          const index = (k * width + j) * 4
          r += tempPixels[index]
          g += tempPixels[index + 1]
          b += tempPixels[index + 2]
          a += tempPixels[index + 3]
          count++
        }
      }

      // Calculate average and set pixel values
      const index = (i * width + j) * 4
      pixels[index] = r / count
      pixels[index + 1] = g / count
      pixels[index + 2] = b / count
      pixels[index + 3] = a / count
    }
  }

  // Put the modified pixels back
  ctx.putImageData(imageData, x, y)
}

export default function CreativeCertificateBuilder() {
  const certificateRef = useRef(null)
  const [backgroundImage, setBackgroundImage] = useState(null)
  const [backgroundColor, setBackgroundColor] = useState("#ffffff")
  const [gridColor, setGridColor] = useState("rgba(0, 0, 0, 0.1)")
  const [rulerColor, setRulerColor] = useState("rgba(0, 0, 0, 0.3)")
  const [isWhiteLines, setIsWhiteLines] = useState(false)
  const [borderStyle, setBorderStyle] = useState({
    color: "#d4af37",
    width: 12,
    style: "solid",
    radius: 8,
  })

  // Get current user from auth context
  const { currentUser, currentUserData } = useAuth()

  // Add state for user events
  const [userEvents, setUserEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [isLoadingEvents, setIsLoadingEvents] = useState(false)

  // Add state for event attendees after the other state declarations
  const [eventAttendees, setEventAttendees] = useState([])
  const [selectedAttendees, setSelectedAttendees] = useState([])
  const [isLoadingAttendees, setIsLoadingAttendees] = useState(false)
  const [sendingMultiple, setSendingMultiple] = useState(false)
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 })

  // History for undo/redo functionality
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  // Certificate size and orientation
  const [certificateSize, setCertificateSize] = useState({
    width: 1000,
    height: 700,
    orientation: "landscape",
  })

  // Start with an empty elements array
  const [elements, setElements] = useState([])
  const [originalelements, setoriginalelements] = useState([])

  // Ruler and grid settings
  const [showRulers, setShowRulers] = useState(true)
  const [showGrid, setShowGrid] = useState(false)
  const [gridSize, setGridSize] = useState(50) // Set a default grid size

  const navigate = useNavigate()

  const [selectedElement, setSelectedElement] = useState(null)

  // Import certificate templates

  const [templates, setTemplates] = useState(certificateTemplates)

  // Saved certificate designs
  const [savedDesigns, setSavedDesigns] = useState([])
  const [currentDesignName, setCurrentDesignName] = useState("Untitled Design")

  // Tabs for the control panel
  const [activeTab, setActiveTab] = useState("elements")

  // Signature pad
  const signaturePadRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [signatureData, setSignatureData] = useState(null)

  // Add a new state for background properties
  const [backgroundProps, setBackgroundProps] = useState({
    blur: 0,
    opacity: 1,
  })

  // Add a state for save status
  const [saveStatus, setSaveStatus] = useState("idle") // idle, saving, saved, error

  // Add a new state for email sending status
  const [emailStatus, setEmailStatus] = useState("idle") // idle, sending, sent, error
  const [recipientEmail, setRecipientEmail] = useState("")
  const [emailMessage, setEmailMessage] = useState("")
  const [downloadUrl, setdownloadUrl] = useState(null)

  // Add a new state for tracking mouse position
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  // Add a state for blurred background image
  const [blurredBackgroundImage, setBlurredBackgroundImage] = useState(null)

  // Initialize canvas when component mounts
  useEffect(() => {
    const canvas = signaturePadRef.current
    if (canvas) {
      const ctx = canvas.getContext("2d")
      ctx.lineWidth = 2
      ctx.lineCap = "round"
      ctx.strokeStyle = "#000"

      // Set canvas dimensions to match displayed size to prevent scaling issues
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
    }
  }, [])

  // Initialize history with the initial state
  useEffect(() => {
    if (history.length === 0) {
      saveToHistory()
    }
  }, [])

  // Add useEffect to load designs from Firestore on component mount
  useEffect(() => {
    loadDesignsFromFirestore()
  }, [])

  // Add useEffect to fetch user events when currentUser changes
  useEffect(() => {
    if (currentUser?.email) {
      fetchUserEvents()
    }
  }, [currentUser])

  // Add useEffect to generate blurred background image when backgroundImage or blur changes
  useEffect(() => {
    if (backgroundImage && backgroundProps.blur > 0) {
      const generateBlurredImage = async () => {
        const blurredImage = await applyBlurToImage(backgroundImage, backgroundProps.blur, backgroundProps.opacity)
        setBlurredBackgroundImage(blurredImage)
      }

      generateBlurredImage()
    } else {
      setBlurredBackgroundImage(null)
    }
  }, [backgroundImage, backgroundProps.blur, backgroundProps.opacity])

  // Function to fetch user events from Firestore
  const fetchUserEvents = async () => {
    if (!currentUser?.email) return

    setIsLoadingEvents(true)
    try {
      const eventsRef = collection(db, "events")
      const q = query(eventsRef, where("registrarEmail", "==", currentUser.email))
      const querySnapshot = await getDocs(q)

      const events = []
      querySnapshot.forEach((doc) => {
        events.push({
          id: doc.id,
          ...doc.data(),
        })
      })

      setUserEvents(events)
    } catch (error) {
      console.error("Error fetching user events:", error)
    } finally {
      setIsLoadingEvents(false)
    }
  }

  // Add this function after the fetchUserEvents function
  const fetchEventAttendees = async (eventId) => {
    if (!eventId) return

    setIsLoadingAttendees(true)
    try {
      const attendeesRef = collection(db, "eventAttendees")
      const q = query(attendeesRef, where("eventId", "==", eventId))
      const querySnapshot = await getDocs(q)

      const attendees = []
      querySnapshot.forEach((doc) => {
        attendees.push({
          id: doc.id,
          ...doc.data(),
        })
      })

      setEventAttendees(attendees)
      // Initially select all attendees
      setSelectedAttendees(attendees.map((a) => a.id))
    } catch (error) {
      console.error("Error fetching event attendees:", error)
    } finally {
      setIsLoadingAttendees(false)
    }
  }

  // Modify the handleEventSelect function to also fetch attendees
  const handleEventSelect = (eventId) => {
    const event = userEvents.find((event) => event.id === eventId)
    setSelectedEvent(event)

    // Fetch attendees for this event
    if (event) {
      fetchEventAttendees(event.id)

      // certificate elements with event data
      const updatedElements = elements.map((element) => {
        if (element.id === "title") {
          return { ...element, content: event.title }
        }
        if (element.id === "accomplishment") {
          return { ...element, content: `for participating in ${event.title}` }
        }
        if (element.id === "date") {
          return { ...element, content: event.date }
        }
        if (element.id === "issuer") {
          return { ...element, content: event.location || "Event Location" }
        }
        return element
      })

      setElements(updatedElements)
      saveToHistory()

      // Update design name with event title
      setCurrentDesignName(`${event.title} Certificate`)

      // If event has an image, set it as background
      if (event.image) {
        setBackgroundImage(event.image)

        // Ensure background blur is applied if it was previously set
        if (backgroundProps.blur > 0) {
          // Force a re-render to ensure blur is applied
          setBackgroundProps({
            ...backgroundProps,
            blur: backgroundProps.blur,
          })
        }
      }
    } else {
      // Clear attendees if no event is selected
      setEventAttendees([])
      setSelectedAttendees([])
    }
  }

  // Function to convert oklch colors to hex/rgba before passing to html2canvas
  const convertOklchColors = (element) => {
    // Process element's content
    const processElement = (el) => {
      // Replace any oklch colors in style attributes with hex
      if (el.getAttribute && el.getAttribute("style")) {
        const style = el.getAttribute("style")
        if (style.includes("oklch")) {
          // Replace oklch with a safe fallback (using hex or rgba)
          el.setAttribute("style", style.replace(/oklch$[^)]+$/g, "#333333"))
        }
      }

      // Process inline styles
      if (el.style) {
        const style = el.style
        const props = ["color", "backgroundColor", "borderColor", "boxShadow", "textShadow"]

        props.forEach((prop) => {
          if (style[prop] && typeof style[prop] === "string" && style[prop].includes("oklch")) {
            style[prop] = "#333333" // Safe fallback color
          }
        })
      }

      // Process children recursively
      if (el.childNodes && el.childNodes.length) {
        Array.from(el.childNodes).forEach((child) => {
          if (child.nodeType === 1) {
            // Element node
            processElement(child)
          }
        })
      }
    }

    processElement(element)
    return element
  }

  // Function to upload certificate to Firebase Storage
  const uploadCertificateToStorage = async (dataUrl, attendeeId) => {
    if (!dataUrl) return null

    try {
      // Create a clean folder name (remove special characters)
      const folderName = (selectedEvent?.title || currentDesignName).replace(/[^a-zA-Z0-9]/g, "_")

      // Create a reference to the file location in Firebase Storage
      const storageRef = ref(storage, `certificates/${folderName}/${attendeeId}.png`)

      // Convert data URL to blob and upload
      const imageData = dataUrl.split(",")[1]
      await uploadString(storageRef, imageData, "base64", {
        contentType: "image/png",
      })

      // Get the download URL
      const downloadURL = await getDownloadURL(storageRef)

      // Set the downloadUrl state
      setdownloadUrl(downloadURL)

      return downloadURL
    } catch (error) {
      console.error("Error uploading certificate to storage:", error)
      return null
    }
  }

  // Generate certificate for a specific attendee
  const generateCertificateForAttendeeFn = async (attendee) => {
    if (!certificateRef.current || !attendee) return null
    setShowRulers(false)
    setShowGrid(false)
    setGridColor("rgba(0, 0, 0, 0)")
    setRulerColor("rgba(0, 0, 0, 0)")

    // Create a temporary clone of elements with attendee data
    setoriginalelements([...elements])
    const attendeeElements = elements.map((el) => {
      if (el.type === "text") {
        return {
          ...el,
          content: parseAttendeePlaceholders(el.content, attendee),
        }
      }
      return el
    })

    // Update elements with attendee data
    setElements(attendeeElements)

    // Wait longer for the UI to update
    await new Promise((resolve) => setTimeout(resolve, 300))

    try {
      // Create a wrapper div with the same border-radius to clip the content
      const wrapper = document.createElement("div")
      wrapper.style.position = "absolute"
      wrapper.style.left = "-9999px"
      wrapper.style.overflow = "hidden"
      wrapper.style.borderRadius = borderStyle.radius ? `${borderStyle.radius}px` : "0"
      wrapper.style.width = `${certificateSize.width}px`
      wrapper.style.height = `${certificateSize.height}px`

      // Clone the certificate
      const certificateClone = certificateRef.current.cloneNode(true)
      certificateClone.style.transform = "none"

      // Append the clone to the wrapper
      wrapper.appendChild(certificateClone)
      document.body.appendChild(wrapper)

      // Manually apply blur to background image if needed
      if (backgroundImage && backgroundProps.blur > 0) {
        // Find the background image elements in the clone
        const bgElements = certificateClone.querySelectorAll('[data-background-blur="true"]')

        if (bgElements.length > 0 && blurredBackgroundImage) {
          // Replace the background image with the pre-blurred version
          bgElements.forEach((el) => {
            el.style.backgroundImage = `url(${blurredBackgroundImage})`
            el.style.filter = "none" // Remove the CSS filter
          })
        }
      }

      // Capture the certificate as PNG
      const canvas = await html2canvas(certificateClone, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: backgroundColor,
        onclone: (clonedDoc) => {
          // Process oklch colors
          convertOklchColors(clonedDoc.documentElement)

          // Ensure text elements have proper styling for export
          const textElements = clonedDoc.querySelectorAll("[data-element-id]")
          textElements.forEach((el) => {
            if (el.style) {
              el.style.overflow = "visible"
              el.style.boxSizing = "border-box"

              // For large font sizes, ensure there's enough space
              const fontSize = Number.parseInt(el.style.fontSize)
              if (fontSize >= 40) {
                el.style.padding = "40px"
                el.style.margin = "10px 0"
              }
            }
          })

          // Manually apply blur to background image if needed
          if (backgroundImage && backgroundProps.blur > 0) {
            // Find the background image elements
            const bgElements = clonedDoc.querySelectorAll('[data-background-blur="true"]')

            if (bgElements.length > 0 && blurredBackgroundImage) {
              // Replace the background image with the pre-blurred version
              bgElements.forEach((el) => {
                el.style.backgroundImage = `url(${blurredBackgroundImage})`
                el.style.filter = "none" // Remove the CSS filter
                el.style.transform = "none" // Remove the scale transform
              })
            }
          }
        },
      })

      // Remove the wrapper after capture
      document.body.removeChild(wrapper)

      const dataUrl = canvas.toDataURL("image/png")

      // Upload to Firebase Storage
      const certificateUrl = await uploadCertificateToStorage(dataUrl, attendee.userId || attendee.id)

      // Restore original elements
      setElements(originalelements)
      setGridColor("rgba(0, 0, 0, 0.1)")
      setRulerColor("rgba(0, 0, 0, 0.3)")

      return {
        dataUrl,
        certificateUrl,
      }
    } catch (error) {
      console.error("Error generating certificate:", error)
      // Restore original elements
      setElements(originalelements)
      setGridColor("rgba(0, 0, 0, 0.1)")
      setRulerColor("rgba(0, 0, 0, 0.3)")
      return null
    }
  }

  // Send certificates to multiple attendees
  const sendCertificatesToMultipleAttendees = async () => {
    if (!certificateRef.current || !selectedEvent || selectedAttendees.length === 0) return

    try {
      setSendingMultiple(true)
      setSendProgress({ current: 0, total: selectedAttendees.length })

      const originalElements = [...elements]

      // Hide rulers and grid
      await new Promise((resolve) => {
        setShowRulers(false)
        setShowGrid(false)
        setGridColor("rgba(0, 0, 0, 0)")
        setRulerColor("rgba(0, 0, 0, 0)")
        resolve()
      })

      // Get selected attendees data
      const attendeesToProcess = eventAttendees.filter((a) => selectedAttendees.includes(a.id))

      // Process each attendee
      for (let i = 0; i < attendeesToProcess.length; i++) {
        const attendee = attendeesToProcess[i]
        setSendProgress({ current: i + 1, total: attendeesToProcess.length })

        try {
          // Reset between attendees
          if (i > 0) {
            setElements([...originalElements])
            await new Promise((resolve) => setTimeout(resolve, 250))
          }

          // Generate and upload certificate
          const certificate = await generateCertificateForAttendeeFn(attendee)

          if (certificate && certificate.certificateUrl) {
            // Prepare email data
            const emailData = {
              email: attendee.userEmail,
              subject: `Certificate: ${selectedEvent.title}`,
              message: emailMessage || `Here is your certificate for ${selectedEvent.title}.`,
              certificateUrl: certificate.certificateUrl,
              certificateName: `${selectedEvent.title}_Certificate.png`,
              eventDetails: selectedEvent,
              name: attendee.userName || "Attendee",
              attendeeName: attendee.userName || "Attendee",
            }

            // Send email with certificate link
            await sendEmail({
              template: EmailTemplates.CERTIFICATE_EMAIL,
              data: emailData,
            })
          }
        } catch (error) {
          console.error(`Error processing attendee ${attendee.userName}:`, error)
        }
      }

      setElements([...originalElements])
      setGridColor("rgba(0, 0, 0, 0.1)")
      setRulerColor("rgba(0, 0, 0, 0.3)")

      setEmailStatus("sent")
      setTimeout(() => {
        setEmailStatus("idle")
        setSendingMultiple(false)
        setSendProgress({ current: 0, total: 0 })
      }, 3000)
    } catch (error) {
      console.error("Error sending multiple certificates:", error)
      setEmailStatus("error")
      setTimeout(() => {
        setEmailStatus("idle")
        setSendingMultiple(false)
        setSendProgress({ current: 0, total: 0 })
      }, 3000)
    }
  }

  // Save current state to history
  const saveToHistory = () => {
    const currentState = {
      elements: JSON.parse(JSON.stringify(elements)),
      backgroundImage,
      backgroundColor,
      borderStyle: JSON.parse(JSON.stringify(borderStyle)),
      certificateSize: JSON.parse(JSON.stringify(certificateSize)),
      backgroundProps: JSON.parse(JSON.stringify(backgroundProps)),
    }

    const newHistory = [...history.slice(0, historyIndex + 1), currentState]
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }

  // Load designs from Firestore
  const loadDesignsFromFirestore = async () => {
    if (!currentUser?.email) return

    try {
      const designsRef = collection(db, "certificateDesigns")

      // Query for user's own designs (both public and private)
      const userDesignsQuery = query(designsRef, where("userEmail", "==", currentUser.email), orderBy("date", "desc"))

      // Query for public designs from other users
      const publicDesignsQuery = query(
        designsRef,
        where("isPublic", "==", true),
        where("userEmail", "!=", currentUser.email),
        orderBy("userEmail"),
        orderBy("date", "desc"),
      )

      // Execute both queries
      const [userDesignsSnapshot, publicDesignsSnapshot] = await Promise.all([
        getDocs(userDesignsQuery),
        getDocs(publicDesignsQuery),
      ])

      // Process user's own designs
      const userDesigns = []
      userDesignsSnapshot.forEach((doc) => {
        userDesigns.push({
          id: doc.id,
          ...doc.data(),
          isOwner: true, // Flag to indicate this is the user's own design
        })
      })

      // Process public designs from other users
      const publicDesigns = []
      publicDesignsSnapshot.forEach((doc) => {
        publicDesigns.push({
          id: doc.id,
          ...doc.data(),
          isOwner: false, // Flag to indicate this is not the user's own design
        })
      })

      // Combine both sets of designs
      setSavedDesigns([...userDesigns, ...publicDesigns])
    } catch (error) {
      console.error("Error loading designs from Firestore:", error)
    }
  }

  // Undo function
  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1)
      const previousState = history[historyIndex - 1]
      setElements(previousState.elements)
      setBackgroundImage(previousState.backgroundImage)
      setBackgroundColor(previousState.backgroundColor)
      setBorderStyle(previousState.borderStyle)
      setCertificateSize(previousState.certificateSize)
      setBackgroundProps(previousState.backgroundProps)
    }
  }

  // Redo function
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1)
      const nextState = history[historyIndex + 1]
      setElements(nextState.elements)
      setBackgroundImage(nextState.backgroundImage)
      setBackgroundColor(nextState.backgroundColor)
      setBorderStyle(nextState.borderStyle)
      setCertificateSize(nextState.certificateSize)
      setBackgroundProps(nextState.backgroundProps)
    }
  }

  // Save current design to Firestore
  const saveCurrentDesign = async (isPublic = false) => {
    if (!currentUser?.email) return

    setSaveStatus("saving")

    try {
      // First, upload backgroundImage to Firebase Storage if it exists and is large
      let backgroundImageURL = backgroundImage

      if (backgroundImage && backgroundImage.length > 500000) {
        // If it's a large data URL
        // Convert data URL to blob
        const response = await fetch(backgroundImage)
        const blob = await response.blob()

        // Create a reference to Firebase Storage
        const storageRef = ref(storage, `certificate-backgrounds/${currentUser.email}/${currentDesignName}`)

        // Upload the image
        const uploadResult = await uploadBytes(storageRef, blob)

        // Get the download URL
        backgroundImageURL = await getDownloadURL(uploadResult.ref)
      }

      const designData = {
        name: currentDesignName,
        elements: JSON.parse(JSON.stringify(elements)),
        backgroundImage: backgroundImageURL,
        backgroundColor,
        borderStyle: JSON.parse(JSON.stringify(borderStyle)),
        certificateSize: JSON.parse(JSON.stringify(certificateSize)),
        backgroundProps: JSON.parse(JSON.stringify(backgroundProps)),
        date: new Date(),
        userEmail: currentUser.email,
        userName: currentUserData.name || "Anonymous User",
        isPublic: isPublic, // Add the privacy setting
      }

      const designsRef = collection(db, "certificateDesigns")
      const q = query(designsRef, where("userEmail", "==", currentUser.email), where("name", "==", currentDesignName))
      const querySnapshot = await getDocs(q)

      if (!querySnapshot.empty) {
        const existingDesign = querySnapshot.docs[0]
        const designRef = doc(db, "certificateDesigns", existingDesign.id)
        await updateDoc(designRef, designData)
      } else {
        await addDoc(designsRef, designData)
      }

      setSaveStatus("saved")
      loadDesignsFromFirestore()

      setTimeout(() => {
        setSaveStatus("idle")
      }, 3000)
    } catch (error) {
      console.error("Error saving design to Firestore:", error)
      setSaveStatus("error")

      setTimeout(() => {
        setSaveStatus("idle")
      }, 3000)
    }
  }

  // Add a new function to handle the save dialog using SweetAlert2
  const handleSaveDesign = () => {
    // Show a SweetAlert2 confirmation dialog with privacy options
    Swal.fire({
      title: `Save "${currentDesignName}"`,
      text: "Choose your design privacy setting",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Save as Public",
      cancelButtonText: "Save as Private",
      reverseButtons: true,
      footer:
        '<span style="font-size: 0.8rem">Public designs can be used by all users. Private designs are only visible to you.</span>',
    }).then((result) => {
      if (result.isConfirmed) {
        // Save as public
        saveCurrentDesign(true)
        Swal.fire({
          icon: "success",
          title: "Saved as public design!",
          showConfirmButton: false,
          timer: 1500,
        })
      } else if (result.dismiss === Swal.DismissReason.cancel) {
        // Save as private
        saveCurrentDesign(false)
        Swal.fire({
          icon: "success",
          title: "Saved as private design!",
          showConfirmButton: false,
          timer: 1500,
        })
      }
    })
  }

  // Export as image
  const exportAsImage = async () => {
    if (!certificateRef.current) return

    try {
      // Hide rulers and grid
      const originalRulerState = showRulers
      const originalGridState = showGrid
      setShowRulers(false)
      setShowGrid(false)

      // Wait for the UI to update
      await new Promise((resolve) => setTimeout(resolve, 200))

      // Manually apply blur to background image if needed
      let certificateToCapture = certificateRef.current

      if (backgroundImage && backgroundProps.blur > 0) {
        // Create a clone for capturing
        certificateToCapture = certificateRef.current.cloneNode(true)

        // Find the background image elements
        const bgElements = certificateToCapture.querySelectorAll('[data-background-blur="true"]')

        if (bgElements.length > 0 && blurredBackgroundImage) {
          // Replace the background image with the pre-blurred version
          bgElements.forEach((el) => {
            el.style.backgroundImage = `url(${blurredBackgroundImage})`
            el.style.filter = "none" // Remove the CSS filter
            el.style.transform = "none" // Remove the scale transform
          })
        }

        // Append to document temporarily
        certificateToCapture.style.position = "absolute"
        certificateToCapture.style.left = "-9999px"
        document.body.appendChild(certificateToCapture)
      }

      // Capture the certificate
      const canvas = await html2canvas(certificateToCapture, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: backgroundColor,
        onclone: (clonedDoc) => {
          // Process oklch colors
          convertOklchColors(clonedDoc.documentElement)

          // Ensure text elements have proper styling for export
          const textElements = clonedDoc.querySelectorAll("[data-element-id]")
          textElements.forEach((el) => {
            if (el.style) {
              el.style.overflow = "visible"
              el.style.boxSizing = "border-box"

              // For large font sizes, ensure there's enough space
              const fontSize = Number.parseInt(el.style.fontSize)
              if (fontSize >= 40) {
                el.style.padding = "40px"
                el.style.margin = "10px 0"
              }
            }
          })

          // Manually apply blur to background image if needed
          if (backgroundImage && backgroundProps.blur > 0) {
            // Find the background image elements
            const bgElements = clonedDoc.querySelectorAll('[data-background-blur="true"]')

            if (bgElements.length > 0 && blurredBackgroundImage) {
              // Replace the background image with the pre-blurred version
              bgElements.forEach((el) => {
                el.style.backgroundImage = `url(${blurredBackgroundImage})`
                el.style.filter = "none" // Remove the CSS filter
                el.style.transform = "none" // Remove the scale transform
              })
            }
          }
        },
      })

      // If we created a temporary clone, remove it
      if (certificateToCapture !== certificateRef.current) {
        document.body.removeChild(certificateToCapture)
      }

      const dataURL = canvas.toDataURL("image/png")
      const link = document.createElement("a")
      link.href = dataURL
      link.download = `${currentDesignName}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Restore original settings
      setShowRulers(originalRulerState)
      setShowGrid(originalGridState)
    } catch (error) {
      console.error("Error exporting as image:", error)
    }
  }

  // Export as PDF
  const exportAsPDF = async () => {
    if (!certificateRef.current) return

    try {
      // Hide rulers and grid
      const originalRulerState = showRulers
      const originalGridState = showGrid
      setShowRulers(false)
      setShowGrid(false)

      // Wait for the UI to update
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Manually apply blur to background image if needed
      let certificateToCapture = certificateRef.current

      if (backgroundImage && backgroundProps.blur > 0) {
        // Create a clone for capturing
        certificateToCapture = certificateRef.current.cloneNode(true)

        // Find the background image elements
        const bgElements = certificateToCapture.querySelectorAll('[data-background-blur="true"]')

        if (bgElements.length > 0 && blurredBackgroundImage) {
          // Replace the background image with the pre-blurred version
          bgElements.forEach((el) => {
            el.style.backgroundImage = `url(${blurredBackgroundImage})`
            el.style.filter = "none" // Remove the CSS filter
            el.style.transform = "none" // Remove the scale transform
          })
        }

        // Append to document temporarily
        certificateToCapture.style.position = "absolute"
        certificateToCapture.style.left = "-9999px"
        document.body.appendChild(certificateToCapture)
      }

      const canvas = await html2canvas(certificateToCapture, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: backgroundColor,
        onclone: (clonedDoc) => {
          convertOklchColors(clonedDoc.documentElement)

          // Ensure text elements have proper styling for export
          const textElements = clonedDoc.querySelectorAll("[data-element-id]")
          textElements.forEach((el) => {
            if (el.style) {
              el.style.overflow = "visible"
              el.style.boxSizing = "border-box"

              // For large font sizes, ensure there's enough space
              const fontSize = Number.parseInt(el.style.fontSize)
              if (fontSize >= 40) {
                el.style.padding = "40px"
                el.style.margin = "10px 0"
              }
            }
          })

          // Manually apply blur to background image if needed
          if (backgroundImage && backgroundProps.blur > 0) {
            // Find the background image elements
            const bgElements = clonedDoc.querySelectorAll('[data-background-blur="true"]')

            if (bgElements.length > 0 && blurredBackgroundImage) {
              // Replace the background image with the pre-blurred version
              bgElements.forEach((el) => {
                el.style.backgroundImage = `url(${blurredBackgroundImage})`
                el.style.filter = "none" // Remove the CSS filter
                el.style.transform = "none" // Remove the scale transform
              })
            }
          }
        },
      })

      // If we created a temporary clone, remove it
      if (certificateToCapture !== certificateRef.current) {
        document.body.removeChild(certificateToCapture)
      }

      const imgData = canvas.toDataURL("image/png")

      // A4 size page in jsPDF
      const pdf = new jsPDF({
        orientation: certificateSize.orientation,
        unit: "px",
        format: [certificateSize.width, certificateSize.height],
      })

      pdf.addImage(imgData, "PNG", 0, 0, certificateSize.width, certificateSize.height)
      pdf.save(`${currentDesignName}.pdf`)

      // Restore original settings
      setShowRulers(originalRulerState)
      setShowGrid(originalGridState)
    } catch (error) {
      console.error("Error exporting as PDF:", error)
    }
  }

  // Send certificate via email
  const sendCertificateEmailFn = async () => {
    if (!certificateRef.current || !recipientEmail) return

    try {
      setEmailStatus("sending")

      // Hide rulers and grid
      await new Promise((resolve) => {
        setShowRulers(false)
        setShowGrid(false)
        setGridColor("rgba(0, 0, 0, 0)")
        setRulerColor("rgba(0, 0, 0, 0)")
        resolve()
      })

      try {
        // Manually apply blur to background image if needed
        let certificateToCapture = certificateRef.current

        if (backgroundImage && backgroundProps.blur > 0) {
          // Create a clone for capturing
          certificateToCapture = certificateRef.current.cloneNode(true)

          // Find the background image elements
          const bgElements = certificateToCapture.querySelectorAll('[data-background-blur="true"]')

          if (bgElements.length > 0 && blurredBackgroundImage) {
            // Replace the background image with the pre-blurred version
            bgElements.forEach((el) => {
              el.style.backgroundImage = `url(${blurredBackgroundImage})`
              el.style.filter = "none" // Remove the CSS filter
              el.style.transform = "none" // Remove the scale transform
            })
          }

          // Append to document temporarily
          certificateToCapture.style.position = "absolute"
          certificateToCapture.style.left = "-9999px"
          document.body.appendChild(certificateToCapture)
        }

        // Capture the certificate
        const canvas = await html2canvas(certificateToCapture, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: backgroundColor,
          onclone: (clonedDoc) => {
            convertOklchColors(clonedDoc.documentElement)

            // Ensure text elements have proper styling for export
            const textElements = clonedDoc.querySelectorAll("[data-element-id]")
            textElements.forEach((el) => {
              if (el.style) {
                el.style.overflow = "visible"
                el.style.boxSizing = "border-box"

                // For large font sizes, ensure there's enough space
                const fontSize = Number.parseInt(el.style.fontSize)
                if (fontSize >= 40) {
                  el.style.padding = "40px"
                  el.style.margin = "10px 0"
                }
              }
            })

            // Manually apply blur to background image if needed
            if (backgroundImage && backgroundProps.blur > 0) {
              // Find the background image elements
              const bgElements = clonedDoc.querySelectorAll('[data-background-blur="true"]')

              if (bgElements.length > 0 && blurredBackgroundImage) {
                // Replace the background image with the pre-blurred version
                bgElements.forEach((el) => {
                  el.style.backgroundImage = `url(${blurredBackgroundImage})`
                  el.style.filter = "none" // Remove the CSS filter
                  el.style.transform = "none" // Remove the scale transform
                })
              }
            }
          },
        })

        // If we created a temporary clone, remove it
        if (certificateToCapture !== certificateRef.current) {
          document.body.removeChild(certificateToCapture)
        }

        const dataUrl = canvas.toDataURL("image/png")

        // Upload to Firebase Storage
        const certificateUrl = await uploadCertificateToStorage(dataUrl, "single-recipient")

        if (!certificateUrl) {
          throw new Error("Failed to generate certificate URL")
        }

        // Prepare email data
        const emailData = {
          email: recipientEmail || selectedAttendees[0]?.email || "",
          subject: `Certificate: ${currentDesignName}`,
          message: emailMessage || `Here is your certificate for ${selectedEvent?.title || "the event"}.`,
          certificateUrl: certificateUrl,
          certificateImageUrl: certificateUrl,
          certificateName: `${currentDesignName}.png`,
          eventDetails: selectedEvent || {
            title: currentDesignName,
            date: new Date().toLocaleDateString(),
          },
          name: elements.find((el) => el.id === "recipient-name")?.content || "Recipient",
        }

        console.log("Email data:", emailData)

        // Send email with certificate link
        await sendEmail({
          template: EmailTemplates.CERTIFICATE_EMAIL,
          data: emailData,
        })

        setEmailStatus("sent")
        setGridColor("rgba(0, 0, 0, 0.1)")
        setRulerColor("rgba(0, 0, 0, 0.3)")

        setTimeout(() => {
          setEmailStatus("idle")
        }, 3000)
      } catch (error) {
        console.error("Error capturing certificate:", error)
        setEmailStatus("error")
        setTimeout(() => {
          setEmailStatus("idle")
        }, 3000)
      }
    } catch (error) {
      console.error("Error sending certificate email:", error)
      setEmailStatus("error")
      setTimeout(() => {
        setEmailStatus("idle")
      }, 3000)
    }
  }

  // Handle mouse movement
  const handleMouseMove = (e) => {
    if (!selectedElement) return

    e.preventDefault()
    if (isDrawing) return

    if (elements.find((el) => el.id === selectedElement)?.isDragging) {
      const rect = certificateRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      // Calculate position as percentage of certificate dimensions
      const newX = (x / rect.width) * 100
      const newY = (y / rect.height) * 100

      // Ensure the element stays within bounds
      const boundedX = Math.min(100, Math.max(0, newX))
      const boundedY = Math.min(100, Math.max(0, newY))

      updateElement(selectedElement, {
        x: boundedX,
        y: boundedY,
      })
    }
  }

  // Handle certificate mouse movement
  const handleCertificateMouseMove = (e) => {
    if (showRulers) {
      const rect = certificateRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      setMousePosition({ x, y })
    }

    // Keep the existing mouse move handler functionality
    handleMouseMove(e)
  }

  // Handle mouse down
  const handleMouseDown = (e, elementId) => {
    e.preventDefault()
    e.stopPropagation()

    setSelectedElement(elementId)
    updateElement(elementId, { isDragging: true })
  }

  // Handle mouse up
  const handleMouseUp = () => {
    if (!selectedElement) return

    updateElement(selectedElement, { isDragging: false })
    saveToHistory()
  }

  // Handle certificate click
  const handleCertificateClick = (e) => {
    setSelectedElement(null)
  }

  // Update element properties
  const updateElement = (id, newProps) => {
    setElements((prevElements) =>
      prevElements.map((element) => (element.id === id ? { ...element, ...newProps } : element)),
    )
  }

  // Add new element
  const addNewElement = (type) => {
    const newElementId = `element-${Date.now()}`
    let newElement

    switch (type) {
      case "text":
        newElement = {
          id: newElementId,
          type: "text",
          content: "New Text",
          x: 50,
          y: 50,
          fontSize: 24,
          fontFamily: "sans-serif",
          color: "#000000",
          fontWeight: "normal",
          textAlign: "center",
          width: 250,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 1,
        }
        break
      case "image":
        newElement = {
          id: newElementId,
          type: "image",
          content: "/placeholder.svg",
          x: 50,
          y: 50,
          width: 100,
          height: 100,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 1,
        }
        break
      case "shape":
        newElement = {
          id: newElementId,
          type: "shape",
          shapeType: "rectangle",
          color: "#3498db",
          x: 50,
          y: 50,
          width: 100,
          height: 100,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 1,
        }
        break
      case "signature":
        newElement = {
          id: newElementId,
          type: "signature",
          content: signatureData,
          x: 50,
          y: 50,
          width: 100,
          height: 50,
          rotation: 0,
          opacity: 1,
          shadow: {
            enabled: false,
            color: "rgba(0,0,0,0.3)",
            blur: 5,
            offsetX: 2,
            offsetY: 2,
          },
          isDragging: false,
          isVisible: true,
          zIndex: 1,
        }
        break
      default:
        return
    }

    setElements((prevElements) => [...prevElements, newElement])
    setSelectedElement(newElementId)
    saveToHistory()
  }

  // Remove element
  const removeElement = (id) => {
    setElements((prevElements) => prevElements.filter((element) => element.id !== id))
    setSelectedElement(null)
    saveToHistory()
  }

  // Duplicate element
  const duplicateElement = (id) => {
    const elementToDuplicate = elements.find((element) => element.id === id)
    if (!elementToDuplicate) return

    const newElementId = `element-${Date.now()}`
    const newElement = { ...elementToDuplicate, id: newElementId }

    setElements((prevElements) => [...prevElements, newElement])
    setSelectedElement(newElementId)
    saveToHistory()
  }

  // Toggle element visibility
  const toggleElementVisibility = (id) => {
    setElements((prevElements) =>
      prevElements.map((element) => (element.id === id ? { ...element, isVisible: !element.isVisible } : element)),
    )
    saveToHistory()
  }

  // Move element layer
  const moveElementLayer = (id, direction) => {
    setElements((prevElements) => {
      const elementIndex = prevElements.findIndex((element) => element.id === id)
      if (elementIndex === -1) return prevElements

      const newElements = [...prevElements]
      const element = newElements[elementIndex]
      const newZIndex = element.zIndex || 0

      if (direction === "up") {
        element.zIndex = newZIndex + 1
      } else if (direction === "down") {
        element.zIndex = Math.max(0, newZIndex - 1)
      }

      newElements.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
      return newElements
    })
    saveToHistory()
  }

  // Update certificate size
  const updateCertificateSize = (newSize) => {
    setCertificateSize({ ...certificateSize, ...newSize })
    saveToHistory()
  }

  // Handle background upload
  const handleBackgroundUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setBackgroundImage(reader.result)

        // Ensure background blur is applied if it was previously set
        if (backgroundProps.blur > 0) {
          // Force a re-render to ensure blur is applied
          setBackgroundProps({
            ...backgroundProps,
            blur: backgroundProps.blur,
          })
        }

        saveToHistory()
      }
      reader.readAsDataURL(file)
    }
  }

  // Apply template
  const applyTemplate = (template) => {
    setBackgroundColor(template.background)
    setBorderStyle({
      color: template.border,
      width: 12,
      style: "solid",
      radius: 8,
    })
    setElements(template.elements)
    saveToHistory()
  }

  // Add the addCustomTemplate function to the main component
  // Add this function after the applyTemplate function:

  // Add custom template
  const addCustomTemplate = (template) => {
    setTemplates([...templates, template])
  }

  // Signature Pad functions
  const startDrawing = (e) => {
    setIsDrawing(true)
    const canvas = signaturePadRef.current
    const ctx = canvas.getContext("2d")
    const rect = canvas.getBoundingClientRect()

    // Calculate position relative to canvas
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    ctx.beginPath()
    ctx.moveTo(x, y)

    // Prevent scrolling while drawing
    e.preventDefault()
  }

  const draw = (e) => {
    if (!isDrawing) return

    const canvas = signaturePadRef.current
    const ctx = canvas.getContext("2d")
    const rect = canvas.getBoundingClientRect()

    // Calculate position relative to canvas
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    ctx.lineTo(x, y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x, y)

    // Prevent scrolling while drawing
    e.preventDefault()
  }

  const stopDrawing = () => {
    if (isDrawing) {
      const canvas = signaturePadRef.current
      const ctx = canvas.getContext("2d")
      ctx.closePath()
      setIsDrawing(false)

      // Update signature data
      setSignatureData(canvas.toDataURL("image/png"))
    }
  }

  const clearSignature = () => {
    const canvas = signaturePadRef.current
    const ctx = canvas.getContext("2d")
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setSignatureData(null)
  }

  const addSignature = () => {
    if (!signaturePadRef.current) return

    const canvas = signaturePadRef.current
    const dataUrl = canvas.toDataURL("image/png")
    setSignatureData(dataUrl)
    addNewElement("signature")
  }

  // Handle touch events for mobile devices
  const handleTouchStart = (e) => {
    const touch = e.touches[0]
    const mouseEvent = new MouseEvent("mousedown", {
      clientX: touch.clientX,
      clientY: touch.clientY,
    })
    startDrawing(mouseEvent)
  }

  const handleTouchMove = (e) => {
    const touch = e.touches[0]
    const mouseEvent = new MouseEvent("mousemove", {
      clientX: touch.clientX,
      clientY: touch.clientY,
    })
    draw(mouseEvent)
  }

  const handleTouchEnd = () => {
    stopDrawing()
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setSignatureData(e.target.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const generateRulerTicks = (length, horizontal) => {
    const tickCount = Math.floor(length / gridSize)
    const ticks = []

    for (let i = 0; i <= tickCount; i++) {
      const position = i * gridSize
      const isMajorTick = i % 2 === 0

      ticks.push(
        <div
          key={i}
          className={`absolute ${isMajorTick ? "bg-gray-400" : "bg-gray-300"}`}
          style={{
            left: horizontal ? `${position}px` : isMajorTick ? "0" : "15px",
            top: horizontal ? (isMajorTick ? "0" : "15px") : `${position}px`,
            width: horizontal ? "1px" : isMajorTick ? "100%" : "50%",
            height: horizontal ? (isMajorTick ? "100%" : "50%") : "1px",
          }}
        ></div>,
      )

      // Add tick labels (numbers) every 100px or at major ticks
      if (isMajorTick) {
        ticks.push(
          <div
            key={`label-${i}`}
            className="absolute text-[9px] text-gray-600 font-medium"
            style={{
              left: horizontal ? `${position + 2}px` : "2px",
              top: horizontal ? "2px" : `${position - 12}px`,
              pointerEvents: "none",
              transform: horizontal ? "none" : "rotate(-90deg)",
              transformOrigin: horizontal ? "none" : "left bottom",
            }}
          >
            {position}
          </div>,
        )
      }
    }
    return ticks
  }

  const loadDesign = (design) => {
    setCurrentDesignName(design.name)
    setElements(design.elements)
    setBackgroundImage(design.backgroundImage)
    setBackgroundColor(design.backgroundColor)
    setBorderStyle(design.borderStyle)
    setCertificateSize(design.certificateSize)

    // Ensure background props are set correctly
    if (design.backgroundProps) {
      setBackgroundProps(design.backgroundProps)
    } else {
      // Default values if not present in saved design
      setBackgroundProps({
        blur: 0,
        opacity: 1,
      })
    }

    saveToHistory()
  }

  const deleteDesignFromFirestore = async (designId, designName) => {
    if (!currentUser?.email || !designId) return

    // Find the design in the savedDesigns array
    const design = savedDesigns.find((d) => d.id === designId)

    // Check if the user is the owner of the design
    if (!design || !design.isOwner) {
      Swal.fire({
        icon: "error",
        title: "Permission Denied",
        text: "You can only delete your own designs.",
      })
      return
    }

    // Show a SweetAlert2 confirmation dialog
    Swal.fire({
      title: "Are you sure?",
      text: `Do you want to delete the design "${designName}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const designRef = doc(db, "certificateDesigns", designId)
          await deleteDoc(designRef)

          // Show success message
          Swal.fire({
            icon: "success",
            title: "Deleted!",
            text: `Design "${designName}" has been deleted.`,
            showConfirmButton: false,
            timer: 1500,
          })

          // Refresh the list of saved designs
          loadDesignsFromFirestore()
        } catch (error) {
          console.error("Error deleting design from Firestore:", error)

          // Show error message
          Swal.fire({
            icon: "error",
            title: "Error",
            text: "Failed to delete the design. Please try again.",
          })
        }
      }
    })
  }

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto gap-6 p-4">
      {/* Toolbar Component */}
      <Toolbar
        historyIndex={historyIndex}
        historyLength={history.length}
        currentDesignName={currentDesignName}
        showRulers={showRulers}
        showGrid={showGrid}
        saveStatus={saveStatus}
        selectedEvent={selectedEvent}
        userEvents={userEvents}
        isLoadingEvents={isLoadingEvents}
        handleUndo={handleUndo}
        handleRedo={handleRedo}
        setCurrentDesignName={setCurrentDesignName}
        setShowRulers={setShowRulers}
        setShowGrid={setShowGrid}
        saveCurrentDesign={handleSaveDesign} // Changed from saveCurrentDesign to handleSaveDesign
        handleEventSelect={handleEventSelect}
        exportAsImage={exportAsImage}
        exportAsPDF={exportAsPDF}
      />

      {/* Event Details Panel (when event is selected) */}
      {selectedEvent && (
        <div className="bg-blue-50 p-4 rounded-lg mb-4 border border-blue-200">
          <h3 className="font-medium text-lg mb-2">Selected Event: {selectedEvent.title}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Description:</p>
              <p className="text-sm">{selectedEvent.description}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Date & Time:</p>
              <p className="text-sm">
                {selectedEvent.date} at {selectedEvent.time}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Location:</p>
              <p className="text-sm">{selectedEvent.location}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Capacity:</p>
              <p className="text-sm">
                {selectedEvent.attendees} / {selectedEvent.capacity}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Certificate Preview Component */}
      <CertificatePreview
        certificateRef={certificateRef}
        backgroundColor={backgroundColor}
        borderStyle={borderStyle}
        certificateSize={certificateSize}
        backgroundImage={backgroundImage}
        backgroundProps={backgroundProps}
        elements={elements}
        selectedElement={selectedElement}
        showRulers={showRulers}
        showGrid={showGrid}
        gridSize={gridSize}
        gridColor={gridColor}
        rulerColor={rulerColor}
        mousePosition={mousePosition}
        handleCertificateMouseMove={handleCertificateMouseMove}
        handleMouseUp={handleMouseUp}
        handleCertificateClick={handleCertificateClick}
        handleMouseDown={handleMouseDown}
        generateRulerTicks={generateRulerTicks}
        parsePlaceholders={parsePlaceholders}
        selectedEvent={selectedEvent}
      />

      {/* Controls Panel */}
      <div className="w-full bg-gray-100 rounded-lg overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b bg-white">
          <button
            className={`flex-1 py-3 px-4 text-center ${
              activeTab === "elements" ? "border-b-2 border-blue-500 font-medium" : ""
            }`}
            onClick={() => setActiveTab("elements")}
          >
            Elements
          </button>
          <button
            className={`flex-1 py-3 px-4 text-center ${
              activeTab === "design" ? "border-b-2 border-blue-500 font-medium" : ""
            }`}
            onClick={() => setActiveTab("design")}
          >
            Design
          </button>
          <button
            className={`flex-1 py-3 px-4 text-center ${
              activeTab === "templates" ? "border-b-2 border-blue-500 font-medium" : ""
            }`}
            onClick={() => setActiveTab("templates")}
          >
            Templates
          </button>
        </div>

        <div className="p-6 overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
          {/* Elements Tab */}
          {activeTab === "elements" && (
            <ElementsSection
              elements={elements}
              selectedElement={selectedElement}
              signaturePadRef={signaturePadRef}
              isDrawing={isDrawing}
              signatureData={signatureData}
              selectedEvent={selectedEvent}
              eventAttendees={eventAttendees}
              selectedAttendees={selectedAttendees}
              emailStatus={emailStatus}
              sendingMultiple={sendingMultiple}
              sendProgress={sendProgress}
              recipientEmail={recipientEmail}
              emailMessage={emailMessage}
              isLoadingAttendees={isLoadingAttendees}
              addNewElement={addNewElement}
              setSelectedElement={setSelectedElement}
              toggleElementVisibility={toggleElementVisibility}
              duplicateElement={duplicateElement}
              removeElement={removeElement}
              startDrawing={startDrawing}
              draw={draw}
              stopDrawing={stopDrawing}
              clearSignature={clearSignature}
              addSignature={addSignature}
              handleTouchStart={handleTouchStart}
              handleTouchMove={handleTouchMove}
              handleTouchEnd={handleTouchEnd}
              handleFileUpload={handleFileUpload}
              setSelectedAttendees={setSelectedAttendees}
              sendCertificatesToMultipleAttendees={sendCertificatesToMultipleAttendees}
              setRecipientEmail={setRecipientEmail}
              setEmailMessage={setEmailMessage}
              sendCertificateEmailFn={sendCertificateEmailFn}
              updateElement={updateElement}
              moveElementLayer={moveElementLayer}
            />
          )}
          {/* Design Tab */}
          {activeTab === "design" && (
            <DesignSection
              certificateSize={certificateSize}
              backgroundColor={backgroundColor}
              backgroundImage={backgroundImage}
              backgroundProps={backgroundProps}
              borderStyle={borderStyle}
              showRulers={showRulers}
              showGrid={showGrid}
              isWhiteLines={isWhiteLines}
              gridSize={gridSize}
              updateCertificateSize={updateCertificateSize}
              setBackgroundColor={setBackgroundColor}
              handleBackgroundUpload={handleBackgroundUpload}
              setBackgroundProps={setBackgroundProps}
              setBorderStyle={setBorderStyle}
              setShowRulers={setShowRulers}
              setShowGrid={setShowGrid}
              setIsWhiteLines={setIsWhiteLines}
              setGridSize={setGridSize}
              setGridColor={setGridColor}
              setRulerColor={setRulerColor}
              saveToHistory={saveToHistory}
            />
          )}

          {/* Templates Tab */}
          {activeTab === "templates" && (
            <TemplatesSection
              templates={templates}
              savedDesigns={savedDesigns}
              applyTemplate={applyTemplate}
              loadDesign={loadDesign}
              deleteDesignFromFirestore={deleteDesignFromFirestore}
              addCustomTemplate={addCustomTemplate}
            />
          )}
          {/* Selected Element Properties */}
          {selectedElement && (
            <div className="mb-6 border-t pt-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium">Edit Element</h3>
                <div className="flex items-center">
                  <button
                    className="p-1 text-gray-500 hover:text-gray-700 mr-1"
                    onClick={() => moveElementLayer(selectedElement, "up")}
                    title="Bring Forward"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    className="p-1 text-gray-500 hover:text-gray-700 mr-1"
                    onClick={() => moveElementLayer(selectedElement, "down")}
                    title="Send Backward"
                  >
                    <ChevronDown size={16} />
                  </button>
                  <button
                    className="p-1 text-red-500 hover:text-red-700"
                    onClick={() => removeElement(selectedElement)}
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Element-specific properties would go here */}
              {/* This would be a separate component in a real implementation */}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}