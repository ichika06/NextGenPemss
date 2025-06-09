import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import {
  saveAttendanceRecords,
  checkSavedAttendanceRecords,
  fetchSavedAttendanceSessions,
} from "../../components/reuseChecker/checkSavedAttendanceRecords";
import { LoadingAnimation } from "../../components/LoadingAnimation";
import {
  CalendarDays,
  Clock,
  BookOpen,
  User,
  ChevronRight,
  Loader2,
  MapPin,
  UserCheck,
  History,
  Calendar,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  ClipboardCheck,
} from "lucide-react";
import AttendanceDetailModal from "./UpcomingAttendanceModal";

export default function StudentAttendanceDisplay() {
  const { currentUserData } = useAuth();
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [pastAttendanceRecords, setPastAttendanceRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPastLoading, setIsPastLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pastError, setPastError] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("present");
  let previousAttendanceIds = new Set();

  // Search and filter for past records
  const [searchTerm, setSearchTerm] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [availableSections, setAvailableSections] = useState([]);
  const [filteredPastRecords, setFilteredPastRecords] = useState([]);

  useEffect(() => {
    // Only fetch current section records when viewing present tab
    if (activeTab === "present") {
      fetchCurrentAttendanceRecords();
    }
  }, [currentUserData, activeTab]);

  useEffect(() => {
    // Only fetch past records when viewing past tab
    if (activeTab === "past") {
      fetchPastAttendanceRecords();
    }
  }, [currentUserData?.uid, activeTab]);

  // Effect to filter past records when search term or section filter changes
  useEffect(() => {
    if (!pastAttendanceRecords.length) return;

    let filtered = [...pastAttendanceRecords];

    // First apply section filter if active
    if (sectionFilter) {
      filtered = filtered.filter((record) => record.section === sectionFilter);
    }

    // Then apply search term if provided
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter((record) => {
        const courseName = (record.course || "").toLowerCase();
        const sectionName = (record.section || "").toLowerCase();

        return courseName.includes(term) || sectionName.includes(term);
      });
    }

    setFilteredPastRecords(filtered);
  }, [searchTerm, pastAttendanceRecords, sectionFilter]);

  // Optional: Function to initialize previous attendance IDs on component mount
async function initializePreviousAttendanceIds() {
  if (currentUserData?.uid) {
    try {
      const savedSessions = await fetchSavedAttendanceSessions(currentUserData.uid);
      if (savedSessions.success && savedSessions.sessions) {
        previousAttendanceIds = new Set(savedSessions.sessions.map(session => session.id));
        console.log("Initialized previous attendance IDs:", Array.from(previousAttendanceIds));
      }
    } catch (error) {
      console.error("Error initializing previous attendance IDs:", error);
    }
  }
}

// Enhanced version with better error handling and user feedback
async function fetchCurrentAttendanceRecords() {
  if (!currentUserData || !currentUserData.section) {
    setError("No section information available");
    setIsLoading(false);
    return;
  }

  try {
    setIsLoading(true);

    // Initialize previous attendance IDs if not already done
    if (previousAttendanceIds.size === 0) {
      await initializePreviousAttendanceIds();
    }

    // Handle comma-separated sections
    const sections = currentUserData.section.includes(',') 
      ? currentUserData.section.split(',').map(section => section.trim())
      : [currentUserData.section];

    console.log('Fetching attendance for sections:', sections);

    const attendanceQuery = query(
      collection(db, "attendance-sessions"),
      where("section", "in", sections)
    );

    const unsubscribe = onSnapshot(attendanceQuery, async (querySnapshot) => {
      const records = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        let formattedDate = data.date;

        if (data.dateObject) {
          formattedDate = new Date(data.dateObject).toLocaleDateString();
        }

        const createdTimestamp =
          data.createdAt?.toDate?.() ||
          (data.createdAt ? new Date(data.createdAt) : null);

        const studentStatus = findStudentStatus(data.students || []);

        return {
          id: doc.id,
          ...data,
          formattedDate,
          createdTimestamp,
          studentStatus,
          dateObjectForSort:
            data.dateObject || data.date || new Date().toISOString(),
        };
      });

      records.sort((a, b) => {
        return new Date(b.dateObjectForSort) - new Date(a.dateObjectForSort);
      });

      const currentAttendanceIds = records.map(record => record.id);
      const currentAttendanceIdsSet = new Set(currentAttendanceIds);
      const newAttendanceIds = currentAttendanceIds.filter(id => !previousAttendanceIds.has(id));

      if (newAttendanceIds.length > 0 && currentUserData?.uid) {
        console.log(`Auto-saving ${newAttendanceIds.length} new attendance record(s)`);
        
        // Show loading state for auto-save
        // setAutoSaving?.(true);
        
        try {
          const saveResult = await saveAttendanceRecords(
            currentUserData.uid,
            newAttendanceIds,
            currentUserData.section
          );

          if (saveResult.success) {
            console.log("✅ Auto-saved new attendance records successfully");
          } else {
            console.error("❌ Auto-save failed:", saveResult.error);
            setError?.(`Auto-save failed: ${saveResult.error}`);
          }
        } catch (saveError) {
          console.error("❌ Auto-save error:", saveError);
          setError?.("Failed to automatically save new attendance records");
        } finally {
          // setAutoSaving?.(false);
        }
      }

      previousAttendanceIds = currentAttendanceIdsSet;
      setAttendanceRecords(records);
      setIsLoading(false);
    });

    return unsubscribe;
  } catch (error) {
    console.error("Error fetching attendance records:", error);
    setError("Failed to load attendance records");
    setIsLoading(false);
  }
}

  async function fetchPastAttendanceRecords() {
    if (!currentUserData?.uid) {
      setPastError("No user information available");
      setIsPastLoading(false);
      return;
    }

    try {
      setIsPastLoading(true);

      // Get saved attendance records from user-attendance-records collection
      const savedRecordsResult = await checkSavedAttendanceRecords(
        currentUserData.uid
      );

      if (!savedRecordsResult.success) {
        setPastError(
          savedRecordsResult.error || "Failed to retrieve saved records"
        );
        setIsPastLoading(false);
        return;
      }

      // If no saved records, show empty state
      if (savedRecordsResult.attendanceRecords.length === 0) {
        setPastAttendanceRecords([]);
        setFilteredPastRecords([]);
        setIsPastLoading(false);
        return;
      }

      // Fetch full session data for each saved record
      const sessionsResult = await fetchSavedAttendanceSessions(
        savedRecordsResult.attendanceRecords
      );

      if (!sessionsResult.success) {
        setPastError(sessionsResult.error || "Failed to fetch session details");
        setIsPastLoading(false);
        return;
      }

      // Process the sessions to add formatted dates
      const processedSessions = sessionsResult.sessions.map((session) => {
        // Format date if available
        let formattedDate = session.date;
        let formattedTime = "Time not available";

        if (session.dateObject) {
          try {
            const dateObj = new Date(session.dateObject);
            formattedDate = dateObj.toLocaleDateString();
            formattedTime = dateObj.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            });
          } catch (e) {
            // Keep original date if parsing fails
          }
        }

        // Find student status in the session
        const student = (session.students || []).find(
          (student) =>
            student.userUID === currentUserData.uid ||
            student.email === currentUserData.email
        );

        // Determine student attendance status
        const studentAttendanceStatus = student
          ? student.isPresent
            ? "present"
            : "absent"
          : "absent";

        return {
          ...session,
          formattedDate,
          formattedTime,
          studentAttendanceStatus,
          createdTimestamp:
            session.createdAt?.toDate?.() ||
            (session.createdAt ? new Date(session.createdAt) : null),
          // For sorting
          dateObjectForSort:
            session.dateObject || session.date || new Date().toISOString(),
          // Make sure we include section information
          section: session.section || session.savedInSection || "unknown",
        };
      });

      // Extract unique sections for filter dropdown
      const sections = [
        ...new Set(
          processedSessions
            .map((session) => session.section)
            .filter((section) => section && section !== "unknown")
        ),
      ];
      setAvailableSections(sections);

      // Sort by date (newest first)
      processedSessions.sort((a, b) => {
        return new Date(b.dateObjectForSort) - new Date(a.dateObjectForSort);
      });

      setPastAttendanceRecords(processedSessions);

      // Initialize filtered records - show all records by default
      setFilteredPastRecords(processedSessions);

      setIsPastLoading(false);
    } catch (error) {
      console.error("Error fetching past attendance records:", error);
      setPastError("Failed to load past attendance records");
      setIsPastLoading(false);
    }
  }

  // Find the student's attendance status in each record
  const findStudentStatus = (studentsArray) => {
    if (!currentUserData) return null;

    // Try to find the student by different identifiers
    const studentRecord = studentsArray.find(
      (student) =>
        student.studentId === currentUserData.id ||
        student.email === currentUserData.email ||
        student.userUID === currentUserData.uid
    );

    return studentRecord;
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString; // Return as is if not a valid date object
      }

      return date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (e) {
      return dateString; // Return original string if formatting fails
    }
  };

  // Format time from timestamp
  const formatTime = (timestamp) => {
    if (!timestamp) return "N/A";

    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch (e) {
      return "N/A";
    }
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";

    try {
      return new Date(timestamp).toLocaleString();
    } catch (e) {
      return "N/A";
    }
  };

  // Open the modal with selected record
  const handleOpenDetails = (record) => {
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  // Close the modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  // Search handler
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  // Section filter handler
  const handleSectionFilter = (e) => {
    setSectionFilter(e.target.value);
  };

  // Status icon renderer
  const renderStatusIcon = (status) => {
    switch (status) {
      case "present":
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
      case "absent":
        return <XCircle className="h-5 w-5 text-rose-500" />;
      default:
        return <XCircle className="h-5 w-5 text-rose-500" />;
    }
  };

  // Status color class getter
  const getStatusColorClass = (status) => {
    switch (status) {
      case "present":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "absent":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-rose-50 text-rose-700 border-rose-200";
    }
  };

  // Render tab navigation
  const renderTabNavigation = () => {
    return (
      <div className="mb-8">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab("present")}
              className={`py-4 px-6 font-medium text-sm mr-8 flex items-center ${
                activeTab === "present"
                  ? "border-b-2 border-primary text-primary"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <CalendarDays className="h-5 w-5 mr-2" />
              Current Attendance
            </button>
            <button
              onClick={() => setActiveTab("past")}
              className={`py-4 px-6 font-medium text-sm flex items-center ${
                activeTab === "past"
                  ? "border-b-2 border-primary text-primary"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <History className="h-5 w-5 mr-2" />
              Past Attendance History
            </button>
          </nav>
        </div>
      </div>
    );
  };

  // Render current attendance tab content
  const renderCurrentAttendanceContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="flex justify-center py-8">
            <LoadingAnimation
              type="spinner"
              size="md"
              variant="info"
              text="Loading current attendance..."
            />
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-xl flex items-start">
          <div className="flex-shrink-0 mr-3 mt-0.5">
            <svg
              className="h-5 w-5 text-red-500"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-medium text-red-800 mb-1">
              Error Loading Data
            </h3>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      );
    }

    if (attendanceRecords.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-xl border border-gray-200">
          <svg
            className="h-16 w-16 text-gray-300 mb-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p className="text-gray-600 font-medium mb-1">
            No attendance records found
          </p>
          <p className="text-primary text-sm">
            Section: {currentUserData?.section || "N/A"}
          </p>
        </div>
      );
    }

    return (
      <>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center mb-4 md:mb-0">
            <CalendarDays className="mr-2 h-6 w-6 text-primary" />
            Current Attendance
          </h1>

          <div className="flex items-center background-primary px-4 py-2 rounded-lg">
            <User className="h-4 w-4 mr-2 text-primary" />
            <span className="font-medium text-primary">Section:</span>
            <span className="ml-2 bg-white px-3 py-1 rounded-md text-primary font-semibold">
              {currentUserData?.section || "N/A"}
            </span>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Course
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Room
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Check-in Time
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attendanceRecords.map((record, index) => {
                  const studentStatus = record.studentStatus;

                  return (
                    <tr
                      key={record.id}
                      className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <CalendarDays className="h-4 w-4 text-gray-400 mr-2" />
                          <div className="text-sm font-medium text-gray-900">
                            {formatDate(record.formattedDate || record.date)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <BookOpen className="h-4 w-4 text-gray-400 mr-2" />
                          <div className="text-sm text-gray-900">
                            {record.course || "N/A"}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                          <div className="text-sm text-gray-900">
                            {record.room || "N/A"}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {studentStatus ? (
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                              studentStatus.isPresent
                                ? "background-primary text-primary"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            <UserCheck className="h-3.5 w-3.5 mr-1" />
                            {studentStatus.isPresent ? "Present" : "Absent"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
                            Not recorded
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700">
                          {studentStatus && studentStatus.timestamp
                            ? formatTime(studentStatus.timestamp)
                            : "—"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleOpenDetails(record)}
                          className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-emerald-700 btn-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-200 transition-colors"
                        >
                          View Details
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-500 flex items-center">
            <Clock className="h-4 w-4 mr-2" />
            Last updated: {new Date().toLocaleTimeString()}
          </div>
          <div className="bg-gray-100 px-4 py-2 rounded-lg text-sm font-medium text-gray-700">
            Total Records: {attendanceRecords.length}
          </div>
        </div>
      </>
    );
  };

  // Render past attendance tab content
  const renderPastAttendanceContent = () => {
    if (isPastLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="flex justify-center py-8">
            <LoadingAnimation
              type="spinner"
              size="md"
              variant="info"
              text="Loading past attendance..."
            />
          </div>
        </div>
      );
    }

    if (pastError) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <div className="bg-gray-50 rounded-full p-4 mb-4">
            <History className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-800">
            No Saved Attendances
          </h3>
          <p className="text-gray-600 mt-2 max-w-md mx-auto">{pastError}</p>
        </div>
      );
    }

    if (pastAttendanceRecords.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <div className="bg-gray-50 rounded-full p-4 mb-4">
            <Calendar className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-800">
            No Saved Attendances
          </h3>
          <p className="text-gray-600 mt-2 max-w-md mx-auto">
            You haven't saved any attendance records yet.
          </p>
        </div>
      );
    }

    return (
      <>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
          <h2 className="text-2xl font-bold mb-6 flex items-center text-gray-800">
            <History className="mr-2 h-6 w-6 text-teal-600" />
            Past Attendance Records
          </h2>
        </div>

        {/* Search and Filter Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          {/* Search Box */}
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by course or section..."
              value={searchTerm}
              onChange={handleSearch}
              className="pl-10 pr-4 py-2 w-full rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          {/* Section Filter */}
          {availableSections.length > 0 && (
            <div className="relative min-w-[200px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Filter className="h-5 w-5 text-gray-400" />
              </div>
              <select
                value={sectionFilter}
                onChange={handleSectionFilter}
                className="pl-10 pr-4 py-2 w-full rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent appearance-none"
              >
                <option value="">All Sections</option>
                {availableSections.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {filteredPastRecords.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="flex justify-center mb-4">
              <Search className="h-12 w-12 text-gray-300" />
            </div>
            <h3 className="text-lg font-medium text-gray-800">
              No matching records found
            </h3>
            <p className="text-gray-600 mt-2">
              {searchTerm ? (
                <>No course or section matching "{searchTerm}" was found.</>
              ) : (
                <>No records found for the selected filters.</>
              )}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:gap-6">
            {filteredPastRecords.map((record) => (
              <div
                key={record.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-200"
              >
                <div className="p-4 sm:p-5">
                  {/* Course header with status badge */}
                  <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
                    <h3 className="font-semibold text-lg text-gray-800 flex items-center">
                      <BookOpen className="mr-2 h-5 w-5 text-teal-600 flex-shrink-0" />
                      <span className="truncate">
                        {record.course || "Unnamed Course"}
                        {record.section && (
                          <>
                            <span className="ml-2 text-sm text-gray-500">
                              ({record.section})
                            </span>
                            <span className="ml-2 text-sm text-gray-500">
                              -
                            </span>
                            <span className="ml-2 text-sm text-gray-500">
                              {record.attendanceCode}
                            </span>
                          </>
                        )}
                      </span>
                    </h3>

                    <div
                      className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColorClass(
                        record.studentAttendanceStatus
                      )} flex items-center`}
                    >
                      {renderStatusIcon(record.studentAttendanceStatus)}
                      <span className="ml-1.5">
                        {record.studentAttendanceStatus === "present"
                          ? "Present"
                          : "Absent"}
                      </span>
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <div className="flex items-center text-gray-700">
                      <CalendarDays className="mr-2 h-4 w-4 text-gray-500 flex-shrink-0" />
                      <span>
                        {record.formattedDate ||
                          record.date ||
                          "Date not available"}
                      </span>
                    </div>

                    <div className="flex items-center text-gray-700">
                      <Clock className="mr-2 h-4 w-4 text-gray-500 flex-shrink-0" />
                      <span>
                        {record.formattedTime || "Time not available"}
                      </span>
                    </div>
                  </div>

                  {/* View details button */}
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => handleOpenDetails(record)}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-teal-700 bg-teal-50 hover:bg-teal-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors"
                    >
                      View Details
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-500 flex items-center">
            <Clock className="h-4 w-4 mr-2" />
            Last updated: {new Date().toLocaleTimeString()}
          </div>
          <div className="bg-gray-100 px-4 py-2 rounded-lg text-sm font-medium text-gray-700">
            Total Records: {filteredPastRecords.length}
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="py-6 px-4 md:px-8 max-w-6xl mx-auto">
      <div className="flex items-center mb-6">
        <ClipboardCheck className="h-6 w-6 text-indigo-600 mr-3" />
        <h1 className="text-3xl font-bold text-gray-900">Attendance</h1>
      </div>
      {/* Tab Navigation */}
      {renderTabNavigation()}

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === "present"
          ? renderCurrentAttendanceContent()
          : renderPastAttendanceContent()}
      </div>

      {/* Attendance Details Modal */}
      {isModalOpen && selectedRecord && (
        <AttendanceDetailModal
          attendanceRecord={selectedRecord}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}