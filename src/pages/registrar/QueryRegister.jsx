import React, { useState, useEffect, useRef } from 'react';
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/config";
import { UserPlus, Check, Clock, List, Search, Users, Edit } from 'lucide-react';
import { Html5QrcodeScanner } from "html5-qrcode";

// Queue Management System Component
export default function QueueManagementSystem() {
  // State for queue management
  const [queue, setQueue] = useState([]);
  const [currentlyServing, setCurrentlyServing] = useState([]);
  const [scannerActive, setScannerActive] = useState(false);
  const [scannedStudent, setScannedStudent] = useState(null);
  const [notification, setNotification] = useState(null);
  const [scanStatus, setScanStatus] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [scanMessage, setScanMessage] = useState(null);
  const [registrationMode, setRegistrationMode] = useState(false);
  const [purpose, setPurpose] = useState("");
  
  // Scanner reference
  const html5QrCodeScannerRef = useRef(null);

  // Mock student data - in a real app, this would come from a database
  const studentDatabase = {
    "STU001": { id: "STU001", name: "John Smith", course: "Computer Science" },
    "STU002": { id: "STU002", name: "Maria Garcia", course: "Engineering" },
    "STU003": { id: "STU003", name: "Aisha Khan", course: "Business" },
    "STU004": { id: "STU004", name: "Lee Wong", course: "Medicine" },
  };

  // Mock purpose options
  const purposeOptions = [
    "Transcript Request",
    "Enrollment Verification",
    "Grade Change Request",
    "Graduation Application",
    "Class Registration",
    "Academic Record Issue",
    "ID Card Replacement",
    "Other"
  ];

  // Start the QR code scanner
  const startScanner = () => {
    setScanStatus("scanning");
    setScanError(null);
    setScanMessage("Position the student ID QR code within the scanner area");

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
          identifyStudent(decodedText);
        } catch (error) {
          console.error("Error processing QR code:", error);
          setScanError(`Failed to process QR code: ${error.message}`);
          setScanStatus("error");
          showNotification("Failed to process QR code", "error");
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
          showNotification("Camera access denied", "error");
        }
      }
    );
  };

  // Stop the QR code scanner
  const stopScanner = () => {
    if (html5QrCodeScannerRef.current) {
      try {
        // First check if the scanner is running
        if (
          html5QrCodeScannerRef.current.html5Qrcode &&
          html5QrCodeScannerRef.current.html5Qrcode.isScanning
        ) {
          // If it's running, stop it before clearing
          html5QrCodeScannerRef.current.html5Qrcode
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

  // Identify the student from the scanned QR code
  const identifyStudent = (scannedId) => {
    const studentInfo = studentDatabase[scannedId];
    
    if (studentInfo) {
      // Check if student is already in queue
      if (queue.some(item => item.id === scannedId) || 
          currentlyServing.some(item => item.id === scannedId)) {
        showNotification(`${studentInfo.name} is already in the queue!`, "warning");
        return;
      }
      
      // Set the scanned student info
      setScannedStudent(studentInfo);
      showNotification(`Student identified: ${studentInfo.name}`, "success");
      
      // Automatically close scanner after successful scan
      setScannerActive(false);
      stopScanner();
      
      // Open registration form
      setRegistrationMode(true);
    } else {
      showNotification("Invalid student ID", "error");
    }
  };

  // Create queue entry by registrar
  const createQueueEntry = () => {
    if (!scannedStudent || !purpose) {
      showNotification("Please select a purpose for the visit", "warning");
      return;
    }

    // Add to queue with timestamp and queue number
    const queueNumber = queue.length + currentlyServing.length + 1;
    const newQueueItem = {
      ...scannedStudent,
      queueNumber,
      timestamp: new Date(),
      estimatedWait: Math.floor(Math.random() * 10) + 5, // Random wait time between 5-15 minutes
      purpose: purpose
    };
    
    setQueue([...queue, newQueueItem]);
    showNotification(`${scannedStudent.name} added to queue as #${queueNumber}`, "success");
    
    // Reset form
    setPurpose("");
    setRegistrationMode(false);
  };

  // Cancel registration
  const cancelRegistration = () => {
    setScannedStudent(null);
    setPurpose("");
    setRegistrationMode(false);
  };

  // Toggle scanner active state
  const toggleScanner = () => {
    if (scannerActive) {
      stopScanner();
      setScannerActive(false);
    } else {
      setScannerActive(true);
      // Use setTimeout to ensure DOM is ready for the scanner
      setTimeout(() => {
        startScanner();
      }, 100);
    }
  };

  // Show notification with auto-dismiss
  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Move student from waiting to being served
  const serveNext = () => {
    if (queue.length > 0) {
      const nextToServe = queue[0];
      const updatedQueue = queue.slice(1);
      setQueue(updatedQueue);
      setCurrentlyServing([...currentlyServing, nextToServe]);
      showNotification(`Now serving #${nextToServe.queueNumber}: ${nextToServe.name}`, "info");
    }
  };

  // Complete service for a student
  const completeService = (id) => {
    const updatedServing = currentlyServing.filter(student => student.id !== id);
    setCurrentlyServing(updatedServing);
    showNotification("Service completed", "success");
  };

  // Clean up scanner when component unmounts
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  // Demo: Auto-serve next in queue every 20 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (queue.length > 0) serveNext();
    }, 20000);
    
    return () => clearInterval(interval);
  }, [queue]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 shadow-md">
        <h1 className="text-2xl font-bold text-center">Student Services Queue</h1>
      </header>

      {/* Main content */}
      <main className="flex-1 p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
          {/* Notification */}
          {notification && (
            <div className={`mb-4 p-3 rounded-md text-white ${
              notification.type === 'success' ? 'bg-green-500' : 
              notification.type === 'error' ? 'bg-red-500' : 
              notification.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
            }`}>
              {notification.message}
            </div>
          )}

          {/* Two-Step Process Section */}
          <div className="mb-6 bg-white p-4 rounded-lg shadow-md">
            {/* Step 1: Student Identification */}
            {!scannedStudent ? (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Search size={24} /> Step 1: Student Identification
                  </h2>
                  <button 
                    onClick={toggleScanner}
                    className={`px-4 py-2 rounded-md flex items-center gap-2 ${
                      scannerActive ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
                    }`}
                  >
                    <UserPlus size={20} />
                    {scannerActive ? 'Close Scanner' : 'Scan Student ID'}
                  </button>
                </div>
                
                {scannerActive ? (
                  <div className="mx-auto max-w-md">
                    <div id="qr-reader" className="border-2 border-gray-300 rounded-lg overflow-hidden"></div>
                    <p className="text-center mt-2 text-gray-600">
                      {scanMessage || "Scan a student ID QR code to identify the student"}
                    </p>
                    {scanError && (
                      <p className="text-center mt-2 text-red-600">{scanError}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-6">Click "Scan Student ID" to identify a student</p>
                )}
              </>
            ) : !registrationMode ? (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2 text-green-600">
                    <Check size={24} /> Student Identified
                  </h2>
                  <button
                    onClick={() => setRegistrationMode(true)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center gap-2"
                  >
                    <Edit size={20} />
                    Continue to Registration
                  </button>
                </div>
                <div className="bg-green-50 p-4 rounded-md">
                  <h3 className="font-medium">Student Information:</h3>
                  <div className="mt-2">
                    <p><span className="font-medium">ID:</span> {scannedStudent.id}</p>
                    <p><span className="font-medium">Name:</span> {scannedStudent.name}</p>
                    <p><span className="font-medium">Course:</span> {scannedStudent.course}</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Step 2: Registrar Queue Registration */}
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Users size={24} /> Step 2: Registrar Queue Registration
                  </h2>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-md mb-4">
                  <h3 className="font-medium">Student:</h3>
                  <div className="mt-2">
                    <p><span className="font-medium">ID:</span> {scannedStudent.id}</p>
                    <p><span className="font-medium">Name:</span> {scannedStudent.name}</p>
                    <p><span className="font-medium">Course:</span> {scannedStudent.course}</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-700 mb-2">Purpose of Visit:</label>
                    <select 
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    >
                      <option value="">-- Select Purpose --</option>
                      {purposeOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  
                  {purpose === "Other" && (
                    <div>
                      <label className="block text-gray-700 mb-2">Specify Purpose:</label>
                      <input 
                        type="text" 
                        placeholder="Enter specific purpose"
                        className="w-full p-2 border border-gray-300 rounded-md"
                        onChange={(e) => setPurpose(e.target.value)}
                      />
                    </div>
                  )}
                  
                  <div className="flex justify-end gap-3 mt-4">
                    <button 
                      onClick={cancelRegistration}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={createQueueEntry}
                      className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                      disabled={!purpose}
                    >
                      Add to Queue
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Queue Display Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Now Serving */}
            <div className="bg-white p-4 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-green-600">
                <Check size={24} /> Now Serving ({currentlyServing.length})
              </h2>
              
              {currentlyServing.length > 0 ? (
                <div className="space-y-3">
                  {currentlyServing.map(student => (
                    <div key={student.id} className="flex justify-between bg-green-50 p-3 rounded-md border-l-4 border-green-500">
                      <div>
                        <div className="font-bold text-2xl">#{student.queueNumber}</div>
                        <div>{student.name}</div>
                        <div className="text-sm text-gray-500">{student.course}</div>
                        <div className="text-sm font-medium mt-1">{student.purpose}</div>
                      </div>
                      <button 
                        onClick={() => completeService(student.id)}
                        className="px-3 py-1 bg-green-500 text-white rounded-md self-center hover:bg-green-600"
                      >
                        Complete
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-6">No students currently being served</p>
              )}
            </div>

            {/* Waiting Queue */}
            <div className="bg-white p-4 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-blue-600">
                <Clock size={24} /> Waiting in Queue ({queue.length})
              </h2>
              
              {queue.length > 0 ? (
                <div className="space-y-3">
                  {queue.map((student, index) => (
                    <div key={student.id} className={`bg-blue-50 p-3 rounded-md border-l-4 ${
                      index === 0 ? 'border-blue-500' : 'border-blue-300'
                    }`}>
                      <div className="flex justify-between">
                        <div className="font-bold text-2xl">#{student.queueNumber}</div>
                        <div className="text-sm text-gray-500">
                          Est. wait: {student.estimatedWait} mins
                        </div>
                      </div>
                      <div>{student.name}</div>
                      <div className="text-sm text-gray-500">{student.course}</div>
                      <div className="text-sm font-medium mt-1">{student.purpose}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-6">Queue is currently empty</p>
              )}
              
              {queue.length > 0 && (
                <div className="mt-4 flex justify-center">
                  <button 
                    onClick={serveNext}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center gap-2"
                  >
                    <List size={20} />
                    Serve Next in Queue
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}