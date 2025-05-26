import { useState, useEffect, useRef } from "react";
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
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import {
  X,
  AlertCircle,
  Smartphone,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import * as XLSX from "xlsx";
import useFirestoreChecker from "../reuseChecker/FirestoreCheckerHook";
import {
  deleteAllExpiredPreRegistrations,
  deletePreRegisteredUser,
} from "../../pages/DeletePreregistered";
// Import the EventAttendanceWorkbook component
import EventAttendanceWorkbook from "../EventAttendanceWorkbook";

const NFCRegistration = ({ eventId, onClose, onSuccess }) => {
  const { currentUser, currentUserData } = useAuth();
  const [nfcStatus, setNfcStatus] = useState("idle");
  const [error, setError] = useState("");
  const [scanMessage, setScanMessage] = useState(
    "Tap your NFC card to register"
  );
  const [submitting, setSubmitting] = useState(false);
  const [nfcController, setNfcController] = useState(null);

  // Add a processing flag ref to prevent multiple simultaneous registrations
  const isProcessingCard = useRef(false);

  const {
    loading: checkingFirestore,
    error: firestoreError,
    checkUserByNfcData,
    checkUserEventRegistration,
    checkEventAttendanceSheet,
  } = useFirestoreChecker();

  // Check if Web NFC is available in the browser
  const isNFCSupported = () => {
    return "NDEFReader" in window;
  };

  useEffect(() => {
    if (nfcStatus === "scanning") {
      startNFCScanning();
    }

    return () => {
      // Clean up NFC scanning when component unmounts
      if (nfcStatus === "scanning") {
        stopNFCScanning();
      }
    };
  }, [nfcStatus]);

  const startNFCScanning = async () => {
    if (!isNFCSupported()) {
      setError("NFC is not supported on this device or browser");
      setNfcStatus("error");
      return;
    }

    try {
      const ndef = new window.NDEFReader();

      // Create an AbortController for proper cleanup
      const abortController = new AbortController();
      const signal = abortController.signal;

      // Store reference to both for later cleanup
      setNfcController({
        reader: ndef,
        abortController: abortController,
      });

      await ndef.scan({ signal });
      setScanMessage("Scanning for NFC card...");

      // Reset the processing flag when starting a new scan
      isProcessingCard.current = false;

      ndef.addEventListener(
        "reading",
        async ({ message }) => {
          // Check if we're already processing a card to prevent duplicate entries
          if (isProcessingCard.current) {
            console.log("Already processing a card, ignoring this scan");
            return;
          }

          // Set processing flag to true immediately
          isProcessingCard.current = true;

          try {
            // Stop NFC scanning immediately to prevent additional readings
            stopNFCScanning();

            // Process the NFC reading
            const decoder = new TextDecoder();
            let nfcData = "";

            for (const record of message.records) {
              if (record.recordType === "text") {
                const textDecoder = new TextDecoder(record.encoding);
                nfcData = textDecoder.decode(record.data);
              }
            }

            if (!nfcData) {
              setError("Could not read data from NFC card");
              setNfcStatus("error");
              isProcessingCard.current = false;
              return;
            }

            // Use NFC data to find the matching user in Firestore
            await verifyUserAndRegister(nfcData);
          } catch (error) {
            console.error("Error processing NFC data:", error);
            setError("Failed to process NFC data");
            setNfcStatus("error");
            isProcessingCard.current = false;
          }
        },
        { signal }
      );

      ndef.addEventListener(
        "error",
        (error) => {
          console.error("NFC error:", error);
          setError(`NFC error: ${error.message}`);
          setNfcStatus("error");
          isProcessingCard.current = false;
        },
        { signal }
      );
    } catch (error) {
      console.error("Error starting NFC scan:", error);
      setError(`Failed to start NFC scan: ${error.message}`);
      setNfcStatus("error");
      isProcessingCard.current = false;
    }
  };

  const stopNFCScanning = () => {
    if (nfcController) {
      console.log("Stopping NFC scanning...");

      // Try to abort using the AbortController
      if (
        nfcController.abortController &&
        typeof nfcController.abortController.abort === "function"
      ) {
        try {
          nfcController.abortController.abort();
          console.log("NFC scanning aborted via AbortController");
        } catch (error) {
          console.error("Error aborting NFC scan:", error);
        }
      }

      // For older browsers or fallback
      if (
        nfcController.reader &&
        typeof nfcController.reader.abort === "function"
      ) {
        try {
          nfcController.reader.abort();
          console.log("NFC scanning aborted via reader");
        } catch (error) {
          console.error("Error aborting NFC reader:", error);
        }
      }

      // Clear the controller reference
      setNfcController(null);
    }

    setScanMessage("NFC scanning stopped");
  };

  const verifyUserAndRegister = async (nfcData) => {
    try {
      setSubmitting(true);
      setScanMessage("Card detected, verifying...");

      // Use our firestore checker hook to find the user
      const { exists, userData } = await checkUserByNfcData(nfcData);

      if (!exists) {
        setError("No matching user found for this NFC card");
        setNfcStatus("error");
        setSubmitting(false);
        return;
      }

      // Get event details for the attendance sheet
      const eventRef = doc(db, "events", eventId);
      const eventSnap = await getDoc(eventRef);

      if (!eventSnap.exists()) {
        setError("Event not found");
        setNfcStatus("error");
        setSubmitting(false);
        return;
      }

      const eventData = eventSnap.data();

      // Check if the event is live
      if (!eventData.isLive) {
        setError("This event is not accessible yet");
        setNfcStatus("error");
        setSubmitting(false);
        return;
      }

      // Check if user is already registered for this event
      const { isRegistered } = await checkUserEventRegistration(
        userData.id,
        eventId
      );

      if (isRegistered) {
        setError("This user is already registered for this event");
        setNfcStatus("error");
        setSubmitting(false);
        return;
      }

      // Register the user for the event
      await registerForEvent(userData, eventData);
    } catch (error) {
      console.error("Error registering with NFC:", error);
      setError("Failed to register with NFC");
      setNfcStatus("error");
      setSubmitting(false);
      isProcessingCard.current = false;
    }
  };

  const registerForEvent = async (userData, eventData) => {
    try {
      // Get the current date and time formatted
      const now = new Date();
      const registeredDate = now.toISOString().split("T")[0]; // YYYY-MM-DD
      const registeredTime = now.toLocaleTimeString();

      // Add user to attendees collection
      await addDoc(collection(db, "eventAttendees"), {
        eventId: eventId,
        userId: userData.usersId || userData.studentId,
        course: userData.course,
        email: userData.email,
        userImageProfile: userData.profileImage,
        userName: userData.name,
        registeredAt: now.toISOString(),
        status: userData.role,
        registeredByUserId: currentUser.uid,
        registeredByEmail: currentUser.email,
        registrationMethod: "NFC",
        userDocId: userData.uid
      });

      deleteUser(userData.uid + "_" + eventId);

      // Increment attendee count
      await updateDoc(doc(db, "events", eventId), {
        attendees: increment(1),
      });

      // Check if the event has an attendance sheet
      const { exists: sheetExists, documentData } =
        await checkEventAttendanceSheet(eventId);

      // Now update the attendance Excel sheet
      await updateAttendanceSheet(
        userData,
        eventData,
        registeredDate,
        now.toISOString(),
        sheetExists ? documentData : null
      );

      // Set success status
      setNfcStatus("success");
      setScanMessage("Successfully registered!");

      // Call the success callback after a delay
      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 2000);
    } catch (error) {
      console.error("Error completing registration:", error);
      setError("Failed to complete registration");
      setNfcStatus("error");
      isProcessingCard.current = false;
    } finally {
      setSubmitting(false);
    }
  };

  // Use the EventAttendanceWorkbook component to create the workbook
  const updateAttendanceSheet = async (
    userData,
    eventData,
    registeredDate,
    registeredTimestamp,
    existingSheetData = null
  ) => {
    try {
      setScanMessage("Updating attendance sheet...");

      // Find the attendance sheet document
      const docsRef = collection(db, "eventDocuments");
      const docsQuery = query(
        docsRef,
        where("eventId", "==", eventId),
        where("documentType", "==", "attendeeSheet")
      );
      const docsSnapshot = await getDocs(docsQuery);

      // Standardized filename based on event title
      const standardFileName = `${eventData.title.replace(
        /\s+/g,
        "_"
      )}_attendees.xlsx`;

      // Determine the storage folder based on whether the event is public
      const storageFolder = eventData.isPublic
        ? "public/events"
        : `${currentUser.uid}/event_data`;
      const standardFilePath = `${storageFolder}/${standardFileName}`;

      let workbook;
      let fileUrl = null;

      if (!docsSnapshot.empty) {
        // Get the document reference
        const docData = docsSnapshot.docs[0].data();
        fileUrl = docData.fileUrl;

        try {
          // Download the file from Firebase Storage
          const response = await fetch(fileUrl);
          const fileBlob = await response.blob();

          // Read the Excel file
          const data = await fileBlob.arrayBuffer();
          workbook = XLSX.read(data, { type: "array" });
        } catch (err) {
          console.error("Error reading Excel file:", err);
          
          // Create a temporary EventAttendanceWorkbook and get the workbook from it
          const attendanceWorkbookResult = await new Promise(resolve => {
            const tempComponent = new EventAttendanceWorkbook({
              eventData,
              onWorkbookCreated: (result) => resolve(result),
              showDownloadButton: false
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
            showDownloadButton: false
          });
          
          // Create the workbook without rendering the component
          tempComponent.handleCreateWorkbook();
        });
        
        workbook = attendanceWorkbookResult.workbook;
      }

      // Check if the workbook has the "Event Attendees" sheet
      const attendeesSheetName = "Event Attendees";
      if (!workbook.SheetNames.includes(attendeesSheetName)) {
        // If the sheet doesn't exist, create a new workbook with correct structure
        console.warn(
          "Excel file does not have the expected sheet structure, recreating..."
        );
        
        // Create a temporary EventAttendanceWorkbook and get the workbook from it
        const attendanceWorkbookResult = await new Promise(resolve => {
          const tempComponent = new EventAttendanceWorkbook({
            eventData,
            onWorkbookCreated: (result) => resolve(result),
            showDownloadButton: false
          });
          
          // Create the workbook without rendering the component
          tempComponent.handleCreateWorkbook();
        });
        
        workbook = attendanceWorkbookResult.workbook;
      }

      // Get the attendees worksheet
      const worksheet = workbook.Sheets[attendeesSheetName];

      // Extract the name from userData - prioritize 'name' field, fallback to displayName or email
      const userName = userData.name || userData.displayName || userData.email;

      // Prepare the new attendee data
      const attendeeData = {
        name: userName,
        email: userData.email,
        registeredDate: registeredDate,
        status: userData.role || "Registered",
        notes: `Registered via NFC by ${currentUser.email} on ${new Date(
          registeredTimestamp
        ).toLocaleString()}`
      };

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
      } else {
        // Something is wrong with the structure, recreate it
        console.warn("Excel structure is incorrect, recreating sheet");
        
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

      // Create a new worksheet from the modified rawData if we didn't recreate the workbook
      if (rawData.length >= 1) {
        const newWorksheet = XLSX.utils.aoa_to_sheet(rawData);
        workbook.Sheets[attendeesSheetName] = newWorksheet;
      }

      // Convert to array buffer
      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

      // Convert to Blob
      const blob = new Blob([excelBuffer], {
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
        userId: currentUser.uid,
        userName: currentUser.email,
        folder: storageFolder,
        isPublic: isPublic,
        uploadedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sharedWith: [],
        relatedEventId: eventId,
      });
    }
  };

  const handleStartScan = () => {
    setNfcStatus("scanning");
    setError("");
  };

  const handleRetry = () => {
    setNfcStatus("idle");
    setError("");
  };

  const deleteUser = async (userEventId) => {
    console.log("userId Content: ",userEventId)
    const result = await deletePreRegisteredUser(userEventId);

    if (result.success) {
      await updateDoc(doc(db, "events", eventId), {
        preRegisteredCount: increment(-1),
      });
    } else {
      console.error("Failed to delete user:", result.error);
    }
  };

  return (
    <div
      className="fixed inset-0 flex bg-black/50 items-center justify-center z-50 p-2 sm:p-4 md:p-6 backdrop-blur-sm"
      onClick={(e) => {
        // Close the modal when clicking outside (only when in idle state)
        if (
          e.target === e.currentTarget &&
          nfcStatus !== "scanning" &&
          nfcStatus !== "submitting"
        ) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm sm:max-w-md overflow-hidden transition-all transform animate-fadeIn">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">
            NFC Registration
          </h2>
          <button
            onClick={onClose}
            disabled={nfcStatus === "scanning" || submitting}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {nfcStatus === "idle" && (
            <div className="text-center">
              <div className="mb-6">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 transition-all">
                  <Smartphone className="h-10 w-10 sm:h-12 sm:w-12 text-primary" />
                </div>
                <p className="mb-4 text-gray-600 text-sm sm:text-base">
                  Register for this event using your NFC card. Ensure your
                  device supports NFC.
                </p>
              </div>
              <button
                onClick={handleStartScan}
                className="btn-primary text-white font-medium py-2.5 px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition duration-150 ease-in-out w-full"
              >
                Start NFC Scan
              </button>
              {!isNFCSupported() && (
                <div className="mt-3 flex items-center justify-center gap-1.5 text-amber-600 text-sm bg-amber-50 p-2 rounded-lg">
                  <AlertCircle className="h-4 w-4" />
                  <p>NFC may not be supported on this device or browser.</p>
                </div>
              )}
            </div>
          )}

          {nfcStatus === "scanning" && (
            <div className="text-center">
              <div className="mb-6">
                <div className="relative w-24 h-24 sm:w-32 sm:h-32 mx-auto mb-6">
                  {/* NFC animation */}
                  <div className="absolute inset-0 bg-purple-100 rounded-full flex items-center justify-center">
                    <Smartphone className="h-12 w-12 sm:h-16 sm:w-16 text-purple-600" />
                  </div>
                  <div className="absolute inset-0 rounded-full border-4 border-purple-600 opacity-30 animate-ping"></div>
                  <div
                    className="absolute inset-2 rounded-full border-4 border-purple-600 opacity-20 animate-ping"
                    style={{ animationDelay: "0.5s" }}
                  ></div>
                  <div
                    className="absolute inset-4 rounded-full border-4 border-purple-600 opacity-10 animate-ping"
                    style={{ animationDelay: "1s" }}
                  ></div>
                </div>
                <p className="text-lg font-medium text-gray-800 mb-2">
                  {scanMessage}
                </p>
                <p className="text-gray-600 text-sm sm:text-base">
                  Hold your NFC card near the back of your device
                </p>
              </div>
              <button
                onClick={onClose}
                className="border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition duration-150 ease-in-out w-full"
                disabled={submitting}
              >
                {submitting ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </span>
                ) : (
                  "Cancel"
                )}
              </button>
            </div>
          )}

          {nfcStatus === "success" && (
            <div className="text-center">
              <div className="mb-6">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 transition-transform animate-success">
                  <CheckCircle className="h-10 w-10 sm:h-12 sm:w-12 text-green-600" />
                </div>
                <p className="text-lg font-medium text-gray-800 mb-2">
                  Registration Successful!
                </p>
                <p className="text-gray-600 text-sm sm:text-base">
                  User has been registered and attendance sheet updated.
                </p>
              </div>
            </div>
          )}

          {nfcStatus === "error" && (
            <div className="text-center">
              <div className="mb-6">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="h-10 w-10 sm:h-12 sm:w-12 text-red-600" />
                </div>
                <p className="text-lg font-medium text-gray-800 mb-2">
                  Registration Failed
                </p>
                <div className="text-red-500 mb-4 p-3 bg-red-50 rounded-lg text-sm sm:text-base">
                  {error || "An error occurred during NFC registration"}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleRetry}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition duration-150 ease-in-out w-full"
                >
                  Try Again
                </button>
                <button
                  onClick={onClose}
                  className="border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition duration-150 ease-in-out w-full"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NFCRegistration;