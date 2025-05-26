import { useState } from "react";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../firebase/config";

/**
 * Custom hook for checking various conditions in Firestore and Storage
 */
const useFirestoreChecker = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Check if a user is registered for a specific event
   * @param {string} userId - The user ID to check
   * @param {string} eventId - The event ID to check against
   * @returns {Promise<{isRegistered: boolean, attendeeData: object|null}>}
   */
  const checkUserEventRegistration = async (email, eventId) => {
    setLoading(true);
    setError(null);

    try {
      // Query the eventAttendees collection to check if the user is registered
      const attendeesRef = collection(db, "eventAttendees");
      const q = query(
        attendeesRef,
        where("eventId", "==", eventId),
        where("email", "==", email)
      );
      
      const querySnapshot = await getDocs(q);
      
      const isRegistered = !querySnapshot.empty;
      const attendeeData = isRegistered 
        ? { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } 
        : null;
      
      setLoading(false);
      return { isRegistered, attendeeData };
    } catch (err) {
      console.error("Error checking event registration:", err);
      setError(`Failed to check registration: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Alternative method to check user registration by email
   * @param {string} userEmail - The user email to check
   * @param {string} eventId - The event ID to check against
   * @returns {Promise<{isRegistered: boolean, attendeeData: object|null}>}
   */
  const checkUserEventRegistrationByEmail = async (userEmail, eventId) => {
    setLoading(true);
    setError(null);

    try {
      const attendeesRef = collection(db, "eventAttendees");
      const q = query(
        attendeesRef,
        where("eventId", "==", eventId),
        where("userEmail", "==", userEmail)
      );
      
      const querySnapshot = await getDocs(q);
      
      const isRegistered = !querySnapshot.empty;
      const attendeeData = isRegistered 
        ? { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } 
        : null;
      
      setLoading(false);
      return { isRegistered, attendeeData };
    } catch (err) {
      console.error("Error checking event registration by email:", err);
      setError(`Failed to check registration: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Check if a user exists in Firestore by NFC data
   * @param {string} nfcData - The NFC data to check
   * @returns {Promise<{exists: boolean, userData: object|null}>}
   */
  const checkUserByNfcData = async (nfcData) => {
    setLoading(true);
    setError(null);

    try {
      // Method 1: Try to get the document directly using the NFC data as document ID
      const userDocRef = doc(db, "users", nfcData);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = { id: userDoc.id, ...userDoc.data() };
        setLoading(false);
        return { exists: true, userData };
      }

      // Method 2: Query by uid field
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("uid", "==", nfcData));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userData = { 
          id: querySnapshot.docs[0].id, 
          ...querySnapshot.docs[0].data() 
        };
        setLoading(false);
        return { exists: true, userData };
      }

      setLoading(false);
      return { exists: false, userData: null };
    } catch (err) {
      console.error("Error checking user by NFC data:", err);
      setError(`Failed to check user: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Check if an event has an attendance sheet document
   * @param {string} eventId - The event ID to check
   * @returns {Promise<{exists: boolean, documentData: object|null}>}
   */
  const checkEventAttendanceSheet = async (eventId) => {
    setLoading(true);
    setError(null);

    try {
      const docsRef = collection(db, "eventDocuments");
      const docsQuery = query(
        docsRef,
        where("eventId", "==", eventId),
        where("documentType", "==", "attendeeSheet")
      );
      const docsSnapshot = await getDocs(docsQuery);
      
      const exists = !docsSnapshot.empty;
      const documentData = exists 
        ? { id: docsSnapshot.docs[0].id, ...docsSnapshot.docs[0].data() } 
        : null;
      
      setLoading(false);
      return { exists, documentData };
    } catch (err) {
      console.error("Error checking attendance sheet:", err);
      setError(`Failed to check attendance sheet: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Check if a file exists in Firebase Storage
   * @param {string} filePath - The path to check
   * @returns {Promise<{exists: boolean, url: string|null}>}
   */
  const checkFileExists = async (filePath) => {
    setLoading(true);
    setError(null);

    try {
      const fileRef = ref(storage, filePath);
      return getDownloadURL(fileRef)
        .then(url => {
          setLoading(false);
          return { exists: true, url };
        })
        .catch(() => {
          setLoading(false);
          return { exists: false, url: null };
        });
    } catch (err) {
      console.error("Error checking file existence:", err);
      setError(`Failed to check file: ${err.message}`);
      setLoading(false);
      return { exists: false, url: null };
    }
  };

  /**
   * Get all students from a specific section
   * @param {string} section - The section to query for
   * @returns {Promise<{students: Array<object>}>}
   */
  const getStudentsBySection = async (section) => {
    setLoading(true);
    setError(null);

    try {
      const usersRef = collection(db, "users");
      const q = query(
        usersRef,
        where("role", "==", "student"),
        where("section", "==", section)
      );
      
      const querySnapshot = await getDocs(q);
      
      const students = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setLoading(false);
      return { students };
    } catch (err) {
      console.error("Error fetching students by section:", err);
      setError(`Failed to fetch students: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  return {
    loading,
    error,
    checkUserEventRegistration,
    checkUserEventRegistrationByEmail,
    checkUserByNfcData,
    checkEventAttendanceSheet,
    checkFileExists,
    getStudentsBySection
  };
};

export default useFirestoreChecker;