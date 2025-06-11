"use client"

import { useState, useEffect } from "react"
import { CheckCircle, User, Users, X } from "lucide-react"

export default function StudentDetailsModal({
  isVisible,
  userData,
  eventData,
  registrationMethod = "NFC",
  onClose,
  autoCloseDelay = 10000,
}) {
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    if (isVisible && autoCloseDelay > 0) {
      const timer = setTimeout(() => {
        handleClose()
      }, autoCloseDelay)

      return () => clearTimeout(timer)
    }
  }, [isVisible, autoCloseDelay])

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => {
      setIsClosing(false)
      onClose()
    }, 300) // Animation duration
  }

  if (!isVisible || !userData) return null

  // Custom styles for animations
  const customStyles = `
    @keyframes modal-enter {
      from { 
        opacity: 0; 
        transform: scale(0.9) translateY(-40px); 
      }
      to { 
        opacity: 1; 
        transform: scale(1) translateY(0); 
      }
    }
    
    @keyframes modal-exit {
      from { 
        opacity: 1; 
        transform: scale(1) translateY(0); 
      }
      to { 
        opacity: 0; 
        transform: scale(0.9) translateY(-40px); 
      }
    }
    
    @keyframes success-ripple {
      0% { transform: scale(1); opacity: 0.8; }
      100% { transform: scale(1.4); opacity: 0; }
    }
    
    @keyframes fade-in-up {
      from { 
        opacity: 0; 
        transform: translateY(32px); 
      }
      to { 
        opacity: 1; 
        transform: translateY(0); 
      }
    }
    
    @keyframes checkmark-scale {
      0% { transform: scale(0); }
      50% { transform: scale(1.2); }
      100% { transform: scale(1); }
    }
    
    .animate-modal-enter {
      animation: modal-enter 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }
    
    .animate-modal-exit {
      animation: modal-exit 0.3s cubic-bezier(0.55, 0.06, 0.68, 0.19);
    }
    
    .animate-success-ripple {
      animation: success-ripple 0.8s ease-out;
    }
    
    .animate-fade-in-up {
      animation: fade-in-up 0.4s ease-out;
    }
    
    .animate-checkmark-scale {
      animation: checkmark-scale 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) 0.2s both;
    }
    
    .material-shadow {
      box-shadow: 0 8px 32px rgba(56, 178, 255, 0.15), 0 4px 16px rgba(0, 0, 0, 0.1);
    }
    
    .material-ripple {
      position: relative;
      overflow: hidden;
    }
    
    .material-ripple::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 0;
      height: 0;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.3);
      transform: translate(-50%, -50%);
      transition: width 0.6s, height 0.6s;
    }
    
    .material-ripple:hover::before {
      width: 300px;
      height: 300px;
    }
  `

  return (
    <>
      <style>{customStyles}</style>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-md">
        <div
          className={`bg-white rounded-3xl material-shadow w-full max-w-sm mx-4 overflow-hidden ${
            isClosing ? "animate-modal-exit" : "animate-modal-enter"
          }`}
        >
          {/* Header with Material Design elevation */}
          <div className="bg-gradient-to-br from-sky-400 via-sky-500 to-sky-600 px-6 py-8 text-white relative overflow-hidden material-ripple">
            {/* Material Design background pattern */}
            <div className="absolute inset-0 opacity-20">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=&quot;40&quot; height=&quot;40&quot; viewBox=&quot;0 0 40 40&quot; xmlns=&quot;http://www.w3.org/2000/svg&quot;%3E%3Cg fill=&quot;%23ffffff&quot; fillOpacity=&quot;0.1&quot;%3E%3Cpath d=&quot;M20 20c0-5.5-4.5-10-10-10s-10 4.5-10 10 4.5 10 10 10 10-4.5 10-10zm10 0c0-5.5-4.5-10-10-10s-10 4.5-10 10 4.5 10 10 10 10-4.5 10-10z&quot;/%3E%3C/g%3E%3C/svg%3E')]"></div>
            </div>

            <div className="relative flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className="bg-white/20 rounded-full p-3 animate-success-ripple">
                  <CheckCircle className="h-8 w-8 text-white animate-checkmark-scale" />
                </div>
                <div>
                  <h2 className="text-2xl font-medium tracking-wide">Registered!</h2>
                  <p className="text-sky-100 text-sm font-normal">via {registrationMethod}</p>
                </div>
              </div>

              {autoCloseDelay === 0 && (
                <button 
                  onClick={handleClose} 
                  className="text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-full"
                >
                  <X className="h-6 w-6" />
                </button>
              )}
            </div>
          </div>

          {/* Student Details - Material Design Cards */}
          <div className="p-8 space-y-6">
            {/* Profile Section */}
            <div className="flex flex-col items-center text-center animate-fade-in-up">
              <div className="relative mb-6">
                {userData.profileImage || userData.profileImageUrl ? (
                  <img
                    src={userData.profileImage || userData.profileImageUrl}
                    alt={userData.name || userData.displayName}
                    className="w-32 h-32 rounded-full object-cover border-4 border-sky-100 shadow-xl"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center border-4 border-sky-100 shadow-xl">
                    <User className="h-16 w-16 text-white" />
                  </div>
                )}
                <div className="absolute -bottom-2 -right-2 bg-sky-500 rounded-full p-2 shadow-lg">
                  <CheckCircle className="h-6 w-6 text-white" />
                </div>
              </div>

              <h3 className="text-2xl font-medium text-gray-800 mb-1">
                {userData.name || userData.displayName || "Student"}
              </h3>
              <p className="text-gray-500 text-sm font-normal">
                ID: {userData.usersId || userData.studentId || userData.id || "N/A"}
              </p>
            </div>

            {/* Section Card - Material Design */}
            <div className="animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
              <div className="bg-sky-50 border border-sky-100 rounded-2xl p-6 hover:shadow-md transition-all duration-300">
                <div className="flex items-center space-x-4">
                  <div className="bg-sky-500 rounded-full p-3 shadow-sm">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sky-600 text-sm font-medium uppercase tracking-wider mb-1">Section</p>
                    <p className="text-gray-800 text-lg font-medium">
                      {userData.section || userData.course || "Not specified"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Status Card */}
            <div className="flex justify-center animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
              <div className="bg-sky-100 text-sky-800 px-6 py-3 rounded-full text-sm font-medium flex items-center space-x-3 shadow-sm">
                <CheckCircle className="h-5 w-5" />
                <span>Successfully Registered</span>
              </div>
            </div>

            {/* Auto-close indicator */}
            {autoCloseDelay > 0 && (
              <div className="flex justify-center animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
                <div className="text-xs text-gray-400 flex items-center space-x-2">
                  <div className="w-2 h-2 bg-sky-400 rounded-full animate-pulse"></div>
                  <span>Auto-closing in {Math.ceil(autoCloseDelay / 1000)} seconds</span>
                </div>
              </div>
            )}
          </div>

          {/* Material Design Progress bar */}
          {autoCloseDelay > 0 && (
            <div className="h-1 bg-sky-100">
              <div
                className="h-full bg-gradient-to-r from-sky-400 to-sky-600 transition-all ease-linear shadow-sm"
                style={{
                  width: "100%",
                  animation: `shrink ${autoCloseDelay}ms linear`,
                }}
              ></div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </>
  )
}