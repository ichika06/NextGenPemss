/**
 * Represents the Admin Dashboard component that displays various statistics and recent events.
 * @returns {JSX.Element} The JSX element representing the Admin Dashboard.
 */
import { useState, useEffect } from "react"
import { Routes, Route } from "react-router-dom"
import { collection, getDocs, query, orderBy, limit, onSnapshot } from "firebase/firestore"
import { db } from "../../firebase/config"
import Sidebar from "../../components/Sidebar"
import EventCard from "../../components/EventCard"
import { BarChart, Calendar, Users } from "lucide-react"

// Admin sub-pages
// import AdminUsers from "./Users"
import AdminSettings from "../Settings"
import AdminManageEvents from "../MangeEvent";
import AdminNotifications from "../Notification"
import AdminProfile from "../Profile"
import FileManager from "../Filemanager"
import AdminCreateEvent from "../CreateEvent";
import AdminRegisterUsers from "../Register";
import DeleteUserAccount from "../DeleteAccount"

import SendNotifications from "../NotificationSendnotif";
import PublicCalendar from "../PublicEventCalendar";
import ShowAllUser from "../ShowAllusers";
import NfcWriter from "../NFCWritter";
import WifiConfig from "../WifiConfig";
import AdminMessage from "../TeacherandStudentMessage";

export default function AdminDashboard() {
  const [events, setEvents] = useState([])
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalUsers: 0,
    upcomingEvents: 0,
  })
  const [loading, setLoading] = useState(true)
  // Add state for mobile sidebar toggle
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  useEffect(() => {
    function fetchDashboardData() {
      try {
        // Fetch recent events
        const eventsQuery = query(collection(db, "events"), orderBy("createdAt", "desc"), limit(3));
        const unsubscribeEvents = onSnapshot(eventsQuery, (eventsSnapshot) => {
          const eventsData = eventsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setEvents(eventsData);
        });

        // Fetch stats
        const unsubscribeUsers = onSnapshot(collection(db, "users"), (usersSnapshot) => {
          const usersCount = usersSnapshot.size;

          const unsubscribeAllEvents = onSnapshot(collection(db, "events"), (allEventsSnapshot) => {
            const now = new Date();

            // Calculate upcoming events
            const upcomingEventsCount = allEventsSnapshot.docs.filter((doc) => {
              const eventDate = new Date(doc.data().date);
              return eventDate >= now;
            }).length;

            setStats({
              totalEvents: allEventsSnapshot.size,
              totalUsers: usersCount,
              upcomingEvents: upcomingEventsCount,
            });
          });

          // Clean up event listeners
          return () => unsubscribeAllEvents();
        });

        // Clean up listeners for events and users
        return () => {
          unsubscribeEvents();
          unsubscribeUsers();
        };
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    const unsubscribeAll = fetchDashboardData();

    // Clean up listeners on unmount
    return () => unsubscribeAll && unsubscribeAll();
  }, []);


  // Main dashboard content
  const DashboardHome = () => (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-zinc-100 mb-6">Admin Dashboard</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6 flex items-center">
          <div className="rounded-full bg-indigo-100 dark:bg-indigo-900 p-3 mr-4">
            <Calendar className="h-6 w-6 text-indigo-600 dark:text-indigo-300" />
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-zinc-300">Total Events</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-zinc-100">{stats.totalEvents}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6 flex items-center">
          <div className="rounded-full bg-green-100 dark:bg-green-900 p-3 mr-4">
            <Users className="h-6 w-6 text-green-600 dark:text-green-300" />
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-zinc-300">Total Users</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-zinc-100">{stats.totalUsers}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6 flex items-center">
          <div className="rounded-full bg-purple-100 dark:bg-purple-900 p-3 mr-4">
            <BarChart className="h-6 w-6 text-purple-600 dark:text-purple-300" />
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-zinc-300">Upcoming Events</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-zinc-100">{stats.upcomingEvents}</p>
          </div>
        </div>
      </div>

      {/* Recent events */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-zinc-100">Recent Events</h2>
        </div>

        {loading ? (
          <div className="text-center py-8 dark:text-zinc-200">Loading...</div>
        ) : events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-zinc-400">No events found</div>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-zinc-900">
      {/* Pass the sidebar state and setter to the Sidebar component */}
      <Sidebar
        role="admin"
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      <div className="flex-1 overflow-auto lg:ml-64">
        <Routes>
          <Route path="/" element={<DashboardHome />} />
          {/* <Route path="/users" element={<AdminUsers />} />
          <Route path="/events" element={<AdminEvents />} />
           */}
          <Route path="/manage-events" element={<AdminManageEvents />} />
          <Route path="/create-event" element={<AdminCreateEvent />} />
          <Route path="/add-user" element={<AdminRegisterUsers />} />
          <Route path="/file-manager" element={<FileManager />} />
          <Route path="/notifications" element={<AdminNotifications />} />
          <Route path="/profile" element={<AdminProfile />} />
          <Route path="/settings" element={<AdminSettings />} />
          <Route path="/delete-users" element={<DeleteUserAccount />} />
          <Route path="/notification-send-notif" element={<SendNotifications />} />
          <Route path="/public-event-calendar" element={<PublicCalendar />} />
          <Route path="/showallusers" element={<ShowAllUser />} />
          <Route path="/nfc-card-setup" element={<NfcWriter />} />
          <Route path="/wificonfig" element={<WifiConfig />} />
          <Route path="/messages" element={<AdminMessage />} />
        </Routes>
      </div>
    </div>
  )
}