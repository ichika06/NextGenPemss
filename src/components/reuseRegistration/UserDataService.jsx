/**
 * A service class for interacting with user data in Firestore.
 */
// src/services/UserDataService.js
import { db } from "../../firebase/config";
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc 
} from "firebase/firestore";

class UserDataService {
  // Step 1: Register user by saving to Firestore without authentication
  async registerPendingUser(email, password, role, name, additionalData = {}) {
    try {
      // Create a new document in the pendingUsers collection
      const docRef = await addDoc(collection(db, "pendingUsers"), {
        email,
        name,
        role,
        ...additionalData,
        createdAt: new Date().toISOString(),
      });
      
      // Return the document ID for reference in later steps
      return { documentId: docRef.id };
    } catch (error) {
      console.error("Error in registration process:", error);
      throw error;
    }
  }

  // Create permanent user document after authentication
  async createUserDocument(uid, pendingDocId, additionalData = {}) {
    try {
      // Get the pending user data from Firestore
      const pendingUserDoc = await getDoc(doc(db, "pendingUsers", pendingDocId));
      
      if (!pendingUserDoc.exists()) {
        throw new Error("Pending user data not found");
      }
      
      const pendingUserData = pendingUserDoc.data();
      
      // Create permanent user document with the new user's UID
      await setDoc(doc(db, "users", uid), {
        ...pendingUserData,
        ...additionalData,
        uid,
        authCompleted: true
      });
      
      // Delete the pending document
      await deleteDoc(doc(db, "pendingUsers", pendingDocId));
      
      return { 
        success: true,
        userData: {
          ...pendingUserData,
          ...additionalData,
          uid
        }
      };
    } catch (error) {
      console.error("Error creating user document:", error);
      throw error;
    }
  }

  // Get user data from Firestore
  async getUserData(uid) {
    if (!uid) return null;
    
    try {
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        return userDoc.data();
      }
      return null;
    } catch (error) {
      console.error("Error fetching user data:", error);
      return null;
    }
  }

  // Update user profile
  async updateUserProfile(uid, userData) {
    if (!uid) throw new Error("No user ID provided");
    
    try {
      await updateDoc(doc(db, "users", uid), userData);
      return true;
    } catch (error) {
      console.error("Error updating user profile:", error);
      throw error;
    }
  }

  // Delete user data from Firestore
  async deleteUserData(uid) {
    if (!uid) throw new Error("No user ID provided");
    
    try {
      await deleteDoc(doc(db, "users", uid));
      return true;
    } catch (error) {
      console.error("Error deleting user data:", error);
      throw error;
    }
  }

  // Helper methods for specific roles
  
  // Get role-specific user data
  async getRoleSpecificData(uid, role) {
    const userData = await this.getUserData(uid);
    if (!userData) return null;
    
    switch (role) {
      case "student":
        return {
          studentId: userData.studentId || null,
          section: userData.section || null,
          course: userData.course || null
        };
      case "teacher":
        return {
          teacherId: userData.teacherId || null,
          department: userData.department || null,
          position: userData.position || null
        };
      case "registrar":
        return {
          employeeId: userData.employeeId || null,
          office: userData.office || null
        };
      case "admin":
        return {
          adminId: userData.adminId || null,
          accessLevel: userData.accessLevel || "standard"
        };
      default:
        return {};
    }
  }
}

export default new UserDataService();