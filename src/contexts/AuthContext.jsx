/**
 * Context provider for managing authentication state and actions.
 * @param {{children}} children - The child components to be wrapped by the AuthProvider.
 * @returns The AuthContext Provider component.
 */
import { createContext, useContext, useState, useEffect } from "react"
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth"
import { doc, getDoc, setDoc, collection, addDoc, updateDoc, deleteDoc } from "firebase/firestore"
import { db } from "../firebase/config"

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
    getCurrentUserData,
    updateUserProfile
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}