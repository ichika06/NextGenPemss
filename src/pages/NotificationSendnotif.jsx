"use client"

/**
 * Component to create and send notifications to specific users or roles.
 * Uses Firebase Firestore to add notifications to the database.
 * @returns JSX element containing the notification creation UI.
 */
import { useState, useEffect } from "react"
import { collection, addDoc, query, where, getDocs } from "firebase/firestore"
import { db } from "../firebase/config"
import {
  Bell,
  Send,
  User,
  Users,
  AlertCircle,
  Clock,
  Info,
  CheckCircle,
  Search,
  X,
  Loader2,
  School,
  BookOpen,
  FileText,
  ShieldCheck,
} from "lucide-react"
import { useToast } from "../contexts/ToastContext";

export default function SendNotifications() {
  const { showToast, hideToast } = useToast();
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [notificationType, setNotificationType] = useState("info")
  const [sendToRoles, setSendToRoles] = useState({
    student: false,
    teacher: false,
    registrar: false,
    admin: false,
  })
  const [sendToSpecificUser, setSendToSpecificUser] = useState(false)
  const [sendToSection, setSendToSection] = useState(false)
  const [section, setSection] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [previewMode, setPreviewMode] = useState(false)

  // Search users by name, email, or ID
  const searchUsers = async () => {
    if (searchTerm.trim().length < 3) {
      setSearchResults([])
      return
    }

    setLoading(true)
    try {
      const usersCollection = collection(db, "users")
      const querySnapshot = await getDocs(usersCollection)

      const results = []
      querySnapshot.forEach((doc) => {
        const userData = doc.data()
        // Search in name, email, studentId, teacherId, employeeId, or adminId
        const searchFields = [
          userData.name,
          userData.email,
          userData.studentId,
          userData.teacherId,
          userData.employeeId,
          userData.adminId,
        ]
          .filter(Boolean)
          .map((field) => field.toLowerCase())

        const searchTermLower = searchTerm.toLowerCase()
        if (searchFields.some((field) => field.includes(searchTermLower))) {
          results.push({
            id: doc.id,
            ...userData,
          })
        }
      })

      setSearchResults(results)
    } catch (error) {
      console.error("Error searching users:", error)
      setError("Error searching users. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (searchTerm.trim().length >= 3) {
      const debounceTimer = setTimeout(() => {
        searchUsers()
      }, 500)

      return () => clearTimeout(debounceTimer)
    } else {
      setSearchResults([])
    }
  }, [searchTerm])

  const getUserTypeLabel = (user) => {
    switch (user.role) {
      case "student":
        return `Student (${user.studentId})`
      case "teacher":
        return `Teacher (${user.teacherId})`
      case "registrar":
        return `Registrar (${user.employeeId})`
      case "admin":
        return `Admin (${user.adminId})`
      default:
        return user.role
    }
  }

  const getRoleIcon = (role) => {
    switch (role) {
      case "student":
        return <School className="h-4 w-4" />
      case "teacher":
        return <BookOpen className="h-4 w-4" />
      case "registrar":
        return <FileText className="h-4 w-4" />
      case "admin":
        return <ShieldCheck className="h-4 w-4" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  const selectUser = (user) => {
    setSelectedUser(user)
    setSearchResults([])
    setSearchTerm("")
  }

  const predictUsername = (name) => {
    if (!name) return ""

    // Simple prediction: first letter of first name + last name
    const nameParts = name.split(" ")
    if (nameParts.length > 1) {
      const firstName = nameParts[0]
      const lastName = nameParts[nameParts.length - 1]
      return `@${firstName[0].toLowerCase()}${lastName.toLowerCase()}`
    }
    return `@${name.toLowerCase().replace(/\s/g, "")}`
  }

  const resetForm = () => {
    setTitle("")
    setMessage("")
    setNotificationType("info")
    setSendToRoles({
      student: false,
      teacher: false,
      registrar: false,
      admin: false,
    })
    setSendToSpecificUser(false)
    setSendToSection(false)
    setSection("")
    setSelectedUser(null)
    setSuccess(false)
    setError("")
    setPreviewMode(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (previewMode) {
      setPreviewMode(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      showToast("Sending notifications...", true);

      // Validate form
      if (!title.trim() || !message.trim()) {
        throw new Error("Title and message are required.");
      }

      // Check if at least one recipient is selected
      const isAnyRoleSelected = Object.values(sendToRoles).some((value) => value);
      if (!isAnyRoleSelected && !sendToSpecificUser && !sendToSection) {
        throw new Error("Please select at least one recipient.");
      }

      if (sendToSpecificUser && !selectedUser) {
        throw new Error("Please select a specific user.");
      }

      if (sendToSection && !section.trim()) {
        throw new Error("Please enter a section.");
      }

      // Determine target users
      let targetUsers = [];

      // For specific user
      if (sendToSpecificUser && selectedUser) {
        targetUsers.push(selectedUser.uid);
      }

      // For section
      if (sendToSection && section.trim()) {
        const sectionQuery = query(
          collection(db, "users"),
          where("role", "==", "student"),
          where("section", "==", section.trim())
        );

        const sectionSnapshot = await getDocs(sectionQuery);
        sectionSnapshot.forEach((doc) => {
          targetUsers.push(doc.data().uid);
        });

        if (sectionSnapshot.empty) {
          throw new Error(`No students found in section ${section}.`);
        }
      }

      // For roles
      if (isAnyRoleSelected) {
        const selectedRoles = Object.entries(sendToRoles)
          .filter(([_, isSelected]) => isSelected)
          .map(([role]) => role);

        for (const role of selectedRoles) {
          const roleQuery = query(collection(db, "users"), where("role", "==", role));

          const roleSnapshot = await getDocs(roleQuery);
          roleSnapshot.forEach((doc) => {
            targetUsers.push(doc.data().uid);
          });
        }
      }

      // Remove duplicates
      targetUsers = [...new Set(targetUsers)];

      if (targetUsers.length === 0) {
        throw new Error("No users found matching your criteria.");
      }

      // Create notification object
      const notificationBase = {
        title,
        message,
        type: notificationType,
        timestamp: new Date(),
        read: false,
      };

      // Add notification for each target user
      for (const uid of targetUsers) {
        await addDoc(collection(db, "notifications"), {
          ...notificationBase,
          recipientId: uid,
        });
      }

      setSuccess(true);
      resetForm();
      showToast("Notifications sent successfully!", false);

      setTimeout(() => {
        hideToast();
      }, 3000);
    } catch (error) {
      console.error("Error sending notifications:", error);
      setError(error.message || "Error sending notifications. Please try again.");
      showToast(`Failed to send notifications: ${error.message}`, false);
    } finally {
      setLoading(false);
    }
  }

  const getNotificationIcon = (type) => {
    switch (type) {
      case "event":
        return <Clock className="h-6 w-6 text-indigo-500" />
      case "user":
        return <User className="h-6 w-6 text-green-500" />
      case "alert":
        return <AlertCircle className="h-6 w-6 text-red-500" />
      case "success":
        return <CheckCircle className="h-6 w-6 text-green-500" />
      case "info":
        return <Info className="h-6 w-6 text-blue-500" />
      default:
        return <Bell className="h-6 w-6 text-gray-500" />
    }
  }

  const getRecipientSummary = () => {
    const parts = []

    // Roles
    const selectedRoles = Object.entries(sendToRoles)
      .filter(([_, isSelected]) => isSelected)
      .map(([role]) => role)

    if (selectedRoles.length > 0) {
      parts.push(`All ${selectedRoles.join(", ")} users`)
    }

    // Section
    if (sendToSection && section) {
      parts.push(`Students in section ${section}`)
    }

    // Specific user
    if (sendToSpecificUser && selectedUser) {
      parts.push(`${selectedUser.name} (${getUserTypeLabel(selectedUser)})`)
    }

    return parts.join(", ")
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 dark:bg-zinc-900 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-6">
          <div className="bg-indigo-100 dark:bg-indigo-900 p-2 rounded-lg mr-4">
            <Bell className="h-6 w-6 text-indigo-600 dark:text-indigo-300" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">Send Notifications</h1>
        </div>

        {success && (
          <div className="mb-6 p-4 rounded-lg bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 flex items-center">
            <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-300 mr-2 flex-shrink-0" />
            <span className="text-green-700 dark:text-green-200">Notifications sent successfully!</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-300 mr-2 flex-shrink-0" />
            <span className="text-red-700 dark:text-red-200">{error}</span>
          </div>
        )}

        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-700 overflow-hidden">
          {previewMode ? (
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100">Notification Preview</h2>
                <button
                  type="button"
                  onClick={() => setPreviewMode(false)}
                  className="text-indigo-600 dark:text-indigo-300 hover:text-indigo-800 dark:hover:text-indigo-400 text-sm font-medium"
                >
                  Back to Edit
                </button>
              </div>

              <div className="border border-gray-200 dark:border-zinc-700 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <div className="mr-4 mt-1">{getNotificationIcon(notificationType)}</div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">{title}</h3>
                    <p className="text-gray-600 dark:text-gray-300 whitespace-pre-line">{message}</p>
                    <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">{new Date().toLocaleString()}</div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-zinc-900 p-4 rounded-lg mb-6">
                <h3 className="font-medium text-gray-700 dark:text-gray-200 mb-2">Recipients</h3>
                <p className="text-gray-600 dark:text-gray-300">{getRecipientSummary()}</p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setPreviewMode(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-700"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-800 text-white flex items-center"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send Notification
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="divide-y divide-gray-100 dark:divide-zinc-700">
              {/* Notification Details */}
              <div className="p-6">
                <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Notification Details</h2>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Title*
                    </label>
                    <input
                      type="text"
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-zinc-900 dark:text-gray-100"
                      placeholder="Enter notification title"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Message*
                    </label>
                    <textarea
                      id="message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-zinc-900 dark:text-gray-100"
                      placeholder="Enter notification message"
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Type
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                      {["info", "event", "user", "alert", "success"].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setNotificationType(type)}
                          className={`flex items-center p-3 rounded-lg border transition-colors
                            ${
                              notificationType === type
                                ? "bg-indigo-50 dark:bg-indigo-900 border-indigo-300 dark:border-indigo-400 ring-1 ring-indigo-500"
                                : "bg-white dark:bg-zinc-900 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-zinc-800"
                            }`}
                        >
                          <div className="mr-2">{getNotificationIcon(type)}</div>
                          <span className="capitalize">{type}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recipients */}
              <div className="p-6">
                <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Recipients</h2>

                <div className="space-y-6">
                  {/* Send to roles */}
                  <div className="bg-gray-50 dark:bg-zinc-900 p-4 rounded-lg">
                    <div className="flex items-center mb-3">
                      <input
                        type="checkbox"
                        id="sendToRoles"
                        checked={Object.values(sendToRoles).some((v) => v)}
                        onChange={() => {
                          const anySelected = Object.values(sendToRoles).some((v) => v)
                          if (anySelected) {
                            setSendToRoles({
                              student: false,
                              teacher: false,
                              registrar: false,
                              admin: false,
                            })
                          } else {
                            setSendToRoles({
                              student: true,
                              teacher: true,
                              registrar: true,
                              admin: true,
                            })
                          }
                        }}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
                      />
                      <label htmlFor="sendToRoles" className="ml-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                        Send to roles
                      </label>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 ml-6">
                      {Object.keys(sendToRoles).map((role) => (
                        <label
                          key={role}
                          className={`flex items-center p-2 rounded-md cursor-pointer transition-colors
                            ${
                              sendToRoles[role]
                                ? "bg-indigo-50 dark:bg-indigo-900 border border-indigo-200 dark:border-indigo-400"
                                : "hover:bg-gray-100 dark:hover:bg-zinc-800"
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={sendToRoles[role]}
                            onChange={(e) => {
                              setSendToRoles({
                                ...sendToRoles,
                                [role]: e.target.checked,
                              })
                            }}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
                          />
                          <span className="ml-2 flex items-center text-sm text-gray-700 dark:text-gray-200 capitalize">
                            {getRoleIcon(role)}
                            <span className="ml-1">{role}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Send to section */}
                  <div className="bg-gray-50 dark:bg-zinc-900 p-4 rounded-lg">
                    <div className="flex items-center mb-3">
                      <input
                        type="checkbox"
                        id="sendToSection"
                        checked={sendToSection}
                        onChange={() => {
                          setSendToSection(!sendToSection)
                          if (sendToSection) setSection("")
                        }}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
                      />
                      <label htmlFor="sendToSection" className="ml-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                        Send to specific section
                      </label>
                    </div>

                    {sendToSection && (
                      <div className="ml-6">
                        <div className="flex items-center">
                          <School className="h-4 w-4 text-gray-400 dark:text-gray-500 mr-2" />
                          <input
                            type="text"
                            value={section}
                            onChange={(e) => setSection(e.target.value)}
                            className="w-full sm:w-64 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-zinc-900 dark:text-gray-100"
                            placeholder="Enter section code"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Send to specific user */}
                  <div className="bg-gray-50 dark:bg-zinc-900 p-4 rounded-lg">
                    <div className="flex items-center mb-3">
                      <input
                        type="checkbox"
                        id="sendToSpecificUser"
                        checked={sendToSpecificUser}
                        onChange={() => {
                          setSendToSpecificUser(!sendToSpecificUser)
                          if (sendToSpecificUser) setSelectedUser(null)
                        }}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded"
                      />
                      <label htmlFor="sendToSpecificUser" className="ml-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                        Send to specific user
                      </label>
                    </div>

                    {sendToSpecificUser && (
                      <div className="ml-6 space-y-3">
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                          </div>
                          <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 dark:bg-zinc-900 dark:text-gray-100"
                            placeholder="Search by name, email, or ID"
                          />
                        </div>

                        {loading && (
                          <div className="flex justify-center p-4">
                            <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
                          </div>
                        )}

                        {searchResults.length > 0 && (
                          <div className="bg-white dark:bg-zinc-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            <ul className="divide-y divide-gray-200 dark:divide-zinc-700">
                              {searchResults.map((user) => (
                                <li
                                  key={user.id}
                                  className="p-3 hover:bg-gray-50 dark:hover:bg-zinc-900 cursor-pointer"
                                  onClick={() => selectUser(user)}
                                >
                                  <div className="flex items-center">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center mr-3">
                                      {getRoleIcon(user.role)}
                                    </div>
                                    <div>
                                      <p className="font-medium text-gray-800 dark:text-gray-100">{user.name}</p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">{getUserTypeLabel(user)}</p>
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {selectedUser && (
                          <div className="bg-indigo-50 dark:bg-indigo-900 border border-indigo-200 dark:border-indigo-400 rounded-lg p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center mr-3">
                                  {getRoleIcon(selectedUser.role)}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-800 dark:text-gray-100">{selectedUser.name}</p>
                                  <p className="text-xs text-gray-600 dark:text-gray-300">
                                    {selectedUser.email} • {getUserTypeLabel(selectedUser)}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Predicted username:{" "}
                                    <span className="font-medium">{predictUsername(selectedUser.name)}</span>
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedUser(null)}
                                className="text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                              >
                                <X className="h-5 w-5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-6 bg-gray-50 dark:bg-zinc-900 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-300">
                  <Users className="h-4 w-4 mr-1" />
                  <span>Recipients: {getRecipientSummary() || "None selected"}</span>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode(true)}
                    disabled={!title || !message}
                    className={`px-4 py-2 rounded-lg border border-indigo-600 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900 ${
                      !title || !message ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    Preview
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className={`px-4 py-2 rounded-lg bg-indigo-600 dark:bg-indigo-700 text-white flex items-center ${
                      loading ? "opacity-70 cursor-not-allowed" : "hover:bg-indigo-700 dark:hover:bg-indigo-800"
                    }`}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin h-4 w-4 mr-2" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Notification
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
