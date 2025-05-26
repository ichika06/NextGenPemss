/**
 * Functional component for displaying and editing user profile information.
 * @returns JSX element containing user profile information and editing functionality.
 */
import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase/config";
import {
  User,
  Edit,
  X,
  Save,
  AlertCircle,
  CheckCircle,
  Lock,
  RefreshCw,
  Briefcase,
  Building,
  BookOpen,
  Users,
  CreditCard,
  GraduationCap,
  School,
} from "lucide-react";
import { LoadingAnimation } from "../components/LoadingAnimation";

export default function UserProfile() {
  const { currentUser, updatePassword, updateEmail, reauthenticate } =
    useAuth();
  const [profile, setProfile] = useState({
    email: currentUser?.email || "",
    name: "",
    phone: "",
    department: "",
    role: "",
    notifications: {
      email: true,
      system: true,
    },
    // Fields for all user types
    studentId: "",
    section: "",
    course: "",
    teacherId: "",
    position: "",
    employeeId: "",
    office: "",
    adminId: "",
    accessLevel: "",
  });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    async function fetchUserProfile() {
      try {
        const userQuery = query(
          collection(db, "users"),
          where("email", "==", currentUser.email)
        );

        const snapshot = await getDocs(userQuery);

        if (!snapshot.empty) {
          const userData = snapshot.docs[0].data();
          setProfile({
            ...profile,
            name: userData.name || "",
            phone: userData.phone || "",
            department: userData.department || "",
            role: userData.role || "",
            notifications: userData.notifications || {
              email: true,
              system: true,
            },
            // Load role-specific fields
            studentId: userData.studentId || "",
            section: userData.section || "",
            course: userData.course || "",
            teacherId: userData.teacherId || "",
            position: userData.position || "",
            employeeId: userData.employeeId || "",
            office: userData.office || "",
            adminId: userData.adminId || "",
            accessLevel: userData.accessLevel || "",
          });
        }

        setLoading(false);
      } catch (error) {
        console.error("Error fetching user profile:", error);
        setLoading(false);
      }
    }

    fetchUserProfile();
  }, [currentUser]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name.startsWith("notifications.")) {
      const notificationType = name.split(".")[1];
      setProfile({
        ...profile,
        notifications: {
          ...profile.notifications,
          [notificationType]: checked,
        },
      });
    } else {
      setProfile({
        ...profile,
        [name]: value,
      });
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    try {
      const userQuery = query(
        collection(db, "users"),
        where("email", "==", currentUser.email)
      );

      const snapshot = await getDocs(userQuery);

      if (!snapshot.empty) {
        const userDoc = snapshot.docs[0];

        // Prepare data object based on user role
        const updateData = {
          name: profile.name,
          phone: profile.phone,
          department: profile.department,
          notifications: profile.notifications,
        };

        // Add role-specific fields
        if (profile.role === "student") {
          updateData.studentId = profile.studentId;
          updateData.section = profile.section;
          updateData.course = profile.course;
        } else if (profile.role === "teacher") {
          updateData.teacherId = profile.teacherId;
          updateData.department = profile.department;
          updateData.position = profile.position;
        } else if (profile.role === "registrar") {
          updateData.employeeId = profile.employeeId;
          updateData.office = profile.office;
        } else if (profile.role === "admin") {
          updateData.adminId = profile.adminId;
          updateData.accessLevel = profile.accessLevel;
        }

        await updateDoc(doc(db, "users", userDoc.id), updateData);

        setMessage({ type: "success", text: "Profile updated successfully" });
        setEditing(false);
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage({ type: "error", text: "Failed to update profile" });
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "New passwords don't match" });
      return;
    }

    try {
      // Reauthenticate user first
      await reauthenticate(oldPassword);
      // Then update password
      await updatePassword(newPassword);

      setMessage({ type: "success", text: "Password changed successfully" });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Error changing password:", error);
      let errorMessage = "Failed to change password";

      if (error.code === "auth/wrong-password") {
        errorMessage = "Current password is incorrect";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "New password is too weak";
      }

      setMessage({ type: "error", text: errorMessage });
    }
  };

  // Render fields specific to the user role
  const renderRoleSpecificFields = () => {
    switch (profile.role) {
      case "student":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Student ID
              </label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="studentId"
                  value={profile.studentId}
                  onChange={handleChange}
                  disabled={!editing}
                  className={`pl-10 w-full px-3 py-2 border rounded-md ${
                    editing
                      ? "border-gray-300 bg-white"
                      : "border-gray-300 bg-gray-50 text-gray-600"
                  }`}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Section
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="section"
                  value={profile.section}
                  onChange={handleChange}
                  disabled={!editing}
                  className={`pl-10 w-full px-3 py-2 border rounded-md ${
                    editing
                      ? "border-gray-300 bg-white"
                      : "border-gray-300 bg-gray-50 text-gray-600"
                  }`}
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Course
              </label>
              <div className="relative">
                <BookOpen className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="course"
                  value={profile.course}
                  onChange={handleChange}
                  disabled={!editing}
                  className={`pl-10 w-full px-3 py-2 border rounded-md ${
                    editing
                      ? "border-gray-300 bg-white"
                      : "border-gray-300 bg-gray-50 text-gray-600"
                  }`}
                />
              </div>
            </div>
          </div>
        );
      case "teacher":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teacher ID
              </label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="teacherId"
                  value={profile.teacherId}
                  onChange={handleChange}
                  disabled={!editing}
                  className={`pl-10 w-full px-3 py-2 border rounded-md ${
                    editing
                      ? "border-gray-300 bg-white"
                      : "border-gray-300 bg-gray-50 text-gray-600"
                  }`}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Position
              </label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="position"
                  value={profile.position}
                  onChange={handleChange}
                  disabled={!editing}
                  className={`pl-10 w-full px-3 py-2 border rounded-md ${
                    editing
                      ? "border-gray-300 bg-white"
                      : "border-gray-300 bg-gray-50 text-gray-600"
                  }`}
                />
              </div>
            </div>
          </div>
        );
      case "registrar":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employee ID
              </label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="employeeId"
                  value={profile.employeeId}
                  onChange={handleChange}
                  disabled={!editing}
                  className={`pl-10 w-full px-3 py-2 border rounded-md ${
                    editing
                      ? "border-gray-300 bg-white"
                      : "border-gray-300 bg-gray-50 text-gray-600"
                  }`}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Office
              </label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="office"
                  value={profile.office}
                  onChange={handleChange}
                  disabled={!editing}
                  className={`pl-10 w-full px-3 py-2 border rounded-md ${
                    editing
                      ? "border-gray-300 bg-white"
                      : "border-gray-300 bg-gray-50 text-gray-600"
                  }`}
                />
              </div>
            </div>
          </div>
        );
      case "admin":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Admin ID
              </label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="adminId"
                  value={profile.adminId}
                  onChange={handleChange}
                  disabled={!editing}
                  className={`pl-10 w-full px-3 py-2 border rounded-md ${
                    editing
                      ? "border-gray-300 bg-white"
                      : "border-gray-300 bg-gray-50 text-gray-600"
                  }`}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Access Level
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="accessLevel"
                  value={profile.accessLevel}
                  onChange={handleChange}
                  disabled={!editing}
                  className={`pl-10 w-full px-3 py-2 border rounded-md ${
                    editing
                      ? "border-gray-300 bg-white"
                      : "border-gray-300 bg-gray-50 text-gray-600"
                  }`}
                />
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // Get icon for current user role
  const getRoleIcon = () => {
    switch (profile.role) {
      case "student":
        return <GraduationCap className="h-6 w-6 text-indigo-600 mr-3" />;
      case "teacher":
        return <School className="h-6 w-6 text-indigo-600 mr-3" />;
      case "registrar":
        return <Briefcase className="h-6 w-6 text-indigo-600 mr-3" />;
      case "admin":
        return <Lock className="h-6 w-6 text-indigo-600 mr-3" />;
      default:
        return <User className="h-6 w-6 text-indigo-600 mr-3" />;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center">
          {getRoleIcon()}
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            Your Profile
          </h1>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 btn-primary rounded transition-colors text-sm font-medium"
          >
            <Edit className="h-4 w-4 mr-2" /> Edit Profile
          </button>
        )}
      </div>

      {message.text && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-start ${
            message.type === "error"
              ? "bg-red-50 text-red-700"
              : "bg-green-50 text-green-700"
          }`}
        >
          {message.type === "error" ? (
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
          ) : (
            <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingAnimation
            type="spinner"
            size="md"
            variant="info"
            text="Loading profile, please wait..."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Information */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-800">
                  Profile Information
                </h2>
                {editing && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setEditing(false)}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <X className="h-4 w-4 mr-1" /> Cancel
                    </button>
                    <button
                      onClick={saveProfile}
                      className="inline-flex items-center px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
                    >
                      <Save className="h-4 w-4 mr-1" /> Save
                    </button>
                  </div>
                )}
              </div>

              <form className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={profile.email}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={profile.name}
                      onChange={handleChange}
                      disabled={!editing}
                      className={`w-full px-3 py-2 border rounded-md ${
                        editing
                          ? "border-gray-300 bg-white"
                          : "border-gray-300 bg-gray-50 text-gray-600"
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={profile.phone}
                      onChange={handleChange}
                      disabled={!editing}
                      className={`w-full px-3 py-2 border rounded-md ${
                        editing
                          ? "border-gray-300 bg-white"
                          : "border-gray-300 bg-gray-50 text-gray-600"
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Department
                    </label>
                    <input
                      type="text"
                      name="department"
                      value={profile.department}
                      onChange={handleChange}
                      disabled={!editing}
                      className={`w-full px-3 py-2 border rounded-md ${
                        editing
                          ? "border-gray-300 bg-white"
                          : "border-gray-300 bg-gray-50 text-gray-600"
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role
                    </label>
                    <input
                      type="text"
                      value={profile.role}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 capitalize"
                    />
                  </div>
                </div>

                {/* Role-specific fields section */}
                {profile.role && (
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-md font-medium text-gray-800 mb-4 capitalize">
                      {profile.role} Information
                    </h3>
                    {renderRoleSpecificFields()}
                  </div>
                )}

                {editing && (
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-md font-medium text-gray-800 mb-4">
                      Notification Preferences
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="notifications.email"
                          name="notifications.email"
                          checked={profile.notifications.email}
                          onChange={handleChange}
                          className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <label
                          htmlFor="notifications.email"
                          className="ml-2 block text-sm text-gray-700"
                        >
                          Receive email notifications
                        </label>
                      </div>

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="notifications.system"
                          name="notifications.system"
                          checked={profile.notifications.system}
                          onChange={handleChange}
                          className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <label
                          htmlFor="notifications.system"
                          className="ml-2 block text-sm text-gray-700"
                        >
                          Receive system notifications
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Password Change */}
          <div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-medium text-gray-800">Security</h2>
              </div>

              <form onSubmit={changePassword} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                    minLength="6"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                    minLength="6"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center items-center px-4 py-2 btn-primary rounded transition-colors text-sm font-medium"
                  >
                    <Lock className="h-4 w-4 mr-2" /> Change Password
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
