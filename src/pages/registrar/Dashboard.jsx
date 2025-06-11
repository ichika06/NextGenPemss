/**
 * Component for the Registrar Dashboard that displays various statistics and actions for the registrar.
 * @returns JSX element containing the registrar dashboard layout and functionality.
 */
import { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { collection, getDocs, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/config";
import Sidebar from "../../components/Sidebar";
import EventCard from "../../components/EventCard";
import {
  Calendar,
  CheckCircle,
  Clock,
  Loader2,
  PlusCircle,
  ArrowRight,
  FileText,
  User,
  Users,
  FolderOpen,
  LayoutDashboard,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

// Registrar sub-pages
import RegistrarCreateEvent from "../CreateEvent";
import RegistrarRegisterUsers from "../Register";
import FileManager from "../Filemanager";
import EventDetails from "../PublicEventView";
import RegistrarManageEvents from "../MangeEvent";
import NFCCardSetupComponent from "../NFCWritter";
import EditEvent from "../EditEvent";
import ManageAttendees from "../MangeEvent";
import RegistrarNotifications from "../Notification";
import RegistrarProfile from "../Profile";
import RegistrarSettings from "../Settings";
import ShowAlluser from "../ShowAllusers";
import CertificateBuilder from "../GenerateCertificateBuilder";
import WifiConfig from "../WifiConfig";
import DeleteAccount from "../DeleteAccount";

import SendNotifications from "../NotificationSendnotif";
import PublicCalendar from "../PublicEventCalendar";
import ShowAllUser from "../ShowAllusers";
import NfcWriter from "../NFCWritter";

import Query from "./QueryRegister";

export default function RegistrarDashboard() {
  const { currentUser, userRole, currentUserData } = useAuth();
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState({
    totalEvents: 0,
    pendingEvents: 0,
    completedEvents: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    let unsubscribeRecentEvents;
    let unsubscribeStats;

    const fetchDashboardData = () => {
      try {
        // Fetch recent events in real time
        unsubscribeRecentEvents = onSnapshot(
          query(
            collection(db, "events"),
            orderBy("date", "desc"),
            limit(3)
          ),
          (eventsSnapshot) => {
            const eventsData = eventsSnapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
            setEvents(eventsData);
          }
        );

        // Fetch stats in real time
        unsubscribeStats = onSnapshot(collection(db, "events"), (allEventsSnapshot) => {
          const now = new Date();
          let pendingCount = 0;
          let completedCount = 0;

          allEventsSnapshot.docs.forEach((doc) => {
            const eventDate = new Date(doc.data().date);
            if (eventDate >= now) {
              pendingCount++;
            } else {
              completedCount++;
            }
          });

          setStats({
            totalEvents: allEventsSnapshot.size,
            pendingEvents: pendingCount,
            completedEvents: completedCount,
          });
        });

        setLoading(false);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        setLoading(false);
      }
    };

    fetchDashboardData();

    // Cleanup listeners on component unmount
    return () => {
      if (unsubscribeRecentEvents) {
        unsubscribeRecentEvents();
      }
      if (unsubscribeStats) {
        unsubscribeStats();
      }
    };
  }, []);


  // Main dashboard content
  const DashboardHome = () => (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center space-x-3">
          <LayoutDashboard className="h-6 w-6 text-indigo-600" />
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            Registrar Dashboard
          </h1>
        </div>
        <div className="mt-4 sm:mt-0 sm:mr-11">
          <Link
            to={`/${userRole}/create-event`}
            className=" btn-primary inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            <PlusCircle className="h-4 w-4 mr-2" /> Create New Event
          </Link>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition-all hover:shadow-md">
          <div className="flex items-center">
            <div className="rounded-full bg-indigo-100 p-3 mr-4">
              <Calendar className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Events</p>
              <p className="text-2xl font-bold text-gray-800">
                {stats.totalEvents}
              </p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <Link
              to={`/${userRole}/manage-events`}
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center"
            >
              Manage own events <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition-all hover:shadow-md">
          <div className="flex items-center">
            <div className="rounded-full bg-amber-100 p-3 mr-4">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Events</p>
              <p className="text-2xl font-bold text-gray-800">
                {stats.pendingEvents}
              </p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <Link
              to={`/${userRole}/manage-events`}
              className="text-sm text-amber-600 hover:text-amber-800 font-medium flex items-center"
            >
              View pending events <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition-all hover:shadow-md">
          <div className="flex items-center">
            <div className="rounded-full bg-green-100 p-3 mr-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Completed Events</p>
              <p className="text-2xl font-bold text-gray-800">
                {stats.completedEvents}
              </p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <Link
              to="/registrar/manage-events"
              className="text-sm text-green-600 hover:text-green-800 font-medium flex items-center"
            >
              View completed events <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
        </div>
      </div>

      {/* Recent events */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-800">Recent Events</h2>
          <Link
            to={`/${userRole}/events`}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            View all
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
            <span className="ml-2 text-gray-600">Loading events...</span>
          </div>
        ) : events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-800 mb-2">
              No events found
            </h3>
            <p className="text-gray-500 mb-6 max-w-md">
              You haven't created any events yet. Create your first event to get
              started.
            </p>
            <Link
              to={`/${userRole}/create-event`}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
            >
              <PlusCircle className="h-4 w-4 mr-2" /> Create New Event
            </Link>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to={`/${userRole}/add-user`}
            className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <User className="h-8 w-8 text-indigo-500 mb-2" />
            <span className="text-sm font-medium text-gray-700">Add User</span>
          </Link>

          <Link
            to={`/${userRole}/file-manager`}
            className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <FolderOpen className="h-8 w-8 text-indigo-500 mb-2" />
            <span className="text-sm font-medium text-gray-700">
              File Manager
            </span>
          </Link>

          <Link
            to={`/${userRole}/nfc-card-setup`}
            className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Users className="h-8 w-8 text-indigo-500 mb-2" />
            <span className="text-sm font-medium text-gray-700">
              NFC Registration
            </span>
          </Link>

          <Link
            to={`/${userRole}/manage-events`}
            className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <FileText className="h-8 w-8 text-indigo-500 mb-2" />
            <span className="text-sm font-medium text-gray-700">
              Manage Events
            </span>
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        role="registrar"
        isOpen={isMobileMenuOpen}
        setIsOpen={setIsMobileMenuOpen}
      />

      <div className="flex-1 overflow-auto lg:ml-64">
        <Routes>
          <Route path="/" element={<DashboardHome />} />
          <Route path="/nfc-card-setup" element={<NFCCardSetupComponent />} />
          <Route path="/events/:eventId" element={<EventDetails />} />
          <Route path="/add-user" element={<RegistrarRegisterUsers />} />
          <Route path="/manage-events" element={<RegistrarManageEvents />} />
          <Route path="/create-event" element={<RegistrarCreateEvent />} />
          <Route path="/edit-event/:eventId" element={<EditEvent />} />
          <Route path="/attendees/:eventId" element={<ManageAttendees />} />
          <Route path="/certificate-builder" element={<CertificateBuilder />} />
          <Route path="/file-manager" element={<FileManager />} />
          <Route path="/notifications" element={<RegistrarNotifications />} />
          <Route path="/profile" element={<RegistrarProfile />} />
          <Route path="/showallusers" element={<ShowAlluser />} />
          <Route path="/settings" element={<RegistrarSettings />} />
          <Route path="/query" element={<Query />} />
          <Route path="/notification-send-notif" element={<SendNotifications />} />
          <Route path="/public-event-calendar" element={<PublicCalendar />} />
          <Route path="/showallusers" element={<ShowAllUser />} />
          <Route path="/nfc-card-setup" element={<NfcWriter />} />
          <Route path="/wificonfig" element={<WifiConfig />} />
          <Route path="/delete-users" element={<DeleteAccount />} />
        </Routes>
      </div>
    </div>
  );
}