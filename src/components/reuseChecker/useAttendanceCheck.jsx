/**
 * Custom hook to check student attendance based on different criteria.
 * @returns {{
 *    loading: boolean,
 *    error: string | null,
 *    checkStudentAttendance: (sessionId: string, studentId: string) => Promise<{ isPresent: boolean, attendanceData: object | null }>,
 *    checkStudentAttendanceByEmail: (sessionId: string, email: string) => Promise<{ isPresent: boolean, attendanceData: object | null }>,
 *    checkStudentAttendanceByUID: (sessionId: string, userUID: string) => Promise<{ isPresent: boolean, attendanceData: object | null }>,
 *    checkStudentAttendanceByDate: (studentId: string, date: string) => Promise<{
 */
import { useState } from "react";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/config";

/**
 * Custom hook for checking student attendance in Firestore
 */
const useAttendanceChecker = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Check if a student is marked as present in a specific attendance session
   * @param {string} sessionId - The attendance session ID to check
   * @param {string} studentId - The student ID to check
   * @returns {Promise<{isPresent: boolean, attendanceData: object|null}>}
   */
  const checkStudentAttendance = async (sessionId, studentId) => {
    setLoading(true);
    setError(null);

    try {
      // Get the specific attendance session document
      const sessionRef = doc(db, "attendance-sessions", sessionId);
      const sessionDoc = await getDoc(sessionRef);

      if (!sessionDoc.exists()) {
        setLoading(false);
        return { isPresent: false, attendanceData: null };
      }

      const sessionData = sessionDoc.data();
      const students = sessionData.students || [];

      // Find the student in the students array
      const studentRecord = students.find(student => 
        student.studentId === studentId || 
        student.email === student.email || 
        student.userUID === studentId
      );

      setLoading(false);
      return { 
        isPresent: !!studentRecord && studentRecord.isPresent === true,
        attendanceData: studentRecord || null 
      };
    } catch (err) {
      console.error("Error checking student attendance:", err);
      setError(`Failed to check attendance: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Check if a student has taken attendance by their email
   * @param {string} sessionId - The attendance session ID to check
   * @param {string} email - The student email to check
   * @returns {Promise<{isPresent: boolean, attendanceData: object|null}>}
   */
  const checkStudentAttendanceByEmail = async (sessionId, email) => {
    setLoading(true);
    setError(null);

    try {
      // Get the specific attendance session document
      const sessionRef = doc(db, "attendance-sessions", sessionId);
      const sessionDoc = await getDoc(sessionRef);

      if (!sessionDoc.exists()) {
        setLoading(false);
        return { isPresent: false, attendanceData: null };
      }

      const sessionData = sessionDoc.data();
      const students = sessionData.students || [];

      // Find the student in the students array by email
      const studentRecord = students.find(student => student.email === email);

      setLoading(false);
      return { 
        isPresent: !!studentRecord && studentRecord.isPresent === true,
        attendanceData: studentRecord || null 
      };
    } catch (err) {
      console.error("Error checking student attendance by email:", err);
      setError(`Failed to check attendance: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Check if a student has taken attendance by their user UID
   * @param {string} sessionId - The attendance session ID to check
   * @param {string} userUID - The student user UID to check
   * @returns {Promise<{isPresent: boolean, attendanceData: object|null}>}
   */
  const checkStudentAttendanceByUID = async (sessionId, userUID) => {
    setLoading(true);
    setError(null);

    try {
      // Get the specific attendance session document
      const sessionRef = doc(db, "attendance-sessions", sessionId);
      const sessionDoc = await getDoc(sessionRef);

      if (!sessionDoc.exists()) {
        setLoading(false);
        return { isPresent: false, attendanceData: null };
      }

      const sessionData = sessionDoc.data();
      const students = sessionData.students || [];

      // Find the student in the students array by UID
      const studentRecord = students.find(student => student.userUID === userUID);

      setLoading(false);
      return { 
        isPresent: !!studentRecord && studentRecord.isPresent === true,
        attendanceData: studentRecord || null 
      };
    } catch (err) {
      console.error("Error checking student attendance by UID:", err);
      setError(`Failed to check attendance: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Check if a student is registered in any attendance session for a specific date
   * @param {string} studentId - The student ID to check
   * @param {string} date - The date string to check against (YYYY-MM-DD)
   * @returns {Promise<{isAttended: boolean, sessions: Array}>}
   */
  const checkStudentAttendanceByDate = async (studentId, date) => {
    setLoading(true);
    setError(null);

    try {
      // Query attendance sessions for the given date
      const sessionsRef = collection(db, "attendance-sessions");
      const q = query(sessionsRef, where("date", "==", date));
      const querySnapshot = await getDocs(q);
      
      const attendedSessions = [];
      
      // Check each session to see if the student is present
      querySnapshot.forEach((doc) => {
        const sessionData = doc.data();
        const students = sessionData.students || [];
        
        const studentRecord = students.find(student => 
          student.studentId === studentId || 
          student.userUID === studentId
        );
        
        if (studentRecord && studentRecord.isPresent === true) {
          attendedSessions.push({
            sessionId: doc.id,
            ...sessionData,
            studentRecord
          });
        }
      });
      
      setLoading(false);
      return { 
        isAttended: attendedSessions.length > 0,
        sessions: attendedSessions
      };
    } catch (err) {
      console.error("Error checking student attendance by date:", err);
      setError(`Failed to check attendance: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Check if a student has any attendance records in a specific time range
   * @param {string} studentId - The student ID to check
   * @param {Date} startDate - The start date of the range
   * @param {Date} endDate - The end date of the range
   * @returns {Promise<{totalSessions: number, attendedSessions: number, sessions: Array}>}
   */
  const checkStudentAttendanceInRange = async (studentId, startDate, endDate) => {
    setLoading(true);
    setError(null);

    try {
      // Convert dates to strings for comparison (assuming dateObject format in Firestore)
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      // Query all attendance sessions
      const sessionsRef = collection(db, "attendance-sessions");
      const querySnapshot = await getDocs(sessionsRef);
      
      const allSessions = [];
      const attendedSessions = [];
      
      // Filter sessions in the date range and check student attendance
      querySnapshot.forEach((doc) => {
        const sessionData = doc.data();
        let sessionDate;
        
        // Extract date from various possible formats in the data
        if (sessionData.dateObject) {
          sessionDate = sessionData.dateObject.split('T')[0];
        } else if (sessionData.date) {
          // Try to parse the date string
          try {
            const parsedDate = new Date(sessionData.date);
            sessionDate = parsedDate.toISOString().split('T')[0];
          } catch (e) {
            sessionDate = sessionData.date;
          }
        }
        
        // Check if the session is within the date range
        if (sessionDate && sessionDate >= startDateStr && sessionDate <= endDateStr) {
          // Add to all sessions in range
          allSessions.push({
            sessionId: doc.id,
            ...sessionData
          });
          
          // Check if student attended
          const students = sessionData.students || [];
          const studentRecord = students.find(student => 
            student.studentId === studentId || 
            student.userUID === studentId
          );
          
          if (studentRecord && studentRecord.isPresent === true) {
            attendedSessions.push({
              sessionId: doc.id,
              ...sessionData,
              studentRecord
            });
          }
        }
      });
      
      setLoading(false);
      return { 
        totalSessions: allSessions.length,
        attendedSessions: attendedSessions.length,
        attendanceRate: allSessions.length > 0 ? 
          (attendedSessions.length / allSessions.length) * 100 : 0,
        sessions: attendedSessions
      };
    } catch (err) {
      console.error("Error checking student attendance in range:", err);
      setError(`Failed to check attendance: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  return {
    loading,
    error,
    checkStudentAttendance,
    checkStudentAttendanceByEmail,
    checkStudentAttendanceByUID,
    checkStudentAttendanceByDate,
    checkStudentAttendanceInRange
  };
};

export default useAttendanceChecker;

// import { useState, useEffect } from "react";
// import { useAuth } from "../../contexts/AuthContext";
// import useAttendanceChecker from "../../hooks/useAttendanceChecker";

// function AttendanceStatus({ sessionId }) {
//   const { currentUserData } = useAuth();
//   const [attendanceStatus, setAttendanceStatus] = useState(null);
//   const { loading, error, checkStudentAttendance } = useAttendanceChecker();

//   useEffect(() => {
//     async function checkAttendance() {
//       if (!currentUserData?.id || !sessionId) return;
      
//       try {
//         const result = await checkStudentAttendance(sessionId, currentUserData.id);
//         setAttendanceStatus(result);
//       } catch (err) {
//         console.error("Error checking attendance:", err);
//       }
//     }
    
//     checkAttendance();
//   }, [currentUserData, sessionId]);

//   if (loading) return <p>Checking attendance status...</p>;
//   if (error) return <p>Error: {error}</p>;
//   if (!attendanceStatus) return <p>No attendance information found</p>;

//   return (
//     <div>
//       <h3>Attendance Status</h3>
//       {attendanceStatus.isPresent ? (
//         <div className="bg-green-100 p-3 rounded">
//           You are marked as present for this session.
//           {attendanceStatus.attendanceData?.comment && (
//             <p>Comment: {attendanceStatus.attendanceData.comment}</p>
//           )}
//           {attendanceStatus.attendanceData?.timestamp && (
//             <p>Checked in at: {new Date(attendanceStatus.attendanceData.timestamp).toLocaleTimeString()}</p>
//           )}
//         </div>
//       ) : (
//         <div className="bg-red-100 p-3 rounded">
//           You are not marked as present for this session.
//         </div>
//       )}
//     </div>
//   );
// }