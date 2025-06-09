import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/config";

/**
 * Function to check and retrieve saved attendance records for a student
 * @param {string} userId - The ID of the current user
 * @param {string} [currentSection] - Optional section filter
 * @returns {Promise<{success: boolean, attendanceRecords: Array<Object>, lastUpdated: string|null, error: string|null}>}
 */
export const checkSavedAttendanceRecords = async (userId, currentSection = null) => {
  if (!userId) {
    return {
      success: false,
      attendanceRecords: [],
      attendanceIds: [], // For backward compatibility
      lastUpdated: null,
      error: "No user ID provided"
    };
  }

  try {
    // Reference to the user's attendance record document
    const userAttendanceRef = doc(db, "user-attendance-records", userId);
    const docSnapshot = await getDoc(userAttendanceRef);

    if (!docSnapshot.exists()) {
      return {
        success: false,
        attendanceRecords: [],
        attendanceIds: [], // For backward compatibility
        lastUpdated: null,
        error: "No saved attendance records found"
      };
    }

    // Get the data from the document
    const data = docSnapshot.data();
    
    // Handle both old and new data structures
    let attendanceRecords = [];
    
    if (data.attendanceRecords && Array.isArray(data.attendanceRecords)) {
      // New structure with section information
      attendanceRecords = data.attendanceRecords;
    } else if (data.attendanceIds && Array.isArray(data.attendanceIds)) {
      // Legacy structure - convert to new format
      attendanceRecords = data.attendanceIds.map(id => ({ id, section: "unknown" }));
    }
    
    // Filter by section if requested
    if (currentSection) {
      attendanceRecords = attendanceRecords.filter(record => record.section === currentSection);
    }
    
    // Extract just the IDs for backward compatibility
    const attendanceIds = attendanceRecords.map(record => record.id);
    
    return {
      success: true,
      attendanceRecords, // New structure with section info
      attendanceIds,     // Legacy structure for compatibility
      lastUpdated: data.lastUpdated || null,
      error: null
    };
  } catch (err) {
    console.error("Error checking saved attendance records:", err);
    return {
      success: false,
      attendanceRecords: [],
      attendanceIds: [],
      lastUpdated: null,
      error: `Failed to check saved records: ${err.message}`
    };
  }
};

/**
 * Function to save attendance records with section information
 * @param {string} userId - The user ID
 * @param {Array<string>} newAttendanceIds - Array of attendance session IDs to save
 * @param {string} section - The section these attendance records belong to
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const saveAttendanceRecords = async (userId, newAttendanceIds, section) => {
  if (!userId) {
    return { success: false, error: "No user ID provided" };
  }

  if (!newAttendanceIds || !Array.isArray(newAttendanceIds)) {
    return { success: false, error: "Invalid attendance IDs" };
  }

  if (!section) {
    return { success: false, error: "No section provided" };
  }

  try {
    const userAttendanceRef = doc(db, "user-attendance-records", userId);
    const docSnapshot = await getDoc(userAttendanceRef);
    
    // Create new records with section information
    const newRecords = newAttendanceIds.map(id => ({
      id,
      section,
      addedAt: new Date().toISOString()
    }));

    if (!docSnapshot.exists()) {
      // Create new document if it doesn't exist
      await setDoc(userAttendanceRef, {
        attendanceRecords: newRecords,
        attendanceIds: newAttendanceIds, // For backward compatibility
        lastUpdated: serverTimestamp()
      });
    } else {
      // Update existing document
      const existingData = docSnapshot.data();
      let existingRecords = existingData.attendanceRecords || [];
      
      // If we have old format data, convert it
      if (!existingRecords.length && existingData.attendanceIds) {
        existingRecords = existingData.attendanceIds.map(id => ({
          id,
          section: "unknown",
          addedAt: new Date().toISOString()
        }));
      }
      
      // Filter out duplicates - don't add records that already exist
      const existingIds = existingRecords.map(record => record.id);
      const recordsToAdd = newRecords.filter(record => !existingIds.includes(record.id));
      
      // Merge existing and new records
      const updatedRecords = [...existingRecords, ...recordsToAdd];
      
      // Update document with merged records
      await updateDoc(userAttendanceRef, {
        attendanceRecords: updatedRecords,
        attendanceIds: updatedRecords.map(record => record.id), // For backward compatibility
        lastUpdated: serverTimestamp()
      });
    }

    return { success: true, error: null };
  } catch (err) {
    console.error("Error saving attendance records:", err);
    return { success: false, error: `Failed to save attendance records: ${err.message}` };
  }
};

/**
 * Function to fetch all attendance sessions from the saved attendance IDs
 * @param {Array<Object>} attendanceRecords - Array of attendance record objects with IDs
 * @returns {Promise<{success: boolean, sessions: Array<Object>, error: string|null}>}
 */
export const fetchSavedAttendanceSessions = async (attendanceRecords) => {
  // Handle both new and old format
  const attendanceIds = Array.isArray(attendanceRecords) 
    ? attendanceRecords.map(record => typeof record === 'object' ? record.id : record)
    : Array.isArray(attendanceRecords) ? attendanceRecords : [];
  
  if (!attendanceIds || attendanceIds.length === 0) {
    return {
      success: false,
      sessions: [],
      error: "No attendance IDs provided"
    };
  }

  try {
    // Fetch each attendance session document by ID
    const sessionPromises = attendanceIds.map(async (sessionId) => {
      const sessionRef = doc(db, "attendance-sessions", sessionId);
      const sessionDoc = await getDoc(sessionRef);
      
      if (sessionDoc.exists()) {
        const sessionData = sessionDoc.data();
        
        // If we have the original attendance record, add section info
        const originalRecord = Array.isArray(attendanceRecords) 
          ? attendanceRecords.find(record => 
              typeof record === 'object' && record.id === sessionId
            )
          : null;
          
        return {
          id: sessionDoc.id,
          ...sessionData,
          // Add saved section info if available from original record
          savedInSection: originalRecord && originalRecord.section ? originalRecord.section : sessionData.section
        };
      }
      
      return null;
    });
    
    // Wait for all promises to resolve
    const sessions = await Promise.all(sessionPromises);
    
    // Filter out any null values (documents that don't exist)
    const validSessions = sessions.filter(session => session !== null);
    
    return {
      success: true,
      sessions: validSessions,
      error: null
    };
  } catch (err) {
    console.error("Error fetching saved attendance sessions:", err);
    return {
      success: false,
      sessions: [],
      error: `Failed to fetch sessions: ${err.message}`
    };
  }
};