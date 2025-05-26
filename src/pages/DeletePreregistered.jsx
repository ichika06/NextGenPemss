"use client"

import { useState, useEffect, useMemo } from "react"
import { collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore"
import { db } from "../firebase/config"
import {
  AlertCircle,
  Trash2,
  Clock,
  X,
  RefreshCw,
  Users,
  UserCheck,
  UserX,
  Calendar,
  Mail,
  Search,
  ChevronDown,
  ChevronUp,
  Filter,
  Download,
  BarChart3,
  Info,
} from "lucide-react"

/**
 * Function to delete all expired pre-registered users for a specific event
 * @param {string} eventId - ID of the event to check pre-registrations for
 * @param {number} expirationMinutes - Minutes after which pre-registration expires (default: 5)
 * @returns {Promise<{success: boolean, count: number}>} Result of the operation
 */
export async function deleteAllExpiredPreRegistrations(eventId, expirationMinutes = 5) {
  if (!eventId) {
    return { success: false, count: 0, error: "No event ID provided" }
  }

  try {
    // Fetch pre-registered users
    const preRegisteredRef = collection(db, "usersPreRegistered")
    const q = query(preRegisteredRef, where("eventId", "==", eventId))
    const querySnapshot = await getDocs(q)

    const expiredUsers = []
    querySnapshot.forEach((docSnapshot) => {
      const userData = docSnapshot.data()
      if (isExpired(userData, expirationMinutes)) {
        expiredUsers.push({
          id: docSnapshot.id,
          ...userData,
        })
      }
    })

    // Delete each expired user
    await Promise.all(expiredUsers.map((user) => deleteDoc(doc(db, "usersPreRegistered", user.id))))

    return { success: true, count: expiredUsers.length }
  } catch (err) {
    console.error("Error deleting expired pre-registrations:", err)
    return { success: false, count: 0, error: err.message }
  }
}

/**
 * Function to delete a specific pre-registered user by ID
 * @param {string} userId - ID of the pre-registered user to delete
 * @returns {Promise<{success: boolean, error?: string}>} Result of the operation
 */
export async function deletePreRegisteredUser(userId) {
  if (!userId) {
    return { success: false, error: "No user ID provided" }
  }

  try {
    // Delete the document
    await deleteDoc(doc(db, "usersPreRegistered", userId))

    return { success: true }
  } catch (err) {
    console.error("Error deleting pre-registered user:", err)
    return { success: false, error: err.message }
  }
}

/**
 * Helper function to check if a pre-registration is expired
 */
function isExpired(userData, expirationMinutes = 5) {
  try {
    // Extract the necessary fields
    const { timestamp, eventTime, eventDate } = userData

    if (!timestamp || !eventTime || !eventDate) return false

    // Parse the timestamp (e.g., "2025-04-12T10:39:55.670Z")
    const registrationTime = new Date(timestamp)

    // Parse the event date and time
    const eventDateTime = parseEventDateTime(eventTime, eventDate)
    if (!eventDateTime) return false

    // Add the expiration minutes to the event time
    const expirationDateTime = new Date(eventDateTime)
    expirationDateTime.setMinutes(eventDateTime.getMinutes() + expirationMinutes)

    // Get current time
    const now = new Date()

    // Registration is expired if current time is after expiration time
    return now > expirationDateTime
  } catch (err) {
    console.error("Error checking if registration is expired:", err)
    return false
  }
}

/**
 * Helper function to parse event date and time
 */
function parseEventDateTime(timeString, dateString) {
  try {
    if (!timeString || !dateString) return null

    // Parse time string (e.g., "6:07 PM")
    const [timePart, ampm] = timeString.split(" ")
    let [hours, minutes] = timePart.split(":").map(Number)

    // Convert to 24-hour format
    if (ampm.toUpperCase() === "PM" && hours < 12) {
      hours += 12
    } else if (ampm.toUpperCase() === "AM" && hours === 12) {
      hours = 0
    }

    // Parse date string (e.g., "2025-04-13")
    const [year, month, day] = dateString.split("-").map(Number)

    // Create a date object using the specified date and time
    const eventDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0)
    return eventDateTime
  } catch (err) {
    console.error("Error parsing event date and time:", err)
    return null
  }
}

// Simple bar chart component
function BarChartComponent({ data, title }) {
  const maxValue = Math.max(...data.map((item) => item.value))

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
      <h3 className="text-sm font-semibold mb-4 text-gray-700">{title}</h3>
      <div className="space-y-2">
        {data.map((item, index) => (
          <div key={index} className="space-y-1">
            <div className="flex justify-between text-xs text-gray-600">
              <span>{item.label}</span>
              <span className="font-medium">{item.value}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5">
              <div
                className="bg-purple-600 h-2.5 rounded-full"
                style={{ width: `${(item.value / maxValue) * 100}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Simple pie chart component
function PieChartComponent({ data, title }) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  let startAngle = 0

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
      <h3 className="text-sm font-semibold mb-4 text-gray-700">{title}</h3>
      <div className="flex items-center justify-center">
        <div className="relative w-32 h-32">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {data.map((item, index) => {
              const percentage = (item.value / total) * 100
              const angle = (percentage / 100) * 360
              const endAngle = startAngle + angle
              const largeArcFlag = angle > 180 ? 1 : 0

              // Calculate coordinates for the path
              const x1 = 50 + 50 * Math.cos((Math.PI * startAngle) / 180)
              const y1 = 50 + 50 * Math.sin((Math.PI * startAngle) / 180)
              const x2 = 50 + 50 * Math.cos((Math.PI * endAngle) / 180)
              const y2 = 50 + 50 * Math.sin((Math.PI * endAngle) / 180)

              // Create the path
              const path = `M 50 50 L ${x1} ${y1} A 50 50 0 ${largeArcFlag} 1 ${x2} ${y2} Z`

              const result = (
                <path
                  key={index}
                  d={path}
                  fill={item.color}
                  stroke="#fff"
                  strokeWidth="1"
                  className="transition-all duration-300 hover:opacity-80"
                />
              )

              startAngle = endAngle
              return result
            })}
          </svg>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {data.map((item, index) => (
          <div key={index} className="flex items-center text-xs">
            <div className="w-3 h-3 rounded-sm mr-2" style={{ backgroundColor: item.color }}></div>
            <span className="text-gray-700">
              {item.label} ({Math.round((item.value / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Modal component to manage and delete expired pre-registered users for events
 * @param {Object} props - Component props
 * @param {string} props.eventId - ID of the event to check pre-registrations for
 * @param {number} props.expirationMinutes - Minutes after which pre-registration expires (default: 5)
 * @param {boolean} props.isOpen - Whether the modal is visible
 * @param {function} props.onClose - Function to call when closing the modal
 * @param {function} props.onDelete - Optional callback function after successful deletion
 * @returns JSX element for managing pre-registered users as a modal
 */
export function PreRegisteredUsersModal({ eventId, expirationMinutes = 5, isOpen, onClose, onDelete }) {
  const [preRegisteredUsers, setPreRegisteredUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [deletingUsers, setDeletingUsers] = useState({})
  const [lastChecked, setLastChecked] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortConfig, setSortConfig] = useState({ key: "timestamp", direction: "desc" })
  const [showCharts, setShowCharts] = useState(true)
  const [activeTab, setActiveTab] = useState("all") // 'all', 'active', 'expired'

  // Format timestamp for display
  const formatTimestamp = (timestamp, type) => {
    if (!timestamp) return "N/A"

    try {
      const date = new Date(timestamp)

      if (type === "time") {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      } else {
        return date.toLocaleDateString()
      }
    } catch (err) {
      console.error("Error formatting timestamp:", err)
      return "Invalid date"
    }
  }

  // Fetch pre-registered users for the specified event
  const fetchPreRegisteredUsers = async () => {
    if (!eventId) {
      setError("No event ID provided")
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const preRegisteredRef = collection(db, "usersPreRegistered")
      const q = query(preRegisteredRef, where("eventId", "==", eventId))
      const querySnapshot = await getDocs(q)

      const users = []
      querySnapshot.forEach((doc) => {
        const userData = doc.data()

        // Determine if the pre-registration is expired
        const expired = isExpired(userData, expirationMinutes)

        users.push({
          id: doc.id,
          ...userData,
          isExpired: expired,
        })
      })

      setPreRegisteredUsers(users)
      setLastChecked(new Date())
      setLoading(false)
    } catch (err) {
      console.error("Error fetching pre-registered users:", err)
      setError("Failed to load pre-registered users")
      setLoading(false)
    }
  }

  // Delete a specific pre-registered user
  const deletePreRegisteredUser = async (userId) => {
    try {
      setDeletingUsers((prev) => ({ ...prev, [userId]: true }))

      // Delete the document
      await deleteDoc(doc(db, "usersPreRegistered", userId))

      // Update the local state
      setPreRegisteredUsers((prev) => prev.filter((user) => user.id !== userId))

      setDeletingUsers((prev) => ({ ...prev, [userId]: false }))

      // Call the onDelete callback if provided
      if (onDelete) {
        onDelete({ success: true, count: 1 })
      }
    } catch (err) {
      console.error("Error deleting pre-registered user:", err)
      setDeletingUsers((prev) => ({ ...prev, [userId]: false }))
    }
  }

  // Delete all expired pre-registered users
  const deleteAllExpiredUsers = async () => {
    const expiredUsers = preRegisteredUsers.filter((user) => user.isExpired)

    try {
      // Mark all as deleting
      const deletingObj = {}
      expiredUsers.forEach((user) => {
        deletingObj[user.id] = true
      })
      setDeletingUsers((prev) => ({ ...prev, ...deletingObj }))

      // Delete each expired user
      await Promise.all(expiredUsers.map((user) => deleteDoc(doc(db, "usersPreRegistered", user.id))))

      // Update local state
      setPreRegisteredUsers((prev) => prev.filter((user) => !user.isExpired))

      // Reset deleting state
      setDeletingUsers({})

      // Call the onDelete callback if provided
      if (onDelete) {
        onDelete({ success: true, count: expiredUsers.length })
      }
    } catch (err) {
      console.error("Error deleting expired users:", err)
      setDeletingUsers({})
    }
  }

  // Handle sorting
  const requestSort = (key) => {
    let direction = "asc"
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc"
    }
    setSortConfig({ key, direction })
  }

  // Filter and sort users
  const filteredAndSortedUsers = useMemo(() => {
    // First filter by search term
    let filteredUsers = preRegisteredUsers.filter((user) => {
      const searchLower = searchTerm.toLowerCase()
      return (
        (user.name && user.name.toLowerCase().includes(searchLower)) ||
        (user.email && user.email.toLowerCase().includes(searchLower))
      )
    })

    // Then filter by tab
    if (activeTab === "active") {
      filteredUsers = filteredUsers.filter((user) => !user.isExpired)
    } else if (activeTab === "expired") {
      filteredUsers = filteredUsers.filter((user) => user.isExpired)
    }

    // Then sort
    return [...filteredUsers].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === "asc" ? -1 : 1
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === "asc" ? 1 : -1
      }
      return 0
    })
  }, [preRegisteredUsers, searchTerm, sortConfig, activeTab])

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!preRegisteredUsers.length) return null

    // Status distribution
    const statusData = [
      {
        label: "Active",
        value: preRegisteredUsers.filter((user) => !user.isExpired).length,
        color: "#8b5cf6", // purple-500
      },
      {
        label: "Expired",
        value: preRegisteredUsers.filter((user) => user.isExpired).length,
        color: "#ef4444", // red-500
      },
    ]

    // Registration time distribution (by hour)
    const timeDistribution = {}
    preRegisteredUsers.forEach((user) => {
      if (user.timestamp) {
        const date = new Date(user.timestamp)
        const hour = date.getHours()
        const hourLabel = `${hour}:00 - ${hour + 1}:00`

        if (!timeDistribution[hourLabel]) {
          timeDistribution[hourLabel] = 0
        }
        timeDistribution[hourLabel]++
      }
    })

    const timeData = Object.entries(timeDistribution)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => {
        const hourA = Number.parseInt(a.label.split(":")[0])
        const hourB = Number.parseInt(b.label.split(":")[0])
        return hourA - hourB
      })

    return {
      statusData,
      timeData,
    }
  }, [preRegisteredUsers])

  // Check for expired registrations every minute
  useEffect(() => {
    if (!isOpen) return

    const updateExpirationStatus = () => {
      setPreRegisteredUsers((prev) =>
        prev.map((user) => ({
          ...user,
          isExpired: isExpired(user, expirationMinutes),
        })),
      )
    }

    // Initial fetch when modal opens and is visible
    fetchPreRegisteredUsers()

    // Set up interval to periodically check for expired registrations
    const intervalId = setInterval(() => {
      updateExpirationStatus()
    }, 60000)

    return () => clearInterval(intervalId)
  }, [eventId, isOpen, expirationMinutes])

  // If modal is not open, don't render anything
  if (!isOpen) return null

  // Count expired users
  const expiredCount = preRegisteredUsers.filter((user) => user.isExpired).length
  const activeCount = preRegisteredUsers.length - expiredCount

  // Export data as CSV
  const exportToCSV = () => {
    const headers = ["Name", "Email", "Registration Time", "Registration Date", "Event Date/Time", "Status"]
    const csvData = filteredAndSortedUsers.map((user) => [
      user.name || "N/A",
      user.email || "N/A",
      formatTimestamp(user.timestamp, "time"),
      formatTimestamp(user.timestamp, "date"),
      `${user.eventDate} ${user.eventTime}`,
      user.isExpired ? "Expired" : "Active",
    ])

    const csvContent = [headers, ...csvData].map((row) => row.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `pre-registered-users-${eventId}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="bg-purple-600 px-6 py-4 rounded-t-xl flex justify-between items-center">
          <div className="flex items-center">
            <Users className="h-6 w-6 text-white mr-3" />
            <h2 className="text-xl font-bold text-white">Pre-registered Users Management</h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-purple-500 transition-colors text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {error ? (
            <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          ) : loading ? (
            <div className="text-center py-12">
              <div className="relative w-16 h-16 mx-auto mb-6">
                <div className="absolute inset-0 bg-purple-100 rounded-full animate-ping opacity-75"></div>
                <div className="relative flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full">
                  <RefreshCw className="h-8 w-8 animate-spin text-purple-600" />
                </div>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Users</h3>
              <p className="text-gray-500">Please wait while we fetch the pre-registered users...</p>
            </div>
          ) : preRegisteredUsers.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-sm">
              <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <UserX className="h-10 w-10 text-purple-500" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-gray-900">No Pre-registered Users</h3>
              <p className="text-gray-500 max-w-md mx-auto">There are no pre-registered users for this event yet.</p>
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-xl shadow-sm p-4 border border-purple-100">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4">
                      <Users className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Pre-registrations</p>
                      <p className="text-2xl font-bold text-gray-900">{preRegisteredUsers.length}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-4 border border-green-100">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                      <UserCheck className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Active Pre-registrations</p>
                      <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-4 border border-red-100">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                      <UserX className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Expired Pre-registrations</p>
                      <p className="text-2xl font-bold text-gray-900">{expiredCount}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Charts Section */}
              {chartData && showCharts && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                      <BarChart3 className="h-5 w-5 mr-2 text-purple-600" />
                      Data Visualization
                    </h3>
                    <button onClick={() => setShowCharts(false)} className="text-sm text-gray-500 hover:text-gray-700">
                      Hide Charts
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <PieChartComponent data={chartData.statusData} title="Registration Status" />
                    {chartData.timeData.length > 0 && (
                      <BarChartComponent data={chartData.timeData} title="Registration Time Distribution" />
                    )}
                  </div>
                </div>
              )}

              {!showCharts && (
                <button
                  onClick={() => setShowCharts(true)}
                  className="flex items-center text-purple-600 hover:text-purple-800 mb-6 text-sm font-medium"
                >
                  <BarChart3 className="h-4 w-4 mr-1" />
                  Show Data Visualization
                </button>
              )}

              {/* Controls */}
              <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border border-gray-200">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="h-4 w-4 mr-2 text-purple-500" />
                    Last checked: {lastChecked?.toLocaleTimeString()}
                    {expiredCount > 0 && (
                      <span className="ml-2 text-red-600 font-medium">
                        ({expiredCount} expired {expiredCount === 1 ? "registration" : "registrations"})
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={fetchPreRegisteredUsers}
                      className="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium flex items-center hover:bg-purple-200 transition-colors"
                    >
                      <RefreshCw className="h-4 w-4 mr-1.5" />
                      Refresh
                    </button>

                    <button
                      onClick={exportToCSV}
                      className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium flex items-center hover:bg-blue-200 transition-colors"
                    >
                      <Download className="h-4 w-4 mr-1.5" />
                      Export CSV
                    </button>

                    {expiredCount > 0 && (
                      <button
                        onClick={deleteAllExpiredUsers}
                        className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium flex items-center hover:bg-red-200 transition-colors"
                      >
                        <Trash2 className="h-4 w-4 mr-1.5" />
                        Delete Expired ({expiredCount})
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Filters and Search */}
              <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border border-gray-200">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1 text-sm text-gray-600">
                      <Filter className="h-4 w-4" />
                      <span>Filter:</span>
                    </div>
                    <div className="flex rounded-lg overflow-hidden border border-gray-300">
                      <button
                        onClick={() => setActiveTab("all")}
                        className={`px-3 py-2 text-sm font-medium ${
                          activeTab === "all" ? "bg-purple-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        All ({preRegisteredUsers.length})
                      </button>
                      <button
                        onClick={() => setActiveTab("active")}
                        className={`px-3 py-2 text-sm font-medium ${
                          activeTab === "active"
                            ? "bg-purple-600 text-white"
                            : "bg-white text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        Active ({activeCount})
                      </button>
                      <button
                        onClick={() => setActiveTab("expired")}
                        className={`px-3 py-2 text-sm font-medium ${
                          activeTab === "expired"
                            ? "bg-purple-600 text-white"
                            : "bg-white text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        Expired ({expiredCount})
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
                {filteredAndSortedUsers.length === 0 ? (
                  <div className="p-6 text-center">
                    <Info className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No users match your search criteria</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr className="bg-gray-50">
                          <th
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => requestSort("name")}
                          >
                            <div className="flex items-center">
                              <span>User Name</span>
                              {sortConfig.key === "name" && (
                                <span className="ml-1">
                                  {sortConfig.direction === "asc" ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => requestSort("email")}
                          >
                            <div className="flex items-center">
                              <span>Email</span>
                              {sortConfig.key === "email" && (
                                <span className="ml-1">
                                  {sortConfig.direction === "asc" ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </span>
                              )}
                            </div>
                          </th>
                          <th
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                            onClick={() => requestSort("timestamp")}
                          >
                            <div className="flex items-center">
                              <span>Registration Time</span>
                              {sortConfig.key === "timestamp" && (
                                <span className="ml-1">
                                  {sortConfig.direction === "asc" ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </span>
                              )}
                            </div>
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Registration Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Event Date/Time
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredAndSortedUsers.map((user, index) => (
                          <tr
                            key={user.id}
                            className={`hover:bg-gray-50 transition duration-150 ${
                              user.isExpired ? "bg-red-50" : index % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                            }`}
                          >
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-medium">
                                  {user.name ? user.name.charAt(0).toUpperCase() : "?"}
                                </div>
                                <div className="ml-3">
                                  <p className="text-sm font-medium text-gray-900">{user.name || "N/A"}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center text-sm text-gray-600">
                                <Mail className="h-4 w-4 text-gray-400 mr-2" />
                                {user.email || "N/A"}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                              <div className="flex items-center">
                                <Clock className="h-4 w-4 text-gray-400 mr-2" />
                                {formatTimestamp(user.timestamp, "time")}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                              <div className="flex items-center">
                                <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                                {formatTimestamp(user.timestamp, "date")}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                              {user.eventDate} {user.eventTime}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  user.isExpired ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
                                }`}
                              >
                                {user.isExpired ? "Expired" : "Active"}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => deletePreRegisteredUser(user.id)}
                                disabled={deletingUsers[user.id]}
                                className={`inline-flex items-center px-3 py-1.5 rounded-lg ${
                                  deletingUsers[user.id]
                                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                    : "bg-red-50 text-red-700 hover:bg-red-100"
                                }`}
                              >
                                {deletingUsers[user.id] ? (
                                  <>
                                    <div className="animate-spin h-4 w-4 border-2 border-red-200 border-t-red-600 rounded-full mr-1.5"></div>
                                    Deleting...
                                  </>
                                ) : (
                                  <>
                                    <Trash2 className="h-4 w-4 mr-1.5" />
                                    Delete
                                  </>
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-100 px-6 py-4 rounded-b-xl border-t border-gray-200">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
