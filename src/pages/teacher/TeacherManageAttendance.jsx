/**
 * Component for managing attendance sessions created by a teacher.
 * This component allows the teacher to view, edit, and delete attendance sessions they have created.
 * It fetches attendance sessions from Firestore where the teacherUID matches the current user's UID.
 * @returns JSX element containing the interface for managing attendance sessions.
 */
import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
} from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "react-toastify";
import {
  BookOpen,
  Users,
  Edit,
  Trash2,
  AlertCircle,
  Eye,
  Search,
  RefreshCw,
  Filter,
} from "lucide-react";
import { LoadingAnimation } from "../../components/LoadingAnimation";

export default function TeacherManageAttendance() {
  const { currentUser, currentUserData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [attendanceSessions, setAttendanceSessions] = useState([]);
  const [filteredSessions, setFilteredSessions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [editSection, setEditSection] = useState("");
  const [editCourse, setEditCourse] = useState("");
  const [editRoom, setEditRoom] = useState("");

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteSessionId, setDeleteSessionId] = useState(null);

  // Fetch attendance sessions
  const fetchAttendanceSessions = async () => {
    try {
      setLoading(true);
      // Create query to fetch sessions where teacherUID matches current user's UID
      const q = query(
        collection(db, "attendance-sessions"),
        where("teacherUID", "==", currentUser.uid),
        orderBy("dateObject", "desc")
      );

      const querySnapshot = await getDocs(q);
      const sessions = [];

      querySnapshot.forEach((doc) => {
        sessions.push({
          id: doc.id,
          ...doc.data(),
          // Convert dateObject string to Date object if it exists
          dateObject: doc.data().dateObject
            ? new Date(doc.data().dateObject)
            : new Date(),
        });
      });

      setAttendanceSessions(sessions);
      setFilteredSessions(sessions);
    } catch (error) {
      console.error("Error fetching attendance sessions:", error);
      toast.error("Failed to fetch attendance sessions");
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch on component mount
  useEffect(() => {
    if (currentUser?.uid) {
      fetchAttendanceSessions();
    }
  }, [currentUser]);

  // Filter sessions when search term or filter status changes
  useEffect(() => {
    if (attendanceSessions.length) {
      let filtered = [...attendanceSessions];

      // Apply search term filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(
          (session) =>
            session.section?.toLowerCase().includes(term) ||
            session.course?.toLowerCase().includes(term) ||
            session.room?.toLowerCase().includes(term) ||
            session.date?.toLowerCase().includes(term)
        );
      }

      // Apply status filter
      if (filterStatus !== "all") {
        const now = new Date();
        if (filterStatus === "active") {
          filtered = filtered.filter(
            (session) => session.active && new Date(session.expiresAt) > now
          );
        } else if (filterStatus === "expired") {
          filtered = filtered.filter(
            (session) => !session.active || new Date(session.expiresAt) <= now
          );
        }
      }

      setFilteredSessions(filtered);
    }
  }, [searchTerm, filterStatus, attendanceSessions]);

  // Open edit modal with session data
  const handleOpenEditModal = (session) => {
    setEditingSession(session);
    setEditSection(session.section);
    setEditCourse(session.course);
    setEditRoom(session.room);
    setShowEditModal(true);
  };

  // Update attendance session
  const handleUpdateSession = async (e) => {
    e.preventDefault();

    if (!editSection || !editCourse || !editRoom) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      const sessionRef = doc(db, "attendance-sessions", editingSession.id);

      // Update only the fields that can be edited
      await updateDoc(sessionRef, {
        section: editSection,
        course: editCourse,
        room: editRoom,
      });

      // Update local state
      const updatedSessions = attendanceSessions.map((session) => {
        if (session.id === editingSession.id) {
          return {
            ...session,
            section: editSection,
            course: editCourse,
            room: editRoom,
          };
        }
        return session;
      });

      setAttendanceSessions(updatedSessions);
      setShowEditModal(false);
      toast.success("Attendance session updated successfully!");
    } catch (error) {
      console.error("Error updating attendance session:", error);
      toast.error("Failed to update attendance session");
    }
  };

  // Open delete confirmation modal
  const handleOpenDeleteModal = (sessionId) => {
    setDeleteSessionId(sessionId);
    setShowDeleteModal(true);
  };

  // Delete attendance session
  const handleDeleteSession = async () => {
    try {
      await deleteDoc(doc(db, "attendance-sessions", deleteSessionId));

      // Update local state
      const updatedSessions = attendanceSessions.filter(
        (session) => session.id !== deleteSessionId
      );

      setAttendanceSessions(updatedSessions);
      setShowDeleteModal(false);
      toast.success("Attendance session deleted successfully!");
    } catch (error) {
      console.error("Error deleting attendance session:", error);
      toast.error("Failed to delete attendance session");
    }
  };

  // Check if a session is active
  const isSessionActive = (session) => {
    const now = new Date();
    return session.active && new Date(session.expiresAt) > now;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6 flex items-center">
        <Users className="mr-3 h-6 w-6 sm:h-7 sm:w-7 text-primary" />
        Manage Attendance Sessions
      </h1>

      {/* Search and Filter Bar */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Search by section, course, room..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <div className="relative flex-grow sm:flex-grow-0">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Filter className="h-5 w-5 text-gray-400" />
              </div>
              <select
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">All Sessions</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
              </select>
            </div>

            <button
              onClick={fetchAttendanceSessions}
              className="flex items-center justify-center p-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
              title="Refresh"
            >
              <RefreshCw className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Sessions List */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="background-primary px-6 py-4">
          <h2 className="text-primary text-lg font-semibold">
            Your Attendance Sessions
          </h2>
          <p className="text-primary-secondary text-sm">
            {filteredSessions.length}{" "}
            {filteredSessions.length === 1 ? "session" : "sessions"} found
          </p>
        </div>

        <div className="overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="flex items-center justify-center mb-4">
                <LoadingAnimation
                  type="spinner"
                  size="md"
                  variant="info"
                  text="Loading Attendance, please wait..."
                />
              </div>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                No attendance sessions found
              </h3>
              <p className="text-gray-500 mb-6">
                {searchTerm || filterStatus !== "all"
                  ? "Try adjusting your search or filter criteria"
                  : "Create your first attendance session to get started"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Session Details
                    </th>
                    <th
                      scope="col"
                      className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell"
                    >
                      Date & Status
                    </th>
                    <th
                      scope="col"
                      className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell"
                    >
                      Attendance Count
                    </th>
                    <th
                      scope="col"
                      className="px-3 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredSessions.map((session) => (
                    <tr key={session.id} className="hover:bg-gray-50">
                      <td className="px-3 sm:px-6 py-4">
                        <div className="flex items-start">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                            <BookOpen className="h-5 w-5 text-primary" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {session.course}
                            </div>
                            <div className="text-sm text-gray-500">
                              Section: {session.section}
                            </div>
                            <div className="text-sm text-gray-500">
                              Room: {session.room}
                            </div>
                            {/* Show date on mobile */}
                            <div className="text-sm text-gray-500 sm:hidden mt-1">
                              {session.date}
                              <div className="mt-1">
                                {isSessionActive(session) ? (
                                  <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                    Active
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                    Expired
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 hidden sm:table-cell">
                        <div className="text-sm text-gray-900">
                          {session.date}
                        </div>
                        <div className="text-sm text-gray-500">
                          Code:{" "}
                          <span className="font-mono">
                            {session.attendanceCode}
                          </span>
                        </div>
                        <div className="mt-1">
                          {isSessionActive(session) ? (
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Active
                            </span>
                          ) : (
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                              Expired
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 hidden md:table-cell">
                        <div className="text-sm text-gray-900">
                          {session.students?.length || 0} students
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 text-right text-sm font-medium">
                        <div className="flex justify-end space-x-1 sm:space-x-2">
                          <button
                            onClick={() => handleOpenEditModal(session)}
                            className="text-indigo-600 hover:text-indigo-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded-full p-1"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4 sm:h-5 sm:w-5" />
                          </button>
                          <button
                            onClick={() => handleOpenDeleteModal(session.id)}
                            className="text-red-600 hover:text-red-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 rounded-full p-1"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                          </button>
                          <a
                            href={`/${currentUserData.role}/attendance-details/${session.id}`}
                            className="text-purple-600 hover:text-purple-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 rounded-full p-1"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity"
              aria-hidden="true"
            >
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <span
              className="hidden sm:inline-block sm:align-middle sm:h-screen"
              aria-hidden="true"
            >
              &#8203;
            </span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full w-full mx-4">
              <form onSubmit={handleUpdateSession}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-purple-100 sm:mx-0 sm:h-10 sm:w-10">
                      <Edit className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Edit Attendance Session
                      </h3>
                      <div className="mt-4">
                        <div className="mb-4">
                          <label
                            className="block text-gray-700 text-sm font-bold mb-2"
                            htmlFor="editSection"
                          >
                            Section/Class Code
                          </label>
                          <input
                            type="text"
                            id="editSection"
                            className="shadow-sm border border-gray-300 rounded-lg w-full py-2.5 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            value={editSection}
                            onChange={(e) => setEditSection(e.target.value)}
                            required
                          />
                        </div>

                        <div className="mb-4">
                          <label
                            className="block text-gray-700 text-sm font-bold mb-2"
                            htmlFor="editCourse"
                          >
                            Course
                          </label>
                          <input
                            type="text"
                            id="editCourse"
                            className="shadow-sm border border-gray-300 rounded-lg w-full py-2.5 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            value={editCourse}
                            onChange={(e) => setEditCourse(e.target.value)}
                            required
                          />
                        </div>

                        <div className="mb-4">
                          <label
                            className="block text-gray-700 text-sm font-bold mb-2"
                            htmlFor="editRoom"
                          >
                            Room
                          </label>
                          <input
                            type="text"
                            id="editRoom"
                            className="shadow-sm border border-gray-300 rounded-lg w-full py-2.5 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            value={editRoom}
                            onChange={(e) => setEditRoom(e.target.value)}
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-purple-600 text-base font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={() => setShowEditModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity"
              aria-hidden="true"
            >
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <span
              className="hidden sm:inline-block sm:align-middle sm:h-screen"
              aria-hidden="true"
            >
              &#8203;
            </span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full w-full mx-4">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <AlertCircle className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Delete Attendance Session
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to delete this attendance session?
                        This action cannot be undone. All attendance records for
                        this session will be permanently removed.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={handleDeleteSession}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
