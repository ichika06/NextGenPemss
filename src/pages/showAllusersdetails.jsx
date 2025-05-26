"use client"
import {
  User,
  Mail,
  Phone,
  Key,
  BookOpen,
  Briefcase,
  Calendar,
  UserCheck,
  Bell,
  X,
  CheckCircle,
  XCircle,
  Shield,
  GraduationCap,
  Building,
  Layers,
  FileText,
  UserPlus,
  Lock,
} from "lucide-react"

export default function UserDetailsModal({ user, isOpen, onClose }) {
  if (!isOpen || !user) return null

  // Format date for display
  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A"

    try {
      const date = new Date(timestamp)
      return date.toLocaleString()
    } catch (error) {
      return "Invalid date"
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden border border-gray-100 animate-fadeIn">
        {/* Header with gradient background */}
        <div className="background-primary text-white p-6 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <User className="h-6 w-6 text-primary" />
            <h3 className="text-xl font-bold text-primary">User Details</h3>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-primary" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* User header with image - Enhanced with card style */}
          <div className="flex flex-col sm:flex-row items-center bg-blue-50 p-5 rounded-xl mb-6 border border-blue-100">
            <div className="h-24 w-24 rounded-full overflow-hidden bg-white border-4 border-white shadow-md mb-4 sm:mb-0 sm:mr-6">
              <img
                src={user.profileImage || "/placeholder.svg"}
                alt={user.name}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="text-center sm:text-left">
              <h4 className="text-2xl font-bold text-gray-800">{user.name}</h4>
              <div className="flex items-center justify-center sm:justify-start mt-1 text-blue-700">
                <Shield className="h-4 w-4 mr-1.5" />
                <p className="font-medium">{user.role || "No role assigned"}</p>
              </div>
              <div className="flex items-center justify-center sm:justify-start mt-2 text-gray-500">
                <Mail className="h-4 w-4 mr-1.5" />
                <p>{user.email || "No email available"}</p>
              </div>
            </div>
          </div>

          {/* Details grid with enhanced styling and icons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal Information */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-4 text-blue-700">
                <User className="h-5 w-5 mr-2" />
                <h5 className="font-semibold">Personal Information</h5>
              </div>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="bg-blue-100 p-2 rounded-lg mr-3 text-blue-700">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500">Full Name</span>
                    <span className="block text-sm font-medium">{user.name || "N/A"}</span>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="bg-blue-100 p-2 rounded-lg mr-3 text-blue-700">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500">Email</span>
                    <span className="block text-sm font-medium">{user.email || "N/A"}</span>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="bg-blue-100 p-2 rounded-lg mr-3 text-blue-700">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500">Phone</span>
                    <span className="block text-sm font-medium">{user.phone || "N/A"}</span>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="bg-blue-100 p-2 rounded-lg mr-3 text-blue-700">
                    <Key className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500">User ID</span>
                    <span className="block text-sm font-medium">{user.uid || "N/A"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Academic Information */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-4 text-green-700">
                <GraduationCap className="h-5 w-5 mr-2" />
                <h5 className="font-semibold">Academic Information</h5>
              </div>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="bg-green-100 p-2 rounded-lg mr-3 text-green-700">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500">Student ID</span>
                    <span className="block text-sm font-medium">{user.studentId || "N/A"}</span>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="bg-green-100 p-2 rounded-lg mr-3 text-green-700">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500">Course</span>
                    <span className="block text-sm font-medium">{user.course || "N/A"}</span>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="bg-green-100 p-2 rounded-lg mr-3 text-green-700">
                    <Building className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500">Department</span>
                    <span className="block text-sm font-medium">{user.department || "N/A"}</span>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="bg-green-100 p-2 rounded-lg mr-3 text-green-700">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500">Section</span>
                    <span className="block text-sm font-medium">{user.section || "N/A"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Information */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-4 text-purple-700">
                <Briefcase className="h-5 w-5 mr-2" />
                <h5 className="font-semibold">Account Information</h5>
              </div>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="bg-purple-100 p-2 rounded-lg mr-3 text-purple-700">
                    <UserPlus className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500">Added By</span>
                    <span className="block text-sm font-medium">{user.addedby || "N/A"}</span>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="bg-purple-100 p-2 rounded-lg mr-3 text-purple-700">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500">Created At</span>
                    <span className="block text-sm font-medium">{formatDate(user.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="bg-purple-100 p-2 rounded-lg mr-3 text-purple-700">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500">Role</span>
                    <span className="block text-sm font-medium">{user.role || "N/A"}</span>
                  </div>
                </div>
                {user.generatedPassword && (
                  <div className="flex items-start">
                    <div className="bg-purple-100 p-2 rounded-lg mr-3 text-purple-700">
                      <Lock className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="block text-xs text-gray-500">Generated Password</span>
                      <div className="flex items-center">
                        <span className="block text-sm font-medium mr-2">{user.generatedPassword}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* System Settings */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-4 text-amber-700">
                <UserCheck className="h-5 w-5 mr-2" />
                <h5 className="font-semibold">System Settings</h5>
              </div>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="bg-amber-100 p-2 rounded-lg mr-3 text-amber-700">
                    <UserCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500">Authentication Completed</span>
                    <span className="flex items-center mt-1">
                      {user.authCompleted ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-500 mr-1.5" />
                          <span className="text-sm font-medium text-green-700">Yes</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-red-500 mr-1.5" />
                          <span className="text-sm font-medium text-red-700">No</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="bg-amber-100 p-2 rounded-lg mr-3 text-amber-700">
                    <Bell className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500 mb-2">Notification Preferences</span>
                    <div className="space-y-2 ml-1">
                      <div className="flex items-center">
                        {user.notifications?.email ? (
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 mr-2" />
                        )}
                        <span className="text-sm">Email notifications</span>
                      </div>

                      <div className="flex items-center">
                        {user.notifications?.system ? (
                          <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500 mr-2" />
                        )}
                        <span className="text-sm">System notifications</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer with gradient button */}
        <div className="flex justify-end p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="-m-4 px-5 py-2.5 btn-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all shadow-md flex items-center"
          >
            <X className="h-4 w-4 mr-2"/>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
