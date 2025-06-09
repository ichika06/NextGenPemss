/**
 * Represents the Teacher Dashboard component that displays upcoming events and events the teacher is assigned to teach.
 * @returns {JSX.Element} The Teacher Dashboard component.
 */
import { useState, useEffect } from "react"
import { Routes, Route } from "react-router-dom"
import { collection, getDocs, query, orderBy, limit, where } from "firebase/firestore"
import { db } from "../../firebase/config"
import { useAuth } from "../../contexts/AuthContext"
import Sidebar from "../../components/Sidebar"
import EventCard from "../../components/EventCard"
import { LoadingAnimation } from "../../components/LoadingAnimation";

// Teacher sub-pages
import TeacherNotifications from "../Notification"
import TeacherProfile from "../Profile"
import TeacherSettings from "../Settings"
import TeacherCreateAttendance from "./CreateAttendance"
import PublicCalendar from "../PublicEventCalendar";
import ManageAttendance from "./TeacherManageAttendance"
import TeacherMessage from "../TeacherandStudentMessage";

export default function TeacherDashboard() {
  const { currentUser } = useAuth()
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [assignedEvents, setAssignedEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // Fetch upcoming events
        const now = new Date().toISOString()
        const eventsQuery = query(collection(db, "events"), where("date", ">=", now), orderBy("date", "asc"), limit(3))
        const eventsSnapshot = await getDocs(eventsQuery)
        const eventsData = eventsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setUpcomingEvents(eventsData)

        // Fetch events the teacher is assigned to
        if (currentUser) {
          const assignedEventsQuery = query(
            collection(db, "events"),
            where("teacherId", "==", currentUser.uid),
            orderBy("date", "desc"),
          )
          const assignedEventsSnapshot = await getDocs(assignedEventsQuery)
          const assignedEventsData = assignedEventsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          setAssignedEvents(assignedEventsData)
        }

        setLoading(false)
      } catch (error) {
        console.error("Error fetching dashboard data:", error)
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [currentUser])

  // Main dashboard content
  const DashboardHome = () => (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Teacher Dashboard</h1>

      {/* Upcoming events - View only (no registration) */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Upcoming Events</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center">
            <LoadingAnimation
              type="spinner"
              size="md"
              variant="info"
              text="Loading upcoming event, please wait..."
            />
          </div>
        ) : upcomingEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} viewOnly={true} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">No upcoming events found</div>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        role="teacher"
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      <div className={`flex-1 overflow-auto ${window.innerWidth >= 1024 ? 'lg:ml-64' : ''}`}>
        <Routes>
          <Route path="/" element={<DashboardHome />} />
          <Route path="/notifications" element={<TeacherNotifications />} />
          <Route path="/profile" element={<TeacherProfile />} />
          <Route path="/settings" element={<TeacherSettings />} />
          <Route path="/create-attendance" element={<TeacherCreateAttendance />} />
          <Route path="/public-event-calendar" element={<PublicCalendar />} />
          <Route path="/manage-attendance" element={<ManageAttendance />} />
          <Route path="/messages" element={<TeacherMessage />} />
        </Routes>
      </div>
    </div>
  )
}