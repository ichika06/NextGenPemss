/**
 * ViewEvent component displays details of a specific event including attendees and event information.
 * @returns JSX element containing event details and attendee information.
 */
import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore"
import { db } from "../firebase/config"
import { useAuth } from "../contexts/AuthContext"
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Calendar,
  Clock,
  MapPin,
  Users,
  Globe,
  Lock,
  User,
  Tag,
  AlertCircle,
  Loader2,
  Info,
  Search,
  ChevronUp,
  ChevronDown,
} from "lucide-react"
import * as XLSX from "xlsx"

export default function ViewEvent() {
  const { eventId } = useParams()
  const { currentUser, userRole } = useAuth()
  const navigate = useNavigate()

  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [fileData, setFileData] = useState(null)
  const [worksheetData, setWorksheetData] = useState([])
  const [fileName, setFileName] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "ascending" })

  // Fetch event and file data
  useEffect(() => {
    async function fetchEventData() {
      if (!currentUser) {
        navigate("/login")
        return
      }

      try {
        setLoading(true)

        // Get event details
        const eventRef = doc(db, "events", eventId)
        const eventSnap = await getDoc(eventRef)

        if (!eventSnap.exists()) {
          setError("Event not found")
          setLoading(false)
          return
        }

        const eventData = { id: eventSnap.id, ...eventSnap.data() }

        // Check if user has permission to view this event
        const isCreator = eventData.registrarId === currentUser.uid
        const isAdmin = userRole === "admin"
        const isPublic = eventData.isPublic

        if (!isCreator && !isAdmin && !isPublic) {
          setError("You don't have permission to view this event")
          setLoading(false)
          return
        }

        setEvent(eventData)

        // Get event documents
        const docsRef = collection(db, "eventDocuments")
        const docsQuery = query(docsRef, where("eventId", "==", eventId))
        const docsSnapshot = await getDocs(docsQuery)

        // Find attendance sheet document
        const attendeeSheet = docsSnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .find((doc) => doc.documentType === "attendeeSheet")

        if (!attendeeSheet || !attendeeSheet.fileUrl) {
          // No attendance sheet found, don't show error just leave the table empty
          setLoading(false)
          return
        }

        setFileName(attendeeSheet.fileName || "attendees.xlsx")

        try {
          // Download the file from Firebase Storage
          const response = await fetch(attendeeSheet.fileUrl)
          const fileBlob = await response.blob()

          // Read the Excel file
          const fileReader = new FileReader()
          fileReader.onload = (e) => {
            try {
              const data = new Uint8Array(e.target.result)
              const workbook = XLSX.read(data, { type: "array" })
              const sheetName = workbook.SheetNames[0]
              const worksheet = workbook.Sheets[sheetName]

              // Convert to JSON
              const jsonData = XLSX.utils.sheet_to_json(worksheet)

              setFileData(fileBlob)
              setWorksheetData(jsonData)
            } catch (err) {
              console.error("Error reading Excel file:", err)
              setError("Failed to read attendance data. The file might be corrupted.")
            }
          }

          fileReader.readAsArrayBuffer(fileBlob)
        } catch (err) {
          console.error("Error downloading file:", err)
          setError("Failed to download attendance sheet.")
        }
      } catch (err) {
        console.error("Error fetching event data:", err)
        setError("Failed to load event data. Please try again.")
      } finally {
        setLoading(false)
      }
    }

    fetchEventData()
  }, [eventId, currentUser, navigate, userRole])

  // Handle file download
  const handleDownload = () => {
    if (!fileData) return

    const url = URL.createObjectURL(fileData)
    const link = document.createElement("a")
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Function to determine the dashboard route based on user role
  const getRoute = (userRole) => {
    switch (userRole) {
      case "admin":
        return "/admin/manage-events"
      case "registrar":
        return "/registrar/manage-events"
      case "teacher":
        return "/teacher/manage-events"
      case "student":
        return "/student/manage-events"
      default:
        return "/events"
    }
  }

  // Filter data based on search term
  const filteredData = worksheetData.filter((row) => {
    if (!searchTerm) return true

    // Search in all fields
    return Object.values(row).some((value) => String(value).toLowerCase().includes(searchTerm.toLowerCase()))
  })

  // Sort data
  const requestSort = (key) => {
    let direction = "ascending"
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending"
    }
    setSortConfig({ key, direction })
  }

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortConfig.key) return 0

    const aValue = a[sortConfig.key]
    const bValue = b[sortConfig.key]

    if (aValue < bValue) {
      return sortConfig.direction === "ascending" ? -1 : 1
    }
    if (aValue > bValue) {
      return sortConfig.direction === "ascending" ? 1 : -1
    }
    return 0
  })

  // Format date to more readable form
  const formatDate = (dateString) => {
    if (!dateString) return ""
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    } catch (e) {
      return dateString
    }
  }

  return (
    <div
      className="p-3 sm:p-6 max-w-7xl mx-auto bg-[#f5ffff] min-h-screen"
      style={{ fontFamily: "'Poppins', sans-serif" }}
    >
      {/* Custom animations */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideIn {
          from { transform: translateX(-20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }
        
        .animate-slideIn {
          animation: slideIn 0.5s ease-out forwards;
        }
        
        .btn-gradient {
          background: linear-gradient(135deg, #0093cb 0%, #005acd 100%);
          transition: all 0.3s ease;
        }
        
        .btn-gradient:hover {
          background: linear-gradient(135deg, #005acd 0%, #0076e0 100%);
          transform: translateY(-2px) scale(1.03);
          box-shadow: 0 10px 15px -3px rgba(0, 90, 205, 0.2), 0 4px 6px -2px rgba(0, 90, 205, 0.1);
        }
        
        .glass-effect {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        .glass-card {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1);
        }
        
        .transparent-header {
          background: rgba(190, 240, 255, 0.7);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        
        .hover-lift {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        
        .hover-lift:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 25px -5px rgba(0, 90, 205, 0.1), 0 10px 10px -5px rgba(0, 90, 205, 0.04);
        }
        
        .input-animated {
          transition: all 0.3s ease;
        }
        
        .input-animated:focus {
          transform: scale(1.01);
          box-shadow: 0 0 0 3px rgba(0, 147, 203, 0.2);
        }
      `}</style>

      {/* Header with back button */}
      <div className="flex flex-wrap items-center gap-2 mb-4 sm:mb-6 animate-slideIn">
        <button
          onClick={() => navigate(getRoute(userRole))}
          className="p-2 rounded-full bg-white shadow-sm hover:bg-[#bef0ff] transition-all duration-300 transform hover:scale-105"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-[#0093cb]" />
        </button>
        <h1
          className="text-xl sm:text-2xl md:text-3xl font-bold text-[#172b4d]"
          style={{ fontFamily: "'Rowdies', sans-serif" }}
        >
          View Event
        </h1>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-[#ffebe6] border-l-4 border-[#ff5630] text-[#5e6c84] p-4 rounded-lg mb-6 shadow-sm animate-fadeIn">
          <div className="flex">
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5 text-[#ff5630]" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col justify-center items-center h-64 glass-card rounded-[1rem] shadow-sm animate-fadeIn">
          <Loader2 className="h-10 w-10 text-[#0093cb] animate-spin mb-4" />
          <p className="text-[#5e6c84]">Loading event data...</p>
        </div>
      ) : event ? (
        <>
          {/* Event Details */}
          <div
            className="glass-card rounded-[1rem] shadow-sm border border-[#e0e6ed] mb-6 overflow-hidden hover-lift animate-fadeIn"
            style={{ animationDelay: "0.1s" }}
          >
            <div className="transparent-header p-4 sm:p-6 border-b border-[#e0e6ed]">
              <h2
                className="text-lg sm:text-xl font-semibold text-[#172b4d] mb-1"
                style={{ fontFamily: "'Open Sans', sans-serif" }}
              >
                Event Details
              </h2>
              <p className="text-[#5e6c84] text-xs sm:text-sm">View information about this event</p>
            </div>
            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-1 gap-4 md:gap-6">
                {/* Left column */}
                <div className="animate-fadeIn" style={{ animationDelay: "0.2s" }}>
                  {/* Event Image */}
                  {event.image && (
                    <div className="mb-4 sm:mb-6 animate-fadeIn" style={{ animationDelay: "0.3s" }}>
                      <img
                        src={event.image || "/placeholder.svg"}
                        alt={`${event.title}`}
                        className="w-full h-auto rounded-[0.75rem] shadow-sm object-cover hover-lift"
                        style={{ maxHeight: "250px" }}
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-4">
                    <div className="animate-fadeIn" style={{ animationDelay: "0.4s" }}>
                      <h3
                        className="text-2xl font-bold text-[#172b4d] mb-2"
                        style={{ fontFamily: "'Open Sans', sans-serif" }}
                      >
                        {event.title}
                      </h3>
                      <p className="text-[#5e6c84] leading-relaxed">{event.description}</p>
                    </div>

                    <div
                      className="grid grid-cols-1 xs:grid-cols-2 gap-3 sm:gap-4 bg-[#f5ffff] p-3 sm:p-5 rounded-lg mt-2 border border-[#e0e6ed] animate-fadeIn"
                      style={{ animationDelay: "0.5s" }}
                    >
                      <div className="flex items-start animate-fadeIn" style={{ animationDelay: "0.6s" }}>
                        <Calendar className="h-5 w-5 mr-3 text-[#0093cb] mt-0.5" />
                        <div>
                          <p className="text-sm text-[#5e6c84] mb-1">Date</p>
                          <p className="font-medium text-[#172b4d]">{formatDate(event.date)}</p>
                        </div>
                      </div>
                      <div className="flex items-start animate-fadeIn" style={{ animationDelay: "0.7s" }}>
                        <Clock className="h-5 w-5 mr-3 text-[#0093cb] mt-0.5" />
                        <div>
                          <p className="text-sm text-[#5e6c84] mb-1">Time</p>
                          <p className="font-medium text-[#172b4d]">{event.time}</p>
                        </div>
                      </div>
                      <div className="flex items-start animate-fadeIn" style={{ animationDelay: "0.8s" }}>
                        <MapPin className="h-5 w-5 mr-3 text-[#0093cb] mt-0.5" />
                        <div>
                          <p className="text-sm text-[#5e6c84] mb-1">Location</p>
                          <p className="font-medium text-[#172b4d]">{event.location}</p>
                        </div>
                      </div>
                      <div className="flex items-start animate-fadeIn" style={{ animationDelay: "0.9s" }}>
                        <Users className="h-5 w-5 mr-3 text-[#0093cb] mt-0.5" />
                        <div>
                          <p className="text-sm text-[#5e6c84] mb-1">Capacity</p>
                          <p className="font-medium text-[#172b4d]">{event.capacity || "Unlimited"}</p>
                        </div>
                      </div>
                      <div className="flex items-start animate-fadeIn" style={{ animationDelay: "1s" }}>
                        <Users className="h-5 w-5 mr-3 text-[#0093cb] mt-0.5" />
                        <div>
                          <p className="text-sm text-[#5e6c84] mb-1">Code Access</p>
                          <p className="font-medium text-[#172b4d]">{event.eventCode}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right column */}
                <div className="animate-fadeIn" style={{ animationDelay: "0.6s" }}>
                  <div className="flex flex-col gap-3 sm:gap-5">
                    <div
                      className="flex items-center glass-effect p-3 sm:p-4 rounded-lg border border-[#e0e6ed] shadow-sm hover-lift animate-fadeIn"
                      style={{ animationDelay: "0.7s" }}
                    >
                      {event.isPublic ? (
                        <>
                          <div className="bg-[#e6f7ff] p-1.5 sm:p-2 rounded-full mr-3 sm:mr-4">
                            <Globe className="h-5 w-5 sm:h-6 sm:w-6 text-[#0093cb]" />
                          </div>
                          <div>
                            <p className="font-medium text-[#0093cb] text-base sm:text-lg">Public Event</p>
                            <p className="text-xs sm:text-sm text-[#5e6c84]">This event is visible to all users</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="bg-gray-100 p-1.5 sm:p-2 rounded-full mr-3 sm:mr-4">
                            <Lock className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-700 text-base sm:text-lg">Private Event</p>
                            <p className="text-xs sm:text-sm text-[#5e6c84]">
                              This event is only visible to selected users
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    <div
                      className="flex items-center glass-effect p-3 sm:p-4 rounded-lg border border-[#e0e6ed] hover-lift animate-fadeIn"
                      style={{ animationDelay: "0.8s" }}
                    >
                      <div className="bg-[#bef0ff] p-1.5 sm:p-2 rounded-full mr-3 sm:mr-4">
                        <Tag className="h-5 w-5 text-[#0093cb]" />
                      </div>
                      <div>
                        <p className="text-sm text-[#5e6c84] mb-1">Category</p>
                        <p className="font-medium text-[#172b4d] text-lg">{event.category || "Uncategorized"}</p>
                      </div>
                    </div>

                    <div
                      className="flex items-center glass-effect p-3 sm:p-4 rounded-lg border border-[#e0e6ed] hover-lift animate-fadeIn"
                      style={{ animationDelay: "0.9s" }}
                    >
                      <div className="bg-[#bef0ff] p-1.5 sm:p-2 rounded-full mr-3 sm:mr-4">
                        <User className="h-5 w-5 text-[#0093cb]" />
                      </div>
                      <div>
                        <p className="text-sm text-[#5e6c84] mb-1 capitalize">{userRole}</p>
                        <p className="font-medium text-[#172b4d] text-lg">{event.registrarName || "Unknown"}</p>
                      </div>
                    </div>

                    {event.createdAt && (
                      <div
                        className="text-sm text-[#5e6c84] mt-2 p-3 bg-[#f5ffff] rounded-lg border border-[#e0e6ed] hover-lift animate-fadeIn"
                        style={{ animationDelay: "1s" }}
                      >
                        <p className="font-medium">Created on</p>
                        <p>{formatDate(event.createdAt)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Attendees Table */}
          <div
            className="glass-card rounded-[1rem] shadow-sm border border-[#e0e6ed] overflow-hidden hover-lift animate-fadeIn"
            style={{ animationDelay: "0.3s" }}
          >
            <div className="transparent-header p-4 sm:p-6 border-b border-[#e0e6ed] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2
                  className="text-lg sm:text-xl font-semibold text-[#172b4d] mb-1"
                  style={{ fontFamily: "'Open Sans', sans-serif" }}
                >
                  Attendees
                </h2>
                <p className="text-[#5e6c84] text-xs sm:text-sm">View all registered attendees for this event</p>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                {fileData && (
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center px-3 sm:px-4 py-2 sm:py-2.5 rounded-[0.5rem] text-sm font-medium text-white transition-all duration-300 shadow-md w-full sm:w-auto justify-center btn-gradient"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Excel
                  </button>
                )}
              </div>
            </div>

            {/* Search bar */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-[#e0e6ed] bg-[#f5ffff]">
              <div className="relative w-full max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="search"
                  placeholder="Search attendees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-9 sm:pl-10 pr-3 py-2 sm:py-2.5 border border-[#e0e6ed] rounded-[0.5rem] leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-[#0093cb] focus:border-[#0093cb] text-sm shadow-sm input-animated"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                {worksheetData.length === 0 ? (
                  <div className="p-6 sm:p-12 text-center animate-fadeIn">
                    <div className="bg-[#f5ffff] p-3 sm:p-4 rounded-full w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <FileSpreadsheet className="h-8 w-8 sm:h-10 sm:w-10 text-[#0093cb]" />
                    </div>
                    <h3
                      className="text-base sm:text-lg font-medium text-[#172b4d] mb-1 sm:mb-2"
                      style={{ fontFamily: "'Open Sans', sans-serif" }}
                    >
                      No attendance data available
                    </h3>
                    <p className="text-xs sm:text-sm text-[#5e6c84] max-w-md mx-auto">
                      There are no attendees registered for this event yet, or the attendance sheet hasn't been created.
                    </p>
                  </div>
                ) : (
                  <div className="relative overflow-x-auto shadow-sm">
                    <table className="min-w-full divide-y divide-[#e0e6ed] table-fixed sm:table-auto">
                      <thead className="bg-[#f5ffff]">
                        <tr>
                          {Object.keys(worksheetData[0]).map((key) => (
                            <th
                              key={key}
                              scope="col"
                              className="px-3 sm:px-6 py-2.5 sm:py-3.5 text-left text-xs font-medium text-[#5e6c84] uppercase tracking-wider cursor-pointer hover:bg-[#bef0ff] transition-colors truncate"
                              onClick={() => requestSort(key)}
                              style={{ fontFamily: "'Open Sans', sans-serif" }}
                            >
                              <div className="flex items-center">
                                <span className="truncate max-w-[100px] sm:max-w-none">{key}</span>
                                {sortConfig.key === key ? (
                                  <span className="ml-1 flex-shrink-0">
                                    {sortConfig.direction === "ascending" ? (
                                      <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4 text-[#0093cb]" />
                                    ) : (
                                      <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 text-[#0093cb]" />
                                    )}
                                  </span>
                                ) : null}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-[#e0e6ed]">
                        {sortedData.map((row, rowIndex) => (
                          <tr
                            key={rowIndex}
                            className="hover:bg-[#f5ffff] transition-colors animate-fadeIn"
                            style={{ animationDelay: `${0.05 * rowIndex}s` }}
                          >
                            {Object.keys(row).map((key, cellIndex) => (
                              <td
                                key={`${rowIndex}-${cellIndex}`}
                                className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-[#172b4d] truncate"
                              >
                                {row[key]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Info footer */}
            <div className="px-4 sm:px-6 py-3 sm:py-4 bg-[#f5ffff] border-t border-[#e0e6ed] text-xs sm:text-sm text-[#5e6c84] rounded-b-xl flex items-center">
              <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 text-[#0093cb]" />
              {worksheetData.length === 0
                ? "No attendees have registered for this event yet."
                : `Showing ${sortedData.length} of ${worksheetData.length} attendees`}
            </div>
          </div>
        </>
      ) : (
        <div className="glass-card rounded-[1rem] p-6 sm:p-12 text-center shadow-sm border border-[#e0e6ed] animate-fadeIn">
          <div className="bg-[#ffebe6] p-3 sm:p-4 rounded-full w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center mx-auto mb-3 sm:mb-4">
            <AlertCircle className="h-8 w-8 sm:h-10 sm:w-10 text-[#ff5630]" />
          </div>
          <h3
            className="text-lg sm:text-xl font-medium text-[#172b4d] mb-2"
            style={{ fontFamily: "'Open Sans', sans-serif" }}
          >
            Event not found
          </h3>
          <p className="text-sm text-[#5e6c84] max-w-md mx-auto mb-4 sm:mb-6">
            The event you're looking for doesn't exist or you don't have permission to view it.
          </p>
          <button
            onClick={() => navigate(getRoute(userRole))}
            className="inline-flex items-center px-4 sm:px-5 py-2 sm:py-2.5 border border-transparent text-sm font-medium rounded-[0.5rem] shadow-md text-white btn-gradient"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Events
          </button>
        </div>
      )}
    </div>
  )
}

