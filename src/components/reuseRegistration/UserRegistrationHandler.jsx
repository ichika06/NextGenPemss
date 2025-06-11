/**
 * Manages user registration process including generating strong passwords, sending welcome emails,
 * registering users, handling NFC completion and skipping steps.
 * @returns {{
 *  loading: boolean,
 *  error: string,
 *  emailStatus: string,
 *  registrationStep: string,
 *  newUserId: string | null,
 *  generatedPassword: string,
 *  generateStrongPassword: Function,
 *  registerUser: Function,
 *  handleNfcComplete: Function,
 *  handleNfcSkip: Function
 * }} Object containing functions and states related to user registration.
 */
import { useState } from "react";
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import UserDataService from "./UserDataService";
import UserStorageService from "./UserStorageService";
import { sendEmail, EmailTemplates } from "../../sendEmail";

const UserRegistrationHandler = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailStatus, setEmailStatus] = useState("");
  const [registrationStep, setRegistrationStep] = useState("form");
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [newUserId, setNewUserId] = useState(null);

  // Generate a strong random password
  const generateStrongPassword = (length = 15) => {
    const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // Removed confusing chars I, O
    const lowercase = "abcdefghijkmnopqrstuvwxyz"; // Removed confusing chars l
    const numbers = "23456789"; // Removed confusing chars 0, 1
    const symbols = "!@#$%^&*_-+=";

    const allChars = uppercase + lowercase + numbers + symbols;
    let password = "";

    // Ensure at least one of each character type
    password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
    password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
    password += numbers.charAt(Math.floor(Math.random() * numbers.length));
    password += symbols.charAt(Math.floor(Math.random() * symbols.length));

    // Fill the rest with random characters
    for (let i = 4; i < length; i++) {
      password += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }

    // Shuffle the password
    return password
      .split("")
      .sort(() => 0.5 - Math.random())
      .join("");
  };

  // Send welcome email to the user
const sendWelcomeEmail = async (userData) => {
  try {
    setEmailStatus("Sending welcome email...");

    // Base email data
    const emailData = {
      email: userData.email,
      fullName: userData.name,
      username: userData.email, // Using email as username
      password: userData.generatedPassword, // Use the generated password
      academic_term: "Current Term",
      ...userData,
    };

    // Select appropriate email template based on user role
    let emailTemplate = EmailTemplates.WELCOME_EMAIL;
    
    // Customize email data based on role
    switch (userData.role) {
      case "student":
        // For students, ensure we have the right data format
        const nameParts = userData.name.split(" ");
        emailData.firstName = nameParts[0] || "";
        emailData.lastName =
          nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
        emailData.middleName =
          nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "";
        emailData.course = userData.course;
        emailData.section = userData.section;
        emailData.studentId = userData.studentId;
        break;
        
      case "teacher":
        // Teacher-specific data
        emailData.department = userData.department;
        emailData.position = userData.position;
        emailData.teacherId = userData.teacherId;
        emailTemplate = EmailTemplates.TEACHER_WELCOME;
        break;
        
      case "admin":
        // Admin-specific data
        emailData.accessLevel = userData.accessLevel;
        emailData.adminId = userData.adminId;
        emailTemplate = EmailTemplates.ADMIN_WELCOME;
        break;
        
      case "registrar":
        // Registrar-specific data
        emailData.office = userData.office;
        emailData.employeeId = userData.employeeId;
        emailTemplate = EmailTemplates.REGISTRAR_WELCOME;
        break;
        
      default:
        // Use default welcome email
        break;
    }

    console.log(`Sending ${userData.role} welcome email with template: ${emailTemplate}`);

    // Use the appropriate email template
    await sendEmail({
      template: emailTemplate,
      data: emailData,
      onProgress: (progress) => {
        setEmailStatus(`Email ${progress.status}...`);
      },
      onError: (error) => {
        setEmailStatus(`Email error: ${error.error}`);
        setError(`Failed to send welcome email: ${error.error}`);
      },
    });

    setEmailStatus("Email sent successfully!");
    return true;
  } catch (error) {
    console.error("Error sending welcome email:", error);
    setEmailStatus(`Failed to send email: ${error.message}`);
    setError(`Failed to send welcome email: ${error.message}`);
    return false;
  }
};

  // Complete user registration process
  const registerUser = async (userData) => {
    const { email, password, name, role, profileImage, ...additionalData } = userData;
    
    try {
      setError("");
      setLoading(true);
      setRegistrationStep("saving");
      
      // Use the provided password or generate a new one
      const passwordToUse = password || generateStrongPassword();
      setGeneratedPassword(passwordToUse);

      // STEP 1: Save user data to Firestore (without authentication)
      const { documentId: pendingDocId } = await UserDataService.registerPendingUser(
        email,
        passwordToUse, // Use the password
        role,
        name,
        {
          ...additionalData,
          generatedPassword: passwordToUse, // Store for later use
        }
      );

      // STEP 2: Create authentication account without signing in
      try {
        // Create a secondary auth instance for the new user
        const secondaryAuth = getAuth();
        
        // Create the auth account
        const userCredential = await createUserWithEmailAndPassword(
          secondaryAuth, 
          email, 
          passwordToUse // Use the password
        );
        
        const newUser = userCredential.user;
        const uid = newUser.uid;
        
        // STEP 3: Create permanent user document
        await UserDataService.createUserDocument(
          uid,
          pendingDocId,
          {
            ...additionalData,
            name,
            generatedPassword: passwordToUse // Store the generated password
          }
        );
        
        // STEP 4: Create user's storage structure
        await UserStorageService.createUserStorageFolders(uid, role);
        
        // STEP 5: Upload profile image if provided
        let profileImagePath = null;
        if (profileImage) {
          const imageUploadResult = await UserStorageService.uploadProfileImage(uid, profileImage);
          profileImagePath = imageUploadResult.url;
          
          // Update user document with profile image URL
          await UserDataService.updateUserProfile(uid, {
            profileImage: profileImagePath
          });
        }
        
        // Sign out from secondary auth instance immediately to avoid affecting current session
        await secondaryAuth.signOut();
        
        // Save the newly created user's ID for NFC setup
        setNewUserId(uid);
        
        // STEP 6: Send welcome email with account details
        await sendWelcomeEmail({
          email,
          name,
          role,
          ...additionalData,
          uid,
          profileImage: profileImagePath,
          generatedPassword: passwordToUse // Make sure we're passing the password
        });
        
        // Registration complete
        setRegistrationStep("complete");
        
        // After a brief delay, move to NFC setup if needed
        setTimeout(() => {
          setRegistrationStep("nfc-setup");
        }, 1500);
        
        return {
          success: true,
          userId: uid
        };
      } catch (error) {
        setError(
          "Failed to create authentication: " +
            (error.message || "Unknown error")
        );
        setRegistrationStep("form");
        throw error;
      }
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        setError("The user is already registered");
      } else {
        setError(
          "Failed to create an account: " + (error.message || "Unknown error")
        );
      }
      console.error(error);
      setRegistrationStep("form");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Helper function to handle NFC setup completion
  const handleNfcComplete = (userId) => {
    // Reset form and show success message
    setRegistrationStep("form");
    setNewUserId(null);
    // Additional handling as needed
  };

  // Helper function to skip NFC setup
  const handleNfcSkip = (userId) => {
    // Reset form
    setRegistrationStep("form");
    setNewUserId(null);
    // Additional handling as needed
  };
  
  return {
    loading,
    error,
    emailStatus,
    registrationStep,
    newUserId,
    generatedPassword,
    generateStrongPassword,
    registerUser,
    handleNfcComplete,
    handleNfcSkip
  };
};

export default UserRegistrationHandler;