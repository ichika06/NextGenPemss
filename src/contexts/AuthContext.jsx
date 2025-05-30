import { createContext, useContext, useState, useEffect } from "react"
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword as firebaseUpdatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser
} from "firebase/auth"
import { doc, getDoc, setDoc, collection, addDoc, updateDoc, deleteDoc, query, where, getDocs } from "firebase/firestore"
import { ref, deleteObject, listAll } from "firebase/storage"
import { db, storage } from "../firebase/config"

const AuthContext = createContext(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [currentUserData, setCurrentUserData] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authReady, setAuthReady] = useState(false)
  const auth = getAuth()

  // Step 1: Register user by saving to Firestore without authentication
  async function register(email, password, role, name, additionalData = {}) {
    try {
      // Create a new document in the pendingUsers collection
      const docRef = await addDoc(collection(db, "pendingUsers"), {
        email,
        name,
        role,
        ...additionalData,
        createdAt: new Date().toISOString(),
      })
      
      // Return the document ID for reference in later steps
      return { documentId: docRef.id }
    } catch (error) {
      console.error("Error in registration process:", error)
      throw error
    }
  }

  // Step 2: Create authentication account without signing out current admin user
  async function createAuthAccountWithoutSignIn(email, password, docId, additionalData = {}) {
    try {
      // Create a secondary auth instance for the new user
      const secondaryAuth = getAuth()
      
      // Create the auth account using the secondary auth instance
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password)
      const newUser = userCredential.user
      
      // Get the pending user data from Firestore
      const pendingUserDoc = await getDoc(doc(db, "pendingUsers", docId))
      
      if (!pendingUserDoc.exists()) {
        throw new Error("Pending user data not found")
      }
      
      const pendingUserData = pendingUserDoc.data()
      
      // Create permanent user document with the new user's UID
      await setDoc(doc(db, "users", newUser.uid), {
        ...pendingUserData,
        ...additionalData,
        uid: newUser.uid,
        authCompleted: true
      })
      
      // Delete the pending document
      await deleteDoc(doc(db, "pendingUsers", docId))
      
      // Sign out from secondary auth instance immediately
      // to avoid affecting current admin session
      await secondaryAuth.signOut()
      
      return { 
        documentId: newUser.uid,
        success: true 
      }
    } catch (error) {
      console.error("Error creating auth account:", error)
      throw error
    }
  }

  async function login(email, password) {
    try {
      // Reset authReady to ensure the state is refreshed
      setAuthReady(false)
      
      // Login with Firebase Auth
      const result = await signInWithEmailAndPassword(auth, email, password)
      
      // Get user role immediately after login
      const userDoc = await getDoc(doc(db, "users", result.user.uid))
      if (userDoc.exists()) {
        const userData = userDoc.data()
        setUserRole(userData.role)
        setCurrentUserData(userData)
      }
      
      // Mark authentication as completed successfully
      setAuthReady(true)
      
      return result
    } catch (error) {
      console.error("Error logging in:", error)
      throw error
    }
  }

  async function logout() {
    try {
      await signOut(auth)
      setUserRole(null)
      setCurrentUserData(null)
      setAuthReady(false)
    } catch (error) {
      console.error("Error logging out:", error)
      throw error
    }
  }

  // Reauthenticate user with current password
  async function reauthenticate(currentPassword) {
    if (!currentUser || !currentUser.email) {
      throw new Error("No authenticated user or email not available")
    }

    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword)
      await reauthenticateWithCredential(currentUser, credential)
      return true
    } catch (error) {
      console.error("Error reauthenticating:", error)
      throw error
    }
  }

  // Update user password
  async function updatePassword(newPassword) {
    if (!currentUser) {
      throw new Error("No authenticated user")
    }

    try {
      await firebaseUpdatePassword(currentUser, newPassword)
      return true
    } catch (error) {
      console.error("Error updating password:", error)
      throw error
    }
  }

  // Delete current user's own account
  async function deleteAccount() {
  if (!currentUser) {
    throw new Error("No authenticated user")
  }

  const uid = currentUser.uid
  const userEmail = currentUser.email

  try {
    // Step 1: Get user data before deletion for audit purposes
    let userData = null
    try {
      const userDoc = await getDoc(doc(db, "users", uid))
      if (userDoc.exists()) {
        userData = userDoc.data()
      }
    } catch (error) {
      console.warn("Could not retrieve user data for audit:", error)
    }

    // Step 2: Delete user's profile images and files from Firebase Storage
    try {
      const userStorageRef = ref(storage, `users/${uid}`)
      const listResult = await listAll(userStorageRef)
      
      // Delete all files in user's storage folder
      const deletePromises = listResult.items.map(itemRef => deleteObject(itemRef))
      await Promise.all(deletePromises)
      
      // Delete subfolders (like profile folder)
      const subfolderPromises = listResult.prefixes.map(async (folderRef) => {
        const subListResult = await listAll(folderRef)
        const subDeletePromises = subListResult.items.map(itemRef => deleteObject(itemRef))
        return Promise.all(subDeletePromises)
      })
      await Promise.all(subfolderPromises)
    } catch (storageError) {
      console.warn("Error deleting storage files:", storageError)
      // Continue with account deletion even if storage deletion fails
    }

    // Step 3: Create audit record before deletion (optional)
    if (userData) {
      try {
        await addDoc(collection(db, "deletedAccounts"), {
          originalUid: uid,
          email: userEmail,
          name: userData.name,
          role: userData.role,
          deletedBy: uid, // Self-deletion
          deletedByEmail: userEmail,
          deletedAt: new Date().toISOString(),
          originalData: userData,
          authAccountStatus: "deleted", // Both auth and Firestore will be deleted
          deletionType: "self-deletion"
        })
      } catch (auditError) {
        console.warn("Error creating audit record:", auditError)
        // Continue with deletion even if audit logging fails
      }
    }

    // Step 4: Delete user document from Firestore
    await deleteDoc(doc(db, "users", uid))

    // Step 5: Delete the authentication account
    await deleteUser(currentUser)

    // Step 6: Clear local state
    setCurrentUser(null)
    setCurrentUserData(null)
    setUserRole(null)
    setAuthReady(false)

    console.log(`Account deleted successfully for ${userEmail}`)
    return true
  } catch (error) {
    console.error("Error deleting account:", error)
    
    // Handle specific Firebase Auth errors
    if (error.code === 'auth/requires-recent-login') {
      throw new Error("For security reasons, please log out and log back in, then try deleting your account again.")
    } else if (error.code === 'auth/user-token-expired') {
      throw new Error("Your session has expired. Please log in again and try deleting your account.")
    } else {
      throw new Error(`Failed to delete account: ${error.message}`)
    }
  }
}

  // New function: Delete another user's account by ID (Admin function)
  async function deleteUserById(userId) {
  if (!currentUser) {
    throw new Error("No authenticated user")
  }

  // Check if current user has admin permissions
  if (!currentUserData || (currentUserData.role !== 'admin' && currentUserData.accessLevel !== 'super' && currentUserData.role !== 'registrar')) {
    throw new Error("Insufficient permissions to delete user accounts")
  }

  try {
    // First, get the user data to verify it exists
    const userDoc = await getDoc(doc(db, "users", userId))
    
    if (!userDoc.exists()) {
      throw new Error("User not found")
    }

    const userData = userDoc.data()
    const userEmail = userData.email // Store the email for logging/tracking

    // Step 1: Delete user's storage files
    try {
      const userStorageRef = ref(storage, `users/${userId}`)
      const listResult = await listAll(userStorageRef)
      
      // Delete all files in user's storage folder
      const deletePromises = listResult.items.map(itemRef => deleteObject(itemRef))
      await Promise.all(deletePromises)
      
      // Delete subfolders
      const subfolderPromises = listResult.prefixes.map(async (folderRef) => {
        const subListResult = await listAll(folderRef)
        const subDeletePromises = subListResult.items.map(itemRef => deleteObject(itemRef))
        return Promise.all(subDeletePromises)
      })
      await Promise.all(subfolderPromises)
    } catch (storageError) {
      console.warn("Error deleting storage files:", storageError)
      // Continue with account deletion even if storage deletion fails
    }

    // Step 2: Create a record of the deleted account for audit purposes
    try {
      await addDoc(collection(db, "deletedAccounts"), {
        originalUid: userId,
        email: userEmail,
        name: userData.name,
        role: userData.role,
        deletedBy: currentUser.uid,
        deletedByEmail: currentUserData.email,
        deletedAt: new Date().toISOString(),
        originalData: userData, // Store complete user data for audit
        authAccountStatus: "orphaned", // Auth account still exists but Firestore doc deleted
        note: "Firestore document deleted. Firebase Auth account may still exist and needs manual cleanup."
      })
    } catch (auditError) {
      console.warn("Error creating audit record:", auditError)
      // Continue with deletion even if audit logging fails
    }

    // Step 3: Delete user document from Firestore
    await deleteDoc(doc(db, "users", userId))

    // Note: We cannot delete the Firebase Auth account from here as we don't have access to that user's auth instance
    // The user's auth account will remain but will be orphaned (no corresponding Firestore document)
    
    console.log(`User ${userData.name} (${userEmail}) deleted successfully`)
    console.log(`Warning: Firebase Auth account for ${userEmail} still exists and may need manual cleanup`)
    
    return { 
      success: true, 
      deletedUser: {
        name: userData.name,
        email: userEmail,
        role: userData.role,
        uid: userId
      },
      warning: "Firebase Authentication account still exists. User won't be able to access the system but the auth account remains active."
    }
  } catch (error) {
    console.error("Error deleting user by ID:", error)
    throw error
  }
}

  // Find user by different ID types (studentId, teacherId, employeeId, adminId)
  async function findUserByIdField(idValue) {
    if (!currentUser) {
      throw new Error("No authenticated user")
    }

    if (!currentUserData || (currentUserData.role !== 'admin' && currentUserData.accessLevel !== 'super'  && currentUserData.role !== 'registrar')) {
      throw new Error("Insufficient permissions to search users")
    }

    try {
      const usersRef = collection(db, "users")
      
      // Try different ID fields based on the user's role pattern
      const idFields = ['studentId', 'teacherId', 'employeeId', 'adminId', 'uid']
      
      for (const field of idFields) {
        const q = query(usersRef, where(field, "==", idValue))
        const querySnapshot = await getDocs(q)
        
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0]
          return {
            uid: userDoc.id,
            ...userDoc.data()
          }
        }
      }
      
      return null
    } catch (error) {
      console.error("Error finding user by ID:", error)
      throw error
    }
  }

  // Get current user data from Firestore
  async function getCurrentUserData() {
    if (!currentUser) return null
    
    try {
      const userDoc = await getDoc(doc(db, "users", currentUser.uid))
      if (userDoc.exists()) {
        const userData = userDoc.data()
        // Update the currentUserData state
        setCurrentUserData(userData)
        return userData
      }
      return null
    } catch (error) {
      console.error("Error fetching user data:", error)
      return null
    }
  }

  // Update user profile
  async function updateUserProfile(userData) {
    if (!currentUser) throw new Error("No authenticated user")
    
    try {
      await updateDoc(doc(db, "users", currentUser.uid), userData)
      // Update the currentUserData state with the new data
      setCurrentUserData(prev => ({ ...prev, ...userData }))
      return true
    } catch (error) {
      console.error("Error updating user profile:", error)
      throw error
    }
  }

  // Fetch user data whenever currentUser changes
  useEffect(() => {
    const fetchUserData = async () => {
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid))
          if (userDoc.exists()) {
            const userData = userDoc.data()
            setCurrentUserData(userData)
            setUserRole(userData.role)
          } else {
            setCurrentUserData(null)
            setUserRole(null)
          }
        } catch (error) {
          console.error("Error fetching user data:", error)
          setCurrentUserData(null)
          setUserRole(null)
        }
      } else {
        setCurrentUserData(null)
        setUserRole(null)
      }
    }

    fetchUserData()
  }, [currentUser])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true)
      
      if (user) {
        setCurrentUser(user)
        
        try {
          // Get user data from Firestore
          const userDoc = await getDoc(doc(db, "users", user.uid))
          if (userDoc.exists()) {
            const userData = userDoc.data()
            setUserRole(userData.role)
            setCurrentUserData(userData)
          } else {
            setUserRole(null)
            setCurrentUserData(null)
          }
        } catch (error) {
          console.error("Error fetching user data:", error)
          setUserRole(null)
          setCurrentUserData(null)
        }
      } else {
        setCurrentUser(null)
        setUserRole(null)
        setCurrentUserData(null)
      }

      setLoading(false)
      setAuthReady(true)
    })

    return unsubscribe
  }, [auth])

  const value = {
    currentUser,
    currentUserData,
    userRole,
    loading,
    authReady,
    register,
    createAuthAccountWithoutSignIn,
    login,
    logout,
    reauthenticate,
    updatePassword,
    deleteAccount,
    deleteUserById,
    findUserByIdField,
    getCurrentUserData,
    updateUserProfile
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}