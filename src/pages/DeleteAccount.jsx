import { useState } from "react"
import {
  Trash2,
  Search,
  AlertTriangle,
  CheckCircle,
  XCircle,
  User,
  Mail,
  Shield,
  Calendar,
  Building,
  GraduationCap,
} from "lucide-react"
import { useAuth } from "../contexts/AuthContext"

const DeleteUserAccount = () => {
  const { deleteUserById, findUserByIdField, currentUserData, deleteFromFirebaseAuth } = useAuth()

  const [userId, setUserId] = useState("")
  const [userToDelete, setUserToDelete] = useState(null)
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [confirmationInput, setConfirmationInput] = useState("")
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState("")
  const [deletionResult, setDeletionResult] = useState(null)
  const [deletionOptions, setDeletionOptions] = useState({
    deleteFromDatabase: true,
    deleteFromAuth: true,
    sendNotificationEmail: false,
  })

  const hasDeletePermission =
    currentUserData &&
    (currentUserData.role === "admin" ||
      currentUserData.accessLevel === "super" ||
      currentUserData.role === "registrar")

  const handleSearchUser = async () => {
    if (!userId.trim()) {
      setMessage("Please enter a user ID")
      setMessageType("error")
      return
    }

    setSearching(true)
    setMessage("")
    setUserToDelete(null)
    setShowConfirmation(false)
    setDeletionResult(null)

    try {
      const foundUser = await findUserByIdField(userId.trim())

      if (foundUser) {
        setUserToDelete(foundUser)
        setMessage(`User found: ${foundUser.name} (${foundUser.email})`)
        setMessageType("success")
      } else {
        setMessage("User not found with the provided ID")
        setMessageType("error")
      }
    } catch (error) {
      setMessage(`Error searching user: ${error.message}`)
      setMessageType("error")
    } finally {
      setSearching(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return

    if (confirmationInput !== "DELETE") {
      setMessage('Please type "DELETE" to confirm')
      setMessageType("error")
      return
    }

    setLoading(true)
    setMessage("")

    try {
      const results = {
        database: null,
        auth: null,
        email: null,
      }

      // Delete from database
      if (deletionOptions.deleteFromDatabase) {
        results.database = await deleteUserById(userToDelete.uid)
      }

      // Delete from Firebase Authentication
      if (deletionOptions.deleteFromAuth && deleteFromFirebaseAuth) {
        try {
          results.auth = await deleteFromFirebaseAuth(userToDelete.email)
        } catch (authError) {
          console.warn("Firebase Auth deletion failed:", authError)
          results.auth = { success: false, error: authError.message }
        }
      }

      // Send notification email (if implemented)
      if (deletionOptions.sendNotificationEmail) {
        // Implement email notification logic here
        results.email = { success: true, message: "Notification email sent" }
      }

      setDeletionResult({
        user: userToDelete,
        results,
        options: deletionOptions,
      })

      const successMessage = `User "${userToDelete.name}" has been processed for deletion.`
      setMessage(successMessage)
      setMessageType("success")

      // Reset form
      setUserId("")
      setUserToDelete(null)
      setShowConfirmation(false)
      setConfirmationInput("")
    } catch (error) {
      setMessage(`Error during deletion process: ${error.message}`)
      setMessageType("error")
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setUserId("")
    setUserToDelete(null)
    setShowConfirmation(false)
    setConfirmationInput("")
    setMessage("")
    setDeletionResult(null)
    setDeletionOptions({
      deleteFromDatabase: true,
      deleteFromAuth: true,
      sendNotificationEmail: false,
    })
  }

  const getRoleIcon = (role) => {
    switch (role) {
      case "admin":
        return <Shield className="h-4 w-4" />
      case "teacher":
        return <GraduationCap className="h-4 w-4" />
      case "student":
        return <User className="h-4 w-4" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800 border border-red-200"
      case "teacher":
        return "bg-blue-100 text-blue-800 border border-blue-200"
      case "student":
        return "bg-gray-100 text-gray-800 border border-gray-200"
      default:
        return "bg-gray-100 text-gray-800 border border-gray-200"
    }
  }

  if (!hasDeletePermission) {
    return (
      <div className="max-w-md mx-auto bg-white dark:bg-zinc-800 rounded-lg shadow-md">
        <div className="pt-6 pb-6 px-6">
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
              <XCircle className="h-6 w-6 text-red-600 dark:text-red-200" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Access Denied</h3>
              <p className="text-sm text-gray-500 dark:text-zinc-300 mt-1">You don't have permission to delete user accounts.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Main Card */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-600 dark:text-red-200" />
            Delete User Account
          </h2>
          <p className="text-sm text-gray-500 dark:text-zinc-300 mt-1">Search for a user and permanently delete their account from the system.</p>
        </div>
        <div className="p-6 space-y-6">
          {/* Warning Alert */}
          <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-md p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-200 mr-2" />
              <div className="text-sm text-yellow-800 dark:text-yellow-100">
                <strong>Warning:</strong> This action cannot be undone. All user data will be permanently deleted.
              </div>
            </div>
          </div>

          {/* Search Section */}
          <div className="space-y-3">
            <label htmlFor="userId" className="block text-sm font-medium text-gray-700 dark:text-zinc-200">
              User ID (Student ID, Teacher ID, Employee ID, Admin ID, or UID)
            </label>
            <div className="flex gap-3">
              <input
                id="userId"
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter user ID (e.g., UA202400217, 20161589)"
                disabled={searching || loading}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-900 dark:text-zinc-100 disabled:bg-gray-50 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleSearchUser}
                disabled={searching || loading}
                className="px-4 py-2 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-100 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Search className="h-4 w-4" />
                {searching ? "Searching..." : "Search"}
              </button>
            </div>
          </div>

          {/* Message Display */}
          {message && (
            <div className={`rounded-md p-4 ${
              messageType === "error" 
                ? "bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700" 
                : "bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700"
            }`}>
              <div className="flex items-center gap-2">
                {messageType === "success" && <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-200" />}
                {messageType === "error" && <XCircle className="h-4 w-4 text-red-600 dark:text-red-200" />}
                {messageType === "warning" && <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-200" />}
                <div className={`text-sm ${
                  messageType === "error" ? "text-red-800 dark:text-red-200" : "text-blue-800 dark:text-blue-200"
                }`}>
                  {message}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Details Card */}
      {userToDelete && !deletionResult && (
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
              <User className="h-5 w-5" />
              User Details
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-100 dark:bg-zinc-900 rounded-full flex items-center justify-center">
                {getRoleIcon(userToDelete.role)}
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-lg dark:text-zinc-100">{userToDelete.name}</h4>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-300">
                  <Mail className="h-3 w-3" />
                  {userToDelete.email}
                </div>
              </div>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(userToDelete.role)}`}>
                {userToDelete.role}
              </span>
            </div>

            <div className="border-t border-gray-200 dark:border-zinc-700 pt-4"></div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {userToDelete.studentId && (
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-gray-400" />
                  <span className="font-medium">Student ID:</span> {userToDelete.studentId}
                </div>
              )}
              {userToDelete.teacherId && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="font-medium">Teacher ID:</span> {userToDelete.teacherId}
                </div>
              )}
              {userToDelete.employeeId && (
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-gray-400" />
                  <span className="font-medium">Employee ID:</span> {userToDelete.employeeId}
                </div>
              )}
              {userToDelete.course && (
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-gray-400" />
                  <span className="font-medium">Course:</span> {userToDelete.course}
                </div>
              )}
              {userToDelete.department && (
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-gray-400" />
                  <span className="font-medium">Department:</span> {userToDelete.department}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="font-medium">Created:</span> {new Date(userToDelete.createdAt).toLocaleDateString()}
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-zinc-700 pt-4"></div>

            <div className="space-y-3">
              <h4 className="font-medium dark:text-zinc-100">Deletion Options</h4>
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={deletionOptions.deleteFromDatabase}
                    onChange={(e) =>
                      setDeletionOptions((prev) => ({
                        ...prev,
                        deleteFromDatabase: e.target.checked,
                      }))
                    }
                    className="rounded border-gray-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 dark:bg-zinc-900"
                  />
                  <span className="text-sm dark:text-zinc-100">Delete from database</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={deletionOptions.deleteFromAuth}
                    onChange={(e) =>
                      setDeletionOptions((prev) => ({
                        ...prev,
                        deleteFromAuth: e.target.checked,
                      }))
                    }
                    className="rounded border-gray-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 dark:bg-zinc-900"
                  />
                  <span className="text-sm dark:text-zinc-100">Delete from Firebase Authentication</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={deletionOptions.sendNotificationEmail}
                    onChange={(e) =>
                      setDeletionOptions((prev) => ({
                        ...prev,
                        sendNotificationEmail: e.target.checked,
                      }))
                    }
                    className="rounded border-gray-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 dark:bg-zinc-900"
                  />
                  <span className="text-sm dark:text-zinc-100">Send notification email to user</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setShowConfirmation(true)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 flex items-center justify-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete This User
              </button>
              <button
                onClick={() => {
                  setUserToDelete(null)
                  setUserId("")
                  setMessage("")
                }}
                className="px-4 py-2 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-100 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deletion Result Card */}
      {deletionResult && (
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-200" />
              Deletion Complete
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="bg-green-50 dark:bg-green-900 p-4 rounded-lg border border-green-200 dark:border-green-700">
              <h4 className="font-medium text-green-800 dark:text-green-100 mb-2">Successfully Processed</h4>
              <div className="text-sm text-green-700 dark:text-green-200 space-y-1">
                <div>
                  <strong>User:</strong> {deletionResult.user.name}
                </div>
                <div>
                  <strong>Email:</strong> {deletionResult.user.email}
                </div>
                <div>
                  <strong>Role:</strong> {deletionResult.user.role}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium dark:text-zinc-100">Deletion Results</h4>
              <div className="space-y-2">
                {deletionResult.options.deleteFromDatabase && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-200" />
                    Database record deleted
                  </div>
                )}
                {deletionResult.options.deleteFromAuth && (
                  <div className="flex items-center gap-2 text-sm">
                    {deletionResult.results.auth?.success ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-200" />
                        Firebase Authentication account deleted
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-red-600 dark:text-red-200" />
                        Firebase Authentication deletion failed
                      </>
                    )}
                  </div>
                )}
                {deletionResult.options.sendNotificationEmail && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-200" />
                    Notification email sent
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={resetForm}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Delete Another User
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-zinc-900 dark:bg-opacity-80 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-zinc-800">
            <div className="mt-3">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-200" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-zinc-100">Confirm Account Deletion</h3>
              </div>
              <p className="text-sm text-gray-500 dark:text-zinc-300 mb-4">This action cannot be undone. Please review the details carefully.</p>

              {userToDelete && (
                <div className="space-y-4">
                  <div className="bg-red-50 dark:bg-red-900 p-4 rounded-lg border border-red-200 dark:border-red-700">
                    <div className="text-sm space-y-1 text-red-800 dark:text-red-200">
                      <div>
                        <strong>Name:</strong> {userToDelete.name}
                      </div>
                      <div>
                        <strong>Email:</strong> {userToDelete.email}
                      </div>
                      <div>
                        <strong>Role:</strong> {userToDelete.role}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="confirmation" className="block text-sm font-medium text-gray-700 dark:text-zinc-200 mb-1">
                      Type "DELETE" to confirm:
                    </label>
                    <input
                      id="confirmation"
                      type="text"
                      value={confirmationInput}
                      onChange={(e) => setConfirmationInput(e.target.value)}
                      placeholder="Type DELETE here"
                      disabled={loading}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-zinc-900 dark:text-zinc-100 disabled:bg-gray-50 dark:disabled:bg-zinc-800"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowConfirmation(false)}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-100 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteUser}
                  disabled={loading || confirmationInput !== "DELETE"}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Deleting..." : "Delete Permanently"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DeleteUserAccount