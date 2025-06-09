class GoogleSheetsService {
  constructor() {
    this.apiKey = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY
    this.clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    this.discoveryDoc = "https://sheets.googleapis.com/$discovery/rest?version=v4";
    this.scopes = "https://www.googleapis.com/auth/spreadsheets";
    this.isInitialized = false
    this.accessToken = null
    this.tokenClient = null
  }

  // Initialize Google API and Identity Services
  async initialize() {
    if (this.isInitialized) return

    try {
      // Load the Google API client
      await new Promise((resolve, reject) => {
        window.gapi.load("client", {
          callback: resolve,
          onerror: reject,
        })
      })

      // Initialize the API client
      await window.gapi.client.init({
        apiKey: this.apiKey,
        discoveryDocs: [this.discoveryDoc],
      })

      // Initialize Google Identity Services
      if (window.google && window.google.accounts) {
        this.tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: this.clientId,
          scope: this.scopes,
          callback: (response) => {
            if (response.error) {
              console.error("Token client error:", response.error)
              return
            }
            this.accessToken = response.access_token
            window.gapi.client.setToken({ access_token: this.accessToken })
          },
        })
      } else {
        throw new Error("Google Identity Services not loaded. Make sure to include the GIS script.")
      }

      this.isInitialized = true
      console.log("Google API and Identity Services initialized successfully")
    } catch (error) {
      console.error("Error initializing Google API:", error)
      throw new Error("Failed to initialize Google API: " + error.message)
    }
  }

  // Sign in user using Google Identity Services
  async signIn() {
    if (!this.isInitialized) {
      await this.initialize()
    }

    try {
      if (!this.tokenClient) {
        throw new Error("Token client not initialized")
      }

      // Request access token
      return new Promise((resolve, reject) => {
        this.tokenClient.callback = (response) => {
          if (response.error) {
            reject(new Error("Authentication failed: " + response.error))
            return
          }
          this.accessToken = response.access_token
          window.gapi.client.setToken({ access_token: this.accessToken })
          resolve(this.accessToken)
        }

        this.tokenClient.requestAccessToken({ prompt: "consent" })
      })
    } catch (error) {
      console.error("Sign in failed:", error)
      throw new Error("Authentication failed: " + error.message)
    }
  }

  // Check if user is currently signed in
  isSignedIn() {
    return this.accessToken !== null && window.gapi.client.getToken() !== null
  }

  // Extract Sheet ID from URL
  extractSheetId(url) {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    return match ? match[1] : null
  }

  // Check if sheet is accessible
  async checkSheetAccess(sheetId) {
    try {
      // Ensure we're initialized and signed in
      if (!this.isInitialized) {
        await this.initialize()
      }

      if (!this.isSignedIn()) {
        await this.signIn()
      }

      // Check if gapi.client.sheets is available
      if (!window.gapi.client.sheets) {
        throw new Error("Google Sheets API not loaded")
      }

      const response = await window.gapi.client.sheets.spreadsheets.get({
        spreadsheetId: sheetId,
      })

      return response.status === 200
    } catch (error) {
      console.error("Sheet access check failed:", error)
      return false
    }
  }

  // Clear sheet data
  async clearSheet(sheetId, range = "A1:Z1000") {
    try {
      if (!window.gapi.client.sheets) {
        throw new Error("Google Sheets API not loaded")
      }

      await window.gapi.client.sheets.spreadsheets.values.clear({
        spreadsheetId: sheetId,
        range: range,
      })
      return true
    } catch (error) {
      console.error("Error clearing sheet:", error)
      return false
    }
  }

  // Upload data to Google Sheets
  async uploadData(sheetId, data, sheetName = "sheet1") {
    try {
      // Ensure we're properly authenticated
      if (!this.isInitialized) {
        await this.initialize()
      }

      if (!this.isSignedIn()) {
        await this.signIn()
      }

      if (!window.gapi.client.sheets) {
        throw new Error("Google Sheets API not loaded")
      }

      // Clear existing data first
      await this.clearSheet(sheetId, `${sheetName}!A1:Z1000`)

      // Upload new data
      const response = await window.gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${sheetName}!A1`,
        valueInputOption: "USER_ENTERED",
        resource: {
          values: data,
        },
      })

      return response.status === 200
    } catch (error) {
      console.error("Error uploading to Google Sheets:", error)
      throw error
    }
  }

  // Sign out user
  signOut() {
    if (this.accessToken) {
      window.google.accounts.oauth2.revoke(this.accessToken)
      this.accessToken = null
      window.gapi.client.setToken(null)
    }
  }

  // Format profile image URL as Google Sheets IMAGE formula
  formatImageUrl(imageUrl, mode = 4, height = 30, width = 30) {
    if (!imageUrl || imageUrl.trim() === "") {
      return ""
    }

    // Clean the URL and escape quotes
    const cleanUrl = imageUrl.trim().replace(/"/g, '""')

    // Return IMAGE formula with specified parameters
    return `=IMAGE("${cleanUrl}", ${mode}, ${height}, ${width})`
  }

  // Format attendee data for sheets
  prepareAttendeeData(attendees, eventTitle) {
    const headers = [
      "Event Title",
      "Name",
      "Email",
      "Student ID",
      "Course",
      "Registration Date",
      "Status",
      "Registration Method",
      "Profile Image",
    ]

    const rows = attendees.map((attendee) => [
      eventTitle,
      attendee.name || attendee.userName || attendee.NFCuserName || "",
      attendee.email || attendee.NFCregisteredByEmail || attendee.userEmail || "",
      attendee.studentId || attendee.NFCuserId || attendee.userId || "",
      attendee.course || attendee.NFCcourse || "",
      this.formatTimestamp(attendee.registrationTime || attendee.NFCregisteredAt),
      this.getStatusText(attendee),
      this.getRegistrationMethod(attendee),
      this.formatImageUrl(attendee.profileImage || attendee.NFCuserImageProfile || ""),
    ])

    return [headers, ...rows]
  }

  // Format attendance data for sheets
  prepareAttendanceData(attendanceData, sessionTitle) {
    const headers = [
      "Session Title",
      "Student ID",
      "Name",
      "Email",
      "Course",
      "Section",
      "Check-in Time",
      "Status",
      "Session Date",
      "Room",
      "Attendance Code",
      "Registration Method",
      "Profile Image",
    ]

    const rows = attendanceData.map((student) => [
      sessionTitle || "N/A",
      student.studentId || "N/A",
      student.name || "N/A",
      student.email || "N/A",
      student.course || "N/A",
      student.section || "N/A",
      student.checkInTime ? this.formatTimestamp(student.checkInTime) : "N/A",
      student.status || "N/A",
      student.sessionDate || "N/A",
      student.room || "N/A",
      student.attendanceCode || "N/A",
      student.registrationMethod || "Manual Check-in",
      this.formatImageUrl(student.profileImageUrl || ""),
    ])

    return [headers, ...rows]
  }

  // Helper methods
  formatTimestamp(timestamp) {
    if (!timestamp) return "Unknown"
    try {
      const date =
        typeof timestamp === "string"
          ? new Date(timestamp)
          : timestamp.toDate
            ? timestamp.toDate()
            : new Date(timestamp)
      return date.toLocaleString()
    } catch (e) {
      return "Invalid date"
    }
  }

  getStatusText(attendee) {
    if (attendee.type === "pre-registered") return "Pre-registered"
    if (attendee.NFCstatus === "student" || attendee.status === "student") return "Registered"
    return attendee.NFCstatus || attendee.status || "Unknown"
  }

  getRegistrationMethod(attendee) {
    if (attendee.type === "pre-registered") return "Pre-registration"
    if (attendee.NFCregistrationMethod === "NFC") return "NFC Registration"
    if (attendee.registrationMethod === "QR") return "QR Registration"
    if (attendee.registrationMethod === "HW-NFC") return "HW Registration"
    return "WIFI Registration"
  }
}

export default new GoogleSheetsService()