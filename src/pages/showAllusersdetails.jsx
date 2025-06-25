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
  MapPin,
  Users,
  Award,
  Settings,
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

  // Role-specific field configurations
  const getRoleSpecificFields = () => {
    switch (user.role) {
      case 'student':
        return {
          academic: [
            { key: 'studentId', label: 'Student ID', icon: FileText },
            { key: 'course', label: 'Course', icon: BookOpen },
            { key: 'section', label: 'Section', icon: Layers },
            { key: 'branch', label: 'Branch', icon: Building },
            { key: 'organization', label: 'Organization', icon: Users },
          ]
        }
      case 'teacher':
        return {
          academic: [
            { key: 'teacherId', label: 'Teacher ID', icon: FileText },
            { key: 'department', label: 'Department', icon: Building },
            { key: 'position', label: 'Position', icon: Award },
          ]
        }
      case 'admin':
        return {
          academic: [
            { key: 'adminId', label: 'Admin ID', icon: FileText },
            { key: 'accessLevel', label: 'Access Level', icon: Shield },
          ]
        }
      case 'registrar':
        return {
          academic: [
            { key: 'employeeId', label: 'Employee ID', icon: FileText },
            { key: 'department', label: 'Department', icon: Building },
            { key: 'office', label: 'Office', icon: MapPin },
          ]
        }
      default:
        return { academic: [] }
    }
  }

  const roleFields = getRoleSpecificFields()

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden border border-gray-100 dark:border-zinc-700 animate-fadeIn">
        {/* Header with gradient background */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-indigo-700 dark:to-gray-800 text-white p-6 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <User className="h-6 w-6" />
            <h3 className="text-xl font-bold">User Details</h3>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* User header with image - Enhanced with card style */}
          <div className="flex flex-col sm:flex-row items-center bg-blue-50 dark:bg-zinc-900 p-5 rounded-xl mb-6 border border-blue-100 dark:border-zinc-700">
            <div className="h-24 w-24 rounded-full overflow-hidden bg-white dark:bg-zinc-800 border-4 border-white dark:border-zinc-700 shadow-md mb-4 sm:mb-0 sm:mr-6">
              <img
                src={user.profileImage || "/placeholder.svg"}
                alt={user.name}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="text-center sm:text-left">
              <h4 className="text-2xl font-bold text-gray-800 dark:text-zinc-100">{user.name}</h4>
              <div className="flex items-center justify-center sm:justify-start mt-1 text-blue-700 dark:text-indigo-300">
                <Shield className="h-4 w-4 mr-1.5" />
                <p className="font-medium capitalize">{user.role || "No role assigned"}</p>
              </div>
              <div className="flex items-center justify-center sm:justify-start mt-2 text-gray-500 dark:text-zinc-300">
                <Mail className="h-4 w-4 mr-1.5" />
                <p>{user.email || "No email available"}</p>
              </div>
            </div>
          </div>

          {/* Details grid with enhanced styling and icons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal Information */}
            <div className="bg-gray-50 dark:bg-zinc-900 rounded-xl p-5 border border-gray-100 dark:border-zinc-700 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-4 text-blue-700 dark:text-indigo-300">
                <User className="h-5 w-5 mr-2" />
                <h5 className="font-semibold">Personal Information</h5>
              </div>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="bg-blue-100 dark:bg-indigo-900 p-2 rounded-lg mr-3 text-blue-700 dark:text-indigo-300">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500 dark:text-zinc-400">Full Name</span>
                    <span className="block text-sm font-medium dark:text-zinc-100">{user.name || "N/A"}</span>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="bg-blue-100 dark:bg-indigo-900 p-2 rounded-lg mr-3 text-blue-700 dark:text-indigo-300">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500 dark:text-zinc-400">Email</span>
                    <span className="block text-sm font-medium dark:text-zinc-100">{user.email || "N/A"}</span>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="bg-blue-100 dark:bg-indigo-900 p-2 rounded-lg mr-3 text-blue-700 dark:text-indigo-300">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500 dark:text-zinc-400">Phone</span>
                    <span className="block text-sm font-medium dark:text-zinc-100">{user.phone || "N/A"}</span>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="bg-blue-100 dark:bg-indigo-900 p-2 rounded-lg mr-3 text-blue-700 dark:text-indigo-300">
                    <Key className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500 dark:text-zinc-400">User ID</span>
                    <span className="block text-sm font-medium dark:text-zinc-100">{user.uid || "N/A"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Role-Specific Information */}
            <div className="bg-gray-50 dark:bg-zinc-900 rounded-xl p-5 border border-gray-100 dark:border-zinc-700 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-4 text-green-700 dark:text-green-300">
                <GraduationCap className="h-5 w-5 mr-2" />
                <h5 className="font-semibold">
                  {user.role === 'student' ? 'Academic Information' : 
                   user.role === 'teacher' ? 'Professional Information' :
                   user.role === 'admin' ? 'Administrative Information' :
                   user.role === 'registrar' ? 'Office Information' : 'Role Information'}
                </h5>
              </div>
              <div className="space-y-4">
                {roleFields.academic.map((field) => {
                  const IconComponent = field.icon
                  return (
                    <div key={field.key} className="flex items-start">
                      <div className="bg-green-100 dark:bg-green-900 p-2 rounded-lg mr-3 text-green-700 dark:text-green-300">
                        <IconComponent className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="block text-xs text-gray-500 dark:text-zinc-400">{field.label}</span>
                        <span className="block text-sm font-medium dark:text-zinc-100">
                          {user[field.key] || "N/A"}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Account Information */}
            <div className="bg-gray-50 dark:bg-zinc-900 rounded-xl p-5 border border-gray-100 dark:border-zinc-700 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-4 text-purple-700 dark:text-purple-300">
                <Briefcase className="h-5 w-5 mr-2" />
                <h5 className="font-semibold">Account Information</h5>
              </div>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg mr-3 text-purple-700 dark:text-purple-300">
                    <UserPlus className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500 dark:text-zinc-400">Added By</span>
                    <span className="block text-sm font-medium dark:text-zinc-100">{user.addedby || "N/A"}</span>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg mr-3 text-purple-700 dark:text-purple-300">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500 dark:text-zinc-400">Created At</span>
                    <span className="block text-sm font-medium dark:text-zinc-100">{formatDate(user.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg mr-3 text-purple-700 dark:text-purple-300">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500 dark:text-zinc-400">Role</span>
                    <span className="block text-sm font-medium capitalize dark:text-zinc-100">{user.role || "N/A"}</span>
                  </div>
                </div>
                {user.generatedPassword && (
                  <div className="flex items-start">
                    <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg mr-3 text-purple-700 dark:text-purple-300">
                      <Lock className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="block text-xs text-gray-500 dark:text-zinc-400">Generated Password</span>
                      <div className="flex items-center">
                        <span className="block text-sm font-medium mr-2 font-mono bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded dark:text-zinc-100">
                          {user.generatedPassword}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* System Settings */}
            <div className="bg-gray-50 dark:bg-zinc-900 rounded-xl p-5 border border-gray-100 dark:border-zinc-700 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-4 text-amber-700 dark:text-amber-300">
                <Settings className="h-5 w-5 mr-2" />
                <h5 className="font-semibold">System Settings</h5>
              </div>
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="bg-amber-100 dark:bg-amber-900 p-2 rounded-lg mr-3 text-amber-700 dark:text-amber-300">
                    <UserCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500 dark:text-zinc-400">Authentication Completed</span>
                    <span className="flex items-center mt-1">
                      {user.authCompleted ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-300 mr-1.5" />
                          <span className="text-sm font-medium text-green-700 dark:text-green-200">Yes</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-red-500 dark:text-red-300 mr-1.5" />
                          <span className="text-sm font-medium text-red-700 dark:text-red-200">No</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
                {user.notifications && (
                  <div className="flex items-start">
                    <div className="bg-amber-100 dark:bg-amber-900 p-2 rounded-lg mr-3 text-amber-700 dark:text-amber-300">
                      <Bell className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="block text-xs text-gray-500 dark:text-zinc-400 mb-2">Notification Preferences</span>
                      <div className="space-y-2 ml-1">
                        <div className="flex items-center">
                          {user.notifications?.email ? (
                            <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-300 mr-2" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 dark:text-red-300 mr-2" />
                          )}
                          <span className="text-sm dark:text-zinc-100">Email notifications</span>
                        </div>

                        <div className="flex items-center">
                          {user.notifications?.system ? (
                            <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-300 mr-2" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 dark:text-red-300 mr-2" />
                          )}
                          <span className="text-sm dark:text-zinc-100">System notifications</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}