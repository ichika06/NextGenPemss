"use client"

import { useState, useEffect, useRef } from "react"
import { useAuth } from "../contexts/AuthContext"
import { collection, getDocs, doc, updateDoc, query, where } from "firebase/firestore"
import { db } from "../firebase/config"
import {
  User,
  Edit,
  X,
  Save,
  AlertCircle,
  CheckCircle,
  Lock,
  RefreshCw,
  Briefcase,
  Building,
  BookOpen,
  Users,
  CreditCard,
  GraduationCap,
  School,
  MapPin,
  UserCheck,
  Camera,
  Upload,
  Database,
  Settings,
} from "lucide-react"
import { LoadingAnimation } from "../components/LoadingAnimation"
import UserStorageService from "../components/reuseRegistration/UserStorageService"
import { useAlert } from "../components/AlertProvider"
import CachePermissionToast from "../components/CachePermissionToast"
import { useOptimizedIndexedDBCache } from "../components/useIndexedDBCache"

export default function UserProfile() {
  const { currentUser, updatePassword, updateEmail, reauthenticate } = useAuth()
  const { getCachePermissionStatus, setCachePermissionStatus, clearCache } = useOptimizedIndexedDBCache()

  const [profile, setProfile] = useState({
    email: currentUser?.email || "",
    name: "",
    phone: "",
    department: "",
    role: "",
    profileImageUrl: "",
    profileImagePath: "",
    notifications: {
      email: true,
      system: true,
    },
    // Fields for all user types
    studentId: "",
    section: "",
    course: "",
    branch: "",
    organization: "",
    teacherId: "",
    position: "",
    employeeId: "",
    office: "",
    adminId: "",
    accessLevel: "",
  })

  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState({ type: "", text: "" })
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [imageUploading, setImageUploading] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)

  // Cache-related state
  const [showCacheToast, setShowCacheToast] = useState(false)
  const [cacheStatus, setCacheStatus] = useState({
    permission: null,
    isGranted: false,
    isDenied: false,
    isUnset: true,
  })

  const fileInputRef = useRef(null)
  const { showAlert } = useAlert()

  // Branch options
  const branches = [
    "ICCT Antipolo Branch",
    "ICCT Binangonan Branch",
    "ICCT San Mateo Branch",
    "ICCT Cogeo Branch",
    "ICCT Taytay Branch",
    "ICCT Cainta Main Campus",
    "ICCT Angono Branch",
    "ICCT Sumulong Branch",
  ]

  // Organization options
  const organizations = [
    "Computer Explorer Society",
    "CISCO Student Associatio",
    "CBA Club",
    "JPIA Chapter",
    "Criminology Society",
    "Educator's Society",
    "English Club",
    "Math Club",
    "Engineering Students Society",
    "IECEP Chapter",
    "ICPEP Chapter",
    "Masscom Society",
    "Phychology Society",
    "Societas Hotelianos",
    "Lakbay",
    "Medical Technology Society",
    "TECH-VOC Student Organization",
    "Taekwondo Club",
    "Sibol Theatrical Dance Group",
    "Yin Yang Dance Group",
    "Blue Dragon Varsity Player",
    "Rhythm and Voice Chorale",
  ]

  useEffect(() => {
    async function fetchUserProfile() {
      try {
        const userQuery = query(collection(db, "users"), where("email", "==", currentUser.email))

        const snapshot = await getDocs(userQuery)

        if (!snapshot.empty) {
          const userData = snapshot.docs[0].data()
          setProfile({
            ...profile,
            name: userData.name || "",
            phone: userData.phone || "",
            department: userData.department || "",
            role: userData.role || "",
            profileImageUrl: userData.profileImageUrl || "",
            profileImagePath: userData.profileImagePath || "",
            notifications: userData.notifications || {
              email: true,
              system: true,
            },
            // Load role-specific fields
            studentId: userData.studentId || "",
            section: userData.section || "",
            course: userData.course || "",
            branch: userData.branch || "",
            organization: userData.organization || "",
            teacherId: userData.teacherId || "",
            position: userData.position || "",
            employeeId: userData.employeeId || "",
            office: userData.office || "",
            adminId: userData.adminId || "",
            accessLevel: userData.accessLevel || "",
          })
        }

        setLoading(false)
      } catch (error) {
        console.error("Error fetching user profile:", error)
        setLoading(false)
      }
    }

    // Initialize cache status
    const initializeCacheStatus = () => {
      const status = getCachePermissionStatus()
      setCacheStatus(status)

      // Show toast if permission is unset
      if (status.isUnset) {
        const timer = setTimeout(() => {
          setShowCacheToast(true)
        }, 2000)
        return () => clearTimeout(timer)
      }
    }

    fetchUserProfile()
    initializeCacheStatus()

    // Listen for storage changes to sync cache status across tabs
    const handleStorageChange = (e) => {
      if (e.key === "events_cache_permission") {
        const status = getCachePermissionStatus()
        setCacheStatus(status)
      }
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [currentUser, getCachePermissionStatus])

  // Handle cache permission response
  const handleCachePermission = async (granted) => {
    try {
      setCachePermissionStatus(granted)
      const newStatus = getCachePermissionStatus()
      setCacheStatus(newStatus)

      // If disabling cache, clear it
      if (!granted) {
        try {
          const clearResult = await clearCache()
          console.log("Cache clear result:", clearResult)
        } catch (error) {
          console.error("Failed to clear cache:", error)
        }
      }

      // Show appropriate alert
      const alertConfig = {
        position: window.innerWidth < 768 ? "top-center" : "top-right",
        animation: window.innerWidth < 768 ? "slide-down" : "slide-left",
        duration: 3000,
        width: window.innerWidth < 768 ? "sm" : "md",
        responsiveMode: window.innerWidth < 768 ? "inline" : "stack",
      }

      if (granted) {
        showAlert({
          icon: "success",
          header: "Cache Enabled",
          description: "Data caching has been enabled for faster loading!",
          variant: "success",
          headerColor: "#086d3f",
          descriptionColor: "#086d3f",
          borderColor: "#086d3f",
          ...alertConfig,
        })
      } else {
        showAlert({
          icon: "info",
          header: "Cache Disabled",
          description: "Data caching has been disabled and cache cleared.",
          variant: "info",
          headerColor: "#1e40af",
          descriptionColor: "#1e40af",
          borderColor: "#1e40af",
          ...alertConfig,
        })
      }
    } catch (error) {
      console.error("Error setting cache permission:", error)
      showAlert({
        icon: "error",
        header: "Cache Error",
        description: "Failed to update cache settings. Please try again.",
        variant: "error",
        headerColor: "#9c0505",
        descriptionColor: "#9c0505",
        borderColor: "#9c0505",
        position: window.innerWidth < 768 ? "top-center" : "top-right",
        animation: window.innerWidth < 768 ? "slide-down" : "slide-left",
        duration: 3000,
        width: window.innerWidth < 768 ? "sm" : "md",
        responsiveMode: window.innerWidth < 768 ? "inline" : "stack",
      })
    }
  }

  // Handle cache button click
  const handleCacheButtonClick = () => {
    if (cacheStatus.isUnset) {
      // First time - show permission toast
      setShowCacheToast(true)
    } else {
      // Already has permission - toggle
      handleCachePermission(!cacheStatus.isGranted)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target

    if (name.startsWith("notifications.")) {
      const notificationType = name.split(".")[1]
      setProfile({
        ...profile,
        notifications: {
          ...profile.notifications,
          [notificationType]: checked,
        },
      })
    } else {
      setProfile({
        ...profile,
        [name]: value,
      })
    }
  }

  // Handle image file selection
  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Validate file type
      const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"]
      if (!validTypes.includes(file.type)) {
        showAlert({
          icon: "error",
          header: "Upload image Profile",
          description: "Please select a valid image file (JPEG, PNG, or GIF)",
          variant: "error",
          position: window.innerWidth < 768 ? "top-center" : "top-right",
          animation: window.innerWidth < 768 ? "slide-down" : "slide-left",
          duration: 3000,
          headerColor: "#9c0505",
          descriptionColor: "#9c0505",
          borderColor: "#9c0505",
          width: window.innerWidth < 768 ? "sm" : "md",
          responsiveMode: window.innerWidth < 768 ? "inline" : "stack",
        })
        return
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024 // 5MB in bytes
      if (file.size > maxSize) {
        showAlert({
          icon: "error",
          header: "Upload image Profile",
          description: "Image size must be less than 5MB",
          variant: "error",
          position: window.innerWidth < 768 ? "top-center" : "top-right",
          animation: window.innerWidth < 768 ? "slide-down" : "slide-left",
          duration: 3000,
          headerColor: "#9c0505",
          descriptionColor: "#9c0505",
          borderColor: "#9c0505",
          width: window.innerWidth < 768 ? "sm" : "md",
          responsiveMode: window.innerWidth < 768 ? "inline" : "stack",
        })
        return
      }

      setSelectedImage(file)

      // Create preview URL
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target.result)
      }
      reader.readAsDataURL(file)
    }
  }

  // Upload profile image
  const uploadProfileImage = async () => {
    if (!selectedImage) return

    setImageUploading(true)
    setMessage({ type: "", text: "" })

    try {
      const imageUploadResult = await UserStorageService.updateProfileImage(
        currentUser.uid,
        selectedImage,
        profile.profileImagePath || null,
      )

      if (imageUploadResult.success) {
        // Update the profile state with new image URL and path
        const updatedProfile = {
          ...profile,
          profileImageUrl: imageUploadResult.url,
          profileImagePath: imageUploadResult.path,
        }
        setProfile(updatedProfile)

        // Update Firestore with new image data
        const userQuery = query(collection(db, "users"), where("email", "==", currentUser.email))
        const snapshot = await getDocs(userQuery)

        if (!snapshot.empty) {
          const userDoc = snapshot.docs[0]
          await updateDoc(doc(db, "users", userDoc.id), {
            profileImageUrl: imageUploadResult.url,
            profileImagePath: imageUploadResult.path,
          })
        }

        showAlert({
          icon: "success",
          header: "Upload image Profile",
          description: "Profile image updated successfully!",
          variant: "success",
          position: window.innerWidth < 768 ? "top-center" : "top-right",
          animation: window.innerWidth < 768 ? "slide-down" : "slide-left",
          duration: 3000,
          headerColor: "#086d3f",
          descriptionColor: "#086d3f",
          borderColor: "#086d3f",
          width: window.innerWidth < 768 ? "sm" : "md",
          responsiveMode: window.innerWidth < 768 ? "inline" : "stack",
        })
        setSelectedImage(null)
        setImagePreview(null)

        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }
    } catch (error) {
      console.error("Error uploading profile image:", error)
      showAlert({
        icon: "error",
        header: "Upload image Profile",
        description: "Failed to upload profile image!",
        variant: "error",
        position: window.innerWidth < 768 ? "top-center" : "top-right",
        animation: window.innerWidth < 768 ? "slide-down" : "slide-left",
        duration: 3000,
        headerColor: "#9c0505",
        descriptionColor: "#9c0505",
        borderColor: "#9c0505",
        width: window.innerWidth < 768 ? "sm" : "md",
        responsiveMode: window.innerWidth < 768 ? "inline" : "stack",
      })
    } finally {
      setImageUploading(false)
    }
  }

  const saveProfile = async (e) => {
    e.preventDefault()
    setMessage({ type: "", text: "" })

    try {
      const userQuery = query(collection(db, "users"), where("email", "==", currentUser.email))

      const snapshot = await getDocs(userQuery)

      if (!snapshot.empty) {
        const userDoc = snapshot.docs[0]

        // Prepare data object based on user role
        const updateData = {
          name: profile.name,
          phone: profile.phone,
          department: profile.department,
          notifications: profile.notifications,
          profileImageUrl: profile.profileImageUrl,
          profileImagePath: profile.profileImagePath,
        }

        // Add role-specific fields
        if (profile.role === "student") {
          updateData.studentId = profile.studentId
          updateData.section = profile.section
          updateData.course = profile.course
          updateData.branch = profile.branch
          updateData.organization = profile.organization
        } else if (profile.role === "teacher") {
          updateData.teacherId = profile.teacherId
          updateData.department = profile.department
          updateData.position = profile.position
        } else if (profile.role === "registrar") {
          updateData.employeeId = profile.employeeId
          updateData.office = profile.office
        } else if (profile.role === "admin") {
          updateData.adminId = profile.adminId
          updateData.accessLevel = profile.accessLevel
        }

        await updateDoc(doc(db, "users", userDoc.id), updateData)
        showAlert({
          icon: "success",
          header: "Edit Profile",
          description: "Profile data saved successfully!",
          variant: "success",
          position: window.innerWidth < 768 ? "top-center" : "top-right",
          animation: window.innerWidth < 768 ? "slide-down" : "slide-left",
          duration: 3000,
          headerColor: "#086d3f",
          descriptionColor: "#086d3f",
          borderColor: "#086d3f",
          width: window.innerWidth < 768 ? "sm" : "md",
          responsiveMode: window.innerWidth < 768 ? "inline" : "stack",
        })
        setEditing(false)
      }
    } catch (error) {
      showAlert({
        icon: "error",
        header: "Edit Profile",
        description: "Profile data not save!",
        variant: "error",
        position: window.innerWidth < 768 ? "top-center" : "top-right",
        animation: window.innerWidth < 768 ? "slide-down" : "slide-left",
        duration: 3000,
        headerColor: "#9c0505",
        descriptionColor: "#9c0505",
        borderColor: "#9c0505",
        width: window.innerWidth < 768 ? "sm" : "md",
        responsiveMode: window.innerWidth < 768 ? "inline" : "stack",
      })
    }
  }

  const changePassword = async (e) => {
    e.preventDefault()
    setMessage({ type: "", text: "" })

    if (newPassword !== confirmPassword) {
      showAlert({
        icon: "error",
        header: "Edit Profile",
        description: "Changing password unsuccessfully, Confirm password didn't match!",
        variant: "error",
        position: window.innerWidth < 768 ? "top-center" : "top-right",
        animation: window.innerWidth < 768 ? "slide-down" : "slide-left",
        duration: 3000,
        headerColor: "#9c0505",
        descriptionColor: "#9c0505",
        borderColor: "#9c0505",
        width: window.innerWidth < 768 ? "sm" : "md",
        responsiveMode: window.innerWidth < 768 ? "inline" : "stack",
      })
      return
    }

    try {
      // Reauthenticate user first
      await reauthenticate(oldPassword)
      // Then update password
      await updatePassword(newPassword)

      setMessage({ type: "success", text: "Password changed successfully" })
      setOldPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error) {
      console.error("Error changing password:", error)
      let errorMessage = "Failed to change password"

      if (error.code === "auth/wrong-password") {
        errorMessage = "Current password is incorrect"
      } else if (error.code === "auth/weak-password") {
        errorMessage = "New password is too weak"
      }

      showAlert({
        icon: "error",
        header: "Edit Profile",
        description: `${errorMessage}`,
        variant: "error",
        position: window.innerWidth < 768 ? "top-center" : "top-right",
        animation: window.innerWidth < 768 ? "slide-down" : "slide-left",
        duration: 3000,
        headerColor: "#9c0505",
        descriptionColor: "#9c0505",
        borderColor: "#9c0505",
        width: window.innerWidth < 768 ? "sm" : "md",
        responsiveMode: window.innerWidth < 768 ? "inline" : "stack",
      })
    }
  }

  // Render fields specific to the user role
  const renderRoleSpecificFields = () => {
    switch (profile.role) {
      case "student":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Student ID</label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="studentId"
                  value={profile.studentId}
                  disabled
                  className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md bg-gray-50 dark:bg-zinc-900 text-gray-600 dark:text-gray-300"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Section</label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="section"
                  value={profile.section}
                  onChange={handleChange}
                  disabled={!editing}
                  className={`pl-10 w-full px-3 py-2 border rounded-md ${
                    editing
                      ? "border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-200"
                      : "border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-gray-600 dark:text-gray-400"
                  }`}
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Course</label>
              <div className="relative">
                <BookOpen className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="course"
                  value={profile.course}
                  onChange={handleChange}
                  disabled={!editing}
                  className={`pl-10 w-full px-3 py-2 border rounded-md ${
                    editing
                      ? "border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-200"
                      : "border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-gray-600 dark:text-gray-400"
                  }`}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Branch</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <select
                  name="branch"
                  value={profile.branch}
                  onChange={handleChange}
                  disabled={!editing}
                  className={`pl-10 w-full px-3 py-2 border rounded-md ${
                    editing
                      ? "border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-200"
                      : "border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  <option value="">Select Branch</option>
                  {branches.map((branch) => (
                    <option key={branch} value={branch}>
                      {branch}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Organization</label>
              <div className="relative">
                <UserCheck className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <select
                  name="organization"
                  value={profile.organization}
                  onChange={handleChange}
                  disabled={!editing}
                  className={`pl-10 w-full px-3 py-2 border rounded-md ${
                    editing
                      ? "border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-200"
                      : "border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  <option value="">Select Organization</option>
                  {organizations.map((org) => (
                    <option key={org} value={org}>
                      {org}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )
      case "teacher":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Teacher ID</label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="teacherId"
                  value={profile.teacherId}
                  onChange={handleChange}
                  disabled={!editing}
                  className={`pl-10 w-full px-3 py-2 border rounded-md ${
                    editing
                      ? "border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-200"
                      : "border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-gray-600 dark:text-gray-400"
                  }`}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Position</label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="position"
                  value={profile.position}
                  onChange={handleChange}
                  disabled={!editing}
                  className={`pl-10 w-full px-3 py-2 border rounded-md ${
                    editing
                      ? "border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-200"
                      : "border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-gray-600 dark:text-gray-400"
                  }`}
                />
              </div>
            </div>
          </div>
        )
      case "registrar":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Employee ID</label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="employeeId"
                  value={profile.employeeId}
                  onChange={handleChange}
                  disabled
                  className="pl-10 w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md bg-gray-50 dark:bg-zinc-900 text-gray-600 dark:text-gray-300"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Office</label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="office"
                  value={profile.office}
                  onChange={handleChange}
                  disabled={!editing}
                  className={`pl-10 w-full px-3 py-2 border rounded-md ${
                    editing
                      ? "border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-200"
                      : "border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-gray-600 dark:text-gray-400"
                  }`}
                />
              </div>
            </div>
          </div>
        )
      case "admin":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Admin ID</label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="adminId"
                  value={profile.adminId}
                  onChange={handleChange}
                  disabled={!editing}
                  className={`pl-10 w-full px-3 py-2 border rounded-md ${
                    editing
                      ? "border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-200"
                      : "border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-gray-600 dark:text-gray-400"
                  }`}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Access Level</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="accessLevel"
                  value={profile.accessLevel}
                  onChange={handleChange}
                  disabled={!editing}
                  className={`pl-10 w-full px-3 py-2 border rounded-md ${
                    editing
                      ? "border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-200"
                      : "border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-gray-600 dark:text-gray-400"
                  }`}
                />
              </div>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  // Get icon for current user role
  const getRoleIcon = () => {
    switch (profile.role) {
      case "student":
        return <GraduationCap className="h-6 w-6 text-indigo-600 mr-3" />
      case "teacher":
        return <School className="h-6 w-6 text-indigo-600 mr-3" />
      case "registrar":
        return <Briefcase className="h-6 w-6 text-indigo-600 mr-3" />
      case "admin":
        return <Lock className="h-6 w-6 text-indigo-600 mr-3" />
      default:
        return <User className="h-6 w-6 text-indigo-600 mr-3" />
    }
  }

  // Cache button component
  const CacheButton = () => {
    const getButtonText = () => {
      if (cacheStatus.isUnset) return "SETUP"
      return cacheStatus.isGranted ? "ON" : "OFF"
    }

    const getButtonTitle = () => {
      if (cacheStatus.isUnset) return "Click to set up cache preferences"
      return cacheStatus.isGranted ? "Cache is enabled - Click to disable" : "Cache is disabled - Click to enable"
    }

    return (
      <button
        onClick={handleCacheButtonClick}
        className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
          cacheStatus.isGranted
            ? "bg-green-100 text-green-700 hover:bg-green-200 border border-green-300"
            : cacheStatus.isUnset
              ? "bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300"
        }`}
        title={getButtonTitle()}
      >
        <Database
          className={`h-4 w-4 mr-2 ${
            cacheStatus.isGranted ? "text-green-600" : cacheStatus.isUnset ? "text-blue-600" : "text-gray-500"
          }`}
        />
        <span className="hidden sm:inline">Cache:</span>
        <span
          className={`ml-1 font-semibold ${
            cacheStatus.isGranted ? "text-green-700" : cacheStatus.isUnset ? "text-blue-700" : "text-gray-600"
          }`}
        >
          {getButtonText()}
        </span>
      </button>
    )
  }

  // Cache settings toggle component
  const CacheSettingsToggle = () => {
    const getToggleTitle = () => {
      if (cacheStatus.isUnset) return "Click to set up cache preferences"
      return cacheStatus.isGranted ? "Click to disable cache" : "Click to enable cache"
    }

    return (
      <button
        onClick={handleCacheButtonClick}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
          cacheStatus.isGranted ? "bg-green-600" : "bg-gray-200"
        }`}
        title={getToggleTitle()}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-zinc-800 transition-transform ${
            cacheStatus.isGranted ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900">
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Cache Permission Toast */}
        {showCacheToast && (
          <CachePermissionToast
            onPermissionSet={(granted) => {
              handleCachePermission(granted)
              setShowCacheToast(false)
            }}
            autoShow={false}
            position="top-right"
          />
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-center">
            {getRoleIcon()}
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">Your Profile</h1>
          </div>
          <div className="flex items-center space-x-3 mt-4 sm:mr-12 sm:mt-0">
            {/* Cache Permission Button */}
            <CacheButton />

            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center px-4 py-2 btn-primary rounded transition-colors text-sm font-medium"
                aria-label="Edit Profile"
              >
                <Edit className="h-4 w-4 mr-2" /> Edit Profile
              </button>
            )}
          </div>
        </div>

        {message.text && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-start ${
              message.type === "error"
                ? "bg-red-50 text-red-700 dark:bg-red-900 dark:text-red-200"
                : "bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-200"
            }`}
            role="alert"
          >
            {message.type === "error" ? (
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
            ) : (
              <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingAnimation type="spinner" size="md" variant="info" text="Loading profile, please wait..." />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Profile Information */}
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-700 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 flex justify-between items-center">
                  <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100">Profile Information</h2>
                  {editing && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setEditing(false)}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-700"
                        aria-label="Cancel Edit"
                      >
                        <X className="h-4 w-4 mr-1" /> Cancel
                      </button>
                      <button
                        onClick={saveProfile}
                        className="inline-flex items-center px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
                        aria-label="Save Profile"
                      >
                        <Save className="h-4 w-4 mr-1" /> Save
                      </button>
                    </div>
                  )}
                </div>

                <form className="p-6 space-y-6">
                  {/* Profile Image Section */}
                  <div className="flex flex-col items-center text-center space-y-4 p-6 rounded-lg shadow-sm bg-white dark:bg-zinc-900">
                    <div className="relative w-32 h-32 rounded-full bg-gray-200 dark:bg-zinc-800 overflow-hidden flex items-center justify-center group">
                      {imagePreview ? (
                        <img
                          src={imagePreview || "/placeholder.svg"}
                          alt="Image preview"
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : profile.profileImageUrl ? (
                        <img
                          src={profile.profileImageUrl || "/placeholder.svg"}
                          alt="Profile"
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : (
                        <User className="h-16 w-16 text-gray-400 dark:text-gray-500" />
                      )}
                      {editing && (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="absolute bottom-2 right-2 bg-white dark:bg-zinc-900 rounded-full p-2 shadow hover:bg-gray-100 dark:hover:bg-zinc-700 transition"
                          aria-label="Change Profile Image"
                        >
                          <Camera className="h-5 w-5 text-indigo-600" />
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col space-y-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!editing}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-200 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-700 transition disabled:opacity-50"
                        aria-label="Choose Image"
                      >
                        <Camera className="h-5 w-5 mr-2" />
                        Choose Image
                      </button>
                      {selectedImage && (
                        <button
                          type="button"
                          onClick={uploadProfileImage}
                          disabled={imageUploading}
                          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
                          aria-label="Upload Image"
                        >
                          {imageUploading ? (
                            <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                          ) : (
                            <Upload className="h-5 w-5 mr-2" />
                          )}
                          {imageUploading ? "Uploading..." : "Upload"}
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">JPG, PNG or GIF. Max size 5MB.</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Email</label>
                      <input
                        type="email"
                        name="email"
                        value={profile.email}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-zinc-900 text-gray-600 dark:text-gray-300"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Full Name</label>
                      <input
                        type="text"
                        name="name"
                        value={profile.name}
                        onChange={handleChange}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-zinc-900 text-gray-600 dark:text-gray-300"
                        autoComplete="name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Phone Number</label>
                      <input
                        type="tel"
                        name="phone"
                        value={profile.phone}
                        onChange={handleChange}
                        disabled={!editing}
                        className={`w-full px-3 py-2 border rounded-md ${
                          editing
                            ? "border-gray-300 dark:border-gray-600 bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-200"
                            : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-zinc-900 text-gray-600 dark:text-gray-400"
                        }`}
                        autoComplete="tel"
                      />
                    </div>

                    {profile.role !== "student" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Department</label>
                        <input
                          type="text"
                          name="department"
                          value={profile.department}
                          onChange={handleChange}
                          disabled={!editing}
                          className={`w-full px-3 py-2 border rounded-md ${
                            editing
                              ? "border-gray-300 dark:border-gray-600 bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-200"
                              : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-zinc-900 text-gray-600 dark:text-gray-400"
                          }`}
                          autoComplete="organization"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Role</label>
                      <input
                        type="text"
                        value={profile.role}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-zinc-900 text-gray-600 dark:text-gray-300 capitalize"
                      />
                    </div>
                  </div>

                  {/* Role-specific fields section */}
                  {profile.role && (
                    <div className="border-t border-gray-200 dark:border-zinc-700 pt-6">
                      <h3 className="text-md font-medium text-gray-800 dark:text-gray-100 mb-4 capitalize">{profile.role} Information</h3>
                      {renderRoleSpecificFields()}
                    </div>
                  )}
                </form>
              </div>
            </div>

            {/* Security Section */}
            <div>
              <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-700 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800">
                  <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100">Security</h2>
                </div>

                <form onSubmit={changePassword} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Current Password</label>
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-200"
                      required
                      autoComplete="current-password"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-200"
                      required
                      minLength="6"
                      autoComplete="new-password"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-200"
                      required
                      minLength="6"
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full inline-flex justify-center items-center px-4 py-2 btn-primary rounded transition-colors text-sm font-medium"
                    >
                      <Lock className="h-4 w-4 mr-2" /> Change Password
                    </button>
                  </div>
                </form>
              </div>

              {/* Cache Settings Section */}
              <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-700 overflow-hidden mt-6">
                <div className="px-6 py-5 border-b border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800">
                  <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100 flex items-center">
                    <Settings className="h-5 w-5 mr-2" />
                    Cache Settings
                  </h2>
                </div>

                <div className="p-6">
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-900 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Database className={`h-6 w-6 ${cacheStatus.isGranted ? "text-green-600" : "text-gray-400"}`} />
                      <div>
                        <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100">Data Caching</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {cacheStatus.isGranted
                            ? "Cache is enabled for faster loading"
                            : cacheStatus.isUnset
                              ? "Cache permission not set"
                              : "Cache is disabled"}
                        </p>
                      </div>
                    </div>
                    <CacheSettingsToggle />
                  </div>

                  <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                    <p>
                      When enabled, data is saved locally for faster loading. Don't worry, your data stays on your
                      device.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}