/**
 * Functional component for user registration form.
 * Manages user input states, form submission, and rendering based on registration step.
 * @returns JSX element containing the user registration form.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import UserRegistrationHandler from "../components/reuseRegistration/UserRegistrationHandler";
import NFCWriter from "../pages/NFCWritter";
import {
  UserPlus,
  Mail,
  Lock,
  User,
  UserCheck,
  CreditCard,
  BookOpen,
  Users,
  Building,
  Briefcase,
  UserRoundPlus,
  Shield,
  Home,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import Default_profile from '../assets/Default_Profile.jpg';
import { Grid } from "ldrs/react";
import 'ldrs/react/Grid.css';

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("student");
  const [profileImage, setProfileImage] = useState(null);
  const [profileImageURL, setProfileImageURL] = useState("");
  const { currentUser } = useAuth();

  // Role-specific fields
  const [studentId, setStudentId] = useState("");
  const [section, setSection] = useState("");
  const [course, setCourse] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [office, setOffice] = useState("");
  const [adminId, setAdminId] = useState("");
  const [accessLevel, setAccessLevel] = useState("standard");

  // Initialize the registration handler
  const {
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
  } = UserRegistrationHandler();

  const navigate = useNavigate();

  // Generate a strong password when the component mounts
  useEffect(() => {
    const newPassword = generateStrongPassword();
    setPassword(newPassword);
  }, []);

  // Initialize profile image URL with default profile when component mounts
  useEffect(() => {
    if (!profileImageURL) {
      setProfileImageURL(Default_profile);
    }
  }, []);

  // Function to handle file selection for profile image
  const handleProfileImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfileImage(file);
      const imageURL = URL.createObjectURL(file);
      setProfileImageURL(imageURL);
    } else {
      // If no file is selected or file is cleared, use default profile
      setProfileImage(null);
      setProfileImageURL(Default_profile);
    }
  };

  // Initialize profile image URL with default profile when component mounts
  useEffect(() => {
    if (!profileImageURL) {
      setProfileImageURL(Default_profile);
    }
  }, []);

  // Function to convert default profile image to File object
  const convertDefaultProfileToFile = async () => {
    try {
      const response = await fetch(Default_profile);
      const blob = await response.blob();
      return new File([blob], 'default_profile.jpg', { type: 'image/jpeg' });
    } catch (error) {
      console.error('Error converting default profile to file:', error);
      return null;
    }
  };

  // Get role-specific data based on the selected role
  const getRoleSpecificData = () => {
    switch (role) {
      case "student":
        return { studentId, section, course };
      case "teacher":
        return { teacherId, department, position };
      case "registrar":
        return { employeeId, office };
      case "admin":
        return { adminId, accessLevel };
      default:
        return {};
    }
  };

  // Reset all form fields
  const resetForm = () => {
    setEmail("");
    const newPassword = generateStrongPassword();
    setPassword(newPassword);
    setName("");
    setProfileImage(null);
    setProfileImageURL(Default_profile);
    setStudentId("");
    setSection("");
    setCourse("");
    setTeacherId("");
    setDepartment("");
    setPosition("");
    setEmployeeId("");
    setOffice("");
    setAdminId("");
    setAccessLevel("standard");
  };

  // Handle form submission
  async function handleSubmit(e) {
    e.preventDefault();

    // Handle profile image - use default if none selected
    let finalProfileImage = profileImage;
    let useDefaultProfile = false;

    if (!profileImage) {
      finalProfileImage = await convertDefaultProfileToFile();
      useDefaultProfile = true;
    }

    // Collect all user data
    const userData = {
      email,
      password,
      name,
      role,
      profileImage: finalProfileImage,
      useDefaultProfile: useDefaultProfile,
      addedby: currentUser.email,
      generatedPassword: password,
      ...getRoleSpecificData()
    };

    try {
      await registerUser(userData);
    } catch (error) {
      console.error("Registration failed:", error);
    }
  }

  // Render role-specific fields
  const renderRoleFields = () => {
    switch (role) {
      case "student":
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 dark:text-gray-200 text-sm font-medium mb-2">
                Student ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <CreditCard className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  required
                  className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter student ID"
                />
              </div>
            </div>
            <div>
              <label className="block text-gray-700 dark:text-gray-200 text-sm font-medium mb-2">
                Section
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Users className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  required
                  className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter section"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-gray-700 dark:text-gray-200 text-sm font-medium mb-2">
                Course
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <BookOpen className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  required
                  className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter course"
                />
              </div>
            </div>
          </div>
        );
      case "teacher":
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 dark:text-gray-200 text-sm font-medium mb-2">
                Teacher ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <CreditCard className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  required
                  className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter teacher ID"
                />
              </div>
            </div>
            <div>
              <label className="block text-gray-700 dark:text-gray-200 text-sm font-medium mb-2">
                Department
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  required
                  className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter department"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-gray-700 dark:text-gray-200 text-sm font-medium mb-2">
                Position
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Briefcase className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  required
                  className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter position"
                />
              </div>
            </div>
          </div>
        );
      case "registrar":
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 dark:text-gray-200 text-sm font-medium mb-2">
                Employee ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <CreditCard className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  required
                  className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter employee ID"
                />
              </div>
            </div>
            <div>
              <label className="block text-gray-700 dark:text-gray-200 text-sm font-medium mb-2">
                Office
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Home className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={office}
                  onChange={(e) => setOffice(e.target.value)}
                  required
                  className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter office location"
                />
              </div>
            </div>
          </div>
        );
      case "admin":
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 dark:text-gray-200 text-sm font-medium mb-2">
                Admin ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <CreditCard className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={adminId}
                  onChange={(e) => setAdminId(e.target.value)}
                  required
                  className="pl-10 w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter admin ID"
                />
              </div>
            </div>
            <div>
              <label className="block text-gray-700 dark:text-gray-200 text-sm font-medium mb-2">
                Access Level
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Shield className="h-5 w-5 text-gray-400" />
                </div>
                <select
                  value={accessLevel}
                  onChange={(e) => setAccessLevel(e.target.value)}
                  required
                  className="pl-10 w-full px-4 py-3 border border-gray-300 dark:bg-zinc-800 dark:text-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="standard">Standard</option>
                  <option value="elevated">Elevated</option>
                  <option value="super">Super Admin</option>
                </select>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // Render different content based on registration step
  const renderContent = () => {
    switch (registrationStep) {
      case "nfc-setup":
        return (
          <div className="max-w-md mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-4 dark:text-zinc-100">NFC Setup</h2>
            <p className="text-gray-600 dark:text-zinc-300 mb-6 text-center">
              Please complete NFC setup for the new user
            </p>
            <NFCWriter
              userId={newUserId}
              onComplete={() => handleNfcComplete(newUserId)}
              onSkip={() => handleNfcSkip(newUserId)}
            />
          </div>
        );
      case "saving":
        return (
          <div className="max-w-md mx-auto text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold mb-2 dark:text-zinc-100">Creating Account</h2>
            <p className="text-gray-600 dark:text-zinc-300">{emailStatus || "Processing registration..."}</p>
          </div>
        );
      case "complete":
        return (
          <div className="max-w-md mx-auto text-center py-12">
            <div className="bg-green-100 dark:bg-green-900 rounded-full p-4 inline-block mb-4">
              <UserCheck className="h-12 w-12 text-green-600 dark:text-green-200" />
            </div>
            <h2 className="text-xl font-semibold mb-2 dark:text-zinc-100">Registration Complete!</h2>
            <p className="text-gray-600 dark:text-zinc-300 mb-4">
              User account successfully created. An email has been sent with login instructions.
            </p>
            <p className="text-gray-500 dark:text-zinc-400">
              Preparing NFC setup...
            </p>
          </div>
        );
      case "form":
      default:
        return (
          <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-zinc-800 rounded-lg shadow-md">
            <div className="flex items-center justify-center mb-6">
              <UserPlus className="h-8 w-8 text-indigo-600 mr-2" />
              <h1 className="text-2xl font-bold text-gray-800 dark:text-zinc-100">Register New User</h1>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900 border-l-4 border-red-500 dark:border-red-700 text-red-700 dark:text-red-200">
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-700 dark:text-zinc-200 mb-4">Basic Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 dark:text-zinc-200 text-sm font-medium mb-2">
                      Full Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="pl-10 w-full px-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-zinc-900 dark:text-zinc-100"
                        placeholder="Enter full name"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-700 dark:text-zinc-200 text-sm font-medium mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="pl-10 w-full px-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-zinc-900 dark:text-zinc-100"
                        placeholder="Enter email address"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-700 dark:text-zinc-200 mb-4">Account Type</h2>
                <div>
                  <label className="block text-gray-700 dark:text-zinc-200 text-sm font-medium mb-2">
                    User Role
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div
                      className={`border p-3 rounded-md cursor-pointer transition-all ${
                        role === "student"
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900"
                          : "border-gray-300 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-500"
                      }`}
                      onClick={() => setRole("student")}
                    >
                      <div className="flex flex-col items-center">
                        <BookOpen className="h-6 w-6 mb-2 text-indigo-600" />
                        <span className="dark:text-zinc-100">Student</span>
                      </div>
                    </div>
                    <div
                      className={`border p-3 rounded-md cursor-pointer transition-all ${
                        role === "teacher"
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900"
                          : "border-gray-300 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-500"
                      }`}
                      onClick={() => setRole("teacher")}
                    >
                      <div className="flex flex-col items-center">
                        <Users className="h-6 w-6 mb-2 text-indigo-600" />
                        <span className="dark:text-zinc-100">Teacher</span>
                      </div>
                    </div>
                    <div
                      className={`border p-3 rounded-md cursor-pointer transition-all ${
                        role === "registrar"
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900"
                          : "border-gray-300 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-500"
                      }`}
                      onClick={() => setRole("registrar")}
                    >
                      <div className="flex flex-col items-center">
                        <Briefcase className="h-6 w-6 mb-2 text-indigo-600" />
                        <span className="dark:text-zinc-100">Registrar</span>
                      </div>
                    </div>
                    <div
                      className={`border p-3 rounded-md cursor-pointer transition-all ${
                        role === "admin"
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900"
                          : "border-gray-300 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-500"
                      }`}
                      onClick={() => setRole("admin")}
                    >
                      <div className="flex flex-col items-center">
                        <Shield className="h-6 w-6 mb-2 text-indigo-600" />
                        <span className="dark:text-zinc-100">Admin</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-700 dark:text-zinc-200 mb-4">
                  Role-specific Information
                </h2>
                {renderRoleFields()}
              </div>

              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-700 dark:text-zinc-200 mb-4">
                  Security & Identity
                </h2>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-gray-700 dark:text-zinc-200 text-sm font-medium mb-2">
                      Password (Auto-generated)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="pl-10 w-full px-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-zinc-900 dark:text-zinc-100"
                        placeholder="Password"
                        readOnly
                      />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
                      This password will be emailed to the user
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-700 dark:text-zinc-200 mb-4">
                  Profile Image
                </h2>
                <div className="flex items-center space-x-4">
                  <div className="w-24 h-24 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-full flex items-center justify-center overflow-hidden">
                    {profileImageURL ? (
                      <img
                        src={profileImageURL}
                        alt="Profile Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="h-12 w-12 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <label htmlFor="profile-image" className="inline-block px-4 py-2 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                      Upload Image
                      <input
                        id="profile-image"
                        type="file"
                        accept="image/*"
                        onChange={handleProfileImageChange}
                        className="hidden"
                      />
                    </label>
                    <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
                      Optional. JPG, PNG or GIF, max 5MB.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between mt-8">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3 border border-gray-300 dark:border-zinc-700 rounded-md text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Reset Form
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`px-8 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center ${loading ? "opacity-70 cursor-not-allowed" : ""
                    }`}
                >
                  {loading && (
                    <Grid
                    size="30"
                    speed="1.5"
                    color="white" 
                  />
                  )}
                  Create Account
                </button>
              </div>
            </form>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 py-12 px-4 sm:px-6 lg:px-8">
      {renderContent()}
    </div>
  );
}
