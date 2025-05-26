import { useState, useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import Sidebar from "../../components/Sidebar";
import { LoadingAnimation } from "../../components/LoadingAnimation";

// Student sub-pages
import StudentNotifications from "../Notification";
import StudentUpcomingAttendance from "./UpcomingAttendance";
import StudentProfile from "../Profile";
import StudentSettings from "../Settings";
import StudentEventsAttendance from "./StudentAttendanceEvent";
import StudentMessage from "../TeacherandStudentMessage";
import PublicCalendar from "../PublicEventCalendar";
import EventPreRegister from "./StudentPreregistedManage";
import EventAttended from "./StudentAttendanceEvent";
/**
 * Student Dashboard Component
 *
 * Displays upcoming events, registered events, and provides functionality for
 * students to view event details and navigate to different sections.
 *
 * @returns {JSX.Element} The Student Dashboard component
 */
export default function StudentDashboard() {
  const { currentUser, currentUserData } = useAuth();
  const navigate = useNavigate();
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [registeredEvents, setRegisteredEvents] = useState([]);
  const [registrationStatus, setRegistrationStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [registeringError, setRegisteringError] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // State for individual section loading status
  const [upcomingEventsLoading, setUpcomingEventsLoading] = useState(true);
  const [registeredEventsLoading, setRegisteredEventsLoading] = useState(true);

  useEffect(() => {
    function fetchDashboardData() {
      if (!currentUser) return;

      // Start loading for each section
      setUpcomingEventsLoading(true);
      setRegisteredEventsLoading(true);

      // Fetch upcoming events - only fetch public events
      const now = new Date().toISOString();
      const eventsQuery = query(
        collection(db, "events"),
        where("date", ">=", now),
        where("isPublic", "==", true),
        orderBy("date", "asc"),
        limit(3)
      );
      const unsubscribeUpcomingEvents = onSnapshot(
        eventsQuery,
        (eventsSnapshot) => {
          const eventsData = eventsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setUpcomingEvents(eventsData);
          setUpcomingEventsLoading(false);
        }
      );

      // Fetch student's registered events from eventAttendees collection
      const registrationsQuery = query(
        collection(db, "eventAttendees"),
        where("email", "==", currentUser.email)
      );
      const unsubscribeRegistrations = onSnapshot(
        registrationsQuery,
        (registrationsSnapshot) => {
          // Create a status object to check if the student is registered for each event
          const statusObj = {};
          registrationsSnapshot.docs.forEach((doc) => {
            statusObj[doc.data().eventId] = true;
          });
          setRegistrationStatus(statusObj);

          // Get event IDs from registrations
          const eventIds = registrationsSnapshot.docs.map(
            (doc) => doc.data().eventId
          );

          if (eventIds.length > 0) {
            // Use an object to track unique events by ID
            const registeredEventsMap = {};
            let completedQueries = 0;

            eventIds.forEach((eventId) => {
              const eventQuery = query(
                collection(db, "events"),
                where("__name__", "==", eventId)
              );
              const unsubscribeEventDoc = onSnapshot(
                eventQuery,
                (eventSnapshot) => {
                  if (!eventSnapshot.empty) {
                    const eventData = eventSnapshot.docs[0].data();
                    // Store in map with ID as key to ensure uniqueness
                    registeredEventsMap[eventId] = {
                      id: eventId,
                      ...eventData,
                    };
                  }

                  // Increment completed queries count
                  completedQueries++;

                  // Only update state when all queries have completed
                  if (completedQueries === eventIds.length) {
                    // Convert map to array for state update
                    const uniqueRegisteredEvents =
                      Object.values(registeredEventsMap);
                    setRegisteredEvents(uniqueRegisteredEvents);
                    setRegisteredEventsLoading(false);
                  }
                }
              );

              // Optional: track unsubscribe for individual event documents
              // Return cleanup if needed for multiple listeners
              return () => unsubscribeEventDoc();
            });
          } else {
            setRegisteredEvents([]);
            setRegisteredEventsLoading(false);
          }
        }
      );

      // Cleanup listeners on unmount
      return () => {
        unsubscribeUpcomingEvents();
        unsubscribeRegistrations();
      };
    }

    const unsubscribeAll = fetchDashboardData();

    return () => {
      unsubscribeAll && unsubscribeAll();
    };
  }, [currentUser]);

  // Modified function to only redirect to event details
  const handleViewEventDetails = (eventId) => {
    if (!currentUser) {
      navigate("/login", { state: { redirectTo: `/events/${eventId}` } });
      return;
    }

    // Redirect to event details page
    navigate(`/events/${eventId}`);
  };

  // Modified EventCard component without direct registration
  const EnhancedEventCard = ({ event, isRegistered = false }) => {
    const eventId = event.id;
    const isFull = event.attendees >= event.capacity;
    const isAlmostFull = event.attendees >= event.capacity * 0.8 && !isFull;

    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 flex flex-col h-full">
        {/* Card Header with Image */}
        <div
          className="h-40 bg-gray-200 relative"
          style={{
            backgroundImage: event.image ? `url(${event.image})` : "none",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* Overlay for text visibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>

          {/* Category and Status Tags */}
          <div className="absolute top-2 left-2 flex flex-wrap gap-1">
            <span className="px-2 py-1 bg-indigo-500/80 text-white text-xs rounded-full backdrop-blur-sm">
              {event.category?.charAt(0).toUpperCase() +
                event.category?.slice(1) || "Event"}
            </span>

            {isFull && (
              <span className="px-2 py-1 bg-red-500/80 text-white text-xs rounded-full backdrop-blur-sm">
                Full
              </span>
            )}

            {isAlmostFull && !isFull && (
              <span className="px-2 py-1 bg-amber-500/80 text-white text-xs rounded-full backdrop-blur-sm">
                Almost Full
              </span>
            )}

            {isRegistered && (
              <span className="px-2 py-1 bg-green-500/80 text-white text-xs rounded-full backdrop-blur-sm">
                Registered
              </span>
            )}

            {!event.isPublic && (
              <span className="px-2 py-1 bg-gray-500/80 text-white text-xs rounded-full backdrop-blur-sm">
                Private
              </span>
            )}
          </div>

          {/* Event Title */}
          <div className="absolute bottom-2 left-3 right-3">
            <h3 className="text-white font-bold text-lg truncate">
              {event.title}
            </h3>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-4 flex-grow flex flex-col">
          <div className="mb-4 space-y-2 flex-grow">
            {/* Date and Location */}
            <div className="flex items-center text-gray-600 text-sm">
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span>{event.date}</span>
            </div>

            <div className="flex items-center text-gray-600 text-sm">
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="truncate">{event.location}</span>
            </div>

            {/* Capacity */}
            <div className="flex items-center text-gray-600 text-sm">
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <span>
                {event.attendees || 0} / {event.capacity}
              </span>
            </div>

            {/* Short description */}
            {event.description && (
              <p className="text-gray-600 text-sm line-clamp-2 mt-2">
                {event.description}
              </p>
            )}
          </div>

          {/* Action Button - Only View Details */}
          <div className="mt-auto">
            <button
              onClick={() => handleViewEventDetails(eventId)}
              className="w-full py-2 px-4 rounded-md text-sm font-medium transition-colors bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isRegistered ? "View Registration" : "View Event Details"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Main dashboard content
  const DashboardHome = () => (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        Student Dashboard
      </h1>

      {registeringError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {registeringError}
        </div>
      )}

      {/* Upcoming events */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            Upcoming Events
          </h2>
          <button
            onClick={() => navigate("/events")}
            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
          >
            View All
          </button>
        </div>

        {upcomingEventsLoading ? (
          <div className="flex justify-center py-8">
            <LoadingAnimation
              type="spinner"
              size="md"
              variant="primary"
              text="Loading upcoming events..."
            />
          </div>
        ) : upcomingEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {upcomingEvents.map((event) => (
              <EnhancedEventCard
                key={event.id}
                event={event}
                isRegistered={registrationStatus[event.id]}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No upcoming events found
          </div>
        )}
      </div>

      {/* Registered events */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            My Registered Events
          </h2>

          <button
            onClick={() =>
              navigate(`/${currentUserData.role}/event-attendance`)
            }
            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
          >
            View All
          </button>
        </div>

        {registeredEventsLoading ? (
          <div className="flex justify-center py-8">
            <LoadingAnimation
              type="spinner"
              size="md"
              variant="primary"
              text="Loading registered events..."
            />
          </div>
        ) : registeredEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {registeredEvents.map((event) => (
              <EnhancedEventCard
                key={event.id}
                event={event}
                isRegistered={true}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            You haven't registered for any events yet
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        role="student"
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      <div className="flex-1 overflow-auto lg:ml-64">
        <Routes>
          <Route path="/" element={<DashboardHome />} />
          <Route path="/notifications" element={<StudentNotifications />} />
          <Route
            path="/upcoming-attendance"
            element={<StudentUpcomingAttendance />}
          />
          <Route path="/profile" element={<StudentProfile />} />
          <Route path="/settings" element={<StudentSettings />} />
          <Route path="/messages" element={<StudentMessage />} />
          <Route path="/public-event-calendar" element={<PublicCalendar />} />
          <Route path="/pre-registered" element={<EventPreRegister />} />
          <Route path="/event-attendance" element={<EventAttended />} />
          
          <Route
            path="/student-event-attendance"
            element={<StudentEventsAttendance />}
          />
        </Routes>
      </div>
    </div>
  );
}
