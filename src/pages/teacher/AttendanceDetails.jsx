/**
 * Component for displaying and managing attendance details for a specific session.
 * @returns JSX element containing the attendance details page.
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot, updateDoc, arrayRemove } from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "react-toastify";
import { ArrowLeft, Clock, User, Building, Calendar, Users, CheckCircle, XCircle, Download, UserX, ClipboardList, Search, RefreshCw, QrCode, Wifi } from 'lucide-react';
import { LoadingAnimation } from "../../components/LoadingAnimation";
import QRCode from "react-qr-code";
import HardwareWiFi from "../../components/RegisterEvent/HardwareWifi";

export default function AttendanceDetailsPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { currentUser, currentUserData } = useAuth();

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [removeStudentId, setRemoveStudentId] = useState(null);
  const [removeStudentName, setRemoveStudentName] = useState("");
  const [showHardwareWifi, setShowHardwareWifi] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    totalStudents: 0,
    onTimeStudents: 0,
    lateStudents: 0,
    averageCheckInTime: null,
  });

  // Fetch attendance session data
  // First, modify the fetchSessionData function to handle the student timestamp correctly
  const fetchSessionData = () => {
    try {
      setLoading(true);
  
      // Check if sessionId exists
      if (!sessionId) {
        toast.error("Invalid session ID");
        navigate(`/${currentUserData?.role || "teacher"}/manage-attendance`);
        setLoading(false);
        return;
      }
  
      const sessionRef = doc(db, "attendance-sessions", sessionId);
  
      // Listen for real-time updates
      const unsubscribe = onSnapshot(sessionRef, (sessionDoc) => {
        if (!sessionDoc.exists()) {
          toast.error("Attendance session not found");
          navigate(`/${currentUserData?.role || "teacher"}/manage-attendance`);
          setLoading(false);
          return;
        }
  
        const sessionData = {
          id: sessionDoc.id,
          ...sessionDoc.data(),
        };
  
        // Handle timestamp conversion safely
        if (
          sessionDoc.data().createdAt &&
          typeof sessionDoc.data().createdAt.toDate === "function"
        ) {
          sessionData.createdAt = sessionDoc.data().createdAt.toDate();
        } else if (sessionDoc.data().createdAt) {
          sessionData.createdAt = new Date(sessionDoc.data().createdAt);
        } else {
          sessionData.createdAt = new Date();
        }
  
        // Handle expiresAt as string
        if (sessionDoc.data().expiresAt) {
          if (typeof sessionDoc.data().expiresAt.toDate === "function") {
            sessionData.expiresAt = sessionDoc.data().expiresAt.toDate();
          } else {
            sessionData.expiresAt = new Date(sessionDoc.data().expiresAt);
          }
        } else {
          sessionData.expiresAt = new Date();
        }
  
        // Check if current user is the teacher who created the session
        if (currentUser && sessionData.teacherUID !== currentUser.uid) {
          toast.error(
            "You do not have permission to view this attendance session"
          );
          navigate(`/${currentUserData?.role || "teacher"}/manage-attendance`);
          setLoading(false);
          return;
        }
  
        // Ensure students array exists and map timestamp to checkInTime
        if (!sessionData.students) {
          sessionData.students = [];
        } else {
          sessionData.students = sessionData.students.map((student) => ({
            ...student,
            checkInTime: student.timestamp || student.checkInTime,
          }));
        }
  
        setSession(sessionData);
        setFilteredStudents(sessionData.students);
  
        // Calculate session statistics
        if (sessionData.students && sessionData.students.length > 0) {
          calculateStats(sessionData);
        } else {
          resetStats();
        }
  
        setLoading(false);
      });
  
      return unsubscribe; // This lets you stop listening when needed
    } catch (error) {
      console.error("Error fetching session data:", error);
      toast.error("Failed to fetch attendance session data");
      setLoading(false);
    }
  };
  

  // Calculate statistics from session data
  const calculateStats = (sessionData) => {
    const totalStudents = sessionData.students.length;
    const sessionStartTime = sessionData.createdAt;
    const graceEndTime = new Date(sessionStartTime.getTime() + 15 * 60000);

    // Make sure to convert all check-in times to Date objects
    const onTimeStudents = sessionData.students.filter(
      (student) => new Date(student.checkInTime) <= graceEndTime
    ).length;

    const lateStudents = totalStudents - onTimeStudents;

    const totalMinutesAfterStart = sessionData.students.reduce(
      (total, student) => {
        const checkInTime = new Date(student.checkInTime);
        const minutesAfterStart =
          (checkInTime.getTime() - sessionStartTime.getTime()) / 60000;
        return total + minutesAfterStart;
      },
      0
    );

    const averageCheckInTime =
      totalStudents > 0
        ? Math.round(totalMinutesAfterStart / totalStudents)
        : null;

    setStats({
      totalStudents,
      onTimeStudents,
      lateStudents,
      averageCheckInTime,
    });
  };

  // Reset stats to default values
  const resetStats = () => {
    setStats({
      totalStudents: 0,
      onTimeStudents: 0,
      lateStudents: 0,
      averageCheckInTime: null,
    });
  };

  // Initial fetch on component mount
  useEffect(() => {
    if (sessionId && currentUser) {
      fetchSessionData();
    } else {
      setLoading(false);
    }
  }, [sessionId, currentUser]);

  // Filter students when search term changes
  useEffect(() => {
    if (session?.students) {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const filtered = session.students.filter(
          (student) =>
            (student.name && student.name.toLowerCase().includes(term)) ||
            (student.email && student.email.toLowerCase().includes(term)) ||
            (student.studentId &&
              student.studentId.toLowerCase().includes(term))
        );
        setFilteredStudents(filtered);
      } else {
        setFilteredStudents(session.students);
      }
    }
  }, [searchTerm, session]);

  // Format date for display
  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Is session active
  const isSessionActive = (session) => {
    if (!session) return false;
    const now = new Date();
    const expiresAt =
      session.expiresAt instanceof Date
        ? session.expiresAt
        : new Date(session.expiresAt);
    return session.active && expiresAt > now;
  };

  // Open remove student modal
  const handleOpenRemoveModal = (studentId, studentName) => {
    setRemoveStudentId(studentId);
    setRemoveStudentName(studentName);
    setShowRemoveModal(true);
  };

  // Remove student from attendance
  const handleRemoveStudent = async () => {
    try {
      if (!session || !session.students) {
        toast.error("Session data not available");
        setShowRemoveModal(false);
        return;
      }

      const studentToRemove = session.students.find(
        (s) => s.studentId === removeStudentId
      );

      if (!studentToRemove) {
        toast.error("Student not found");
        setShowRemoveModal(false);
        return;
      }

      const sessionRef = doc(db, "attendance-sessions", sessionId);

      // The issue is here - we need to make sure all properties match exactly
      // including the timestamp field as it appears in Firestore
      // First ensure the student object has the exact same structure as in Firestore
      const studentForRemoval = {
        ...studentToRemove,
        // Make sure we're using the original timestamp field from Firestore
        timestamp: studentToRemove.timestamp || studentToRemove.checkInTime,
        // Remove checkInTime property if it was added by our code but not in Firestore
        ...(studentToRemove.checkInTime && !studentToRemove.timestamp
          ? {}
          : { checkInTime: undefined }),
      };

      // Remove undefined properties to match the exact structure in Firestore
      Object.keys(studentForRemoval).forEach((key) =>
        studentForRemoval[key] === undefined
          ? delete studentForRemoval[key]
          : {}
      );

      await updateDoc(sessionRef, {
        students: arrayRemove(studentForRemoval),
      });

      // Update local state
      const updatedStudents = session.students.filter(
        (s) => s.studentId !== removeStudentId
      );

      const updatedSession = {
        ...session,
        students: updatedStudents,
      };

      setSession(updatedSession);
      setFilteredStudents(updatedStudents);

      toast.success("Student removed from attendance successfully!");
      setShowRemoveModal(false);

      // Update stats with updated student list
      if (updatedStudents.length > 0) {
        calculateStats(updatedSession);
      } else {
        resetStats();
      }
    } catch (error) {
      console.error("Error removing student:", error);
      toast.error("Failed to remove student");
    }
  };

  const handleWirelessConnection = () => {
    if (!isSessionActive(session)) {
      toast.error("Cannot use hardware for expired attendance sessions");
      return;
    }
    setShowHardwareWifi(true);
    toast.info("Connecting to wireless hardware...");
  };

  const handleHardwareSuccess = (userData) => {
    toast.success(`${userData.name || userData.email} registered successfully!`);
    // Refresh the session data to show new registrations
    fetchSessionData();
  };

  // Export attendance data as CSV
  const exportAttendanceCSV = () => {
    if (!session || !session.students || session.students.length === 0) {
      toast.error("No attendance data to export");
      return;
    }

    // Create CSV header
    let csvContent = "Student ID,Name,Email,Check-in Time,Status\n";

    // Add each student row
    session.students.forEach((student) => {
      const checkInTime = new Date(student.checkInTime);
      const sessionStartTime = session.createdAt;
      const graceEndTime = new Date(sessionStartTime.getTime() + 15 * 60000);
      const status = checkInTime <= graceEndTime ? "On time" : "Late";

      // Format CSV row and escape any commas in fields
      const row = [
        `"${student.studentId || ""}"`,
        `"${student.name || ""}"`,
        `"${student.email || ""}"`,
        `"${formatDate(student.checkInTime)}"`,
        `"${status}"`,
      ];

      csvContent += row.join(",") + "\n";
    });

    // Create downloadable link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `attendance_${session.course}_${session.date}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate check-in status for a student
  const getCheckInStatus = (checkInTime) => {
    if (!session || !checkInTime) return "Unknown";

    const sessionStartTime = session.createdAt;
    const graceEndTime = new Date(sessionStartTime.getTime() + 15 * 60000);
    const studentCheckIn = new Date(checkInTime);

    if (studentCheckIn <= graceEndTime) {
      return "On time";
    } else {
      return "Late";
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
      {/* Back Button */}
      <button
        onClick={() =>
          navigate(`/${currentUserData?.role || "teacher"}/manage-attendance`)
        }
        className="inline-flex items-center text-primary-button mb-6 transition-colors"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        <span>Back to All Sessions</span>
      </button>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="flex items-center justify-center mb-4">
            <LoadingAnimation
              type="spinner"
              size="md"
              variant="info"
              text="Loading Selected Attendance, please wait..."
            />
          </div>
        </div>
      ) : session ? (
        <>
          {/* Session Header */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
            <div className="background-primary px-4 sm:px-6 py-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <div>
                  <h1 className="text-primary text-xl sm:text-2xl font-bold">
                    {session.course || "Unnamed Course"}
                  </h1>
                  <p className="text-primary-secondary">
                    Section: {session.section || "N/A"}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  {isSessionActive(session) ? (
                    <span className="px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      Active
                    </span>
                  ) : (
                    <span className="px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                      Expired
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="px-4 sm:px-6 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 text-primary mr-2 flex-shrink-0" />
                  <div>
                    <div className="text-sm text-gray-500">Date</div>
                    <div className="text-gray-900 truncate">
                      {session.date || "N/A"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center">
                  <Building className="h-5 w-5 text-primary mr-2 flex-shrink-0" />
                  <div>
                    <div className="text-sm text-gray-500">Room</div>
                    <div className="text-gray-900 truncate">
                      {session.room || "N/A"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center">
                  <Clock className="h-5 w-5 text-primary mr-2 flex-shrink-0" />
                  <div>
                    <div className="text-sm text-gray-500">Created At</div>
                    <div className="text-gray-900 truncate">
                      {formatDate(session.createdAt)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center border border-yellow-200 bg-yellow-50 px-4 py-3 rounded-lg">
                <div className="flex items-center bg-yellow-100 rounded-full p-2 mr-3 mb-2 sm:mb-0">
                  <ClipboardList className="h-5 w-5 text-yellow-700" />
                </div>
                <div>
                  <div className="text-sm font-medium text-yellow-800">
                    Attendance Code
                  </div>
                  <div className="text-lg font-mono font-semibold text-yellow-900">
                    {session.attendanceCode || "N/A"}
                  </div>
                </div>
              </div>

              {/* QR Code Section */}
              <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center border border-blue-200 bg-blue-50 px-4 py-3 rounded-lg">
                <div className="flex items-center bg-blue-100 rounded-full p-2 mr-3 mb-2 sm:mb-0">
                  <QrCode className="h-5 w-5 text-blue-700" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-blue-800">
                    Student QR Code
                  </div>
                  <div className="text-sm text-blue-700 mb-2">
                    Students can scan this code to check in
                  </div>
                  <div className="bg-white p-2 rounded-lg inline-block">
                    <QRCode
                      value={`${window.location.origin}/student-attendance?code=${session.attendanceCode}`}
                      size={120}
                      level="L"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-md p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-blue-100 rounded-full p-3">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <div className="text-sm text-gray-500">Total Students</div>
                  <div className="text-2xl font-semibold text-gray-900">
                    {stats.totalStudents}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-green-100 rounded-full p-3">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <div className="text-sm text-gray-500">On Time</div>
                  <div className="text-2xl font-semibold text-gray-900">
                    {stats.onTimeStudents}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-red-100 rounded-full p-3">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-4">
                  <div className="text-sm text-gray-500">Late</div>
                  <div className="text-2xl font-semibold text-gray-900">
                    {stats.lateStudents}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-purple-100 rounded-full p-3">
                  <Clock className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <div className="text-sm text-gray-500">
                    Avg. Check-in Time
                  </div>
                  <div className="text-2xl font-semibold text-gray-900">
                    {stats.averageCheckInTime !== null
                      ? `+${stats.averageCheckInTime} min`
                      : "N/A"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Attendance List */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="background-primary px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-primary text-lg font-semibold">
                  Student Attendance
                </h2>
                <p className="text-primary-secondary text-sm">
                  {filteredStudents.length}{" "}
                  {filteredStudents.length === 1 ? "student" : "students"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={exportAttendanceCSV}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white background-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
                >
                  <Download className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Export CSV</span>
                  <span className="sm:hidden">Export</span>
                </button>
                <button
                  onClick={fetchSessionData}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white background-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Refresh</span>
                  <span className="sm:hidden">Refresh</span>
                </button>
                {isSessionActive(session) && (
                  <button
                    onClick={handleWirelessConnection}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white background-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
                  >
                    <Wifi className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Hardware WiFi</span>
                    <span className="sm:hidden">WiFi</span>
                  </button>
                )}
              </div>
            </div>

            {/* Search Bar */}
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Search by name, email, or student ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              {filteredStudents.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <Users className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">
                    No students found
                  </h3>
                  <p className="text-gray-500 mb-6">
                    {searchTerm
                      ? "Try adjusting your search term"
                      : "No students have checked in to this session yet"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Student
                        </th>
                        <th
                          scope="col"
                          className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell"
                        >
                          Check-in Time
                        </th>
                        <th
                          scope="col"
                          className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Status
                        </th>
                        <th
                          scope="col"
                          className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredStudents.map((student, index) => (
                        <tr
                          key={student.studentId || index}
                          className="hover:bg-gray-50"
                        >
                          {/* Within the table where students are rendered - find and replace this section */}
                          <td className="px-4 sm:px-6 py-4">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                                {student.profileImageUrl ? (
                                  <img
                                    src={student.profileImageUrl || "/placeholder.svg"}
                                    alt={`${
                                      student.name || "Student"
                                    }'s profile`}
                                    className="h-full w-full object-cover"
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.src = ""; // Clear the src
                                      e.target.parentNode.innerHTML =
                                        '<User className="h-5 w-5 text-gray-500" />';
                                    }}
                                  />
                                ) : (
                                  <User className="h-5 w-5 text-gray-500" />
                                )}
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {student.name || "N/A"}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {student.email || "No email"}
                                </div>
                                <div className="text-xs text-gray-500">
                                  ID: {student.studentId || "N/A"}
                                </div>
                                {/* Mobile-only check-in time */}
                                <div className="text-xs text-gray-500 sm:hidden mt-1">
                                  {formatDate(student.checkInTime)}
                                  <div>
                                    {student.checkInTime &&
                                      session.createdAt &&
                                      `${Math.round(
                                        (new Date(
                                          student.checkInTime
                                        ).getTime() -
                                          session.createdAt.getTime()) /
                                          60000
                                      )} minutes after start`}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-4 hidden sm:table-cell">
                            <div className="text-sm text-gray-900">
                              {formatDate(student.checkInTime)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {student.checkInTime &&
                                session.createdAt &&
                                `${Math.round(
                                  (new Date(student.checkInTime).getTime() -
                                    session.createdAt.getTime()) /
                                    60000
                                )} minutes after start`}
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-4">
                            {getCheckInStatus(student.checkInTime) ===
                            "On time" ? (
                              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                On time
                              </span>
                            ) : (
                              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                Late
                              </span>
                            )}
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-right text-sm font-medium">
                            <button
                              onClick={() =>
                                handleOpenRemoveModal(
                                  student.studentId,
                                  student.name
                                )
                              }
                              className="text-red-600 hover:text-red-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 rounded-lg px-2 py-1 transition-colors"
                              aria-label="Remove student"
                              title="Remove student"
                            >
                              <UserX className="h-5 w-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <XCircle className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Attendance Session Not Found
          </h3>
          <p className="text-gray-500 mb-6">
            The attendance session you are looking for does not exist or you do
            not have permission to view it.
          </p>
          <button
            onClick={() =>
              navigate(
                `/${currentUserData?.role || "teacher"}/manage-attendance`
              )
            }
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
          >
            <span>Return to Attendance Management</span>
          </button>
        </div>
      )}

      {/* Hardware WiFi Modal */}
      {showHardwareWifi && (
        <HardwareWiFi
          eventId={sessionId}
          onSuccess={handleHardwareSuccess}
          onClose={() => setShowHardwareWifi(false)}
        />
      )}

      {/* Remove Student Confirmation Modal */}
      {showRemoveModal && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity"
              aria-hidden="true"
            >
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <span
              className="hidden sm:inline-block sm:align-middle sm:h-screen"
              aria-hidden="true"
            >
              &#8203;
            </span>

            <div className="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full w-full mx-4">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <UserX className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Remove Student
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to remove{" "}
                        <span className="font-semibold">
                          {removeStudentName || "this student"}
                        </span>{" "}
                        from this attendance session? This action cannot be
                        undone.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                  onClick={handleRemoveStudent}
                >
                  <span>Remove</span>
                </button>
                <button
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors"
                  onClick={() => setShowRemoveModal(false)}
                >
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}