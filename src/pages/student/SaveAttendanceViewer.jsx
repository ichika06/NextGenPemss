import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  checkSavedAttendanceRecords,
  fetchSavedAttendanceSessions,
} from "../../components/reuseChecker/checkSavedAttendanceRecords";
import StudentAttendanceStatus from "../../components/reuseChecker/StudentAttendanceStatus";
import AttendanceDetailModal from "./UpcomingAttendanceModal";
import { LoadingAnimation } from "../../components/LoadingAnimation";
import {
  CalendarDays,
  BookOpen,
  User,
  ChevronRight,
  Loader2,
  MapPin,
  History,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Search,
  Filter,
} from "lucide-react";

/**
 * Component to display saved attendance records for a student
 * @param {Object} props - Component props
 * @param {string} [props.studentUid] - Optional student UID (defaults to current user)
 * @param {number} [props.limit=0] - Number of records to show (0 for all)
 * @param {string} [props.className] - Additional CSS classes
 * @param {boolean} [props.currentSectionOnly=false] - Show only current section's records
 */
export default function SavedAttendanceViewer({
  studentUid,
  limit = 0,
  className = "",
  currentSectionOnly = false,
}) {
  const { currentUserData } = useAuth();
  const [savedRecords, setSavedRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Modal state management
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Search and filter functionality
  const [searchTerm, setSearchTerm] = useState("");
  const [sectionFilter, setSectionFilter] = useState(""); // No default section filter
  const [availableSections, setAvailableSections] = useState([]);

  // Use provided studentUid or fall back to current user
  const targetUid = studentUid || currentUserData?.uid;

  useEffect(() => {
    async function fetchSavedRecords() {
      if (!targetUid) {
        setError("No user information available");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        // Get saved attendance records without filtering by section
        const savedRecordsResult = await checkSavedAttendanceRecords(targetUid);

        if (!savedRecordsResult.success) {
          setError(
            savedRecordsResult.error || "Failed to retrieve saved records"
          );
          setIsLoading(false);
          return;
        }

        // Set last updated time
        setLastUpdated(savedRecordsResult.lastUpdated);

        // If no saved records, show empty state
        if (savedRecordsResult.attendanceRecords.length === 0) {
          setSavedRecords([]);
          setFilteredRecords([]);
          setIsLoading(false);
          return;
        }

        // Fetch full session data for each saved record
        const sessionsResult = await fetchSavedAttendanceSessions(
          savedRecordsResult.attendanceRecords
        );

        if (!sessionsResult.success) {
          setError(sessionsResult.error || "Failed to fetch session details");
          setIsLoading(false);
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
              student.userUID === targetUid ||
              student.email === currentUserData?.email
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

        // Apply limit if set
        const limitedSessions =
          limit > 0 ? processedSessions.slice(0, limit) : processedSessions;

        setSavedRecords(limitedSessions);

        // Initialize filtered records - show all records by default
        setFilteredRecords(limitedSessions);

        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching saved attendance records:", error);
        setError("Failed to load saved attendance records");
        setIsLoading(false);
      }
    }

    fetchSavedRecords();
  }, [targetUid, currentUserData?.email, limit]);

  // Effect to filter records when search term or section filter changes
  useEffect(() => {
    let filtered = [...savedRecords];

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

    setFilteredRecords(filtered);
  }, [searchTerm, savedRecords, sectionFilter]);

  // Modal handlers
  const handleOpenModal = (record) => {
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedRecord(null);
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

  // Status text getter
  const getStatusText = (status) => {
    switch (status) {
      case "present":
        return "Present";
      case "absent":
        return "Absent";
      default:
        return "Absent";
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

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";

    try {
      return new Date(timestamp).toLocaleString();
    } catch (e) {
      return "N/A";
    }
  };

  if (isLoading) {
    return (
      <div
        className={`flex flex-col items-center justify-center py-12 ${className}`}
      >
        <div className="flex justify-center py-8">
          <LoadingAnimation
            type="spinner"
            size="md"
            variant="info"
            text="Loading saved attendance..."
          />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`flex flex-col items-center justify-center py-12 text-center px-4 ${className}`}
      >
        <div className="bg-gray-50 rounded-full p-4 mb-4">
          <History className="h-12 w-12 text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-800">
          No Saved Attendances
        </h3>
        <p className="text-gray-600 mt-2 max-w-md mx-auto">{error}</p>
      </div>
    );
  }

  if (savedRecords.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center py-12 text-center px-4 ${className}`}
      >
        <div className="bg-gray-50 rounded-full p-4 mb-4">
          <Calendar className="h-12 w-12 text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-800">
          No Saved Attendances
        </h3>
        <p className="text-gray-600 mt-2 max-w-md mx-auto">
          You haven't saved any attendance records yet.
        </p>
        {lastUpdated && (
          <p className="text-gray-500 text-sm mt-2">
            Last checked: {formatTimestamp(lastUpdated)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`max-w-4xl mx-auto px-4 sm:px-6 py-6 ${className}`}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
        <h2 className="text-2xl font-bold mb-6 flex items-center text-gray-800">
          <History className="mr-2 h-6 w-6 text-teal-600" />
          Past Attendance Records
        </h2>

        {lastUpdated && (
          <div className="text-sm text-gray-500 mt-2 md:mt-0">
            Last updated: {formatTimestamp(lastUpdated)}
          </div>
        )}
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

      {filteredRecords.length === 0 ? (
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
          {filteredRecords.map((record) => (
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
                          <span className="ml-2 text-sm text-gray-500">-</span>
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
                      {getStatusText(record.studentAttendanceStatus)}
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
                    <span>{record.formattedTime}</span>
                  </div>

                  <div className="flex items-center text-gray-700">
                    <MapPin className="mr-2 h-4 w-4 text-gray-500 flex-shrink-0" />
                    <span className="truncate">
                      {record.room || "Room not specified"}
                    </span>
                  </div>

                  <div className="flex items-center text-gray-700">
                    <User className="mr-2 h-4 w-4 text-gray-500 flex-shrink-0" />
                    <span className="truncate">
                      {record.teacherName || "Instructor not specified"}
                    </span>
                  </div>
                </div>

                {/* View details button */}
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => handleOpenModal(record)}
                    className="flex items-center text-teal-600 hover:text-teal-700 font-medium text-sm transition-colors"
                    aria-label="View details"
                  >
                    View Details
                    <ChevronRight className="h-5 w-5 ml-1" />
                  </button>
                </div>
              </div>

              {/* Integrated StudentAttendanceStatus component - hidden on mobile for cleaner UI */}
              <div className="hidden sm:block border-t border-gray-100">
                <StudentAttendanceStatus
                  sessionId={record.id}
                  showHeader={false}
                  className="bg-gray-50 p-3"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal for detailed view */}
      {isModalOpen && selectedRecord && (
        <AttendanceDetailModal
          attendanceRecord={selectedRecord}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      )}

      {/* Records count display */}
      <div className="mt-4 text-sm text-gray-500 flex justify-between items-center">
        <div>
          Showing <span className="font-medium">{filteredRecords.length}</span>{" "}
          of <span className="font-medium">{savedRecords.length}</span> records
        </div>
        {limit > 0 && savedRecords.length > limit && (
          <div className="text-teal-600 font-medium">
            Limited to {limit} records
          </div>
        )}
      </div>
    </div>
  );
}
