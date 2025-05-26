/**
 * Saves the attendance IDs for a user in the Firestore database.
 * @param {string} userId - The ID of the user whose attendance IDs are being saved.
 * @param {string[]} newAttendanceIds - An array of new attendance IDs to save for the user.
 * @returns {Object} An object containing the success status, saved IDs, and error message.
 */
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/config";

/**
 * Helper function to automatically save attendance IDs for a user
 * @param {string} userId - The user's UID
 * @param {string[]} newAttendanceIds - Array of attendance IDs to save
 * @returns {Promise<{success: boolean, savedIds: string[], error: string | null}>}
 */
export async function saveAttendanceIds(userId, newAttendanceIds) {
  if (!userId || !newAttendanceIds || newAttendanceIds.length === 0) {
    return {
      success: false,
      savedIds: [],
      error: "Invalid user ID or no attendance IDs to save",
    };
  }

  try {
    // Reference to the user's saved attendance record
    const userAttendanceRef = doc(db, "user-attendance-records", userId);

    // Get existing saved IDs
    const docSnap = await getDoc(userAttendanceRef);
    const existingIds = docSnap.exists()
      ? docSnap.data().attendanceIds || []
      : [];

    // Combine existing saved IDs with new IDs (removing duplicates)
    const combinedIds = [...new Set([...existingIds, ...newAttendanceIds])];

    // Save the attendance IDs
    await setDoc(
      userAttendanceRef,
      {
        userId: userId,
        attendanceIds: combinedIds,
        lastUpdated: new Date().toISOString(),
      },
      { merge: true }
    );

    return {
      success: true,
      savedIds: combinedIds,
      error: null,
    };
  } catch (error) {
    console.error("Error saving attendance IDs:", error);
    return {
      success: false,
      savedIds: [],
      error: "Failed to save attendance IDs: " + error.message,
    };
  }
}

/**
 * Helper function to get saved attendance IDs for a user
 * @param {string} userId - The user's UID
 * @returns {Promise<{success: boolean, savedIds: string[], error: string | null}>}
 */
export async function getSavedAttendanceIds(userId) {
  if (!userId) {
    return {
      success: false,
      savedIds: [],
      error: "Invalid user ID",
    };
  }

  try {
    // Reference to the user's saved attendance record
    const userAttendanceRef = doc(db, "user-attendance-records", userId);

    // Get existing saved IDs
    const docSnap = await getDoc(userAttendanceRef);
    const savedIds = docSnap.exists() ? docSnap.data().attendanceIds || [] : [];

    return {
      success: true,
      savedIds: savedIds,
      error: null,
    };
  } catch (error) {
    console.error("Error getting saved attendance IDs:", error);
    return {
      success: false,
      savedIds: [],
      error: "Failed to get saved attendance IDs: " + error.message,
    };
  }
}
