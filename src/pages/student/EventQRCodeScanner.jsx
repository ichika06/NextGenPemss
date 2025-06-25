import { useState, useRef, useEffect } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { X, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import {
  doc,
  getDoc,
  updateDoc,
  increment,
  collection,
  addDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import * as XLSX from "xlsx";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { useAlert } from "../../components/AlertProvider";
import {
  deleteAllExpiredPreRegistrations,
  deletePreRegisteredUser,
} from "../DeletePreregistered";
import EventAttendanceWorkbook from "../../components/EventAttendanceWorkbook";

/**
 * Modal component for scanning QR codes for event registration
 * @param {Object} props Component props
 * @param {Function} props.onRegister Function to handle successful registration
 * @param {Function} props.onClose Function to close the scanner modal
 * @param {boolean} props.isOpen Whether the scanner modal is open
 * @returns {JSX.Element} QR code scanner modal component
 */
export default function QRScannerModal({ onRegister, onClose, isOpen }) {
  const { currentUserData, currentUser } = useAuth();
  // Status states for better UI management
  const [scanStatus, setScanStatus] = useState("idle"); // idle, scanning, success, error
  const [scanMessage, setScanMessage] = useState(
    "Position the QR code within the scanner area"
  );
  const [scanError, setScanError] = useState(null);
  const [processingRegistration, setProcessingRegistration] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const scannerRef = useRef(null);
  const html5QrCodeScannerRef = useRef(null);
  const attendanceWorkbookRef = useRef(null);
  const { showAlert } = useAlert();

  useEffect(() => {
    // Initialize scanner when component is mounted and isOpen is true
    if (isOpen && scannerRef.current && !html5QrCodeScannerRef.current) {
      startScanner();
    }

    return () => {
      // Cleanup function for scanner
      stopScanner();
    };
  }, [isOpen]);

  const startScanner = () => {
    setScanStatus("scanning");
    setScanError(null);
    setScanResult(null);
    setScanMessage("Position the QR code within the scanner area");

    // Create a scanner with improved configuration
    html5QrCodeScannerRef.current = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
        aspectRatio: 1.0,
        rememberLastUsedCamera: true,
        formatsToSupport: [
          0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
        ],
        supportedScanTypes: [0, 1],
      },
      false
    );

    html5QrCodeScannerRef.current.render(
      // Success callback
      async (decodedText) => {
        try {
          console.log("QR Code detected:", decodedText);
          await processRegistration(decodedText);
        } catch (error) {
          console.error("Error processing QR code:", error);
          setScanError(`Failed to process QR code: ${error.message}`);
          setScanStatus("error");
        }
      },
      // Error callback
      (errorMessage) => {
        console.error("QR Code scanning error:", errorMessage);

        // Don't close the scanner on intermittent errors
        if (
          errorMessage.includes("NotFoundException") &&
          scanStatus === "scanning"
        ) {
          // This is normal when no QR code is in view, ignore
          return;
        }

        if (errorMessage.includes("NotAllowedError")) {
          setScanError(
            "Camera access denied. Please allow camera access and try again."
          );
          setScanStatus("error");
        }
      }
    );
  };

  const stopScanner = () => {
    if (html5QrCodeScannerRef.current) {
      try {
        // First check if the scanner is running
        if (
          html5QrCodeScannerRef.current.html5Qrcode &&
          html5QrCodeScannerRef.current.html5Qrcode.isScanning
        ) {
          // If it's running, stop it before clearing
          html5QrCodeScannerRef.current.html5QrCode
            .stop()
            .then(() => {
              html5QrCodeScannerRef.current.clear().catch((error) => {
                console.error("Failed to clear scanner:", error);
              });
              html5QrCodeScannerRef.current = null;
            })
            .catch((err) => {
              console.warn("Could not stop scanner in cleanup:", err);
              // Try to clear anyway
              html5QrCodeScannerRef.current.clear().catch(() => {});
              html5QrCodeScannerRef.current = null;
            });
        } else {
          // If it's not running, just clear it
          html5QrCodeScannerRef.current.clear().catch((error) => {
            console.error("Failed to clear scanner:", error);
          });
          html5QrCodeScannerRef.current = null;
        }
      } catch (e) {
        console.error("Error in scanner cleanup:", e);
        html5QrCodeScannerRef.current = null;
      }
    }
  };

  // Extract event ID from URL (unchanged)
  const extractEventId = (scannedCode) => {
    // If it's a URL with /register/ format
    if (scannedCode.includes("/register/")) {
      // Get the last part of the URL by splitting on all slashes
      const urlParts = scannedCode.split("/");
      // Return the last non-empty part
      return urlParts[urlParts.length - 1].split("?")[0];
    }
    // If it's the old format with /register-event/
    else if (scannedCode.includes("/register-event/")) {
      // Split by /register-event/ and get the part after it
      const urlParts = scannedCode.split("/register-event/");
      if (urlParts.length > 1) {
        // Get the last part (event ID) removing any trailing slashes or query params
        const eventId = urlParts[1].split("/")[0].split("?")[0];
        return eventId;
      }
    }
    // If not a URL format, just return the raw text as it might be the event ID itself
    return scannedCode;
  };

  // Process scanned registration data
  const processRegistration = async (scannedCode) => {
    try {
      // Check if already processing to prevent duplicate submissions
      if (processingRegistration) {
        console.log("Already processing registration, ignoring duplicate scan");
        return;
      }

      setProcessingRegistration(true);
      setScanMessage("QR code detected, processing...");

      // First properly stop the scanner
      if (
        html5QrCodeScannerRef.current &&
        html5QrCodeScannerRef.current.html5Qrcode
      ) {
        try {
          // Set scanning to stop before attempting to stop the hardware
          setScanStatus("processing");

          // Use a timeout to ensure state update has occurred
          setTimeout(async () => {
            try {
              await html5QrCodeScannerRef.current.html5Qrcode.stop();
              console.log("Scanner stopped successfully");
            } catch (stopError) {
              console.warn(
                "Could not stop scanner, may already be stopped:",
                stopError
              );
            }

            // Process the scan result
            processEventRegistration(scannedCode);
          }, 100);
        } catch (e) {
          console.error("Error stopping scanner:", e);
          // Continue with processing anyway
          processEventRegistration(scannedCode);
        }
      } else {
        // If scanner reference isn't available, just process the scan
        processEventRegistration(scannedCode);
      }
    } catch (error) {
      console.error("Error in processRegistration:", error);
      setScanError(`Failed to process scan: ${error.message}`);
      setProcessingRegistration(false);
      setScanStatus("error");
    }
  };

  // Helper function to handle the actual registration processing
  const processEventRegistration = async (scannedCode) => {
    try {
      // Extract the event ID from the scanned URL
      const eventId = extractEventId(scannedCode);

      if (!eventId) {
        setScanError("Invalid QR code format. Could not extract event ID.");
        setProcessingRegistration(false);
        setScanStatus("error");
        return;
      }

      // Get event details for the attendance sheet
      const eventRef = doc(db, "events", eventId);
      const eventSnap = await getDoc(eventRef);

      if (!eventSnap.exists()) {
        setScanError("Event not found in the database.");
        setProcessingRegistration(false);
        setScanStatus("error");
        return;
      }

      const eventData = eventSnap.data();

      // Check if the event is live
      if (!eventData.isLive) {
        showAlert({
          icon: "error",
          header: "Scanned Complete",
          description: "This event is not accessible yet.",
          variant: "error",
          position: window.innerWidth < 768 ? "top-center" : "top-right",
          animation: window.innerWidth < 768 ? "slide-down" : "slide-left",
          duration: 5000,
          headerColor: "#9c0505",
          descriptionColor: "#9c0505",
          borderColor: "#9c0505",
          width: window.innerWidth < 768 ? "sm" : "md",
          responsiveMode: window.innerWidth < 768 ? "inline" : "stack",
        });
        setProcessingRegistration(false);
        setScanStatus("error");
        return;
      }

      // Check if user is already registered for this event
      const attendeesRef = collection(db, "eventAttendees");
      const attendeeQuery = query(
        attendeesRef,
        where("eventId", "==", eventId),
        where("userEmail", "==", currentUserData.email)
      );
      const attendeeSnap = await getDocs(attendeeQuery);

      if (!attendeeSnap.empty) {
        showAlert({
          icon: "info",
          header: "Scanned Complete",
          description: "You are already registered for this event.",
          variant: "info",
          position: window.innerWidth < 768 ? "top-center" : "top-right",
          animation: window.innerWidth < 768 ? "slide-down" : "slide-left",
          duration: 5000,
          headerColor: "#050f9c",
          descriptionColor: "#050f9c",
          borderColor: "#050f9c",
          width: window.innerWidth < 768 ? "sm" : "md",
          responsiveMode: window.innerWidth < 768 ? "inline" : "stack",
        });
        setProcessingRegistration(false);
        setScanStatus("error");
        return;
      }

      // Construct user data similar to NFCRegistration format
      const userData = {
        id: currentUserData.uid,
        email: currentUserData.email,
        name: currentUserData.name,
        role: currentUserData.role || "Attendee",
        proImage: currentUserData.profileImage,
        userId: currentUserData.studentId,
        course: currentUserData.course,
      };

      // Register the user for the event
      await registerForEvent(eventId, userData, eventData);
    } catch (error) {
      console.error("Error processing scan result:", error);
      setScanError(`Failed to process registration: ${error.message}`);
      setProcessingRegistration(false);
      setScanStatus("error");
    }
  };

  const registerForEvent = async (eventId, userData, eventData) => {
    try {
      setScanMessage("Registering for event...");

      // Get the current date and time formatted
      const now = new Date();
      const registeredDate = now.toISOString().split("T")[0]; // YYYY-MM-DD
      const registeredTime = now.toLocaleTimeString();

      // Create registration data - aligned with NFC registration format
      const registrationData = {
        eventId: eventId,
        userDocId: userData.id,
        course: userData.course,
        userId: userData.userId,
        email: userData.email,
        userImageProfile: userData.proImage,
        userName: userData.name,
        registeredAt: now.toISOString(),
        status: userData.role || "Registered",
        registeredByUserId: eventData.registrarId,
        registeredByEmail: eventData.registrarEmail,
        registrationMethod: "QR",
      };

      // Delete pre-registration record if exists
      deleteUser(currentUser.uid + "_" + eventId, eventId);

      // Add user to attendees collection
      const attendeeDocRef = await addDoc(
        collection(db, "eventAttendees"),
        registrationData
      );

      // Increment attendee count
      await updateDoc(doc(db, "events", eventId), {
        attendees: increment(1),
      });

      // Now update the attendance Excel sheet
      await updateAttendanceSheet(
        userData,
        eventData,
        eventId,
        registeredDate,
        now.toISOString()
      );

      // Set success status
      setScanStatus("success");
      setScanMessage("Registration successful!");
      setScanResult({
        message: "Registration successful!",
        data: {
          eventId: eventId,
          scannedAt: now.toISOString(),
          registrationType: "QR_SCAN",
          attendeeId: attendeeDocRef.id,
        },
      });

      // Call onRegister callback with registration data
      if (onRegister) {
        onRegister({
          eventId,
          scannedAt: now.toISOString(),
          registrationType: "QR_SCAN",
          attendeeId: attendeeDocRef.id,
        });
      }

      // Add a delay before allowing to close
      setTimeout(() => {
        setProcessingRegistration(false);
      }, 1500);
    } catch (error) {
      console.error("Error completing registration:", error);
      setScanError(`Failed to complete registration: ${error.message}`);
      setProcessingRegistration(false);
      setScanStatus("error");
    }
  };

  const updateAttendanceSheet = async (
    userData,
    eventData,
    eventId,
    registeredDate,
    registeredTimestamp
  ) => {
    try {
      setScanMessage("Updating attendance records...");

      // Standardized filename based on event title
      const standardFileName = `${eventData.title.replace(/\s+/g, "_")}_attendees.xlsx`;

      // Determine the storage folder based on whether the event is public
      const storageFolder = eventData.isPublic
        ? "public/events"
        : `${currentUserData.uid}/event_data`;
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
        notes: `Registered via QR scan on ${new Date(registeredTimestamp).toLocaleString()}`
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
      await updateFileRecord(
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

  const updateFileRecord = async (
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
        userId: currentUserData.uid,
        userName: currentUserData.email,
        folder: storageFolder,
        isPublic: isPublic,
        uploadedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sharedWith: [],
        relatedEventId: eventId,
      });
    }
  };

  // Handler for retry when there's an error
  const handleRetry = () => {
    setScanStatus("idle");
    setScanError(null);
    setScanResult(null);
    setScanMessage("Position the QR code within the scanner area");
    startScanner();
  };

  const deleteUser = async (userId, eventId) => {
    const result = await deletePreRegisteredUser(userId);

    if (result.success) {
      await updateDoc(doc(db, "events", eventId), {
        preRegisteredCount: increment(-1),
      });
    } else {
      console.error("Failed to delete user:", result.error);
    }
  };

  // If modal is not open, don't render anything
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-zinc-700">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-zinc-100">
            Event Registration
          </h2>
          <button
            onClick={onClose}
            disabled={processingRegistration}
            className="text-gray-500 dark:text-zinc-300 hover:text-gray-700 dark:hover:text-white transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-6">
          {scanStatus === "error" && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-md flex items-start gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Error scanning QR code</p>
                <p className="text-sm mt-1">{scanError}</p>
                <button
                  onClick={handleRetry}
                  className="mt-3 px-3 py-1 text-xs bg-red-100 dark:bg-red-800 hover:bg-red-200 dark:hover:bg-red-700 text-red-800 dark:text-red-200 rounded transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {scanStatus === "success" && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-md flex items-start gap-3">
              <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">
                  {scanResult?.message || "Registration successful!"}
                </p>
                {scanResult?.data && (
                  <>
                    <p className="text-sm mt-1">
                      Event ID: {scanResult.data.eventId}
                    </p>
                    <p className="text-sm">
                      Registered at:{" "}
                      {new Date(scanResult.data.scannedAt).toLocaleString()}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {(scanStatus === "idle" || scanStatus === "scanning") &&
            !processingRegistration && (
              <>
                <p className="text-gray-600 dark:text-zinc-300 mb-4 text-center">{scanMessage}</p>

                <div
                  id="qr-reader"
                  ref={scannerRef}
                  className="mb-4"
                  style={{ maxWidth: "100%" }}
                ></div>

                <p className="text-sm text-gray-500 dark:text-zinc-400 text-center">
                  Make sure your camera is enabled and the QR code is clearly
                  visible.
                </p>
              </>
            )}

          {(processingRegistration || scanStatus === "processing") && (
            <div className="flex flex-col items-center justify-center py-6">
              <Loader2 className="h-8 w-8 text-blue-600 dark:text-blue-400 animate-spin mb-3" />
              <p className="text-gray-700 dark:text-zinc-100">
                {scanMessage || "Processing registration..."}
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-700">
          {scanStatus === "success" ? (
            <button
              onClick={onClose}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            >
              Complete Registration
            </button>
          ) : (
            <button
              onClick={onClose}
              disabled={processingRegistration || scanStatus === "processing"}
              className="w-full py-2 px-4 border border-gray-300 dark:border-zinc-700 rounded-md text-gray-700 dark:text-zinc-100 font-medium hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}