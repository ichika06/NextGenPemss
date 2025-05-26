/**
 * Component for managing and updating user settings including account, event, and security settings.
 * @returns JSX element containing the settings form and related functionality.
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
  addDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import {
  Settings as SettingsIcon,
  AlertCircle,
  CheckCircle,
  Save,
  RefreshCw,
} from "lucide-react";
import { LoadingAnimation } from "../components/LoadingAnimation";
import UninstallInfo from '../components/UninstallInfo';

export default function RegistrarSettings() {
  const [settings, setSettings] = useState({
    accountSettings: {
      defaultLandingPage: "dashboard",
      showEventReminders: true,
      dataExportFormat: "csv",
    },
    eventSettings: {
      defaultEventDuration: 2,
      requireAttendeeApproval: true,
      autoGenerateCertificates: false,
      sendEventEmails: true,
    },
    securitySettings: {
      twoFactorAuth: false,
      sessionTimeout: 30,
      ipRestriction: false,
    },
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });
  const { currentUser, currentUserData } = useAuth();

  // Check if the current user has access to event settings
  const hasEventSettingsAccess = currentUserData?.role === "admin" || currentUserData?.role === "registrar";

  useEffect(() => {
    async function fetchSettings() {
      try {
        const settingsQuery = query(
          collection(db, "settings"),
          where("userId", "==", currentUser.uid)
        );

        const snapshot = await getDocs(settingsQuery);

        if (!snapshot.empty) {
          const settingsData = snapshot.docs[0].data();
          setSettings({
            accountSettings:
              settingsData.accountSettings || settings.accountSettings,
            eventSettings: settingsData.eventSettings || settings.eventSettings,
            securitySettings:
              settingsData.securitySettings || settings.securitySettings,
          });
        }

        setLoading(false);
      } catch (error) {
        console.error("Error fetching settings:", error);
        setLoading(false);
      }
    }

    fetchSettings();
  }, [currentUser]);

  const handleChange = (section, field, value) => {
    setSettings({
      ...settings,
      [section]: {
        ...settings[section],
        [field]: value,
      },
    });
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    setMessage({ type: "", text: "" });

    try {
      const settingsQuery = query(
        collection(db, "settings"),
        where("userId", "==", currentUser.uid)
      );

      const snapshot = await getDocs(settingsQuery);

      if (!snapshot.empty) {
        // Update existing settings
        const settingsDoc = snapshot.docs[0];
        await updateDoc(doc(db, "settings", settingsDoc.id), settings);
      } else {
        // Create new settings
        await addDoc(collection(db, "settings"), {
          userId: currentUser.uid,
          ...settings,
        });
      }

      setMessage({ type: "success", text: "Settings saved successfully" });
    } catch (error) {
      console.error("Error saving settings:", error);
      setMessage({ type: "error", text: "Failed to save settings" });
    }
  };

  // Function to get landing page options based on user role
  const getLandingPageOptions = () => {
    // Default options for all roles
    const defaultOptions = [
      { value: "/", label: "Dashboard" },
    ];

    // Role-specific options
    if (currentUserData.role === "admin") {
      return [
        ...defaultOptions,
        { value: "events", label: "Events" },
        { value: "file-manager", label: "File Manager" },
        { value: "users", label: "User Management" },
        { value: "reports", label: "Reports" },
      ];
    } else if (currentUserData.role === "registrar") {
      return [
        ...defaultOptions,
        { value: "events", label: "Events" },
        { value: "file-manager", label: "File Manager" },
        { value: "registration", label: "Registration" },
      ];
    } else if (currentUserData.role === "teacher") {
      return [
        ...defaultOptions,
        { value: "events", label: "Events" },
        { value: "courses", label: "Courses" },
        { value: "grades", label: "Grades" },
      ];
    } else if (currentUserData.role === "student") {
      return [
        ...defaultOptions,
        { value: "events", label: "Events" },
        { value: "event-attendance", label: "Event Attendance" },
        { value: "upcoming-attendance", label: "Class Attendance" },
        { value: "notifications", label: "Notification" },
      ];
    }

    // Fallback options if role not specified
    return [
      ...defaultOptions,
      { value: "events", label: "Events" },
      { value: "file-manager", label: "File Manager" },
    ];
  };

  // Get landing page options based on user role
  const landingPageOptions = getLandingPageOptions();

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center mb-6">
        <SettingsIcon className="h-6 w-6 text-indigo-600 mr-3" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
          Settings
        </h1>
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
        <form onSubmit={saveSettings} className="space-y-6">
          {/* Account Settings */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-medium text-gray-800">
                Account Settings
              </h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Landing Page
                  </label>
                  <select
                    value={settings.accountSettings.defaultLandingPage}
                    onChange={(e) =>
                      handleChange(
                        "accountSettings",
                        "defaultLandingPage",
                        e.target.value
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                  >
                    {landingPageOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Export Format
                  </label>
                  <select
                    value={settings.accountSettings.dataExportFormat}
                    onChange={(e) =>
                      handleChange(
                        "accountSettings",
                        "dataExportFormat",
                        e.target.value
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                  >
                    <option value="csv">CSV</option>
                    <option value="xlsx">Excel (XLSX)</option>
                    <option value="pdf">PDF</option>
                    <option value="json">JSON</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="showEventReminders"
                  checked={settings.accountSettings.showEventReminders}
                  onChange={(e) =>
                    handleChange(
                      "accountSettings",
                      "showEventReminders",
                      e.target.checked
                    )
                  }
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <label
                  htmlFor="showEventReminders"
                  className="ml-2 block text-sm text-gray-700"
                >
                  Show event reminders and notifications on dashboard
                </label>
              </div>
            </div>
          </div>

          {/* Event Settings - Only shown to registrar and admin */}
          {hasEventSettingsAccess && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-medium text-gray-800">
                  Event Settings
                </h2>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Event Duration (hours)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={settings.eventSettings.defaultEventDuration}
                      onChange={(e) =>
                        handleChange(
                          "eventSettings",
                          "defaultEventDuration",
                          parseInt(e.target.value)
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="requireAttendeeApproval"
                      checked={settings.eventSettings.requireAttendeeApproval}
                      onChange={(e) =>
                        handleChange(
                          "eventSettings",
                          "requireAttendeeApproval",
                          e.target.checked
                        )
                      }
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <label
                      htmlFor="requireAttendeeApproval"
                      className="ml-2 block text-sm text-gray-700"
                    >
                      Require manual approval of attendee registrations
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="autoGenerateCertificates"
                      checked={settings.eventSettings.autoGenerateCertificates}
                      onChange={(e) =>
                        handleChange(
                          "eventSettings",
                          "autoGenerateCertificates",
                          e.target.checked
                        )
                      }
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <label
                      htmlFor="autoGenerateCertificates"
                      className="ml-2 block text-sm text-gray-700"
                    >
                      Automatically generate certificates for attendees
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="sendEventEmails"
                      checked={settings.eventSettings.sendEventEmails}
                      onChange={(e) =>
                        handleChange(
                          "eventSettings",
                          "sendEventEmails",
                          e.target.checked
                        )
                      }
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <label
                      htmlFor="sendEventEmails"
                      className="ml-2 block text-sm text-gray-700"
                    >
                      Send automated email notifications for events
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Security Settings */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-medium text-gray-800">
                Security Settings
              </h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Session Timeout (minutes)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="120"
                    value={settings.securitySettings.sessionTimeout}
                    onChange={(e) =>
                      handleChange(
                        "securitySettings",
                        "sessionTimeout",
                        parseInt(e.target.value)
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="twoFactorAuth"
                    checked={settings.securitySettings.twoFactorAuth}
                    onChange={(e) =>
                      handleChange(
                        "securitySettings",
                        "twoFactorAuth",
                        e.target.checked
                      )
                    }
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <label
                    htmlFor="twoFactorAuth"
                    className="ml-2 block text-sm text-gray-700"
                  >
                    Enable two-factor authentication
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="ipRestriction"
                    checked={settings.securitySettings.ipRestriction}
                    onChange={(e) =>
                      handleChange(
                        "securitySettings",
                        "ipRestriction",
                        e.target.checked
                      )
                    }
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <label
                    htmlFor="ipRestriction"
                    className="ml-2 block text-sm text-gray-700"
                  >
                    Restrict access to trusted IP addresses only
                  </label>
                </div>
              </div>
            </div>
          </div>

          <UninstallInfo />

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 btn-primary rounded transition-colors text-sm font-medium"
            >
              <Save className="h-4 w-4 mr-2" /> Save Settings
            </button>
          </div>
        </form>
      )}
    </div>
  );
}