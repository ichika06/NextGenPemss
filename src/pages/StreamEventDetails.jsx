import { useState, useEffect, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { doc, collection, query, where, getDocs, onSnapshot } from "firebase/firestore"
import { db } from "../firebase/config"
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Tag,
  User,
  Download,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  ImageIcon,
  Clipboard,
  QrCode,
  AlertTriangle,
} from "lucide-react"
import { LoadingAnimation } from "../components/LoadingAnimation"
import { PreRegisteredUsersModal } from "./DeletePreregistered"
import GoogleSheetsUploader from '../pages/GoogleSheetIntegration';

export default function EventDetailsDisplay() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [attendees, setAttendees] = useState([])
  const [preRegisteredUsers, setPreRegisteredUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [attendanceSheetUrl, setAttendanceSheetUrl] = useState("")
  const [eventVisible, setEventVisible] = useState(true)
  const [visibilityMessage, setVisibilityMessage] = useState("")
  const cleanupTimeoutRef = useRef(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    let eventUnsubscribe = null
    let attendeesUnsubscribe = null
    let preRegisteredUnsubscribe = null

    // Fetch the event details
    const fetchEventDetails = async () => {
      try {
        if (!eventId) {
          setError("No event ID provided")
          setLoading(false)
          return
        }

        const eventRef = doc(db, "events", eventId)

        // Setup real-time listener for the event document
        const unsubscribe = onSnapshot(
          eventRef,
          (doc) => {
            if (!doc.exists()) {
              setError("Event not found")
              setLoading(false)
              return
            }

            const eventData = {
              id: doc.id,
              ...doc.data(),
            }

            setEvent(eventData)

            // Only check if event is live - removed isPublic check
            if (!eventData.isLive) {
              setVisibilityMessage("This event is not currently live.")
              setEventVisible(false)
            } else {
              setEventVisible(true)
              setVisibilityMessage("")
            }

            setLoading(false)
          },
          (err) => {
            console.error("Error in event listener:", err)
            setError("Failed to load event data")
            setLoading(false)
          },
        )

        eventUnsubscribe = unsubscribe // Store the unsubscribe function

        // Fetch attendance sheet URL if it exists
        const docsRef = collection(db, "eventDocuments")
        const docsQuery = query(docsRef, where("eventId", "==", eventId), where("documentType", "==", "attendeeSheet"))

        const docsSnapshot = await getDocs(docsQuery)

        if (!docsSnapshot.empty) {
          const docData = docsSnapshot.docs[0].data()
          setAttendanceSheetUrl(docData.fileUrl)
        }
      } catch (err) {
        console.error("Error fetching event details:", err)
        setError("Failed to load event details")
        setLoading(false)
      }
    }

    // Set up real-time listener for attendees
    const setupAttendeesListener = () => {
      try {
        const attendeesRef = collection(db, "eventAttendees")
        const attendeesQuery = query(attendeesRef, where("eventId", "==", eventId))

        const unsubscribe = onSnapshot(
          attendeesQuery,
          (snapshot) => {
            const attendeesList = []
            snapshot.forEach((doc) => {
              attendeesList.push({
                id: doc.id,
                ...doc.data(),
              })
            })

            setAttendees(attendeesList)
          },
          (err) => {
            console.error("Error in attendees listener:", err)
            setError("Failed to load attendees data")
          },
        )

        attendeesUnsubscribe = unsubscribe // Store the unsubscribe function
        return unsubscribe
      } catch (err) {
        console.error("Error setting up attendees listener:", err)
        setError("Failed to set up real-time updates")
      }
    }

    // Set up real-time listener for pre-registered users
    const setupPreRegisteredListener = () => {
      try {
        const preRegRef = collection(db, "usersPreRegistered")
        const preRegQuery = query(preRegRef, where("eventId", "==", eventId))

        const unsubscribe = onSnapshot(
          preRegQuery,
          (snapshot) => {
            const preRegList = []
            snapshot.forEach((doc) => {
              preRegList.push({
                id: doc.id,
                ...doc.data(),
              })
            })

            setPreRegisteredUsers(preRegList)
          },
          (err) => {
            console.error("Error in pre-registered listener:", err)
            // Don't set the main error since this is not critical
            console.error("Failed to load pre-registered users data")
          },
        )

        preRegisteredUnsubscribe = unsubscribe // Store the unsubscribe function
        return unsubscribe
      } catch (err) {
        console.error("Error setting up pre-registered listener:", err)
        // Don't set the main error since this is not critical
      }
    }

    // Execute all functions
    fetchEventDetails()
    setupAttendeesListener()
    setupPreRegisteredListener()

    // Clean up listeners and timeout when component unmounts
    return () => {
      if (eventUnsubscribe) {
        eventUnsubscribe()
      }
      if (attendeesUnsubscribe) {
        attendeesUnsubscribe()
      }
      if (preRegisteredUnsubscribe) {
        preRegisteredUnsubscribe()
      }
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current)
      }
    }
  }, [eventId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <LoadingAnimation type="spinner" size="md" variant="primary" text="Loading, please wait..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-6 shadow-md">
          <div className="flex items-center">
            <AlertCircle className="h-6 w-6 text-red-500 mr-3" />
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-lg p-6 shadow-md">
          <div className="flex items-center">
            <AlertCircle className="h-6 w-6 text-yellow-500 mr-3" />
            <p className="text-yellow-700 font-medium">No event data available</p>
          </div>
        </div>
      </div>
    )
  }

  // If event is not visible, show message
  if (!eventVisible) {
    return (
      <div className="flex justify-center items-center h-screen w-screen bg-gray-50 p-4">
        <div className="border-primary rounded-lg p-6 text-center max-w-md">
          <AlertCircle className="h-6 w-6 text-gray-500 mx-auto mb-2" />
          <h2 className="font-medium text-lg text-gray-800">Event Not Available</h2>
          <p className="text-gray-600 mt-1">{visibilityMessage}</p>
        </div>
      </div>
    )
  }

  // Format date for better display if available
  const formatDate = (dateString) => {
    if (!dateString) return "TBD"
    try {
      const options = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }
      return new Date(dateString).toLocaleDateString(undefined, options)
    } catch (e) {
      return dateString
    }
  }

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "Unknown"
    try {
      // Handle both Firestore timestamps and string timestamps
      const date =
        typeof timestamp === "string"
          ? new Date(timestamp)
          : timestamp.toDate
            ? timestamp.toDate()
            : new Date(timestamp)

      return date.toLocaleString()
    } catch (e) {
      console.error("Error formatting timestamp:", e)
      return "Invalid date"
    }
  }

  // Determine if a pre-registered user has fully registered
  const hasFullyRegistered = (preRegUser) => {
    return attendees.some(
      (attendee) => attendee.userEmail === preRegUser.email || attendee.userId === preRegUser.userId,
    )
  }

  // Filter preRegisteredUsers to exclude those who are already in the attendees list
  const filteredPreRegisteredUsers = preRegisteredUsers.filter((preRegUser) => !hasFullyRegistered(preRegUser))

  // Create a merged list of attendees and filtered pre-registered users
  const mergedAttendeesList = [
    // Add fully registered attendees with proper formatting
    ...attendees.map((attendee) => ({
      ...attendee,
      type: "registered",
      name: attendee.userName,
      email: attendee.email,
      profileImage: attendee.userImageProfile,
      registrationTime: attendee.registeredAt,
      registrationMethod: attendee.registrationMethod,
      displayStatus: attendee.status || "Registered",
    })),

    // Add pre-registered users with proper formatting
    ...filteredPreRegisteredUsers.map((user) => ({
      ...user,
      type: "pre-registered",
      name: user.name,
      email: user.email,
      profileImage: user.profileImage,
      registrationTime: user.timestamp,
      registrationMethod: "Pre-registration",
      displayStatus: "Pre-registered",
    })),
  ]

  const handleDeleteSuccess = (result) => {
    console.log(`Successfully deleted ${result.count} pre-registrations`)
    // Do something with the result
  }

  // Total of all students (registered + pre-registered)
  const totalStudents = attendees.length + filteredPreRegisteredUsers.length

  const backtolast = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      window.close();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Back Button */}
        <button
          onClick={backtolast}
          className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 shadow-2xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors mb-2.5"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          <span>Back to Live events</span>
        </button>

        {/* Event Header */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="background-primary px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
              <h1 className="text-2xl md:text-3xl font-bold text-primary mb-2 sm:mb-0">{event.title}</h1>
              <div className="flex gap-2">
                <div
                  className={`px-4 py-1.5 rounded-full text-sm font-medium self-start sm:self-auto ${new Date(event.date) < new Date()
                      ? "bg-red-100 text-red-800"
                      : event.isLive
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                >
                  {new Date(event.date) < new Date() ? "Expired Event" : event.isLive ? "Live Event" : "Upcoming Event"}
                </div>
                {/* Add visibility indicator for private events */}
                {!event.isPublic && (
                  <div className="px-4 py-1.5 rounded-full text-sm font-medium bg-orange-100 text-orange-800 self-start sm:self-auto">
                    Private Event
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Event Image and Description */}
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          {event.image ? (
            <div className="md:w-1/3 rounded-lg overflow-hidden shadow-md flex-shrink-0">
              <img
                src={event.image || "/placeholder.svg"}
                alt={`${event.title} event`}
                className="w-full h-64 md:h-full object-cover"
              />
            </div>
          ) : (
            <div className="md:w-1/3 bg-purple-50 rounded-lg h-64 flex items-center justify-center flex-shrink-0">
              <div className="text-center">
                <ImageIcon className="h-12 w-12 text-purple-200 mx-auto" />
                <p className="text-purple-400 mt-2">No event image available</p>
              </div>
            </div>
          )}

          <div className="md:w-2/3">
            <p className="text-primary-secondary text-lg leading-relaxed">{event.description}</p>
          </div>
        </div>

        {/* Event Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          <div className="bg-purple-50 rounded-lg p-4 flex items-center shadow-sm">
            <div className="bg-purple-100 rounded-full p-3 mr-4 flex-shrink-0">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-primary font-medium uppercase">Date</p>
              <p className="text-gray-800 font-medium">{formatDate(event.date)}</p>
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4 flex items-center shadow-sm">
            <div className="bg-purple-100 rounded-full p-3 mr-4 flex-shrink-0">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-primary font-medium uppercase">Time</p>
              <p className="text-gray-800 font-medium">{event.time || "TBD"}</p>
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4 flex items-center shadow-sm">
            <div className="bg-purple-100 rounded-full p-3 mr-4 flex-shrink-0">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-primary font-medium uppercase">Location</p>
              <p className="text-gray-800 font-medium">{event.location || "TBD"}</p>
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4 flex items-center shadow-sm">
            <div className="bg-purple-100 rounded-full p-3 mr-4 flex-shrink-0">
              <Tag className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-primary font-medium uppercase">Category</p>
              <p className="text-gray-800 font-medium">{event.category || "Uncategorized"}</p>
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4 flex items-center shadow-sm">
            <div className="bg-purple-100 rounded-full p-3 mr-4 flex-shrink-0">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-primary font-medium uppercase">Attendees</p>
              <p className="text-gray-800 font-medium">
                {totalStudents} / {event.capacity ? event.capacity : "Unlimited"}
              </p>
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4 flex items-center shadow-sm">
            <div className="bg-purple-100 rounded-full p-3 mr-4 flex-shrink-0">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-primary font-medium uppercase">Organizer</p>
              <p className="text-gray-800 font-medium">{event.registrarName || "Unknown"}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap gap-4">
          {attendanceSheetUrl && (
            <a
              href={attendanceSheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-5 py-2.5 background-primary text-primary rounded-lg transition duration-200 shadow-md hover:shadow-lg font-medium"
            >
              <Download className="h-5 w-5 mr-2" />
              Download Attendance Sheet
            </a>
          )}

          <button
            className="inline-flex items-center px-5 py-2.5 background-primary text-primary rounded-lg transition duration-200 shadow-md hover:shadow-lg font-medium"
            onClick={() => setIsModalOpen(true)}
          >
            <Users className="h-5 w-5 mr-2" />
            Manage Pre-registrations
          </button>
        </div>

        {/* Google Sheets Upload Section - ADD THIS */}
        <div className="mt-8">
          <GoogleSheetsUploader
            attendeesData={mergedAttendeesList}
            eventTitle={event.title}
          />
        </div>

        <PreRegisteredUsersModal
          eventId={eventId}
          expirationMinutes={5}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onDelete={handleDeleteSuccess}
        />

        {/* Combined Attendees List */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mt-8">
          <div className="background-primary px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
              <h2 className="text-xl font-bold text-primary mb-2 sm:mb-0 flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Event Attendees
              </h2>
              <div className="flex flex-wrap gap-2">
                <div className="bg-white text-purple-700 border border-purple-300 font-medium px-3 py-1 rounded-full text-xs">
                  Registered: {attendees.length}
                </div>
                <div className="bg-white text-indigo-700 border border-indigo-300 font-medium px-3 py-1 rounded-full text-xs">
                  Pre-registered: {filteredPreRegisteredUsers.length}
                </div>
                <div className="bg-white text-primary font-bold px-3 py-1 rounded-full text-xs">
                  Total: {totalStudents}
                </div>
              </div>
            </div>
          </div>

          {/* Legend for status indicators */}
          <div className="bg-gray-50 p-4 flex flex-wrap items-center gap-4 justify-end border-t border-gray-100">
            <div className="flex items-center text-sm">
              <div className="w-4 h-4 rounded-full bg-white border-2 border-green-500 mr-2"></div>
              <span>Registered</span>
            </div>
            <div className="flex items-center text-sm">
              <div className="w-4 h-4 rounded-full bg-gray-100 border-2 border-indigo-400 mr-2"></div>
              <span>Pre-registered</span>
            </div>
          </div>

          {mergedAttendeesList.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="h-12 w-12 text-purple-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No students have registered for this event yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-purple-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-primary uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-primary uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-primary uppercase tracking-wider">
                      Student ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-primary uppercase tracking-wider">
                      Course
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-primary uppercase tracking-wider">
                      Registration
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-primary uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-primary uppercase tracking-wider">
                      Method
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {mergedAttendeesList.map((attendee, index) => {
                    const isRegistered = attendee.type === "registered"
                    const registrationDate = formatTimestamp(attendee.registrationTime || attendee.NFCregisteredAt)

                    return (
                      <tr
                        key={attendee.id}
                        className={`transition duration-150 ${isRegistered ? "bg-white hover:bg-purple-50" : "bg-gray-50 hover:bg-indigo-50"
                          }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {/* Status indicator dot */}
                            <div
                              className={`w-3 h-3 rounded-full mr-2 ${isRegistered
                                  ? "bg-white border-2 border-green-500"
                                  : "bg-gray-100 border-2 border-indigo-400"
                                }`}
                            ></div>

                            <div
                              className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center overflow-hidden ${isRegistered ? "bg-purple-100" : "bg-indigo-100"
                                }`}
                            >
                              {attendee.profileImage || attendee.NFCuserImageProfile ? (
                                <img
                                  src={attendee.profileImage || attendee.NFCuserImageProfile || "/placeholder.svg"}
                                  alt={attendee.profileImage || attendee.NFCuserImageProfile}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className={`font-medium ${isRegistered ? "text-primary" : "text-indigo-600"}`}>
                                  {attendee.name ? attendee.name.charAt(0).toUpperCase() : "?"}
                                </span>
                              )}
                            </div>
                            <div className="ml-4">
                              <div
                                className={`text-sm font-medium ${isRegistered ? "text-primary" : "text-gray-600"}`}
                              >
                                {attendee.name || attendee.userName || attendee.NFCuserName}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isRegistered ? "text-primary" : "text-gray-600"}`}>
                          {attendee.email || attendee.NFCregisteredByEmail || attendee.userEmail}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isRegistered ? "text-primary" : "text-gray-600"}`}>
                          {attendee.studentId || attendee.NFCuserId || attendee.userId}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isRegistered ? "text-primary" : "text-gray-600"}`}>
                          {attendee.course || attendee.NFCcourse}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${isRegistered ? "text-primary" : "text-gray-600"}`}>{registrationDate}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${isRegistered
                                ? attendee.NFCstatus === "student" || attendee.status === "student"
                                  ? "bg-green-100 text-green-800"
                                  : attendee.NFCstatus === "Pending"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-blue-100 text-blue-800"
                                : "bg-indigo-100 text-indigo-800"
                              }`}
                          >
                            {attendee.NFCstatus === "student" || attendee.status === "student"
                              ? "Registered"
                              : attendee.NFCstatus || attendee.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div
                            className={`flex items-center ${isRegistered
                                ? attendee.NFCregistrationMethod === "NFC" || attendee.registrationMethod === "QR"
                                  ? "text-primary"
                                  : "text-primary-secondary"
                                : "text-primary-secondary"
                              }`}
                          >
                            {isRegistered ? (
                              attendee.NFCregistrationMethod === "NFC" ? (
                                <>
                                  <CheckCircle className="h-4 w-4 mr-1.5" />
                                  <span>NFC Registration</span>
                                </>
                              ) : attendee.registrationMethod === "QR" ? (
                                <>
                                  <QrCode className="h-4 w-4 mr-1.5" />
                                  <span>QR Registration</span>
                                </>
                              ) : attendee.registrationMethod === "HW-NFC" ? (
                                <>
                                  <Clipboard className="h-4 w-4 mr-1.5" />
                                  <span>HW Registration</span>
                                </>
                              ) : (
                                <>
                                  <User className="h-4 w-4 mr-1.5" />
                                  <span>WIFI Registration</span>
                                </>
                              )
                            ) : (
                              <>
                                <AlertTriangle className="h-4 w-4 mr-1.5" />
                                <span>Pre-registration</span>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}