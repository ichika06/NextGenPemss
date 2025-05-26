import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  increment,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../firebase/config";
import * as XLSX from "xlsx";
import {
  deleteAllExpiredPreRegistrations,
  deletePreRegisteredUser,
} from "../../pages/DeletePreregistered";
import { sendEmail, EmailTemplates } from "../../sendEmail";
import EventAttendanceWorkbook from "../../components/EventAttendanceWorkbook";
/**
 * Class for handling NFC scanning operations and Firebase interactions
 * Updated for better Electron integration
 */
export default class NFCScanner {
  constructor() {
    this.port = null;
    this.writer = null;
    this.isConnected = false;
    this.isScanning = false;
    this.lastScannedTag = "";
    this.availablePorts = [];
    this.db = getFirestore();
    this.serialDataHandlers = new Set();
    this.serialErrorHandlers = new Set();
    this.currentUser = null;
    this.currentUserData = null;

    // Check if we're running in Electron environment
    this.isElectron = window.SerialBridge && window.SerialBridge.isElectron;
    // Set up event listeners for electron serial data events
    if (this.isElectron) {
      this.setupElectronEventListeners();
    }
  }

  setCurrentUser(user) {
    this.currentUser = user;
  }
  
  setCurrentUserData(userData) {
    this.currentUserData = userData;
  }

  // USB VendorID:ProductID to friendly name mapping
  static USB_NAME_MAP = {
    "10c4:ea60": "NFC Scanner (Silicon Labs CP210x)",
    "0403:6001": "FTDI FT232 Device",
    "2341:0043": "Arduino Device",
  };

  // Set up event listeners for Electron serial data
  setupElectronEventListeners() {
    // Create handler for serial data events
    this.electronSerialDataHandler = (event) => {
      const data = event.detail;
      for (const handler of this.serialDataHandlers) {
        handler(data);
      }
    };

    // Create handler for serial error events
    this.electronSerialErrorHandler = (event) => {
      const error = event.detail;
      for (const handler of this.serialErrorHandlers) {
        handler(error);
      }
    };

    // Add global event listeners
    window.addEventListener("serial-data", this.electronSerialDataHandler);
    window.addEventListener("serial-error", this.electronSerialErrorHandler);
  }

  // Clean up event listeners when done
  removeElectronEventListeners() {
    if (this.electronSerialDataHandler) {
      window.removeEventListener("serial-data", this.electronSerialDataHandler);
    }
    if (this.electronSerialErrorHandler) {
      window.removeEventListener(
        "serial-error",
        this.electronSerialErrorHandler
      );
    }
  }

  // Check if port is Silicon Labs CP210x (common ESP32 USB chip)
  isSiliconLabsDevice(port) {
    try {
      const info = port.getInfo();
      const id = `${info.usbVendorId?.toString(
        16
      )}:${info.usbProductId?.toString(16)}`;
      return id === "10c4:ea60"; // Silicon Labs CP210x
    } catch {
      // For Electron, handle differently
      if (this.isElectron && port.vendorId && port.productId) {
        return (
          port.vendorId.toLowerCase() === "10c4" &&
          port.productId.toLowerCase() === "ea60"
        );
      }
      return false;
    }
  }

  // Get friendly device name for a serial port
  getFriendlyPortName(port, index) {
    try {
      // For Electron environment
      if (this.isElectron && port.vendorId && port.productId) {
        const id = `${port.vendorId.toLowerCase()}:${port.productId.toLowerCase()}`;
        const name =
          NFCScanner.USB_NAME_MAP[id] || `Serial Device (${port.path})`;
        return name;
      }

      // For Web Serial API
      const info = port.getInfo();
      const id = `${info.usbVendorId?.toString(
        16
      )}:${info.usbProductId?.toString(16)}`;
      const name = NFCScanner.USB_NAME_MAP[id] || "Unknown Device";
      return `${name}`;
    } catch {
      return `Unknown Port ${index + 1}`;
    }
  }

  // Check for available serial ports
  async checkForDevices() {
    try {
      // Check if we're in Electron environment
      if (this.isElectron) {
        console.log("Running in Electron environment, using SerialBridge");
        const ports = await window.SerialBridge.getSerialPorts();
        this.availablePorts = ports;

        // Check if any are Silicon Labs devices (CP210x)
        for (const port of ports) {
          if (
            port.vendorId &&
            port.vendorId.toLowerCase() === "10c4" &&
            port.productId &&
            port.productId.toLowerCase() === "ea60"
          ) {
            return { nfcScannerFound: true, ports };
          }
        }
        return { nfcScannerFound: false, ports };
      }

      // Web browser environment using Web Serial API
      if (!navigator.serial) {
        throw new Error(
          "Web Serial API is not supported in this browser. Please use Chrome or Edge."
        );
      }

      // Get available ports
      const ports = await navigator.serial.getPorts();
      this.availablePorts = ports;

      // Check if any are Silicon Labs devices
      for (const port of ports) {
        if (this.isSiliconLabsDevice(port)) {
          return { nfcScannerFound: true, ports };
        }
      }
      return { nfcScannerFound: false, ports };
    } catch (error) {
      console.error("Error checking ports:", error);
      throw error;
    }
  }

  // Connect to the USB device (ESP32)
  async connectToDevice() {
    try {
      // Check if we're in Electron
      if (this.isElectron) {
        return await this.connectToDeviceElectron();
      }

      // Web browser environment
      return await this.connectToDeviceBrowser();
    } catch (error) {
      console.error("Connection failed:", error);
      throw error;
    }
  }

  // Connect in Electron environment using SerialBridge
  async connectToDeviceElectron() {
    try {
      // Always get fresh list of ports through SerialBridge
      const ports = await window.SerialBridge.getSerialPorts();
      this.availablePorts = ports;

      // Close any existing port connection
      if (this.isConnected && this.port) {
        console.log("Closing previous port connection");
        await this.disconnectDevice();
      }

      console.log("Requesting port through SerialBridge");
      try {
        const targetPort = await window.SerialBridge.requestPort({});

        if (targetPort) {
          this.port = targetPort;
          console.log("Opening port connection via SerialBridge");
          const connection = await targetPort.open({ baudRate: 115200 });
          this.writer = connection.writable.getWriter();
          this.isConnected = true;

          // Instead of reading directly, we'll use the custom events from preload.js
          console.log("Setting up data handlers for Electron");

          // Send initialization command to verify communication
          try {
            console.log("Sending STATUS command to verify connection");
            await this.sendToDevice("STATUS");
            return {
              status: "Connected to NFC Scanner device",
              connected: true,
              deviceName: this.getFriendlyPortName(targetPort, 0),
            };
          } catch (comError) {
            console.error("Communication error:", comError);
            await this.disconnectDevice();
            throw new Error(
              "Failed to establish communication with NFC Scanner"
            );
          }
        }
      } catch (err) {
        console.error("Port selection failed:", err);
        throw new Error("No NFC Scanner device found or selection cancelled.");
      }
    } catch (error) {
      console.error("Electron connection failed:", error);
      throw error;
    }
  }

  // Connect in Web browser environment
  async connectToDeviceBrowser() {
    // The original connection logic for browser
    // Always get fresh list of ports
    this.availablePorts = await navigator.serial.getPorts();

    // Try to automatically find NFC Scanner device
    let targetPort = null;

    // First check already available ports
    for (const availablePort of this.availablePorts) {
      if (this.isSiliconLabsDevice(availablePort)) {
        targetPort = availablePort;
        console.log("Found Silicon Labs device in available ports");
        break;
      }
    }

    // If NFC Scanner device not found, request a port
    if (!targetPort) {
      try {
        console.log(
          "No Silicon Labs device found in available ports, requesting user selection"
        );
        // Request user to select a port (browser will filter by available ports)
        const port = await navigator.serial.requestPort({
          // Don't use filters here to allow user to select any port if Silicon Labs isn't detected
        });

        targetPort = port;
        console.log(
          "User selected port:",
          this.getFriendlyPortName(targetPort, 0)
        );
      } catch (err) {
        // User cancelled or no device found
        console.error("Port selection cancelled or failed:", err);
        throw new Error("No NFC Scanner device found or selection cancelled.");
      }
    }

    // Connect to the selected port
    if (targetPort) {
      // Close any existing port connection
      if (this.isConnected && this.port) {
        console.log("Closing previous port connection");
        await this.disconnectDevice();
      }

      console.log("Opening port connection");
      await targetPort.open({ baudRate: 115200 });
      const writableStream = targetPort.writable.getWriter();

      this.writer = writableStream;
      this.port = targetPort;
      this.isConnected = true;

      // Set up a reader for device responses
      this.setupPortReader(targetPort);

      // Send initialization command to verify communication
      try {
        console.log("Sending STATUS command to verify connection");
        await this.sendToDevice("STATUS");
        return {
          status: "Connected to NFC Scanner device",
          connected: true,
          deviceName: this.getFriendlyPortName(targetPort, 0),
        };
      } catch (comError) {
        console.error("Communication error:", comError);
        await this.disconnectDevice();
        throw new Error("Failed to establish communication with NFC Scanner");
      }
    } else {
      throw new Error(
        "No NFC Scanner device found. Please connect your device and try again."
      );
    }
  }

  async handlePortChange() {
    // Disconnect from current port
    await this.disconnectDevice();

    // Refresh available ports (browser or electron)
    if (this.isElectron) {
      this.availablePorts = await window.SerialBridge.getSerialPorts();
    } else {
      this.availablePorts = await navigator.serial.getPorts();
    }

    // Attempt to reconnect
    return await this.connectToDevice();
  }

  monitorConnection() {
    // Check if the device is still connected every few seconds
    setInterval(async () => {
      if (this.isConnected && this.port) {
        try {
          // Try sending a lightweight command
          await this.sendToDevice("STATUS");
        } catch (error) {
          console.log("Connection lost, attempting to reconnect...");
          this.isConnected = false;
          try {
            await this.handlePortChange();
          } catch (reconnectError) {
            console.error("Reconnection failed:", reconnectError);
          }
        }
      }
    }, 5000); // Check every 5 seconds
  }

  // Set up a port reader for Web Serial API
  setupPortReader(port) {
    if (!this.isElectron) {
      // Implementation for Web Serial API
      console.log("Setting up Web Serial API port reader");
    }
    console.log("Port reader setup complete");
  }

  // Disconnect from the USB device
  async disconnectDevice() {
    try {
      if (this.writer) {
        try {
          this.writer.releaseLock();
        } catch (e) {
          console.warn("Error releasing writer lock:", e);
        }
        this.writer = null;
      }

      if (this.port) {
        // Handle both Electron and Web Serial API environments
        if (this.isElectron) {
          // For Electron, use SerialBridge to close the port
          try {
            if (
              window.SerialBridge &&
              typeof window.SerialBridge.closePort === "function"
            ) {
              await window.SerialBridge.closePort(this.port.path);
            }
          } catch (e) {
            console.warn("Error closing port via SerialBridge:", e);
          }
        } else {
          // For Web Serial API
          try {
            if (typeof this.port.close === "function") {
              await this.port.close();
            }
          } catch (e) {
            console.warn("Error closing port:", e);
          }
        }
        this.port = null;
      }

      this.isConnected = false;
      return { status: "Disconnected", connected: false };
    } catch (error) {
      console.error("Error during device disconnection:", error);
      // Even if there's an error, reset the state
      this.port = null;
      this.writer = null;
      this.isConnected = false;
      return { status: "Disconnected with errors", connected: false };
    }
  }

  // Search Firestore for a matching tag
  async searchUserByNfcTag(tagValue) {
    try {
      const usersRef = collection(this.db, "users");

      // Create a query against the collection
      const q = query(usersRef, where("uid", "==", tagValue));

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // Match found
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        userData.id = userDoc.id; // Add document ID to the data

        return { exists: true, userData };
      } else {
        return { exists: false, userData: null };
      }
    } catch (error) {
      console.error("Firestore search error:", error);
      throw error;
    }
  }

  // Check if user is already registered for an event
  async checkUserEventRegistration(userId, eventId) {
    try {
      const attendeesRef = collection(this.db, "eventAttendees");
      const q = query(
        attendeesRef,
        where("userId", "==", userId),
        where("eventId", "==", eventId)
      );

      const querySnapshot = await getDocs(q);
      return { isRegistered: !querySnapshot.empty };
    } catch (error) {
      console.error("Event registration check error:", error);
      throw error;
    }
  }

  // Check if event has an attendance sheet
  async checkEventAttendanceSheet(eventId) {
    try {
      const sheetRef = collection(this.db, "attendanceSheets");
      const q = query(sheetRef, where("eventId", "==", eventId));

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const docData = querySnapshot.docs[0].data();
        return { exists: true, documentData: docData };
      } else {
        return { exists: false, documentData: null };
      }
    } catch (error) {
      console.error("Attendance sheet check error:", error);
      throw error;
    }
  }

  updateFileRecord = async (
    eventId,
    fileName,
    filePath,
    downloadURL,
    fileSize,
    isPublic,
    storageFolder
  ) => {
    // Find any existing file records for this event
    const filesRef = collection(db, "files");
    const filesQuery = query(filesRef, where("relatedEventId", "==", eventId));
    const filesSnapshot = await getDocs(filesQuery);

    // Get any existing file records that match our attendance sheet pattern
    const attendanceFileDoc = filesSnapshot.docs.find((doc) => {
      const data = doc.data();
      return data.name.includes("attendees.xlsx");
    });

    if (attendanceFileDoc) {
      // Update the existing file record
      await updateDoc(attendanceFileDoc.ref, {
        name: fileName,
        path: filePath,
        downloadURL: downloadURL,
        size: fileSize,
        updatedAt: new Date().toISOString(),
      });
    } else {
      // Create a new file record
      await addDoc(collection(db, "files"), {
        name: fileName,
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: fileSize,
        path: filePath,
        downloadURL: downloadURL,
        userId: this.currentUserData.uid,
        userName: this.currentUserData.email,
        folder: storageFolder,
        isPublic: isPublic,
        uploadedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sharedWith: [],
        relatedEventId: eventId,
      });
    }
  };

  updateAttendanceSheet = async (
    userData,
    eventData,
    eventId,
    registeredDate,
    registeredTimestamp
  ) => {
    try {

      // Standardized filename based on event title
      const standardFileName = `${eventData.title.replace(/\s+/g, "_")}_attendees.xlsx`;

      // Determine the storage folder based on whether the event is public
      const storageFolder = eventData.isPublic
        ? "public/events"
        : `${this.currentUserData.uid}/event_data`;
      const standardFilePath = `${storageFolder}/${standardFileName}`;

      // Find the attendance sheet document if it exists
      const docsRef = collection(db, "eventDocuments");
      const docsQuery = query(
        docsRef,
        where("eventId", "==", eventId),
        where("documentType", "==", "attendeeSheet")
      );
      const docsSnapshot = await getDocs(docsQuery);

      // Prepare attendee data
      const attendeeData = {
        name: userData.name,
        email: userData.email,
        registeredDate: registeredDate,
        status: userData.role || "Attendee",
        notes: `Registered via Hardware scan on ${new Date(registeredTimestamp).toLocaleString()}`
      };

      let workbook;
      let blob;

      if (!docsSnapshot.empty) {
        // Get existing document data
        const docData = docsSnapshot.docs[0].data();
        const fileUrl = docData.fileUrl;

        try {
          // Download the existing file
          const response = await fetch(fileUrl);
          const fileBlob = await response.blob();

          // Read the Excel file
          const data = await fileBlob.arrayBuffer();
          workbook = XLSX.read(data, { type: "array" });
        } catch (err) {
          console.error("Error processing existing Excel file:", err);

          // Create a temporary EventAttendanceWorkbook and get the workbook from it
          const attendanceWorkbookResult = await new Promise(resolve => {
            const tempComponent = new EventAttendanceWorkbook({
              eventData,
              onWorkbookCreated: (result) => resolve(result),
              showDownloadButton: false,
              initialAttendees: [attendeeData]
            });

            // Create the workbook without rendering the component
            tempComponent.handleCreateWorkbook();
          });

          workbook = attendanceWorkbookResult.workbook;
        }
      } else {
        // Create a temporary EventAttendanceWorkbook and get the workbook from it
        const attendanceWorkbookResult = await new Promise(resolve => {
          const tempComponent = new EventAttendanceWorkbook({
            eventData,
            onWorkbookCreated: (result) => resolve(result),
            showDownloadButton: false,
            initialAttendees: [attendeeData]
          });

          // Create the workbook without rendering the component
          tempComponent.handleCreateWorkbook();
        });

        workbook = attendanceWorkbookResult.workbook;
      }

      // Process workbook to add the attendee if not already added with initialAttendees
      if (!docsSnapshot.empty) {
        const attendeesSheetName = "Event Attendees";
        if (workbook.SheetNames.includes(attendeesSheetName)) {
          const worksheet = workbook.Sheets[attendeesSheetName];

          // Convert the sheet to JSON with headers
          const rawData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: "",
          });

          // Check if we have at least the header row
          if (rawData.length >= 1) {
            // Check if the user is already registered by finding their email
            let existingUserIndex = -1;
            for (let i = 1; i < rawData.length; i++) {
              if (rawData[i][1] === userData.email) {
                existingUserIndex = i;
                break;
              }
            }

            if (existingUserIndex !== -1) {
              // Update existing user data
              rawData[existingUserIndex] = [
                attendeeData.name,
                attendeeData.email,
                attendeeData.registeredDate,
                attendeeData.status,
                attendeeData.notes
              ];
            } else {
              // Add new user after the headers
              rawData.push([
                attendeeData.name,
                attendeeData.email,
                attendeeData.registeredDate,
                attendeeData.status,
                attendeeData.notes
              ]);
            }
          }

          // Create a new worksheet from the modified rawData
          const newWorksheet = XLSX.utils.aoa_to_sheet(rawData);
          workbook.Sheets[attendeesSheetName] = newWorksheet;
        }
      }

      // Convert to array buffer
      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

      // Convert to Blob
      blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      // Upload to Firebase Storage
      const fileRef = ref(storage, standardFilePath);
      await uploadBytes(fileRef, blob);

      // Get download URL
      const downloadURL = await getDownloadURL(fileRef);

      if (!docsSnapshot.empty) {
        // Update existing document reference
        const docRef = docsSnapshot.docs[0].ref;
        await updateDoc(docRef, {
          fileUrl: downloadURL,
          fileName: standardFileName,
          updatedAt: new Date().toISOString(),
        });
      } else {
        // Create new document reference if it doesn't exist
        await addDoc(collection(db, "eventDocuments"), {
          eventId: eventId,
          documentType: "attendeeSheet",
          fileUrl: downloadURL,
          fileName: standardFileName,
          isPublic: eventData.isPublic,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // Update the file record in Firebase
      await this.updateFileRecord(
        eventId,
        standardFileName,
        standardFilePath,
        downloadURL,
        blob.size,
        eventData.isPublic,
        storageFolder
      );

      console.log("Attendance sheet updated successfully");
    } catch (err) {
      console.error("Error updating attendance sheet:", err);
      throw new Error("Failed to update attendance sheet");
    }
  };

  // Delete temporary user data
  async deleteUser(combinedId) {
    try {
      // Implementation for deleting temporary user data
      // This could be a document in a "tempUsers" collection
      console.log("Deleting temporary user", combinedId);
      // Add actual implementation if needed
      return true;
    } catch (error) {
      console.error("Error deleting temporary user:", error);
      return false;
    }
  }

  // Register user for an event
  async registerUserForEvent(userData, eventId, currentUser) {
    try {
      // Get event details
      const eventRef = doc(this.db, "events", eventId);
      const eventSnap = await getDoc(eventRef);

      if (!eventSnap.exists()) {
        throw new Error("Event not found");
      }

      const eventData = eventSnap.data();
      eventData.id = eventId; // Add ID to the data object

      // Check if the event is live
      if (!eventData.isLive) {
        throw new Error("This event is not accessible yet");
      }

      // Check if user is already registered for this event
      const { isRegistered } = await this.checkUserEventRegistration(
        userData.usersId || userData.studentId || userData.id,
        eventId
      );

      if (isRegistered) {
        throw new Error("This user is already registered for this event");
      }

      // Get the current date and time formatted
      const now = new Date();
      const registeredDate = now.toISOString().split("T")[0]; // YYYY-MM-DD

      // Add user to attendees collection
      await addDoc(collection(this.db, "eventAttendees"), {
        eventId: eventId,
        userId: userData.usersId || userData.studentId || userData.id,
        course: userData.course,
        userEmail: userData.email,
        userImageProfile: userData.profileImage,
        userName: userData.name || userData.displayName,
        registeredAt: now.toISOString(),
        status: userData.role,
        registeredByUserId: this.currentUser.uid,
        registeredByEmail: this.currentUser.email,
        registrationMethod: "HW-NFC",
        userDocId: userData.uid,
      });

      console.log(userData);

      const emailData = {
        email: userData.email,
        userName: userData.name || userData.displayName,
        userId: userData.usersId || userData.studentId || userData.id,
        course: userData.course,
        userImageProfile: userData.profileImage,
        eventId: eventId,
        eventName: eventData.title,
        registeredAt: now.toISOString(),
        status: userData.role,
        registeredByUserId: this.currentUser.uid,
        registeredByEmail: this.currentUser.email,
        registrationMethod: "HW-NFC",
        userDocId: userData.uid,
      };

      // 3. Send the confirmation email
      await sendEmail({
        template: EmailTemplates.EVENT_REGISTRATION,
        data: emailData,
        onError: (error) => {
          console.error(`Failed to send confirmation email to ${userData.email}:`, error);
        },
      });

      const deleteUser = async (userEventId) => {
        console.log("userId Content: ", userEventId)
        const db = getFirestore();
        const result = await deletePreRegisteredUser(userEventId);

        if (result.success) {
          await updateDoc(doc(db, "events", eventId), {
            preRegisteredCount: increment(-1),
          });
        } else {
          console.error("Failed to delete user:", result.error);
        }
      };

      deleteUser(userData.uid + "_" + eventId);

      // Clean up any temporary user data
      if (userData.uid) {
        this.deleteUser(userData.uid + "_" + eventId);
      }

      // Increment attendee count
      await updateDoc(doc(this.db, "events", eventId), {
        attendees: increment(1),
      });

      // Check if the event has an attendance sheet
      const { exists: sheetExists, documentData } =
        await this.checkEventAttendanceSheet(eventId);

      // Now update the attendance sheet
      await this.updateAttendanceSheet(
        userData,
        eventData,
        eventId,
        registeredDate,
        now.toISOString()
      );

      return { success: true, userData, eventData };
    } catch (error) {
      console.error("Error registering user for event:", error);
      throw error;
    }
  }

  async readNfcTag() {
    if (!this.port) {
      throw new Error(
        "No NFC Scanner connected. Please connect your device first."
      );
    }

    if (this.isScanning) {
      // Instead of throwing error, wait until scanning is complete
      console.log("Waiting for previous scan to complete...");
      await new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (!this.isScanning) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 500); // Check every 500ms

        // Safety timeout after 5 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          this.isScanning = false; // Force reset scanning state
          resolve();
        }, 5000);
      });
    }

    this.isScanning = true;
    await this.sendToDevice("READ");

    try {
      // Handle differently based on environment
      if (this.isElectron) {
        return await this.readNfcTagElectron();
      } else {
        return await this.readNfcTagBrowser();
      }
    } catch (error) {
      console.error("Scan failed:", error);
      throw error;
    } finally {
      this.isScanning = false;
    }
  }

  // Process the tag data to remove any known prefixes
  processTagData(data) {
    let processedData = data.trim();

    // Remove "(&NDEF:T:en:" prefix if present (for NDEF formatted tags)
    if (processedData.startsWith("(&NDEF:T:en:")) {
      processedData = processedData.substring("(&NDEF:T:en:".length);
    }

    // Remove "#Ten" prefix if present
    if (processedData.startsWith("#Ten")) {
      processedData = processedData.substring(4);
    }

    return processedData;
  }

  // Read NFC tag in Electron environment
  async readNfcTagElectron() {
    return new Promise((resolve, reject) => {
      let receivedText = "";
      let timeoutId = null;
      let responseComplete = false;

      // Function to determine if response is complete
      const isResponseComplete = (text) => {
        return (
          text.includes("Read successful:") ||
          text.includes("No NFC detected") ||
          text.includes("Read failed!")
        );
      };

      // Set timeout for the operation
      timeoutId = setTimeout(() => {
        this.serialDataHandlers.delete(dataHandler);
        reject(new Error("Scan timed out. Please try again."));
      }, 10000);

      // Create data handler
      const dataHandler = (data) => {
        receivedText += data;

        // Check if we have a complete response
        if (isResponseComplete(receivedText) && !responseComplete) {
          responseComplete = true;

          // Wait a bit to ensure all data is captured before processing
          setTimeout(() => {
            clearTimeout(timeoutId);
            this.serialDataHandlers.delete(dataHandler);

            // Process based on the type of response
            if (receivedText.includes("Read successful:")) {
              // Extract data starting after "Read successful:"
              const successIndex = receivedText.indexOf("Read successful:");
              if (successIndex !== -1) {
                let extractedData = receivedText
                  .substring(successIndex + "Read successful:".length)
                  .trim();

                // Process the tag data to remove prefixes
                extractedData = this.processTagData(extractedData);

                this.lastScannedTag = extractedData;
                resolve({
                  success: true,
                  tagData: extractedData,
                  fullResponse: receivedText,
                });
              } else {
                reject(new Error("NFC tag read, but no data found"));
              }
            } else if (receivedText.includes("No NFC detected")) {
              reject(
                new Error(
                  "No NFC tag detected. Please bring an NFC tag closer to the reader."
                )
              );
            } else if (receivedText.includes("Read failed!")) {
              reject(new Error("NFC scan failed! Please try again."));
            } else {
              reject(new Error("Unknown scan result"));
            }
          }, 500); // Wait 500ms to ensure all data is collected
        }
      };

      // Add handler to the set
      this.serialDataHandlers.add(dataHandler);
    });
  }

  // Read NFC tag in Web browser environment (original implementation)
  async readNfcTagBrowser() {
    const reader = this.port.readable.getReader();
    let receivedText = "";
    let timeoutId = null;
    let responseComplete = false;

    try {
      // Function to determine if response is complete
      const isResponseComplete = (text) => {
        return (
          text.includes("Read successful:") ||
          text.includes("No NFC detected") ||
          text.includes("Read failed!")
        );
      };
      // Set timeout to ensure we don't wait forever
      const responseTimeout = new Promise((resolve) => {
        timeoutId = setTimeout(() => {
          resolve({ done: true, timeout: true });
        }, 10000); // 10 second timeout
      });

      while (!responseComplete) {
        // Race between reading and timeout
        const readPromise = reader.read();
        const result = await Promise.race([readPromise, responseTimeout]);

        // Check if we timed out
        if (result.timeout) {
          throw new Error("Scan timed out. Please try again.");
        }

        const { value, done } = result;
        if (done) break;

        // Decode and append the new data
        const newText = new TextDecoder().decode(value);
        receivedText += newText;

        // Check if we have a complete response
        if (isResponseComplete(receivedText)) {
          responseComplete = true;

          // Process based on the type of response
          if (receivedText.includes("Read successful:")) {
            // Extract data starting after "Read successful:"
            const successIndex = receivedText.indexOf("Read successful:");
            if (successIndex !== -1) {
              // Wait a bit to ensure all data is captured
              await new Promise((resolve) => setTimeout(resolve, 500));

              // Read any remaining data
              const finalResult = await reader.read();
              if (!finalResult.done) {
                receivedText += new TextDecoder().decode(finalResult.value);
              }

              let extractedData = receivedText
                .substring(successIndex + "Read successful:".length)
                .trim();

              // Process the tag data to remove prefixes
              extractedData = this.processTagData(extractedData);

              this.lastScannedTag = extractedData;
              return {
                success: true,
                tagData: extractedData,
                fullResponse: receivedText,
              };
            } else {
              throw new Error("NFC tag read, but no data found");
            }
          } else if (receivedText.includes("No NFC detected")) {
            throw new Error(
              "No NFC tag detected. Please bring an NFC tag closer to the reader."
            );
          } else if (receivedText.includes("Read failed!")) {
            throw new Error("NFC scan failed! Please try again.");
          }
        }
      }

      throw new Error("Scan did not complete successfully");
    } finally {
      // Clear timeout if it's still active
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      reader.releaseLock();
    }
  }

  async writeNfcTag(text) {
    if (!this.port) {
      throw new Error(
        "No NFC Scanner connected. Please connect your device first."
      );
    }

    if (this.isScanning) {
      throw new Error("Operation already in progress. Please wait.");
    }

    this.isScanning = true;

    try {
      // First send a status command to ensure communication is active
      await this.sendToDevice("STATUS");

      // Wait a bit to ensure device is ready
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Trim and validate the text to write
      if (!text || text.trim().length === 0) {
        throw new Error("Cannot write empty text to NFC tag");
      }

      // Limit text length to prevent buffer overflows
      const safeText = text.trim().substring(0, 500); // Reasonable limit

      // Format specifically for Record 1 - UTF-8(en) : text/plain
      // Format: WRITE:NDEF:T:en:TEXT
      // Where T indicates text record, en is the language code, and TEXT is the content
      console.log(`Sending WRITE command with formatted NDEF Record 1 data: ${safeText}`);
      await this.sendToDevice(`WRITE:NDEF:T:en:${safeText}`);

      // Handle differently based on environment
      if (this.isElectron) {
        return await this.writeNfcTagElectron(safeText);
      } else {
        return await this.writeNfcTagBrowser(safeText);
      }
    } catch (error) {
      console.error("Write failed:", error);
      throw error;
    } finally {
      this.isScanning = false;
    }
  }

  async writeNfcTagElectron(text) {
    return new Promise((resolve, reject) => {
      let receivedText = "";
      let timeoutId = null;
      let responseComplete = false;

      // Function to determine if response is complete
      const isResponseComplete = (text) => {
        return (
          text.includes("Write successful") ||
          text.includes("No NFC detected") ||
          text.includes("Write failed!")
        );
      };

      // Set timeout for the operation - increased for reliability
      timeoutId = setTimeout(() => {
        this.serialDataHandlers.delete(dataHandler);
        reject(new Error("Write operation timed out. Please try again."));
      }, 15000); // Increased timeout to 15 seconds

      // Create data handler with improved response processing
      const dataHandler = (data) => {
        // Add new data to our buffer
        receivedText += data;
        console.log(`Received data chunk: ${data}`);

        // Check if we have a complete response
        if (isResponseComplete(receivedText) && !responseComplete) {
          responseComplete = true;

          // Wait a bit longer to ensure all data is captured before processing
          setTimeout(() => {
            clearTimeout(timeoutId);
            this.serialDataHandlers.delete(dataHandler);

            // Log the full response for debugging
            console.log(`Full write response: ${receivedText}`);

            if (receivedText.includes("Write successful")) {
              // Reset the scanning state to ensure verification can proceed
              this.isScanning = false;

              // Wait slightly longer before verification for NDEF format
              setTimeout(() => {
                // Verify contents were actually written by sending a read command
                this.verifyWrittenData(text)
                  .then((verifyResult) => {
                    if (verifyResult.verified) {
                      resolve({
                        success: true,
                        writtenData: text,
                        fullResponse: receivedText,
                        verified: true,
                        message: "Successfully wrote Record 1 UTF-8(en) text to tag"
                      });
                    } else {
                      // Data verification failed
                      console.warn(
                        "Write reported success but verification failed"
                      );
                      resolve({
                        success: true,
                        writtenData: text,
                        fullResponse: receivedText,
                        verified: false,
                        message:
                          "Write reported as successful but verification failed. Try again or check the NFC tag.",
                      });
                    }
                  })
                  .catch((err) => {
                    // Verification attempt failed
                    console.warn("Failed to verify write:", err);
                    resolve({
                      success: true,
                      writtenData: text,
                      fullResponse: receivedText,
                      verified: false,
                      message:
                        "Write reported as successful but verification could not be completed.",
                    });
                  });
              }, 2000); // Wait 2 seconds before verification for NDEF format
            } else if (receivedText.includes("No NFC detected")) {
              reject(
                new Error(
                  "No NFC tag detected. Please hold the NFC tag directly against the scanner."
                )
              );
            } else if (receivedText.includes("Write failed!")) {
              reject(
                new Error(
                  "NFC write failed! The tag might be read-only or damaged. Please try again with a different tag."
                )
              );
            } else {
              reject(
                new Error(
                  "Unknown write result. Please check the NFC tag and try again."
                )
              );
            }
          }, 1000); // Wait longer (1000ms) to ensure all data is collected
        }
      };

      // Add handler to the set
      this.serialDataHandlers.add(dataHandler);
    });
  }

  async writeNfcTagBrowser(text) {
    const reader = this.port.readable.getReader();
    let receivedText = "";
    let timeoutId = null;
    let responseComplete = false;

    try {
      // Function to determine if response is complete
      const isResponseComplete = (text) => {
        return (
          text.includes("Write successful") ||
          text.includes("No NFC detected") ||
          text.includes("Write failed!")
        );
      };

      // Set timeout to ensure we don't wait forever - increased for reliability
      const responseTimeout = new Promise((resolve) => {
        timeoutId = setTimeout(() => {
          resolve({ done: true, timeout: true });
        }, 15000); // Increased to 15 second timeout
      });

      while (!responseComplete) {
        // Race between reading and timeout
        const readPromise = reader.read();
        const result = await Promise.race([readPromise, responseTimeout]);

        // Check if we timed out
        if (result.timeout) {
          throw new Error(
            "Write operation timed out. Please try again and make sure the NFC tag stays in range."
          );
        }

        const { value, done } = result;
        if (done) break;

        // Decode and append the new data
        const newText = new TextDecoder().decode(value);
        receivedText += newText;
        console.log(`Received data chunk: ${newText}`);

        // Check if we have a complete response
        if (isResponseComplete(receivedText)) {
          responseComplete = true;

          // Wait a bit longer to ensure all data is captured
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Read any final data
          try {
            const finalResult = await Promise.race([
              reader.read(),
              new Promise((r) => setTimeout(() => r({ done: true }), 1000)),
            ]);
            if (!finalResult.done && finalResult.value) {
              receivedText += new TextDecoder().decode(finalResult.value);
            }
          } catch (e) {
            console.warn("Error reading final data:", e);
          }

          console.log(`Full write response: ${receivedText}`);

          if (receivedText.includes("Write successful")) {
            // Reset the scanning state before verification
            this.isScanning = false;

            // Wait longer for NDEF formatted data
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Attempt to verify the written data
            try {
              const verifyResult = await this.verifyWrittenData(text);
              if (verifyResult.verified) {
                return {
                  success: true,
                  writtenData: text,
                  fullResponse: receivedText,
                  verified: true,
                  message: "Successfully wrote Record 1 UTF-8(en) text to tag"
                };
              } else {
                return {
                  success: true,
                  writtenData: text,
                  fullResponse: receivedText,
                  verified: false,
                  message:
                    "Write reported as successful but verification failed. Try again or check the NFC tag.",
                };
              }
            } catch (verifyError) {
              console.warn("Failed to verify write:", verifyError);
              return {
                success: true,
                writtenData: text,
                fullResponse: receivedText,
                verified: false,
                message:
                  "Write reported as successful but verification could not be completed.",
              };
            }
          } else if (receivedText.includes("No NFC detected")) {
            throw new Error(
              "No NFC tag detected. Please hold the NFC tag directly against the scanner."
            );
          } else if (receivedText.includes("Write failed!")) {
            throw new Error(
              "NFC write failed! The tag might be read-only or damaged. Please try again with a different tag."
            );
          }
        }
      }

      throw new Error(
        "Write operation did not complete successfully. Please try again."
      );
    } finally {
      // Clear timeout if it's still active
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      reader.releaseLock();
    }
  }

  async verifyWrittenData(expectedText) {
    try {
      console.log("Attempting to verify written data...");

      // First, ensure we're not in scanning mode before attempting verification
      this.isScanning = false;

      // Wait a moment for the write to complete fully and for the device to be ready
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Try to read the tag
      const readResult = await this.readNfcTag().catch((err) => {
        console.warn("Error during verification read:", err);
        return { success: false, error: err.message };
      });

      if (readResult.success && readResult.tagData) {
        const tagText = readResult.tagData.trim();
        const expectedTrimmed = expectedText.trim();

        console.log(
          `Verification - Expected: "${expectedTrimmed}", Read: "${tagText}"`
        );

        // Compare the expected text with what we read
        return {
          verified: tagText === expectedTrimmed,
          expected: expectedTrimmed,
          actual: tagText,
        };
      }

      return { verified: false };
    } catch (error) {
      console.error("Verification failed:", error);
      return { verified: false, error: error.message };
    }
  }

  // sendToDevice with retry logic
  async sendToDevice(data) {
    if (!this.writer) throw new Error("Device not connected");

    const maxRetries = 2;
    let retries = 0;

    while (retries <= maxRetries) {
      try {
        await this.writer.write(new TextEncoder().encode(data + "\n"));
        return; // Success, exit
      } catch (error) {
        retries++;
        if (retries > maxRetries) {
          throw new Error(
            `Failed to send command after ${maxRetries} attempts: ${error.message}`
          );
        }
        console.warn(`Send attempt ${retries} failed, retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 500)); // Wait before retry
      }
    }
  }
}
