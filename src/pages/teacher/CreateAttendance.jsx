"use client";

/**
 * Component for creating an attendance session by a teacher.
 * This component allows the teacher to input details such as section, course, room, and expiration time for the attendance session.
 * Upon submission, the attendance session is created and stored in the Firestore database.
 * @returns JSX element containing the form for creating an attendance session.
 */
import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
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
  Smartphone,
  Plus,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { LoadingAnimation } from "../../components/LoadingAnimation";
import { sendEmail, EmailTemplates } from "../../sendEmail";
import useFirestoreChecker from "../../components/reuseChecker/FirestoreCheckerHook";

export default function TeacherCreateAttendance() {
  const { currentUser, currentUserData } = useAuth();
  const { loading: checkingFirestore, getStudentsBySection } = useFirestoreChecker();
  const [loading, setLoading] = useState(false);
  const [attendanceCreated, setAttendanceCreated] = useState(false);
  const [attendanceId, setAttendanceId] = useState("");
  const [attendanceData, setAttendanceData] = useState(null); // State to store the attendance session data
  const [expandedSection, setExpandedSection] = useState("teacher"); // For mobile accordion
  const [emailStatus, setEmailStatus] = useState("");

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

      // Save the attendance session to state
      setAttendanceData(attendanceSession);

      // Save to Firestore
      const docRef = await addDoc(
        collection(db, "attendance-sessions"),
        attendanceSession
      );

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
      setError(`Failed to create attendance session: ${error.message}`);
      toast.error("Failed to create attendance session");
    } finally {
      setLoading(false);
    }
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
                    className={`h-4 w-4 text-gray-500 transition-transform ${
                      expandedSection === "teacher"
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
                    className={`h-4 w-4 text-gray-500 transition-transform ${
                      expandedSection === "attendance"
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
              Students can use the QR code below or their NFC card to register
              attendance
            </p>
          </div>

          <div className="p-4 sm:p-6">
            <div className="flex flex-col items-center">
              {/* QR Codes Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8 w-full max-w-4xl mb-6 sm:mb-8">
                {/* Student QR Code */}
                <div className="flex flex-col items-center bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm">
                  <div className="flex items-center mb-3 sm:mb-4 text-primary">
                    <QrCode className="h-4 w-4 sm:h-6 sm:w-6 mr-1.5 sm:mr-2" />
                    <h3 className="font-semibold text-primary text-sm sm:text-lg">
                      Student QR Code
                    </h3>
                  </div>
                  <div className="p-2 sm:p-4 bg-white border border-gray-200 rounded-lg mb-3 sm:mb-4 flex items-center justify-center">
                    {attendanceData && (
                      <QRCode
                        value={`${window.location.origin}/student-attendance?code=${attendanceData.attendanceCode}`}
                        size={150}
                        level="L"
                        className="max-w-full h-auto"
                        style={{
                          width: "100%",
                          maxWidth: "150px",
                          height: "auto",
                        }}
                      />
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 text-center">
                    Students can scan this QR code to mark their attendance
                  </p>
                </div>

                {/* NFC Scanner QR Code */}
                <div className="flex flex-col items-center bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-sm">
                  <div className="flex items-center mb-3 sm:mb-4 text-primary">
                    <Smartphone className="h-4 w-4 sm:h-6 sm:w-6 mr-1.5 sm:mr-2" />
                    <h3 className="font-semibold text-sm sm:text-lg text-primary">
                      NFC Scanner QR Code
                    </h3>
                  </div>
                  <div className="p-2 sm:p-4 bg-white border border-gray-200 rounded-lg mb-3 sm:mb-4 flex items-center justify-center">
                    {attendanceData && (
                      <QRCode
                        value={`${window.location.origin}/scan-attendance?code=${attendanceData.attendanceCode}`}
                        size={150}
                        level="L"
                        className="max-w-full h-auto"
                        style={{
                          width: "100%",
                          maxWidth: "150px",
                          height: "auto",
                        }}
                      />
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 text-center">
                    Scan this QR code with your smartphone to open the NFC
                    scanner
                  </p>
                </div>
              </div>

              {/* Attendance Details */}
              <div className="w-full max-w-4xl mb-6 sm:mb-8">
                <div className="bg-gray-50 rounded-xl p-4 sm:p-6 border border-gray-200">
                  <h3 className="font-semibold text-base sm:text-lg text-gray-800 mb-3 sm:mb-4 flex items-center">
                    <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2 text-primary" />
                    Attendance Details
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="flex items-start">
                      <Users className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-xs sm:text-sm text-gray-500">
                          Section
                        </p>
                        <p className="text-sm sm:text-base font-medium">
                          {section}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-xs sm:text-sm text-gray-500">
                          Course
                        </p>
                        <p className="text-sm sm:text-base font-medium">
                          {course}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <MapPin className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-xs sm:text-sm text-gray-500">Room</p>
                        <p className="text-sm sm:text-base font-medium">
                          {room}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <Clock className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2 text-gray-500 mt-0.5" />
                      <div>
                        <p className="text-xs sm:text-sm text-gray-500">
                          Expires
                        </p>
                        <p className="text-sm sm:text-base font-medium">
                          {new Date(
                            new Date().getTime() + expireHours * 60 * 60 * 1000
                          ).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200">
                    <div className="flex items-center">
                      <div className="bg-purple-100 text-primary text-xs sm:text-sm font-medium px-2 sm:px-3 py-0.5 sm:py-1 rounded-full flex items-center">
                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full mr-1.5 sm:mr-2"></span>
                        Active
                      </div>
                      <div className="ml-3 sm:ml-4 text-xs sm:text-sm text-gray-500">
                        Attendance Code:{" "}
                        <span className="font-mono font-medium">
                          {attendanceData?.attendanceCode}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center w-full max-w-4xl">
                <button
                  className="btn-primary text-white font-bold py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors flex-1 flex items-center justify-center text-sm"
                  onClick={() => setAttendanceCreated(false)}
                >
                  <Plus className="mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  Create Another Attendance
                </button>

                <a
                  href={
                    attendanceData
                      ? `/scan-attendance?code=${attendanceData.attendanceCode}`
                      : "#"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary text-white font-bold py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors flex-1 flex items-center justify-center text-sm"
                >
                  <Smartphone className="mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  Open NFC Scanner
                  <ExternalLink className="ml-1.5 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
