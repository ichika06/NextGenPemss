/**
 * A React component that displays the details of an attendance session and allows for QR code scanning.
 * @param {{boolean}} isOpen - Flag indicating if the modal is open.
 * @param {{function}} onClose - Function to close the modal.
 * @param {{object}} attendanceRecord - The attendance record object containing session details.
 * @returns The AttendanceDetailModal component.
 */
import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import {
  Calendar,
  Clock,
  User,
  Users,
  BookOpen,
  Home,
  Key,
  CheckCircle,
  XCircle,
  X,
  BarChart,
  Info,
  Mail,
  Briefcase,
  QrCode,
  Loader2,
} from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { doc, updateDoc, arrayUnion, getDoc } from "firebase/firestore";
import { db } from "../../firebase/config"; // Adjust path as needed
import { toast } from "react-toastify";
import { useAuth } from "../../contexts/AuthContext";

export default function AttendanceDetailModal({
  isOpen,
  onClose,
  attendanceRecord,
}) {
  const [activeTab, setActiveTab] = useState("details");
  const [showScanner, setShowScanner] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scannedStudentData, setScannedStudentData] = useState(null);
  const [processingAttendance, setProcessingAttendance] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState("");
  const scannerRef = useRef(null);
  const html5QrCodeScannerRef = useRef(null);
  const { currentUser, currentUserData } = useAuth();

  // Format timestamp if it exists
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";
    try {
      if (timestamp.toDate) {
        return format(timestamp.toDate(), "PPpp");
      } else if (timestamp instanceof Date) {
        return format(timestamp, "PPpp");
      } else {
        return new Date(timestamp).toISOString();
      }
    } catch (error) {
      return "Invalid date";
    }
  };

  // Calculate session status (active/expired)
  const getSessionStatus = () => {
    if (!attendanceRecord) return { status: "Unknown", color: "gray" };

    if (attendanceRecord.active === true) {
      return { status: "Active", color: "emerald" };
    }

    const now = new Date();
    const expiresAt = attendanceRecord.expiresAt
      ? new Date(attendanceRecord.expiresAt)
      : null;

    if (expiresAt && expiresAt > now) {
      return { status: "Active", color: "emerald" };
    } else {
      return { status: "Expired", color: "red" };
    }
  };

  const sessionStatus = getSessionStatus();

  // Calculate attendance statistics if students array exists
  const getAttendanceStats = () => {
    if (
      !attendanceRecord?.students ||
      !Array.isArray(attendanceRecord.students)
    ) {
      return { total: 0, present: 0, absent: 0, presentPercentage: 0 };
    }

    const total = attendanceRecord.students.length;
    const present = attendanceRecord.students.filter(
      (student) => student.isPresent
    ).length;
    const absent = total - present;
    const presentPercentage =
      total > 0 ? Math.round((present / total) * 100) : 0;

    return { total, present, absent, presentPercentage };
  };

  const stats = getAttendanceStats();

  // Update time remaining countdown
  useEffect(() => {
    if (!attendanceRecord?.expiresAt) return;

    const updateTimeRemaining = () => {
      const now = new Date();
      const expiresAt = new Date(attendanceRecord.expiresAt);

      if (expiresAt <= now) {
        setTimeRemaining("Expired");
        return;
      }

      const timeDiff = expiresAt - now;
      const hours = Math.floor(timeDiff / (1000 * 60 * 60));
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

      setTimeRemaining(
        `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [attendanceRecord]);

  useEffect(() => {
    if (showScanner && scannerRef.current && !html5QrCodeScannerRef.current) {
      setScanning(true);

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
            await processAttendance(decodedText);
          } catch (error) {
            console.error("Error processing QR code:", error);
            toast.error(`Failed to process QR code: ${error.message}`);
          }
        },
        // Error callback
        (errorMessage) => {
          console.error("QR Code scanning error:", errorMessage);
          // Don't close the scanner on intermittent errors
          // Only display errors if they persist
          if (errorMessage.includes("NotFoundException") && scanning) {
            // This is normal when no QR code is in view, so we don't need to do anything
            return;
          }

          if (errorMessage.includes("NotAllowedError")) {
            toast.error(
              "Camera access denied. Please allow camera access and try again."
            );
            setShowScanner(false);
          }
        }
      );
    }

    return () => {
      // Cleanup function for scanner
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
  }, [showScanner, attendanceRecord]);

  // Process scanned attendance data
  const processAttendance = async (scannedCode) => {
    if (!attendanceRecord || !attendanceRecord.id) {
      toast.error("Attendance record not found");
      return;
    }

    try {
      // Check if already processing to prevent duplicate submissions
      if (processingAttendance) {
        console.log("Already processing attendance, ignoring duplicate scan");
        return;
      }

      setProcessingAttendance(true);

      // First properly stop the scanner
      if (
        html5QrCodeScannerRef.current &&
        html5QrCodeScannerRef.current.html5Qrcode
      ) {
        try {
          // Set scanning to false before attempting to stop
          setScanning(false);

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
              // Continue processing even if stop fails
            }

            // Continue with attendance processing
            processScanResult(scannedCode);
          }, 100);
        } catch (e) {
          console.error("Error stopping scanner:", e);
          // Continue with processing anyway
          processScanResult(scannedCode);
        }
      } else {
        // If scanner reference isn't available, just process the scan
        processScanResult(scannedCode);
      }
    } catch (error) {
      console.error("Error in processAttendance:", error);
      toast.error(`Failed to process scan: ${error.message}`);
      setProcessingAttendance(false);
      setShowScanner(false);
    }
  };

  // Add this helper function to handle the actual attendance processing
  const processScanResult = async (scannedCode) => {
    try {
      // Check if the session has expired
      const now = new Date();
      const expiresAt = attendanceRecord.expiresAt
        ? new Date(attendanceRecord.expiresAt)
        : null;

      if (expiresAt && expiresAt < now) {
        const formattedExpireTime = expiresAt.toLocaleString();
        toast.error(
          `This attendance session expired at ${formattedExpireTime}`
        );
        setProcessingAttendance(false);
        setShowScanner(false);
        return;
      }

      // Extract the code from the scanned URL if it's a URL format
      let attendanceCode = scannedCode;
      if (scannedCode.includes("?code=")) {
        const url = new URL(scannedCode);
        const params = new URLSearchParams(url.search);
        attendanceCode = params.get("code");
      }

      // Check if the scanned code matches the attendance code
      if (attendanceCode !== attendanceRecord.attendanceCode) {
        toast.error("Invalid attendance code");
        setProcessingAttendance(false);
        setShowScanner(false);
        return;
      }

      // At this point, the code is valid
      toast.success("Valid attendance code scanned!");

      // Create student data object with just the currentUser.uid
      const studentData = {
        teacherName: attendanceRecord.teacherName,
        course: attendanceRecord.course,
        userUID: currentUser.uid,
        studentId: currentUserData.studentId,
        profileImageUrl: currentUserData.profileImage,
        isPresent: true,
        email: currentUser.email,
        name: currentUserData.name,
        timestamp: new Date().toISOString(),
        comment: "Checked in via QR scan",
      };

      // Check if student already exists in the attendance record
      const docRef = doc(db, "attendance-sessions", attendanceRecord.id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        toast.error("Attendance session not found");
        setProcessingAttendance(false);
        setShowScanner(false);
        return;
      }

      const currentData = docSnap.data();
      const existingStudent = currentData.students.find(
        (student) => student.studentId === studentData.studentId
      );

      if (existingStudent) {
        toast.info("You have already checked in");
        setShowScanner(false);
        return;
      }

      // Add student to attendance record
      await updateDoc(docRef, {
        students: arrayUnion(studentData),
      });

      toast.success("Checked in successfully!");

      // Set the scanned student data for display
      setScannedStudentData(studentData);

      // Add a delay before closing the scanner to show success message
      setTimeout(() => {
        // Update the local attendance record to reflect changes
        if (attendanceRecord.students) {
          attendanceRecord.students.push(studentData);
        } else {
          attendanceRecord.students = [studentData];
        }

        // Close scanner after successful check-in
        setShowScanner(false);
        setProcessingAttendance(false);
      }, 2000); // 2-second delay to show success message
    } catch (error) {
      console.error("Error updating attendance:", error);
      toast.error("Failed to update attendance");
      setProcessingAttendance(false);
    }
  };

  // Toggle QR scanner
  const toggleScanner = () => {
    if (sessionStatus.status === "Expired") {
      toast.error("Cannot scan QR codes for expired attendance sessions");
      return;
    }

    // If we're closing the scanner, make sure to stop it first
    if (
      showScanner &&
      html5QrCodeScannerRef.current &&
      html5QrCodeScannerRef.current.html5Qrcode
    ) {
      try {
        html5QrCodeScannerRef.current.html5Qrcode
          .stop()
          .catch((err) => {
            console.warn("Error stopping scanner:", err);
          })
          .finally(() => {
            // Reset states when toggling scanner
            setProcessingAttendance(false);
            setScannedStudentData(null);
            setShowScanner(false);
            html5QrCodeScannerRef.current = null;
          });
      } catch (e) {
        console.error("Error in toggleScanner:", e);
        // Reset states anyway
        setProcessingAttendance(false);
        setScannedStudentData(null);
        setShowScanner(false);
        html5QrCodeScannerRef.current = null;
      }
    } else {
      // Reset states when toggling scanner
      setProcessingAttendance(false);
      setScannedStudentData(null);
      setShowScanner(!showScanner);
    }
  };

  if (!isOpen || !attendanceRecord) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="background-primary px-4 sm:px-6 py-4 flex justify-between items-center">
          <h2 className="text-m sm:text-xl font-bold text-primary header flex items-center">
            <Calendar className="mr-2 h-5 w-5 text-primary" />
            Attendance Session Details
          </h2>
          <div className="flex items-center space-x-2">
            {sessionStatus.status === "Active" && (
              <button
                onClick={toggleScanner}
                className="text-white background-primary-light px-2 sm:px-3 py-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-white/50 transition-colors flex items-center text-xs sm:text-sm"
              >
                <QrCode className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 text-primary" />
                <span className="hidden xs:inline text-primary paragraph">
                  Scan QR
                </span>
                <span className="xs:hidden text-primary paragraph">Scan</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 p-1.5 rounded-full focus:outline-none focus:ring-2 focus:ring-white/50 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-primary header" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          {/* Sidebar with session info - collapsible on mobile */}
          <div className="p-4 sm:p-6 bg-gray-50 lg:w-1/3 overflow-y-auto border-b lg:border-r lg:border-b-0 border-gray-200">
            <div className="mb-4 sm:mb-6 flex flex-wrap items-center justify-between gap-2">
              <span
                className={`inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium ${
                  sessionStatus.color === "emerald"
                    ? "bg-emerald-100 paragraph-secondary-no-color text-emerald-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                <div
                  className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
                    sessionStatus.color === "emerald"
                      ? "bg-emerald-500"
                      : "bg-red-500"
                  } mr-1.5 sm:mr-2 animate-pulse`}
                ></div>
                {sessionStatus.status}
              </span>

              {/* Time remaining counter */}
              {attendanceRecord.expiresAt && (
                <div className="flex items-center">
                  <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500 mr-1 sm:mr-2" />
                  <span
                    className={`text-xs sm:text-sm font-mono ${
                      timeRemaining === "Expired"
                        ? "text-red-600 paragraph-secondary-no-color"
                        : "paragraph-secondary-no-color text-gray-700"
                    }`}
                  >
                    {timeRemaining === "Expired"
                      ? "Expired"
                      : `${timeRemaining}`}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-1 gap-3 sm:gap-5">
              <div className="flex items-start">
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-primary mt-0.5 mr-2 sm:mr-3 flex-shrink-0" />
                <div>
                  <h3 className="text-xs font-medium text-primary-secondary uppercase paragraph">
                    Course
                  </h3>
                  <p className="text-sm sm:text-base font-semibold paragraph-secondary">
                    {attendanceRecord.course || "N/A"}
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary mt-0.5 mr-2 sm:mr-3 flex-shrink-0" />
                <div>
                  <h3 className="text-xs font-medium text-primary-secondary paragraph uppercase">
                    Section
                  </h3>
                  <p className="text-sm sm:text-base font-semibold paragraph-secondary">
                    {attendanceRecord.section || "N/A"}
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-primary mt-0.5 mr-2 sm:mr-3 flex-shrink-0" />
                <div>
                  <h3 className="text-xs font-medium text-primary-secondary paragraph uppercase">
                    Date
                  </h3>
                  <p className="text-sm sm:text-base font-semibold paragraph-secondary">
                    {attendanceRecord.date || "N/A"}
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <Home className="w-4 h-4 sm:w-5 sm:h-5 text-primary mt-0.5 mr-2 sm:mr-3 flex-shrink-0" />
                <div>
                  <h3 className="text-xs font-medium text-primary-secondary paragraph uppercase">
                    Room
                  </h3>
                  <p className="text-sm sm:text-base font-semibold paragraph-secondary">
                    {attendanceRecord.room || "N/A"}
                  </p>
                </div>
              </div>

              <div className="flex items-start col-span-2 sm:col-span-1">
                <Key className="w-4 h-4 sm:w-5 sm:h-5 text-primary mt-0.5 mr-2 sm:mr-3 flex-shrink-0" />
                <div className="w-full">
                  <h3 className="text-xs font-medium text-primary-secondary paragraph uppercase">
                    Attendance Code
                  </h3>
                  <p className="text-sm sm:text-base font-mono bg-gray-100 p-1.5 sm:p-2 rounded-md paragraph-secondary mt-1 w-full overflow-x-auto">
                    {attendanceRecord.attendanceCode || "N/A"}
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary mt-0.5 mr-2 sm:mr-3 flex-shrink-0" />
                <div>
                  <h3 className="text-xs font-medium text-primary-secondary paragraph uppercase">
                    Created
                  </h3>
                  <p className="text-xs sm:text-sm paragraph-secondary">
                    {formatTimestamp(attendanceRecord.createdAt)}
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary mt-0.5 mr-2 sm:mr-3 flex-shrink-0" />
                <div>
                  <h3 className="text-xs font-medium text-primary-secondary paragraph uppercase">
                    Expires
                  </h3>
                  <p className="text-xs sm:text-sm paragraph-secondary">
                    {attendanceRecord.expiresAt
                      ? new Date(attendanceRecord.expiresAt).toLocaleString()
                      : "N/A"}
                  </p>
                </div>
              </div>
            </div>

            {/* Teacher info */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h3 className="text-sm sm:text-md font-medium mb-3 flex items-center text-primary-secondary header">
                <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 text-primary" />
                Teacher Information
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-1 gap-3">
                <div className="flex items-start">
                  <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary mt-0.5 mr-2 flex-shrink-0" />
                  <div>
                    <h4 className="text-xs font-medium text-primary-secondary paragraph uppercase">
                      Name
                    </h4>
                    <p className="text-xs sm:text-sm font-medium paragraph-secondary">
                      {attendanceRecord.teacherName || "N/A"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary mt-0.5 mr-2 flex-shrink-0" />
                  <div>
                    <h4 className="text-xs font-medium text-primary-secondary paragraph uppercase">
                      Email
                    </h4>
                    <p className="text-xs sm:text-sm paragraph-secondary break-all">
                      {attendanceRecord.teacherEmail || "N/A"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start col-span-2 sm:col-span-1">
                  <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary mt-0.5 mr-2 flex-shrink-0" />
                  <div>
                    <h4 className="text-xs font-medium text-primary-secondary paragraph uppercase">
                      Department
                    </h4>
                    <p className="text-xs sm:text-sm paragraph-secondary">
                      {attendanceRecord.department || "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main content area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Tabs */}
            <div className="px-4 sm:px-6 border-b border-gray-200">
              <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto scrollbar-hide">
                <button
                  className={`px-2 sm:px-3 py-3 sm:py-4 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === "details"
                      ? "text-primary border-primary"
                      : "text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300"
                  }`}
                  onClick={() => setActiveTab("details")}
                >
                  <div className="flex items-center">
                    <BarChart className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    Overview
                  </div>
                </button>
                <button
                  className={`px-2 sm:px-3 py-3 sm:py-4 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === "students"
                      ? "text-primary border-primary"
                      : "text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300"
                  }`}
                  onClick={() => setActiveTab("students")}
                >
                  <div className="flex items-center">
                    <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    Students ({stats.total})
                  </div>
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
              {activeTab === "details" && (
                <div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 mb-6 sm:mb-8">
                    <div className="bg-blue-50 rounded-lg p-3 sm:p-5 text-center shadow-sm">
                      <div className="flex items-center justify-center mb-1 sm:mb-2">
                        <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                      </div>
                      <p className="text-xs sm:text-sm font-medium paragraph-secondary-no-color text-blue-600 mb-0.5 sm:mb-1">
                        Total Students
                      </p>
                      <p className="text-xl sm:text-3xl font-bold paragraph-secondary-no-color text-blue-700">
                        {stats.total}
                      </p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-3 sm:p-5 text-center shadow-sm">
                      <div className="flex items-center justify-center mb-1 sm:mb-2">
                        <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />
                      </div>
                      <p className="text-xs sm:text-sm font-medium paragraph-secondary-no-color text-emerald-600 mb-0.5 sm:mb-1">
                        Present
                      </p>
                      <p className="text-xl sm:text-3xl font-bold paragraph-secondary-no-color text-emerald-700">
                        {stats.present}
                        <span className="text-xs sm:text-sm ml-1">
                          ({stats.presentPercentage}%)
                        </span>
                      </p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3 sm:p-5 text-center shadow-sm">
                      <div className="flex items-center justify-center mb-1 sm:mb-2">
                        <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
                      </div>
                      <p className="text-xs sm:text-sm font-medium paragraph-secondary-no-color text-red-600 mb-0.5 sm:mb-1">
                        Absent
                      </p>
                      <p className="text-xl sm:text-3xl paragraph-secondary-no-color font-bold text-red-700">
                        {stats.absent}
                        <span className="text-xs sm:text-sm ml-1">
                          ({100 - stats.presentPercentage}%)
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 sm:space-y-6">
                    <div>
                      <h3 className="text-base sm:text-lg font-medium mb-2 sm:mb-3 flex items-center text-gray-800">
                        <Info className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2 text-indigo-600" />
                        Session Information
                      </h3>
                      <div className="bg-gray-50 p-3 sm:p-5 rounded-lg border border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                          <div className="space-y-2 sm:space-y-3">
                            <p className="flex flex-col sm:flex-row sm:items-start text-xs sm:text-sm">
                              <span className="font-medium paragraph-secondary-no-color text-gray-700 sm:mr-2 sm:min-w-[120px]">
                                Date Object:
                              </span>
                              <span className="paragraph-secondary-no-color text-gray-600 break-all">
                                {attendanceRecord.dateObject || "N/A"}
                              </span>
                            </p>
                            <p className="flex flex-col sm:flex-row paragraph-secondary-no-color sm:items-start text-xs sm:text-sm">
                              <span className="font-medium paragraph-secondary-no-color text-gray-700 sm:mr-2 sm:min-w-[120px]">
                                Session ID:
                              </span>
                              <span className="text-gray-600 paragraph-secondary-no-color font-mono text-xs break-all">
                                {attendanceRecord.id || "N/A"}
                              </span>
                            </p>
                            <p className="flex flex-col sm:flex-row sm:items-start paragraph-secondary-no-color text-xs sm:text-sm">
                              <span className="font-medium text-gray-700 sm:mr-2 sm:min-w-[120px]">
                                Status:
                              </span>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  attendanceRecord.active
                                    ? "paragraph-secondary-no-color bg-emerald-100 text-emerald-800"
                                    : "paragraph-secondary-no-color bg-gray-100 text-gray-800"
                                }`}
                              >
                                {attendanceRecord.active
                                  ? "Active"
                                  : "Inactive"}
                              </span>
                            </p>
                          </div>
                          <div className="flex items-center justify-center mt-2 sm:mt-0">
                            <div
                              className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center ${
                                stats.presentPercentage > 75
                                  ? "paragraph-secondary-no-color bg-emerald-100"
                                  : stats.presentPercentage > 50
                                  ? "paragraph-secondary-no-color bg-yellow-100"
                                  : "paragraph-secondary-no-color bg-red-100"
                              }`}
                            >
                              <div className="text-center">
                                <div
                                  className={`text-xl sm:text-2xl font-bold ${
                                    stats.presentPercentage > 75
                                      ? "paragraph-secondary-no-color text-emerald-700"
                                      : stats.presentPercentage > 50
                                      ? "paragraph-secondary-no-color text-yellow-700"
                                      : "paragraph-secondary-no-color text-red-700"
                                  }`}
                                >
                                  {stats.presentPercentage}%
                                </div>
                                <div className="text-xs font-medium text-gray-600">
                                  Attendance
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "students" && (
                <div>
                  <div className="mb-4 sm:mb-6 flex items-center justify-between">
                    <h3 className="text-base sm:text-lg font-medium flex items-center text-primary-secondary paragraph">
                      <Users className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2 text-primary" />
                      Student Attendance
                    </h3>
                    <div className="flex items-center space-x-2 sm:space-x-3 text-xs">
                      <div className="flex items-center">
                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-emerald-500 mr-1"></div>
                        <span className="text-gray-600">Present</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-red-500 mr-1"></div>
                        <span className="text-gray-600">Absent</span>
                      </div>
                    </div>
                  </div>

                  {attendanceRecord.students &&
                  attendanceRecord.students.length > 0 ? (
                    <div className="overflow-hidden border border-gray-200 rounded-lg">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th
                                scope="col"
                                className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium paragraph-secondary-no-color text-gray-500 uppercase tracking-wider"
                              >
                                Name
                              </th>
                              <th
                                scope="col"
                                className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium paragraph-secondary-no-color text-gray-500 uppercase tracking-wider hidden sm:table-cell"
                              >
                                Email
                              </th>
                              <th
                                scope="col"
                                className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium paragraph-secondary-no-color text-gray-500 uppercase tracking-wider"
                              >
                                Status
                              </th>
                              <th
                                scope="col"
                                className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium paragraph-secondary-no-color text-gray-500 uppercase tracking-wider hidden md:table-cell"
                              >
                                Check-in Time
                              </th>
                              <th
                                scope="col"
                                className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium paragraph-secondary-no-color text-gray-500 uppercase tracking-wider hidden lg:table-cell"
                              >
                                Comment
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {attendanceRecord.students.map((student, index) => (
                              <tr
                                key={student.studentId || index}
                                className={
                                  index % 2 === 0 ? "bg-white" : "bg-gray-50"
                                }
                              >
                                <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <div
                                      className={`flex-shrink-0 h-6 w-6 sm:h-8 sm:w-8 rounded-full flex items-center justify-center ${
                                        student.isPresent
                                          ? "bg-emerald-100"
                                          : "bg-red-100"
                                      }`}
                                    >
                                      {student.profileImageUrl ? (
                                        <img
                                          src={
                                            student.profileImageUrl ||
                                            "/placeholder.svg"
                                          }
                                          alt={student.name || "Student"}
                                          className="h-6 w-6 sm:h-8 sm:w-8 rounded-full object-cover "
                                        />
                                      ) : (
                                        <User
                                          className={`h-3 w-3 sm:h-4 sm:w-4  ${
                                            student.isPresent
                                              ? "text-emerald-600"
                                              : "text-red-600"
                                          }`}
                                        />
                                      )}
                                    </div>
                                    <div className="ml-2 sm:ml-4">
                                      <div className="text-xs sm:text-sm font-medium paragraph-secondary-no-color text-gray-900">
                                        {student.name || "N/A"}
                                      </div>
                                      <div className="text-xs paragraph-secondary-no-color text-gray-500">
                                        ID: {student.studentId || "N/A"}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap hidden sm:table-cell">
                                  <div className="text-xs sm:text-sm paragraph-secondary-no-color text-gray-500">
                                    {student.email || "N/A"}
                                  </div>
                                </td>
                                <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium paragraph-secondary-no-color ${
                                      student.isPresent
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {student.isPresent ? "Present" : "Absent"}
                                  </span>
                                </td>
                                <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap hidden md:table-cell">
                                  <div className="text-xs sm:text-sm paragraph-secondary-no-color text-gray-500">
                                    {student.timestamp
                                      ? new Date(
                                          student.timestamp
                                        ).toLocaleString()
                                      : "N/A"}
                                  </div>
                                </td>
                                <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap hidden lg:table-cell">
                                  <div className="text-xs sm:text-sm paragraph-secondary-no-color text-gray-500 max-w-xs truncate">
                                    {student.comment || "No comment"}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-6 sm:p-8 text-center border border-gray-200">
                      <Users className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-2 sm:mb-3" />
                      <h3 className="text-base sm:text-lg font-medium text-gray-800 mb-1">
                        No Students Yet
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                        No students have checked in for this attendance session
                        yet.
                      </p>
                      {sessionStatus.status === "Active" && (
                        <button
                          onClick={toggleScanner}
                          className="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 border border-transparent text-xs sm:text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                        >
                          <QrCode className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                          Scan Student QR Code
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* QR Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center">
                <QrCode className="mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                Scan QR Code
              </h3>
              <button
                onClick={() => setShowScanner(false)}
                className="text-white hover:bg-white/20 p-1.5 rounded-full focus:outline-none focus:ring-2 focus:ring-white/50 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6">
              <div className="flex flex-col gap-4 sm:gap-6">
                <div className="mx-auto w-full max-w-[250px] sm:max-w-[300px]">
                  <div
                    id="qr-reader"
                    ref={scannerRef}
                    className="border border-gray-300 rounded-lg overflow-hidden"
                  ></div>
                  <p className="text-xs sm:text-sm text-gray-600 mt-2 text-center">
                    Position the QR code within the frame to scan
                  </p>
                </div>

                {processingAttendance && (
                  <div className="flex items-center justify-center text-indigo-600 bg-indigo-50 p-3 sm:p-4 rounded-lg">
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2 animate-spin" />
                    Processing attendance...
                  </div>
                )}

                {scannedStudentData && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
                    <h4 className="text-green-800 font-medium mb-1.5 sm:mb-2 flex items-center text-sm sm:text-base">
                      <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                      Student Detected
                    </h4>
                    <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm ">
                      <p>
                        <span className="font-medium ">Name:</span>{" "}
                        {scannedStudentData.name}
                      </p>
                      <p>
                        <span className="font-medium">Email:</span>{" "}
                        {scannedStudentData.email}
                      </p>
                      <p>
                        <span className="font-medium">Student ID:</span>{" "}
                        {scannedStudentData.studentId}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 flex justify-end border-t border-gray-200">
              <button
                onClick={() => setShowScanner(false)}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
