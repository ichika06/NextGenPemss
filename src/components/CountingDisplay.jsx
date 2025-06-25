import { useState, useEffect, useRef } from "react"
import { Calendar, BarChart2, X, BellRing } from "lucide-react"
import { collection, query, where, onSnapshot } from "firebase/firestore" 

const CountdownDisplay = ({
  eventId,
  eventDate,
  eventTime,
  className = "",
  showSeconds = true,
  startedText = "Event has started",
  errorText = "Date or time not set",
  isPublic = true,
  isLive = true,
  eventDurationHours = 24, // This prop is now ignored, but kept for backward compatibility
  unavailableText = "This event is not available",
  expiredText,
  eventTitle = "Event",
  eventAnalytics = {
    registrations: 0,
    views: 0,
    engagement: 20,
  },
  detailsOnClick = true,
  db, // Firestore database instance
  totalCapacity = 100, // New prop for total capacity
}) => {
  const [countdownDisplay, setCountdownDisplay] = useState("")
  const [showPopup, setShowPopup] = useState(false)
  const [eventStatus, setEventStatus] = useState("upcoming") // 'upcoming', 'live', 'ended'
  const [eventStartDate, setEventStartDate] = useState(null)
  const [weeklyEngagementData, setWeeklyEngagementData] = useState(generateDefaultChartData())
  const popupRef = useRef(null)
  const containerRef = useRef(null)
  const [isMobile, setIsMobile] = useState(false)
  const [unsubscribe, setUnsubscribe] = useState(null) // Store unsubscribe function

  // Support the old expiredText prop for backward compatibility
  const finalUnavailableText = expiredText || unavailableText

  // Check if device is mobile based on screen width
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 640) // Consider mobile if less than 640px (typical sm breakpoint)
    }

    // Check initially
    checkIfMobile()

    // Add event listener for window resize
    window.addEventListener("resize", checkIfMobile)

    // Clean up
    return () => window.removeEventListener("resize", checkIfMobile)
  }, [])

  // Close popup when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        popupRef.current &&
        !popupRef.current.contains(event.target) &&
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setShowPopup(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [popupRef, containerRef])

  // Format engagement data
  const formatEngagementData = (engagement) => {
    if (typeof engagement === "number") {
      return engagement
    }
    return 0
  }

  // Format views data
  const formatViewsCount = (views) => {
    if (Array.isArray(views)) {
      return views.length
    }
    return views || 0
  }

  // Add a new state for processed analytics
  const [processedAnalytics, setProcessedAnalytics] = useState({
    registrations: eventAnalytics.registrations || 0,
    views: formatViewsCount(eventAnalytics.views),
    engagement: formatEngagementData(eventAnalytics.engagement),
  })

  // Improved generateWeeklyEngagementData function with better date handling
  const generateWeeklyEngagementData = (attendees) => {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    // Create dates without time components for more accurate comparison
    const today = new Date()
    today.setHours(23, 59, 59, 999) // End of today

    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(today.getDate() - 6)
    oneWeekAgo.setHours(0, 0, 0, 0) // Start of day 7 days ago

    // Initialize data structure for the past 7 days
    const weekDays = []
    for (let i = 6; i >= 0; i--) {
      const day = new Date()
      day.setDate(today.getDate() - i)
      day.setHours(0, 0, 0, 0) // Start of day

      const endOfDay = new Date(day)
      endOfDay.setHours(23, 59, 59, 999) // End of day

      weekDays.push({
        date: day,
        endOfDay: endOfDay,
        name: dayNames[day.getDay()],
        value: 0,
      })
    }

    // Count registrations per day
    attendees.forEach((attendee) => {
      if (!attendee.registeredAt || !(attendee.registeredAt instanceof Date)) {
        console.log("Skipping invalid date:", attendee.registeredAt)
        return // Skip invalid dates
      }

      // Check if the registration date is within the past 7 days
      if (attendee.registeredAt >= oneWeekAgo && attendee.registeredAt <= today) {
        // Find which day this registration belongs to
        const dayIndex = weekDays.findIndex(
          (day) => attendee.registeredAt >= day.date && attendee.registeredAt <= day.endOfDay,
        )

        if (dayIndex !== -1) {
          weekDays[dayIndex].value += 1
        }
      } else {
        console.log("Registration outside of date range:", attendee.registeredAt)
      }
    })

    // Return the weekly data with day names and values
    return weekDays.map((day) => ({
      name: day.name,
      value: day.value,
    }))
  }

  // Modified fetchWeeklyEngagementData function to use onSnapshot instead of getDocs
  const setupEngagementDataListener = () => {
    if (!db || !eventId) {
      console.log("Missing db or eventId, using default data")
      return
    }

    try {
      // Query the eventAttendees collection for entries matching the eventId
      const attendeesRef = collection(db, "eventAttendees")
      const q = query(attendeesRef, where("eventId", "==", eventId))
      
      // Set up a real-time listener with onSnapshot
      const unsubscribeListener = onSnapshot(q, (querySnapshot) => {
        // Process registeredAt dates to generate weekly data
        const attendees = []
        let totalAttendees = 0

        querySnapshot.forEach((doc) => {
          const data = doc.data()
          totalAttendees++

          if (data.registeredAt) {
            // Properly parse the ISO string date format
            // This handles both Firestore timestamps and ISO string formats
            const registeredAtDate =
              typeof data.registeredAt === "string"
                ? new Date(data.registeredAt)
                : data.registeredAt.toDate
                  ? data.registeredAt.toDate()
                  : new Date(data.registeredAt)

            attendees.push({
              ...data,
              registeredAt: registeredAtDate,
            })
          }
        })

        // Generate weekly engagement data from the registeredAt dates
        const weeklyData = generateWeeklyEngagementData(attendees)

        // Make sure we update the state with the new data
        setWeeklyEngagementData(weeklyData)

        // Calculate registrations (use the count from Firebase or from props)
        const registrationCount = Math.max(totalAttendees, processedAnalytics.registrations)

        // Calculate engagement as the percentage of capacity that has registered
        const engagementPercentage = totalCapacity > 0 ? Math.round((registrationCount / totalCapacity) * 100) : 0

        // Update the processed analytics with the new values
        setProcessedAnalytics((prev) => ({
          ...prev,
          registrations: registrationCount,
          engagement: engagementPercentage,
        }))
      }, (error) => {
        console.error("Error setting up engagement data listener:", error)
      })
      
      // Store the unsubscribe function
      setUnsubscribe(() => unsubscribeListener)
      
      return unsubscribeListener
    } catch (error) {
      console.error("Error setting up event attendees listener:", error)
    }
  }

  // Set up and clean up the listener when popup is shown/hidden
  useEffect(() => {
    if (showPopup) {
      const unsubscribeListener = setupEngagementDataListener()
      
      // Clean up listener when popup is closed or component unmounts
      return () => {
        if (unsubscribeListener) {
          unsubscribeListener()
        }
      }
    } else if (unsubscribe) {
      // Clean up existing listener when popup is closed
      unsubscribe()
      setUnsubscribe(null)
    }
  }, [showPopup, eventId, db, totalCapacity])

  useEffect(() => {
    if (!eventDate || !eventTime) {
      setCountdownDisplay(errorText)
      return
    }

    // Create a date object for the event start
    const [year, month, day] = eventDate.split("-").map(Number)

    // Parse time with AM/PM support
    let hours = 0
    let minutes = 0

    // Check if time contains AM/PM
    if (eventTime.toLowerCase().includes("am") || eventTime.toLowerCase().includes("pm")) {
      const isPM = eventTime.toLowerCase().includes("pm")
      const timeParts = eventTime
        .replace(/\s?[APap][Mm]\s?/g, "")
        .split(":")
        .map(Number)

      hours = timeParts[0]
      minutes = timeParts[1] || 0

      // Adjust hours for PM
      if (isPM && hours < 12) {
        hours += 12
      }
      // Adjust for 12 AM
      if (!isPM && hours === 12) {
        hours = 0
      }
    } else {
      // Simple HH:MM format
      ;[hours, minutes] = eventTime.split(":").map(Number)
    }

    const eventStartDateTime = new Date(year, month - 1, day, hours, minutes)
    setEventStartDate(eventStartDateTime)

    // MODIFIED: Calculate event end time as 11:59 PM of the same day
    const eventEndDateTime = new Date(year, month - 1, day, 23, 59, 59, 999)

    // Function to update the countdown
    const updateCountdown = () => {
      const currentTime = new Date()

      // If the event is not public or not live, it's unavailable
      if (!isPublic || !isLive) {
        setEventStatus("unavailable")
        return finalUnavailableText
      }

      // Calculate the difference in milliseconds to event start
      const timeToStart = eventStartDateTime - currentTime

      // Calculate the difference in milliseconds to event end
      const timeToEnd = eventEndDateTime - currentTime

      // If the event has ended
      if (timeToEnd < 0) {
        setEventStatus("ended")
        return finalUnavailableText
      }

      // If the event has already started but not ended
      if (timeToStart < 0 && timeToEnd > 0) {
        setEventStatus("live")
        return startedText
      }

      // Event is upcoming
      setEventStatus("upcoming")

      // Calculate days, hours, minutes and seconds until start
      const days = Math.floor(timeToStart / (1000 * 60 * 60 * 24))
      const hours = Math.floor((timeToStart % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((timeToStart % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((timeToStart % (1000 * 60)) / 1000)

      // Format the output based on the time left
      if (days > 0) {
        return `${days} day${days !== 1 ? "s" : ""}, ${hours} hr${hours !== 1 ? "s" : ""}`
      } else if (hours > 0) {
        return `${hours} hr${hours !== 1 ? "s" : ""}, ${minutes} min${minutes !== 1 ? "s" : ""}`
      } else if (minutes > 0) {
        if (showSeconds) {
          return `${minutes} min${minutes !== 1 ? "s" : ""}, ${seconds} sec${seconds !== 1 ? "s" : ""}`
        } else {
          return `${minutes} minute${minutes !== 1 ? "s" : ""} remaining`
        }
      } else {
        return `${seconds} second${seconds !== 1 ? "s" : ""} remaining`
      }
    }

    // Initial update
    setCountdownDisplay(updateCountdown())

    // Set up an interval to update the countdown every second
    const countdownInterval = setInterval(() => {
      const newCountdown = updateCountdown()
      setCountdownDisplay(newCountdown)

      // If the event is no longer available, clear the interval
      if (newCountdown === finalUnavailableText && eventStatus === "ended") {
        clearInterval(countdownInterval)
      }
    }, 1000)

    // Clean up interval on component unmount
    return () => clearInterval(countdownInterval)
  }, [
    eventDate,
    eventTime,
    showSeconds,
    startedText,
    errorText,
    isPublic,
    isLive,
    eventDurationHours, // Still included for backward compatibility
    finalUnavailableText,
    eventStatus,
  ])

  // Format date for display
  const formatDate = (date) => {
    if (!date) return "Unknown"

    const options = {
      weekday: "short",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }

    return date.toLocaleDateString(undefined, options)
  }

  // Handler for clicking on countdown
  const handleCountdownClick = () => {
    if (detailsOnClick) {
      setShowPopup(!showPopup)
    }
  }

  // Get status color
  const getStatusColor = () => {
    switch (eventStatus) {
      case "live":
        return "bg-green-100 text-green-800"
      case "upcoming":
        return "bg-blue-100 text-blue-800"
      case "ended":
        return "bg-gray-100 text-gray-800"
      case "unavailable":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  // Get status text
  const getStatusText = () => {
    switch (eventStatus) {
      case "live":
        return "Live Now"
      case "upcoming":
        return "Coming Soon"
      case "ended":
        return "Ended"
      case "unavailable":
        return "Unavailable"
      default:
        return "Unknown"
    }
  }

  // Calculate capacity percentage for display
  const getCapacityPercentage = () => {
    return Math.min(100, Math.round((processedAnalytics.registrations / totalCapacity) * 100))
  }

  // Enhanced popup positioning for better mobile experience
  const getPopupPositionStyles = () => {
    if (isMobile) {
      return {
        position: "fixed",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        maxWidth: "90vw",
        width: "300px",
        maxHeight: "80vh",
        overflowY: "auto",
      }
    } else {
      return {
        right: "150%",
        top: "-100px",
      }
    }
  }

  // Add backdrop for mobile popup
  const renderBackdrop = () => {
    if (showPopup && isMobile) {
      return <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={() => setShowPopup(false)} />
    }
    return null
  }

  return (
    <div className="relative inline-block" ref={containerRef}>
      {renderBackdrop()}

      <span
        className={`${detailsOnClick ? "cursor-pointer hover:underline" : ""} ${className} transition-colors duration-200`}
        onClick={handleCountdownClick}
      >
        {countdownDisplay}
      </span>

      {showPopup && (
        <div
          ref={popupRef}
          className="absolute z-50 mt-2 w-72 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 p-4"
          style={getPopupPositionStyles()}
        >
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-gray-900">{eventTitle}</h3>
            <button
              onClick={() => setShowPopup(false)}
              className="text-gray-400 hover:text-gray-500 rounded-full p-1 hover:bg-gray-100 transition-colors duration-200"
              aria-label="Close popup"
            >
              <X size={18} />
            </button>
          </div>

          <div className="space-y-3">
            {/* Status badge */}
            <div className="flex justify-between items-center">
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor()}`}>
                {getStatusText()}
              </span>
              <span className="text-xs text-gray-500">
                Capacity: {getCapacityPercentage()}% ({processedAnalytics.registrations}/{totalCapacity})
              </span>
            </div>

            {/* Date and time */}
            <div className="flex items-center text-sm text-gray-600 bg-gray-50 p-2 rounded">
              <Calendar size={16} className="mr-2 flex-shrink-0 text-gray-500" />
              <span>{eventStartDate ? formatDate(eventStartDate) : "Date not set"}</span>
            </div>

            {/* Event analytics */}
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="bg-gray-50 p-2 rounded text-center">
                <div className="text-xs text-gray-500">Registrations</div>
                <div className="text-lg font-medium">{processedAnalytics.registrations}</div>
              </div>
              <div className="bg-gray-50 p-2 rounded text-center">
                <div className="text-xs text-gray-500">Views</div>
                <div className="text-lg font-medium">{processedAnalytics.views}</div>
              </div>
              <div className="bg-gray-50 p-2 rounded text-center">
                <div className="text-xs text-gray-500">Capacity</div>
                <div className="text-lg font-medium">{getCapacityPercentage()}%</div>
              </div>
            </div>

            {/* Capacity progress bar */}
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Registration Progress</span>
                <span>
                  {processedAnalytics.registrations}/{totalCapacity}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    getCapacityPercentage() > 80
                      ? "bg-green-500"
                      : getCapacityPercentage() > 50
                        ? "bg-blue-500"
                        : "bg-blue-400"
                  }`}
                  style={{ width: `${getCapacityPercentage()}%` }}
                ></div>
              </div>
            </div>

            {/* Analytics chart */}
            <div className="mt-4">
              <div className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <BarChart2 size={16} className="mr-2 flex-shrink-0 text-gray-500" />
                <span>Registered Engagement</span>
              </div>
              <EventChart data={weeklyEngagementData} />
            </div>

            {/* Reminder button */}
            <button className="w-full mt-3 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-md transition-colors duration-200">
              <BellRing size={16} />
              <span>Set Reminder</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Generate default chart data when no real data is available
 */
const generateDefaultChartData = () => {
  return [
    { name: "Mon", value: Math.floor(Math.random() * 5) },
    { name: "Tue", value: Math.floor(Math.random() * 5) },
    { name: "Wed", value: Math.floor(Math.random() * 5) },
    { name: "Thu", value: Math.floor(Math.random() * 5) },
    { name: "Fri", value: Math.floor(Math.random() * 5) },
    { name: "Sat", value: Math.floor(Math.random() * 5) },
    { name: "Sun", value: Math.floor(Math.random() * 5) },
  ]
}

/**
 * Improved chart component for the event popup with better bar visualization
 */
const EventChart = ({ data }) => {
  // Ensure we have actual data
  if (!data || data.length === 0) {
    data = generateDefaultChartData()
  }

  // Find the maximum value in the data (with a minimum of 1 to avoid division by zero)
  const maxValue = Math.max(...data.map((item) => item.value), 1)

  return (
    <div className="w-full h-36 flex items-end space-x-1">
      {data.map((item, index) => {
        // Calculate percentage height (minimum 5% if value > 0, 1% if value = 0)
        const heightPercent = Math.max((item.value / maxValue) * 100, item.value > 0 ? 5 : 1)

        return (
          <div key={index} className="flex flex-col items-center flex-1">
            <div className="flex-1 w-full flex flex-col justify-end h-24">
              <div
                className={`w-full ${
                  item.value > 0 ? (item.value === maxValue ? "bg-blue-600" : "bg-blue-500") : "bg-gray-200"
                } rounded-t transition-all duration-300`}
                style={{
                  height: `${heightPercent}%`,
                  minHeight: "4px",
                }}
              ></div>
            </div>
            <div className="text-xs text-gray-500 mt-1">{item.name}</div>
            <div className="text-xs font-medium">{item.value}</div>
          </div>
        )
      })}
    </div>
  )
}

export default CountdownDisplay