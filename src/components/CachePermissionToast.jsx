"use client"

import { useState, useEffect } from "react"
import { X, Database, Zap, Clock, Shield } from "lucide-react"

const CachePermissionToast = ({ onPermissionSet, autoShow = true, className = "", position = "top-right" }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (autoShow) {
      // Check if permission was already set
      const existingPermission = localStorage.getItem("events_cache_permission")
      if (!existingPermission || existingPermission === "null") {
        // Show toast after a short delay
        const timer = setTimeout(() => {
          setIsVisible(true)
          setIsAnimating(true)
        }, 1000)
        return () => clearTimeout(timer)
      }
    }
  }, [autoShow])

  const handlePermission = (granted) => {
    setIsAnimating(false)

    setTimeout(() => {
      setIsVisible(false)
      onPermissionSet(granted)
    }, 300)
  }

  const handleClose = () => {
    handlePermission(false)
  }

  const getPositionClasses = () => {
    const positions = {
      "top-right": "top-4 right-4",
      "top-left": "top-4 left-4",
      "top-center": "top-4 left-1/2 transform -translate-x-1/2",
      "bottom-right": "bottom-4 right-4",
      "bottom-left": "bottom-4 left-4",
      "bottom-center": "bottom-4 left-1/2 transform -translate-x-1/2",
    }
    return positions[position] || positions["top-right"]
  }

  if (!isVisible) return null

  return (
    <div
      className={`fixed ${getPositionClasses()} z-50 transition-all duration-300 ease-in-out ${
        isAnimating ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
      } ${className}`}
    >
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 max-w-sm w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-3 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Database className="h-5 w-5" />
              <h3 className="font-semibold text-sm">Boost Load of Pages</h3>
            </div>
            <button onClick={handleClose} className="text-white hover:text-gray-200 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-gray-700 text-sm mb-4">
            Allow us to save data locally for faster loading of pages?
          </p>

          {/* Benefits */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center space-x-2 text-xs text-gray-600">
              <Zap className="h-3 w-3 text-green-500" />
              <span>Faster page loads</span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-gray-600">
              <Shield className="h-3 w-3 text-purple-500" />
              <span>Data stays on your device</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2">
            <button
              onClick={() => handlePermission(true)}
              className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-sm font-medium py-2 px-3 rounded-md transition-all duration-200 transform hover:scale-105 active:scale-95"
            >
              Allow
            </button>
            <button
              onClick={() => handlePermission(false)}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 px-3 rounded-md transition-colors"
            >
              Not Now
            </button>
          </div>

          {/* Footer note */}
          <p className="text-xs text-gray-500 mt-3 text-center">You can change this in profile anytime</p>
        </div>
      </div>
    </div>
  )
}

export default CachePermissionToast