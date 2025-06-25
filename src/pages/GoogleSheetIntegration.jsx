import { useState, useEffect } from "react"
import { Upload, Link, AlertCircle, CheckCircle, Loader, Info } from "lucide-react"
import GoogleSheetsService from "../utils/googleSheetsService"

const GoogleSheetsUploader = ({ attendeesData, eventTitle, dataType = "event" }) => {
  const [sheetUrl, setSheetUrl] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)
  const [error, setError] = useState("")
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)

  useEffect(() => {
    // Load Google API script
    const gapiScript = document.createElement("script")
    gapiScript.src = "https://apis.google.com/js/api.js"

    // Load Google Identity Services script
    const gisScript = document.createElement("script")
    gisScript.src = "https://accounts.google.com/gsi/client"

    const loadScripts = async () => {
      document.body.appendChild(gapiScript)
      document.body.appendChild(gisScript)

      // Wait for both scripts to load
      await Promise.all([
        new Promise((resolve) => {
          gapiScript.onload = resolve
        }),
        new Promise((resolve) => {
          gisScript.onload = resolve
        }),
      ])

      try {
        await GoogleSheetsService.initialize()
        setIsSignedIn(GoogleSheetsService.isSignedIn())
      } catch (error) {
        console.error("Failed to initialize Google Sheets Service:", error)
      }
    }

    loadScripts()

    return () => {
      if (document.body.contains(gapiScript)) {
        document.body.removeChild(gapiScript)
      }
      if (document.body.contains(gisScript)) {
        document.body.removeChild(gisScript)
      }
    }
  }, [])

  const validateSheetUrl = (url) => {
    const sheetId = GoogleSheetsService.extractSheetId(url)
    if (!sheetId) {
      setError("Invalid Google Sheets URL. Please provide a valid share link.")
      return false
    }
    setError("")
    return true
  }

  const handleSignIn = async () => {
    try {
      await GoogleSheetsService.signIn()
      setIsSignedIn(GoogleSheetsService.isSignedIn())
      setError("")
    } catch (err) {
      setError("Failed to sign in to Google. Please try again.")
    }
  }

  const uploadToGoogleSheets = async () => {
    if (!validateSheetUrl(sheetUrl)) return
    if (!attendeesData || attendeesData.length === 0) {
      setError("No attendee data to upload.")
      return
    }

    setIsUploading(true)
    setUploadStatus(null)
    setError("")

    try {
      // Sign in if not already signed in
      if (!isSignedIn) {
        await handleSignIn()
      }

      const sheetId = GoogleSheetsService.extractSheetId(sheetUrl)

      // Check if sheet is accessible
      const hasAccess = await GoogleSheetsService.checkSheetAccess(sheetId)
      if (!hasAccess) {
        throw new Error("Cannot access the Google Sheet. Please check sharing permissions.")
      }

      // Prepare data based on data type
      let sheetData
      if (dataType === "attendance") {
        sheetData = GoogleSheetsService.prepareAttendanceData(attendeesData, eventTitle)
      } else {
        sheetData = GoogleSheetsService.prepareAttendeeData(attendeesData, eventTitle)
      }

      const success = await GoogleSheetsService.uploadData(sheetId, sheetData)

      if (success) {
        setUploadStatus("success")
        setTimeout(() => setUploadStatus(null), 5000)
      } else {
        throw new Error("Upload failed")
      }
    } catch (err) {
      console.error("Error uploading to Google Sheets:", err)
      setError(err.message || "Failed to upload to Google Sheets. Please check the share link and permissions.")
      setUploadStatus("error")
    } finally {
      setIsUploading(false)
    }
  }

  const getDataTypeLabel = () => {
    return dataType === "attendance" ? "attendance records" : "attendees"
  }

  const getDataDescription = () => {
    if (dataType === "attendance") {
      return "Upload attendance data directly to your Google Sheets. The data will include student IDs, names, emails, check-in times, attendance status, course information, and session details."
    }
    return "Upload attendee data directly to your Google Sheets. The data will include names, emails, student IDs, courses, registration dates, and methods."
  }

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Upload className="h-5 w-5 text-green-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Upload to Google Sheets</h3>
        </div>
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="flex items-center space-x-1 text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 text-sm"
        >
          <Info className="h-4 w-4" />
          <span>Instructions</span>
        </button>
      </div>

      <p className="text-sm text-gray-600 dark:text-zinc-300">{getDataDescription()}</p>

      {showInstructions && (
        <div className="bg-blue-50 dark:bg-zinc-900 border border-blue-200 dark:border-zinc-900 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Setup Instructions:</h4>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li>Create a new Google Sheet or open an existing one</li>
            <li>Click the "Share" button (top right corner)</li>
            <li>Change "Restricted" to "Anyone with the link"</li>
            <li>Set permission to "Editor" (not "Viewer")</li>
            <li>Click "Copy link" and paste it below</li>
            <li>Click "Upload to Google Sheets" button</li>
          </ol>
          <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded">
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              <strong>Important:</strong> Make sure the sheet has "Editor" access, not just "Viewer" access, otherwise
              the upload will fail.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-zinc-200 mb-2">Google Sheets Share Link</label>
          <div className="relative">
            <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="url"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/your-sheet-id/edit?usp=sharing"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center space-x-2 text-red-600 dark:text-red-200 text-sm bg-red-50 dark:bg-red-900 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {uploadStatus === "success" && (
          <div className="flex items-center space-x-2 text-green-600 dark:text-green-200 text-sm bg-green-50 dark:bg-green-900 p-3 rounded-lg">
            <CheckCircle className="h-4 w-4" />
            <span>
              Successfully uploaded {attendeesData.length} {getDataTypeLabel()} to Google Sheets!
            </span>
          </div>
        )}

        <button
          onClick={uploadToGoogleSheets}
          disabled={!sheetUrl || isUploading || !attendeesData?.length}
          className="w-full flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 dark:bg-green-800 dark:hover:bg-green-900 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isUploading ? (
            <>
              <Loader className="h-4 w-4 animate-spin" />
              <span>Uploading to Google Sheets...</span>
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              <span>
                Upload to Google Sheets ({attendeesData?.length || 0} {getDataTypeLabel()})
              </span>
            </>
          )}
        </button>
      </div>

      {!isSignedIn && (
        <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            You'll need to sign in to your Google account when uploading for the first time.
          </p>
        </div>
      )}
    </div>
  )
}

export default GoogleSheetsUploader