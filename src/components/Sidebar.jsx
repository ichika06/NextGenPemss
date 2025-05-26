/**
 * Sidebar component that displays user information and navigation links based on the user's role.
 * @param {{string}} role - The role of the user (e.g., student, teacher, registrar, admin).
 * @param {{boolean}} isOpen - Flag indicating whether the sidebar is open or closed.
 * @param {{function}} setIsOpen - Function to toggle the sidebar open/close state.
 * @returns JSX element representing the sidebar component.
 */
"use client"

import { useState, useEffect } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { useNotifications } from "../contexts/NotificationContext"
import {
  LogOut,
  Menu,
  X,
  Loader
} from "lucide-react"
import logo from "../assets/next-gen-pemss-logo.svg"

// Import UserDataService directly to avoid circular dependencies
import UserDataService from "../components/reuseRegistration/UserDataService"
// Import UserStorageService for profile image
import UserStorageService from "../components/reuseRegistration/UserStorageService"
// Import the new SidebarNavigation component
import SidebarNavigation from "./SidebarNavigation"

export default function Sidebar({ role, isOpen, setIsOpen }) {
  const { logout, currentUser } = useAuth()
  const { unreadCount } = useNotifications()
  const navigate = useNavigate()
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileImageUrl, setProfileImageUrl] = useState(null)

  // Track window resize for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
      if (window.innerWidth >= 1024) {
        setIsOpen(false) // Close mobile menu when screen becomes large
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [setIsOpen])

  // Fetch user data and profile image from Firestore/Storage when component mounts
  useEffect(() => {
    const fetchUserData = async () => {
      if (currentUser?.uid) {
        try {
          setLoading(true)
          
          // Fetch user data
          const data = await UserDataService.getUserData(currentUser.uid)
          setUserData(data)
          
          // Try to fetch profile image
          try {
            // List files in the profile folder
            const { files } = await UserStorageService.listUserFiles(currentUser.uid, "profile")
            
            // Find profile image (assuming it follows the naming pattern from UserStorageService)
            const profileImage = files.find(file => 
              file.name.startsWith('profile-image') || 
              file.name.includes('profile')
            )
            
            if (profileImage && profileImage.url) {
              setProfileImageUrl(profileImage.url)
            }
          } catch (imageError) {
            console.error("Failed to fetch profile image:", imageError)
            // Continue without profile image
          }
        } catch (error) {
          console.error("Failed to fetch user data:", error)
        } finally {
          setLoading(false)
        }
      } else {
        setLoading(false)
      }
    }
    
    fetchUserData()
  }, [currentUser])

  const handleLogout = async () => {
    try {
      await logout()
      navigate("/login")
    } catch (error) {
      console.error("Failed to log out", error)
    }
  }

  // Get first letter of name or email for avatar (fallback if no image)
  const getInitial = () => {
    if (userData?.name) {
      return userData.name.charAt(0).toUpperCase()
    }
    return currentUser?.email?.charAt(0)?.toUpperCase() || "U"
  }

  // Render role-specific information
  const renderRoleSpecificInfo = () => {
    if (loading) return "Loading...";
    if (!userData) return capitalize(role);
    
    switch (role) {
      case "student":
        return userData.studentId ? `ID: ${userData.studentId}` : capitalize(role);
      case "teacher":
        return userData.department ? `${capitalize(userData.department)}` : capitalize(role);
      case "registrar":
        return userData.office ? `${capitalize(userData.office)}` : capitalize(role);
      case "admin":
        return userData.accessLevel ? `Access: ${capitalize(userData.accessLevel)}` : capitalize(role);
      default:
        return capitalize(role);
    }
  }
  
  // Helper function to capitalize first letter
  const capitalize = (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // User Profile Display Component - Updated with profile image
  const UserProfileDisplay = ({isMobile = false}) => (
    <div className={`flex items-center ${isMobile ? '' : ''}`}>
      <div className="flex-shrink-0">
        {loading ? (
          <div className={`${isMobile ? 'h-12 w-12' : 'h-10 w-10'} rounded-full bg-gray-200 flex items-center justify-center`}>
            <Loader className="h-5 w-5 text-gray-400 animate-spin" />
          </div>
        ) : profileImageUrl ? (
          <div className={`${isMobile ? 'h-12 w-12' : 'h-10 w-10'} rounded-full bg-gray-100 overflow-hidden border border-gray-200`}>
            <img 
              src={profileImageUrl} 
              alt="Profile" 
              className="h-full w-full object-cover"
              onError={(e) => {
                // Fallback to initials if image fails to load
                e.target.style.display = 'none';
                e.target.parentNode.classList.add('flex', 'items-center', 'justify-center', 'bg-indigo-100', 'text-indigo-600', 'font-semibold');
                e.target.parentNode.innerHTML = getInitial();
              }}
            />
          </div>
        ) : (
          <div className={`${isMobile ? 'h-12 w-12' : 'h-10 w-10'} rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold ${isMobile ? 'text-xl' : 'text-lg'}`}>
            {getInitial()}
          </div>
        )}
      </div>
      <div className={`${isMobile ? 'ml-4' : 'ml-3'} overflow-hidden`}>
        <p className={`${isMobile ? 'text-base' : 'text-sm'} font-medium text-gray-900 truncate`}>
          {loading ? "Loading..." : userData?.name || currentUser?.email || "User"}
        </p>
        <p className={`${isMobile ? 'text-sm' : 'text-xs'} text-gray-500 truncate`}>
          {renderRoleSpecificInfo()}
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 right-4 z-40">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2.5 rounded-full bg-indigo-600 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-md hover:bg-indigo-700 transition-colors"
          aria-label="Toggle menu"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Sidebar for desktop */}
      <div
        className={`hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:border-r lg:border-gray-200 lg:bg-white lg:shadow-sm z-30`}
      >
        <div className="flex flex-col h-full">
          {/* Logo and header */}
          <div className="flex items-center h-16 px-6 border-b border-gray-200">
            <Link to={`/${role}`} className="flex items-center space-x-2">
              <div className="text-white p-1.5 rounded">
                <img src={logo} className="h-8 w-auto rounded" alt="NextGen-Pemss Logo" />
              </div>
              <span className="text-l font-bold text-gray-900">NextGen-Pemss</span>
            </Link>
          </div>

          {/* User info - Updated */}
          <div className="px-4 py-4 border-b border-gray-200">
            <UserProfileDisplay />
          </div>

          {/* Navigation - Using the new SidebarNavigation component */}
          <SidebarNavigation 
            role={role} 
            accessLevel={userData?.accessLevel} 
            unreadCount={unreadCount} 
            setIsOpen={setIsOpen} 
            windowWidth={windowWidth} 
          />

          {/* Logout button */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="w-full flex items-center px-4 py-2 text-sm font-medium text-red-600 rounded-md hover:bg-red-50 transition-colors"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Mobile sidebar backdrop */}
      <div
        className={`lg:hidden fixed inset-0 bg-gray-800 bg-opacity-50 backdrop-blur-sm z-30 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      ></div>

      {/* Mobile sidebar */}
      <div
        className={`lg:hidden fixed inset-y-0 right-0 w-full max-w-xs bg-white shadow-xl z-40 transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Close button - only shown when menu is open */}
          <div className="absolute top-4 right-4">
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Logo and header */}
          <div className="flex items-center h-20 px-6 border-b border-gray-200">
            <Link to={`/${role}`} className="flex items-center space-x-2" onClick={() => setIsOpen(false)}>
              <div className="text-white p-1.5 rounded">
                <img src={logo} className="h-10 w-auto rounded" alt="NextGen-Pemss Logo" />
              </div>
              <span className="text-xl font-bold text-gray-900">NextGen-Pemss</span>
            </Link>
          </div>

          {/* User info - Updated for mobile */}
          <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
            <UserProfileDisplay isMobile={true} />
          </div>

          {/* Navigation - Using the new SidebarNavigation component */}
          <SidebarNavigation 
            role={role} 
            accessLevel={userData?.accessLevel} 
            unreadCount={unreadCount} 
            setIsOpen={setIsOpen} 
            windowWidth={windowWidth} 
          />

          {/* Logout button */}
          <div className="p-6 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center px-4 py-3 text-base font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Logout
            </button>
          </div>
        </div>
      </div>
    </>
  )
}