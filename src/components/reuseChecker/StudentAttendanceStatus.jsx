import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import useAttendanceChecker from "./useAttendanceCheck";
import { checkSavedAttendanceRecords, fetchSavedAttendanceSessions } from "./checkSavedAttendanceRecords";

/**
 * Component to display a student's attendance status for a specific session
 * with added functionality to check saved attendance records
 * @param {Object} props - Component props
 * @param {string} props.sessionId - ID of the attendance session
 * @param {string} [props.studentUid] - Optional student UID (defaults to current user)
 * @param {boolean} [props.showHeader=true] - Whether to show the component header
 * @param {boolean} [props.showSavedRecords=false] - Whether to show saved attendance records
 * @param {string} [props.className] - Additional CSS classes
 */
export default function StudentAttendanceStatus({
  sessionId,
  studentUid,
  showHeader = true,
  showSavedRecords = false,
  className = "",
}) {
  const { currentUserData } = useAuth();
  const [attendanceStatus, setAttendanceStatus] = useState(null);
  const [savedRecords, setSavedRecords] = useState([]);
  const [isSavedSession, setIsSavedSession] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [savedError, setSavedError] = useState(null);
  const { loading, error, checkStudentAttendanceByUID } = useAttendanceChecker();

  // Use provided studentUid or fall back to current user
  const targetUid = studentUid || currentUserData?.uid;

  useEffect(() => {
    async function checkAttendance() {
      if (!targetUid || !sessionId) return;

      try {
        const result = await checkStudentAttendanceByUID(sessionId, targetUid);
        setAttendanceStatus(result);
      } catch (err) {
        console.error("Error checking attendance:", err);
      }
    }

    // Initial check
    checkAttendance();

    // Set up interval to check every minute (60000 ms)
    const intervalId = setInterval(() => {
      checkAttendance();
    }, 60000);

    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, [targetUid, sessionId, checkStudentAttendanceByUID]);

  // Check if the current session is in saved records
  useEffect(() => {
    async function checkSavedRecords() {
      if (!targetUid || !showSavedRecords) return;

      setLoadingSaved(true);
      try {
        // Get saved attendance IDs
        const savedRecordsResult = await checkSavedAttendanceRecords(targetUid);
        
        if (savedRecordsResult.success) {
          // Check if current session is in saved records
          setIsSavedSession(savedRecordsResult.attendanceIds.includes(sessionId));
          
          // If showing saved records, fetch the full session data
          if (showSavedRecords) {
            const sessionsResult = await fetchSavedAttendanceSessions(savedRecordsResult.attendanceIds);
            if (sessionsResult.success) {
              setSavedRecords(sessionsResult.sessions);
            } else {
              setSavedError(sessionsResult.error);
            }
          }
        } else {
          setSavedError(savedRecordsResult.error);
        }
      } catch (err) {
        console.error("Error checking saved records:", err);
        setSavedError(`Failed to check saved records: ${err.message}`);
      } finally {
        setLoadingSaved(false);
      }
    }

    checkSavedRecords();
  }, [targetUid, sessionId, showSavedRecords]);

  if (error) return <p className="text-red-600">Error: {error}</p>;
  if (!attendanceStatus) return null;

  // Format timestamp if available
  const formatTime = (timestamp) => {
    if (!timestamp) return null;
    try {
      return new Date(timestamp).toLocaleTimeString();
    } catch (e) {
      return null;
    }
  };

  // Get formatted check-in time
  const checkinTime = attendanceStatus.attendanceData?.timestamp
    ? formatTime(attendanceStatus.attendanceData.timestamp)
    : null;

  return (
    <div className={`p-4 rounded-lg border border-gray-200 ${className}`}>
      {showHeader && (
        <h3 className="text-lg font-medium text-gray-800 mb-2">
          Attendance Status
        </h3>
      )}

      {attendanceStatus.isPresent ? (
        <div className="bg-green-100 p-3 rounded">
          <p className="text-green-800 font-medium">
            {studentUid && studentUid !== currentUserData?.uid
              ? "Student is marked as present for this session."
              : "You are marked as present for this session."}
          </p>
          {attendanceStatus.attendanceData?.course && (
            <p className="text-green-700 mt-1">
              Course: {attendanceStatus.attendanceData.course}
            </p>
          )}
          {attendanceStatus.attendanceData?.teacherName && (
            <p className="text-green-700 mt-1">
              Professor: {attendanceStatus.attendanceData.teacherName}
            </p>
          )}
          {attendanceStatus.attendanceData?.comment && (
            <p className="text-green-700 mt-1">
              Comment: {attendanceStatus.attendanceData.comment}
            </p>
          )}
          {checkinTime && (
            <p className="text-green-700 mt-1">Checked in at: {checkinTime}</p>
          )}
          {isSavedSession && (
            <div className="mt-2 pt-2 border-t border-green-200">
              <p className="text-green-800 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                This session is saved in your records
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-red-100 p-3 rounded">
          <p className="text-red-800 font-medium">
            {studentUid && studentUid !== currentUserData?.uid
              ? "Student is not marked as present for this session."
              : "You are not marked as present for this session."}
          </p>
        </div>
      )}

      {/* Display saved records if requested */}
      {showSavedRecords && (
        <div className="mt-4">
          <h4 className="font-medium text-gray-800 mb-2">Saved Attendance Records</h4>
          
          {loadingSaved ? (
            <p className="text-gray-600">Loading saved records...</p>
          ) : savedError ? (
            <p className="text-red-600">{savedError}</p>
          ) : savedRecords.length === 0 ? (
            <p className="text-gray-600">No saved attendance records found.</p>
          ) : (
            <div className="border border-gray-200 rounded overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {savedRecords.slice(0, 5).map((record) => {
                    // Find student data in the record
                    const studentData = (record.students || []).find(
                      (student) => student.userUID === targetUid
                    );
                    
                    return (
                      <tr key={record.id}>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {record.date || "N/A"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {record.course || "N/A"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm">
                          {studentData?.isPresent ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Present
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Absent
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {savedRecords.length > 5 && (
                <div className="px-3 py-2 bg-gray-50 text-center text-sm text-gray-700">
                  Showing 5 of {savedRecords.length} records
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}