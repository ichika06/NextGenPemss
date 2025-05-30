import { useState, useEffect } from "react"
import { getAuth, onAuthStateChanged } from "firebase/auth"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "../firebase/config"
import UserDetailsModal from "./showAllusersdetails"
import { Search } from "lucide-react"
import defaultProfile from '../assets/Default_Profile.jpg'

export default function UserRegistrationManagement() {
  const [currentUser, setCurrentUser] = useState(null)
  const [viewMode, setViewMode] = useState("myCreatedUsers")
  const [securityPin, setSecurityPin] = useState("")
  const [accessGranted, setAccessGranted] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [myCreatedUsers, setMyCreatedUsers] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchField, setSearchField] = useState("email")

  // Authentication listener
  useEffect(() => {
    const auth = getAuth()
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user)
        fetchMyCreatedUsers(user.email)
      } else {
        setCurrentUser(null)
        setMyCreatedUsers([])
      }
    })

    return () => unsubscribe()
  }, [])

  // Fetch users created by current user
  const fetchMyCreatedUsers = async (email) => {
    setLoading(true)
    try {
      const userQuery = query(collection(db, "users"), where("addedby", "==", email))

      const querySnapshot = await getDocs(userQuery)
      const users = []

      querySnapshot.forEach((doc) => {
        users.push({
          id: doc.id,
          ...doc.data(),
          avatar: "/placeholder.svg?height=40&width=40",
        })
      })

      setMyCreatedUsers(users)
      setLoading(false)
    } catch (error) {
      console.error("Error fetching user data:", error)
      setError("Failed to load user data")
      setLoading(false)
    }
  }

  // Fetch all users when access is granted
  const fetchAllUsers = async () => {
    setLoading(true)
    try {
      const querySnapshot = await getDocs(collection(db, "users"))
      const users = []

      querySnapshot.forEach((doc) => {
        users.push({
          id: doc.id,
          ...doc.data(),
          avatar: "/placeholder.svg?height=40&width=40",
        })
      })

      setAllUsers(users)
      setLoading(false)
    } catch (error) {
      console.error("Error fetching all users:", error)
      setError("Failed to load all user data")
      setLoading(false)
    }
  }

  const handleRequestAccess = () => {
    setIsDialogOpen(true)
    setError("")
  }

  const handleShowAllUsers = () => {
    if (accessGranted) {
      setViewMode("allUsers")
    } else {
      handleRequestAccess()
    }
  }

  const handleVerifyPin = () => {
    if (securityPin === "1234") {
      setAccessGranted(true)
      setViewMode("allUsers")
      setIsDialogOpen(false)
      setError("")
      fetchAllUsers()
    } else {
      setError("Invalid security pin. Please try again.")
    }
  }

  // Filter users based on search query and field
  const filterUsers = (users) => {
    if (!searchQuery.trim()) return users;
    
    return users.filter(user => {
      // Convert search value to lowercase for case-insensitive comparison
      const searchValue = searchQuery.toLowerCase();
      
      // Search by selected field
      if (searchField === "email" && user.email) {
        return user.email.toLowerCase().includes(searchValue);
      } else if (searchField === "studentId" && user.studentId) {
        return user.studentId.toLowerCase().includes(searchValue);
      } else if (searchField === "employeeId" && user.employeeId) {
        return user.employeeId.toLowerCase().includes(searchValue);
      } else if (searchField === "adminId" && user.adminId) {
        return user.adminId.toLowerCase().includes(searchValue);
      } else if (searchField === "teacherId" && user.teacherId) {
        return user.teacherId.toLowerCase().includes(searchValue);
      }
      
      return false;
    });
  };

  // Determine which users to show based on access, view mode, and search
  const usersToShow = filterUsers(viewMode === "allUsers" && accessGranted ? allUsers : myCreatedUsers)

  // Format date for display
  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A"

    // Handle different timestamp formats
    let date
    if (timestamp.toDate && typeof timestamp.toDate === "function") {
      // Firestore Timestamp
      date = timestamp.toDate()
    } else if (timestamp instanceof Date) {
      date = timestamp
    } else if (typeof timestamp === "string") {
      date = new Date(timestamp)
    } else {
      return "Invalid date"
    }

    return date.toISOString().split("T")[0]
  }

  const handleViewDetails = (user) => {
    setSelectedUser(user)
    setIsModalOpen(true)
  }


  return (
    <div className="container mx-auto py-6 px-4 min-h-screen">

      <div className="flex flex-col space-y-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <h1 className="text-3xl font-bold text-gray-800">User Management</h1>
            <div className="flex flex-wrap gap-3">
              <button
                className={`px-4 py-2 rounded-md transition-colors ${
                  viewMode === "allUsers"
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-white text-gray-800 border border-gray-300 hover:bg-gray-50"
                }`}
                onClick={handleShowAllUsers}
              >
                Show All Users
              </button>
              <button
                className={`px-4 py-2 rounded-md transition-colors ${
                  viewMode === "myCreatedUsers"
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-white text-gray-800 border border-gray-300 hover:bg-gray-50"
                }`}
                onClick={() => setViewMode("myCreatedUsers")}
              >
                Users I Created
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="md:w-48">
                <select
                  value={searchField}
                  onChange={(e) => setSearchField(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="email">Email</option>
                  <option value="studentId">Student ID</option>
                  <option value="employeeId">Employee ID</option>
                  <option value="adminId">Admin ID</option>
                  <option value="teacherId">Teacher ID</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : usersToShow.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-lg border border-gray-200">
              <p className="text-gray-500 text-lg">
                {searchQuery 
                  ? "No users match your search criteria." 
                  : viewMode === "myCreatedUsers" 
                    ? "You haven't created any users yet." 
                    : "No users found in the system."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {usersToShow.map((user) => (
                <div
                  key={user.id}
                  className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200 hover:shadow-md transition-shadow"
                >
                  {/* User Card - Vertical Layout */}
                  <div className="flex flex-col p-5">
                    {/* Profile Image - Centered */}
                    <div className="flex justify-center mb-4">
                      <div className="h-20 w-20 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200">
                        <img
                          src={user.profileImage || defaultProfile}
                          alt={user.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </div>

                    {/* User Info - Centered */}
                    <div className="text-center mb-4">
                      <h3 className="text-xl font-semibold text-gray-800">{user.name}</h3>
                      <div className="flex items-center justify-center mt-1 text-gray-500 text-sm">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3 w-3 mr-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                        {user.email}
                      </div>

                      {/* Role Badge */}
                      {user.role && (
                        <span className="inline-flex items-center px-2.5 py-0.5 mt-2 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                          {user.role}
                        </span>
                      )}
                    </div>

                    {/* Additional Info */}
                    <div className="space-y-2 border-t border-gray-100 pt-4 mb-4">
                      {user.addedBy && (
                        <div className="text-sm flex justify-between">
                          <span className="font-medium text-gray-600">Added by:</span>
                          <span className="text-gray-700">{user.addedBy}</span>
                        </div>
                      )}
                      {user.createdAt && (
                        <div className="text-sm flex justify-between">
                          <span className="font-medium text-gray-600">Created:</span>
                          <span className="text-gray-700">{formatDate(user.createdAt)}</span>
                        </div>
                      )}
                      
                      {/* Display ID fields if they exist */}
                      {user.studentId && (
                        <div className="text-sm flex justify-between">
                          <span className="font-medium text-gray-600">Student ID:</span>
                          <span className="text-gray-700">{user.studentId}</span>
                        </div>
                      )}
                      {user.employeeId && (
                        <div className="text-sm flex justify-between">
                          <span className="font-medium text-gray-600">Employee ID:</span>
                          <span className="text-gray-700">{user.employeeId}</span>
                        </div>
                      )}
                      {user.adminId && (
                        <div className="text-sm flex justify-between">
                          <span className="font-medium text-gray-600">Admin ID:</span>
                          <span className="text-gray-700">{user.adminId}</span>
                        </div>
                      )}
                      {user.teacherId && (
                        <div className="text-sm flex justify-between">
                          <span className="font-medium text-gray-600">Teacher ID:</span>
                          <span className="text-gray-700">{user.teacherId}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-between mt-auto pt-4 border-t border-gray-100">
                      <button
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium py-1 px-3 rounded-md hover:bg-blue-50 transition-colors"
                        onClick={() => handleViewDetails(user)}
                      >
                        View Details
                      </button>
                      {user.addedBy === currentUser?.email && (
                        <button className="text-sm text-red-600 hover:text-red-800 font-medium py-1 px-3 rounded-md hover:bg-red-50 transition-colors">
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {viewMode === "myCreatedUsers" && !accessGranted && (
            <div className="flex justify-center mt-8">
              <button
                className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-sm"
                onClick={handleRequestAccess}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                Request Access to All Users
              </button>
            </div>
          )}
        </div>

        {isDialogOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900">Security Verification</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Enter the security PIN to access all users. Contact your administrator if you don't have a PIN.
                </p>
                <div className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="pin" className="block text-sm font-medium text-gray-700">
                      Security PIN
                    </label>
                    <input
                      id="pin"
                      type="password"
                      placeholder="Enter security PIN"
                      value={securityPin}
                      onChange={(e) => setSecurityPin(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {error && <p className="text-sm text-red-500">{error}</p>}
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3 rounded-b-lg">
                <button
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  onClick={handleVerifyPin}
                >
                  Verify
                </button>
              </div>
            </div>
          </div>
        )}
        <UserDetailsModal user={selectedUser} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </div>
    </div>
  )
}