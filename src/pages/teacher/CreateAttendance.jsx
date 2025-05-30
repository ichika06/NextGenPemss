import { useState } from "react";
import { collection, addDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "react-toastify";
import QRCode from "react-qr-code";
import { v4 as uuidv4 } from "uuid";
import {
  BookOpen,
  Clock,
  User,
  Mail,
  Building,
  Calendar,
  MapPin,
  Users,
  CheckCircle,
  QrCode,
  Usb,
  Wifi,
  Plus,
  ExternalLink,
  ChevronDown,
  Microchip,
} from "lucide-react";
import { LoadingAnimation } from "../../components/LoadingAnimation";
import { sendEmail, EmailTemplates } from "../../sendEmail";
import useFirestoreChecker from "../../components/reuseChecker/FirestoreCheckerHook";
import HardwareWiFi from "../../components/RegisterEvent/HardwareWifi";

// IndexedDB utility functions
const DB_NAME = 'AttendanceQRCodes';
const DB_VERSION = 1;
const STORE_NAME = 'qr_codes';

const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('attendanceCode', 'attendanceCode', { unique: true });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
};

const saveQRCodeToIndexedDB = async (attendanceData, qrCodeValue) => {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const qrCodeData = {
      id: attendanceData.attendanceCode,
      attendanceCode: attendanceData.attendanceCode,
      qrCodeValue: qrCodeValue,
      attendanceData: attendanceData,
      createdAt: new Date().toISOString(),
      expiresAt: attendanceData.expiresAt,
      section: attendanceData.section,
      course: attendanceData.course,
      room: attendanceData.room,
      teacherName: attendanceData.teacherName,
    };

    await store.put(qrCodeData);
    console.log('QR Code saved to IndexedDB successfully');
    return true;
  } catch (error) {
    console.error('Error saving QR Code to IndexedDB:', error);
    return false;
  }
};

export default function TeacherCreateAttendance() {
  const [showHardwareWifi, setShowHardwareWifi] = useState(false);
  const { currentUser, currentUserData } = useAuth();
  const { loading: checkingFirestore, getStudentsBySection } = useFirestoreChecker();
  const [loading, setLoading] = useState(false);
  const [attendanceCreated, setAttendanceCreated] = useState(false);
  const [attendanceId, setAttendanceId] = useState("");
  const [attendanceData, setAttendanceData] = useState(null);
  const [expandedSection, setExpandedSection] = useState("teacher");
  const [emailStatus, setEmailStatus] = useState("");
  const [qrCodeValue, setQrCodeValue] = useState("");

  // Form fields
  const [section, setSection] = useState("");
  const [course, setCourse] = useState("");
  const [room, setRoom] = useState("");
  const [expireHours, setExpireHours] = useState(1);

  // Teacher details (prefilled)
  const [teacherName, setTeacherName] = useState(currentUserData?.name || "");
  const [department, setDepartment] = useState(
    currentUserData?.department || ""
  );

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handleCreateAttendance = async (e) => {
    e.preventDefault();

    if (!section || !course || !room) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      setLoading(true);

      // Calculate expiration date (current time + hours)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + Number.parseInt(expireHours));

      // Generate unique ID for this attendance session
      const uniqueId = uuidv4().substring(0, 8);

      // Create current date for displaying in student view
      const currentDate = new Date();

      const attendanceSession = {
        section,
        course,
        room,
        teacherId: currentUserData?.teacherId,
        teacherUID: currentUser.uid,
        teacherName,
        teacherEmail: currentUser.email,
        department,
        createdAt: serverTimestamp(),
        date: currentDate.toLocaleDateString(),
        dateObject: currentDate.toISOString(),
        expiresAt: expiresAt.toISOString(),
        active: true,
        attendanceCode: uniqueId,
        students: [],
      };

      // Generate QR code value
      const qrValue = `${window.location.origin}/student-attendance?code=${uniqueId}`;
      setQrCodeValue(qrValue);

      // Save to Firestore first
      const docRef = await addDoc(
        collection(db, "attendance-sessions"),
        attendanceSession
      );

      // Update the document with its own ID
      await updateDoc(docRef, {
        id: docRef.id
      });

      // Update attendance session data with the document ID
      const updatedAttendanceSession = {
        ...attendanceSession,
        id: docRef.id
      };

      // Save the attendance session to state (with ID included)
      setAttendanceData(updatedAttendanceSession);

      // Save QR Code to IndexedDB for later use in manage attendance
      const savedToIndexedDB = await saveQRCodeToIndexedDB(updatedAttendanceSession, qrValue);
      if (savedToIndexedDB) {
        toast.success("QR Code saved for future management!");
      } else {
        toast.warn("Attendance created but QR Code couldn't be saved locally");
      }

      // Get all students from the same section
      const { students } = await getStudentsBySection(section);

      // Send emails to all students in the section
      if (students && students.length > 0) {
        setEmailStatus(`Sending emails to ${students.length} students...`);

        const emailPromises = students.map(async (student) => {
          const emailData = {
            email: student.email,
            fullName: student.name,
            studentId: student.studentId,
            section: student.section,
            course: student.course,
            attendanceCode: uniqueId,
            courseName: course,
            room: room,
            teacherName: teacherName,
            date: currentDate.toLocaleDateString(),
            expiresAt: expiresAt.toLocaleString(),
            // Include document ID in email data if needed
            attendanceId: docRef.id,
          };

          return sendEmail({
            template: EmailTemplates.NEW_ATTENDANCE,
            data: emailData,
            onError: (error) => {
              console.error(`Failed to send email to ${student.email}:`, error);
            },
          });
        });

        await Promise.allSettled(emailPromises);
        setEmailStatus(`Emails sent successfully to ${students.length} students`);
      } else {
        setEmailStatus("No students found in this section");
      }

      setAttendanceId(docRef.id);
      setAttendanceCreated(true);
      toast.success("Attendance session created successfully!");
    } catch (error) {
      console.error("Error creating attendance session:", error);
      toast.error("Failed to create attendance session");
    } finally {
      setLoading(false);
    }
  };

  const handleUSBConnection = () => {
    // Handle USB hardware connection
    toast.info("Connecting to USB hardware...");
    // Add your USB connection logic here
    console.log("USB Hardware connection initiated");
  };

  const handleWirelessConnection = () => {
    if (!attendanceId || !attendanceData) {
      toast.error("Please create an attendance session first");
      return;
    }

    // Show the hardware WiFi modal
    setShowHardwareWifi(true);
    toast.info("Connecting to wireless hardware...");
  };

  // Add this function to handle successful registrations
  const handleHardwareSuccess = (userData) => {
    toast.success(`${userData.name || userData.email} registered successfully!`);
    // You can update the UI or state here if needed
  };

  return (
    <div className="max-w-7xl mx-auto mt-5 px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 mb-4 sm:mb-6 flex items-center">
        <Users className="mr-2 h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-primary" />
        Create Attendance Session
      </h1>

      {!attendanceCreated ? (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="background-primary px-4 sm:px-6 py-3 sm:py-4">
            <h2 className="text-primary text-base sm:text-lg font-semibold">
              New Attendance Session
            </h2>
            <p className="text-primary-secondary text-xs sm:text-sm">
              Fill in the details below to create a new attendance session
            </p>
          </div>

          <form onSubmit={handleCreateAttendance} className="p-4 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:gap-6">
              {/* Teacher Information - Mobile Accordion */}
              <div className="block sm:hidden">
                <button
                  type="button"
                  className="w-full flex justify-between items-center py-3 px-4 bg-gray-50 rounded-lg text-left"
                  onClick={() => toggleSection("teacher")}
                >
                  <div className="flex items-center">
                    <User className="mr-2 h-4 w-4 text-primary" />
                    <span className="font-semibold text-gray-800">
                      Teacher Information
                    </span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-gray-500 transition-transform ${expandedSection === "teacher"
                        ? "transform rotate-180"
                        : ""
                      }`}
                  />
                </button>

                {expandedSection === "teacher" && (
                  <div className="mt-3 p-4 border border-gray-200 rounded-lg">
                    <div className="space-y-4">
                      <div>
                        <label
                          className="text-gray-700 text-xs font-bold mb-1 flex items-center"
                          htmlFor="teacherName-mobile"
                        >
                          <User className="mr-1 h-3 w-3 text-gray-500" />
                          Teacher Name
                        </label>
                        <input
                          type="text"
                          id="teacherName-mobile"
                          className="shadow-sm border border-gray-300 rounded-lg w-full py-2 px-3 text-sm text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                          value={teacherName}
                          onChange={(e) => setTeacherName(e.target.value)}
                          disabled={currentUserData?.name}
                          required
                        />
                      </div>

                      <div>
                        <label
                          className="text-gray-700 text-xs font-bold mb-1 flex items-center"
                          htmlFor="teacherEmail-mobile"
                        >
                          <Mail className="mr-1 h-3 w-3 text-gray-500" />
                          Email
                        </label>
                        <input
                          type="email"
                          id="teacherEmail-mobile"
                          className="shadow-sm border border-gray-300 rounded-lg w-full py-2 px-3 text-sm text-gray-700 leading-tight bg-gray-50 cursor-not-allowed"
                          value={currentUser?.email || ""}
                          disabled
                        />
                      </div>

                      <div>
                        <label
                          className="text-gray-700 text-xs font-bold mb-1 flex items-center"
                          htmlFor="department-mobile"
                        >
                          <Building className="mr-1 h-3 w-3 text-gray-500" />
                          Department
                        </label>
                        <input
                          type="text"
                          id="department-mobile"
                          className="shadow-sm border border-gray-300 rounded-lg w-full py-2 px-3 text-sm text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          placeholder="Computer Science"
                          required
                        />
                      </div>

                      <div>
                        <label
                          className="text-gray-700 text-xs font-bold mb-1 flex items-center"
                          htmlFor="date-mobile"
                        >
                          <Calendar className="mr-1 h-3 w-3 text-gray-500" />
                          Date Created
                        </label>
                        <input
                          type="text"
                          id="date-mobile"
                          className="shadow-sm border border-gray-300 rounded-lg w-full py-2 px-3 text-sm text-gray-700 leading-tight bg-gray-50 cursor-not-allowed"
                          value={new Date().toLocaleDateString()}
                          disabled
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Attendance Information - Mobile Accordion */}
              <div className="block sm:hidden">
                <button
                  type="button"
                  className="w-full flex justify-between items-center py-3 px-4 bg-gray-50 rounded-lg text-left"
                  onClick={() => toggleSection("attendance")}
                >
                  <div className="flex items-center">
                    <BookOpen className="mr-2 h-4 w-4 text-primary" />
                    <span className="font-semibold text-gray-800">
                      Attendance Information
                    </span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-gray-500 transition-transform ${expandedSection === "attendance"
                        ? "transform rotate-180"
                        : ""
                      }`}
                  />
                </button>

                {expandedSection === "attendance" && (
                  <div className="mt-3 p-4 border border-gray-200 rounded-lg">
                    <div className="space-y-4">
                      <div>
                        <label
                          className="text-gray-700 text-xs font-bold mb-1 flex items-center"
                          htmlFor="section-mobile"
                        >
                          <Users className="mr-1 h-3 w-3 text-gray-500" />
                          Section/Class Code
                        </label>
                        <input
                          type="text"
                          id="section-mobile"
                          className="shadow-sm border border-gray-300 rounded-lg w-full py-2 px-3 text-sm text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                          value={section}
                          onChange={(e) => setSection(e.target.value)}
                          placeholder="LFAU333A004"
                          required
                        />
                      </div>

                      <div>
                        <label
                          className="text-gray-700 text-xs font-bold mb-1 flex items-center"
                          htmlFor="course-mobile"
                        >
                          <BookOpen className="mr-1 h-3 w-3 text-gray-500" />
                          Course
                        </label>
                        <input
                          type="text"
                          id="course-mobile"
                          className="shadow-sm border border-gray-300 rounded-lg w-full py-2 px-3 text-sm text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                          value={course}
                          onChange={(e) => setCourse(e.target.value)}
                          placeholder="Introduction to Computer Science"
                          required
                        />
                      </div>

                      <div>
                        <label
                          className="text-gray-700 text-xs font-bold mb-1 flex items-center"
                          htmlFor="room-mobile"
                        >
                          <MapPin className="mr-1 h-3 w-3 text-gray-500" />
                          Room
                        </label>
                        <input
                          type="text"
                          id="room-mobile"
                          className="shadow-sm border border-gray-300 rounded-lg w-full py-2 px-3 text-sm text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                          value={room}
                          onChange={(e) => setRoom(e.target.value)}
                          placeholder="B-301"
                          required
                        />
                      </div>

                      <div>
                        <label
                          className="text-gray-700 text-xs font-bold mb-1 flex items-center"
                          htmlFor="expireHours-mobile"
                        >
                          <Clock className="mr-1 h-3 w-3 text-gray-500" />
                          Attendance Expires In (hours)
                        </label>
                        <select
                          id="expireHours-mobile"
                          className="shadow-sm border border-gray-300 rounded-lg w-full py-2 px-3 text-sm text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                          value={expireHours}
                          onChange={(e) => setExpireHours(e.target.value)}
                          required
                        >
                          <option value="1">1 hour</option>
                          <option value="2">2 hours</option>
                          <option value="3">3 hours</option>
                          <option value="4">4 hours</option>
                          <option value="24">24 hours</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Desktop Layout */}
              <div className="hidden sm:grid sm:grid-cols-2 sm:gap-6">
                {/* Teacher Information */}
                <div className="col-span-2">
                  <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <User className="mr-2 h-5 w-5 text-primary" />
                    Teacher Information
                  </h2>
                  <div className="h-0.5 bg-gray-100 mb-4"></div>
                </div>

                <div className="mb-4">
                  <label
                    className="text-gray-700 text-sm font-bold mb-2 flex items-center"
                    htmlFor="teacherName"
                  >
                    <User className="mr-2 h-4 w-4 text-gray-500" />
                    Teacher Name
                  </label>
                  <input
                    type="text"
                    id="teacherName"
                    className="shadow-sm border border-gray-300 rounded-lg w-full py-2.5 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    disabled={currentUserData?.name}
                    required
                  />
                </div>

                <div className="mb-4">
                  <label
                    className="text-gray-700 text-sm font-bold mb-2 flex items-center"
                    htmlFor="teacherEmail"
                  >
                    <Mail className="mr-2 h-4 w-4 text-gray-500" />
                    Email
                  </label>
                  <input
                    type="email"
                    id="teacherEmail"
                    className="shadow-sm border border-gray-300 rounded-lg w-full py-2.5 px-4 text-gray-700 leading-tight bg-gray-50 cursor-not-allowed"
                    value={currentUser?.email || ""}
                    disabled
                  />
                </div>

                <div className="mb-4">
                  <label
                    className="text-gray-700 text-sm font-bold mb-2 flex items-center"
                    htmlFor="department"
                  >
                    <Building className="mr-2 h-4 w-4 text-gray-500" />
                    Department
                  </label>
                  <input
                    type="text"
                    id="department"
                    className="shadow-sm border border-gray-300 rounded-lg w-full py-2.5 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Computer Science"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label
                    className="text-gray-700 text-sm font-bold mb-2 flex items-center"
                    htmlFor="date"
                  >
                    <Calendar className="mr-2 h-4 w-4 text-gray-500" />
                    Date Created
                  </label>
                  <input
                    type="text"
                    id="date"
                    className="shadow-sm border border-gray-300 rounded-lg w-full py-2.5 px-4 text-gray-700 leading-tight bg-gray-50 cursor-not-allowed"
                    value={new Date().toLocaleDateString()}
                    disabled
                  />
                </div>

                {/* Attendance Information */}
                <div className="col-span-2 mt-6">
                  <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <BookOpen className="mr-2 h-5 w-5 text-primary" />
                    Attendance Information
                  </h2>
                  <div className="h-0.5 bg-gray-100 mb-4"></div>
                </div>

                <div className="mb-4">
                  <label
                    className="text-gray-700 text-sm font-bold mb-2 flex items-center"
                    htmlFor="section"
                  >
                    <Users className="mr-2 h-4 w-4 text-gray-500" />
                    Section/Class Code
                  </label>
                  <input
                    type="text"
                    id="section"
                    className="shadow-sm border border-gray-300 rounded-lg w-full py-2.5 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    placeholder="LFAU333A004"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label
                    className="text-gray-700 text-sm font-bold mb-2 flex items-center"
                    htmlFor="course"
                  >
                    <BookOpen className="mr-2 h-4 w-4 text-gray-500" />
                    Course
                  </label>
                  <input
                    type="text"
                    id="course"
                    className="shadow-sm border border-gray-300 rounded-lg w-full py-2.5 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    placeholder="Introduction to Computer Science"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label
                    className="text-gray-700 text-sm font-bold mb-2 flex items-center"
                    htmlFor="room"
                  >
                    <MapPin className="mr-2 h-4 w-4 text-gray-500" />
                    Room
                  </label>
                  <input
                    type="text"
                    id="room"
                    className="shadow-sm border border-gray-300 rounded-lg w-full py-2.5 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    placeholder="B-301"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label
                    className="text-gray-700 text-sm font-bold mb-2 flex items-center"
                    htmlFor="expireHours"
                  >
                    <Clock className="mr-2 h-4 w-4 text-gray-500" />
                    Attendance Expires In (hours)
                  </label>
                  <select
                    id="expireHours"
                    className="shadow-sm border border-gray-300 rounded-lg w-full py-2.5 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                    value={expireHours}
                    onChange={(e) => setExpireHours(e.target.value)}
                    required
                  >
                    <option value="1">1 hour</option>
                    <option value="2">2 hours</option>
                    <option value="3">3 hours</option>
                    <option value="4">4 hours</option>
                    <option value="24">24 hours</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 sm:mt-6">
                {loading && (
                  <div className="flex items-center justify-center mb-4">
                    <LoadingAnimation
                      type="spinner"
                      size="md"
                      variant="info"
                      text="Creating attendance, please wait..."
                    />
                  </div>
                )}
                <button
                  type="submit"
                  className="btn-primary text-white font-bold py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors w-full flex items-center justify-center"
                  disabled={loading}
                >
                  <Plus className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  Create Attendance
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="background-primary px-4 sm:px-6 py-3 sm:py-4">
            <h2 className="text-primary text-base sm:text-lg font-semibold flex items-center">
              <CheckCircle className="mr-2 h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Attendance Created Successfully!
            </h2>
            <p className="text-primary-secondary text-xs sm:text-sm">
              Students can use the QR code below or connect to hardware for registration
            </p>
            {emailStatus && (
              <p className="text-primary-secondary text-xs sm:text-sm mt-1">
                {emailStatus}
              </p>
            )}
          </div>

          <div className="p-4 sm:p-6">
            <div className="flex flex-col items-center">
              {/* Student QR Code Section */}
              <div className="w-full max-w-md mb-6 sm:mb-8">
                <div className="flex flex-col items-center bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm">
                  <div className="flex items-center mb-3 sm:mb-4 text-primary">
                    <QrCode className="h-4 w-4 sm:h-6 sm:w-6 mr-1.5 sm:mr-2" />
                    <h3 className="font-semibold text-primary text-sm sm:text-lg">
                      Student QR Code
                    </h3>
                  </div>
                  <div className="p-2 sm:p-4 bg-white border border-gray-200 rounded-lg mb-3 sm:mb-4 flex items-center justify-center">
                    {qrCodeValue && (
                      <QRCode
                        value={qrCodeValue}
                        size={200}
                        level="L"
                        className="max-w-full h-auto"
                        style={{
                          width: "100%",
                          maxWidth: "200px",
                          height: "auto",
                        }}
                      />
                    )}
                  </div>
                  {/* <p className="text-xs sm:text-sm text-gray-600 text-center">
                    Students can scan this QR code to mark their attendance
                  </p>
                  <div className="mt-3 sm:mt-4 w-full">
                    <a
                      href={qrCodeValue}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center px-3 py-2 border border-transparent text-xs sm:text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
                    >
                      <ExternalLink className="mr-1.5 h-3 w-3 sm:h-4 sm:w-4" />
                      Open Attendance Link
                    </a>
                  </div> */}
                </div>
              </div>

              {/* Hardware Connection Section */}
              <div className="w-full max-w-md mb-6 sm:mb-8">
                <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm">
                  <div className="flex items-center mb-3 sm:mb-4 text-primary">
                    <Microchip className="h-4 w-4 sm:h-6 sm:w-6 mr-1.5 sm:mr-2" />
                    <h3 className="font-semibold text-primary text-sm sm:text-lg">
                      Hardware Connection (RECOMMENDED)
                    </h3>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 text-center mb-4">
                    Connect attendance hardware for automated student registration
                  </p>

                  <div className="space-y-3">
                    {/* <button
                      onClick={handleUSBConnection}
                      className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-gray-300 text-xs sm:text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
                    >
                      <Usb className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                      Connect USB Hardware
                    </button> */}

                    <button
                      onClick={handleWirelessConnection}
                      className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-gray-300 text-xs sm:text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
                    >
                      <Wifi className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                      Connect Wireless Hardware
                    </button>
                  </div>
                </div>
              </div>

              <div>
                {showHardwareWifi && attendanceId && (
                  <HardwareWiFi
                    eventId={attendanceId}
                    onClose={() => setShowHardwareWifi(false)}
                    onSuccess={handleHardwareSuccess}
                  />
                )}
              </div>

              {/* Attendance Details Summary */}
              <div className="w-full max-w-2xl">
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-6">
                  <h3 className="font-semibold text-gray-800 text-sm sm:text-lg mb-4 flex items-center">
                    <BookOpen className="mr-2 h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    Attendance Session Details
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                    <div className="flex items-center">
                      <Users className="mr-2 h-3 w-3 sm:h-4 sm:w-4 text-gray-500" />
                      <span className="text-gray-600">Section:</span>
                      <span className="ml-2 font-medium text-gray-800">{attendanceData?.section}</span>
                    </div>

                    <div className="flex items-center">
                      <BookOpen className="mr-2 h-3 w-3 sm:h-4 sm:w-4 text-gray-500" />
                      <span className="text-gray-600">Course:</span>
                      <span className="ml-2 font-medium text-gray-800">{attendanceData?.course}</span>
                    </div>

                    <div className="flex items-center">
                      <MapPin className="mr-2 h-3 w-3 sm:h-4 sm:w-4 text-gray-500" />
                      <span className="text-gray-600">Room:</span>
                      <span className="ml-2 font-medium text-gray-800">{attendanceData?.room}</span>
                    </div>

                    <div className="flex items-center">
                      <User className="mr-2 h-3 w-3 sm:h-4 sm:w-4 text-gray-500" />
                      <span className="text-gray-600">Teacher:</span>
                      <span className="ml-2 font-medium text-gray-800">{attendanceData?.teacherName}</span>
                    </div>

                    <div className="flex items-center">
                      <Calendar className="mr-2 h-3 w-3 sm:h-4 sm:w-4 text-gray-500" />
                      <span className="text-gray-600">Date:</span>
                      <span className="ml-2 font-medium text-gray-800">{attendanceData?.date}</span>
                    </div>

                    <div className="flex items-center">
                      <Clock className="mr-2 h-3 w-3 sm:h-4 sm:w-4 text-gray-500" />
                      <span className="text-gray-600">Expires:</span>
                      <span className="ml-2 font-medium text-gray-800">
                        {attendanceData?.expiresAt && new Date(attendanceData.expiresAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-gray-600">Attendance Code:</span>
                      <span className="font-mono font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded">
                        {attendanceData?.attendanceCode}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="w-full max-w-md mt-6 sm:mt-8 space-y-3">
                <button
                  onClick={() => {
                    setAttendanceCreated(false);
                    setSection("");
                    setCourse("");
                    setRoom("");
                    setExpireHours(1);
                    setAttendanceData(null);
                    setQrCodeValue("");
                    setEmailStatus("");
                  }}
                  className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Another Session
                </button>

                <button
                  onClick={() => window.location.href = '/teacher/manage-attendance'}
                  className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
                >
                  <Users className="mr-2 h-4 w-4" />
                  Manage Attendance
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}