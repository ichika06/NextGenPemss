import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import {
  Calendar,
  MapPin,
  Tag,
  Users,
  Search,
  ChevronLeft,
  List,
  BellRing,
  Radio,
  Umbrella,
  Globe,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import CountdownDisplay from "../components/CountingDisplay";

export default function PublicEventsList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredEvents, setFilteredEvents] = useState([]);
  const { currentUser, userRole, currentUserData } = useAuth();

  // Function to determine the dashboard route based on user role
  const getDashboardRoute = () => {
    if (!currentUser) return "/login";
    switch (userRole) {
      case "admin":
        return "/admin";
      case "registrar":
        return "/registrar";
      case "teacher":
        return "/teacher";
      case "student":
        return "/student";
      default:
        return "/events";
    }
  };

  // Function to check if event has expired
  const isEventExpired = (eventDate, eventTime) => {
    const now = new Date();
    const eventDateTime = new Date(`${eventDate} ${eventTime}`);
    return now > eventDateTime;
  };

  // Function to update event status when expired
  const updateEventStatus = async (eventId, isExpired) => {
    if (isExpired) {
      try {
        const eventRef = doc(db, "events", eventId);
        await updateDoc(eventRef, {
          isPublic: false,
          isLive: false,
        });
        console.log(`Event ${eventId} status updated - set to private and not live`);
      } catch (error) {
        console.error("Error updating event status:", error);
      }
    }
  };

  // Function to check if user can see the event
  const canViewEvent = (event) => {
    // Check if event is expired and update its status
    const expired = isEventExpired(event.date, event.time);
    if (expired && (event.isPublic || event.isLive)) {
      updateEventStatus(event.id, true);
      // Update local state immediately for better UX
      event.isPublic = false;
      event.isLive = false;
    }

    // If event is public, everyone can see it
    if (event.isPublic) {
      return true;
    }

    // If event is private and user is not logged in, they can't see it
    if (!currentUser || !currentUserData) {
      return false;
    }

    // If event is private, check if user's branch or organization match
    const userBranch = currentUserData.branch;
    const userOrganization = currentUserData.organization;
    const eventBranch = event.branch;
    const eventOrganization = event.organization;

    // Show event if:
    // 1. Event has no branch/organization restrictions (null/undefined/empty)
    // 2. User's branch matches event's branch (if event has a branch)
    // 3. User's organization matches event's organization (if event has an organization)
    const noBranchRestriction = !eventBranch || eventBranch.trim() === "";
    const noOrgRestriction = !eventOrganization || eventOrganization.trim() === "";
    const branchMatches = eventBranch && userBranch === eventBranch;
    const organizationMatches = eventOrganization && userOrganization === eventOrganization;

    // If event has no restrictions, show it
    if (noBranchRestriction && noOrgRestriction) {
      return true;
    }

    // If event has branch restriction but no org restriction, check branch
    if (!noBranchRestriction && noOrgRestriction) {
      return branchMatches;
    }

    // If event has org restriction but no branch restriction, check org
    if (noBranchRestriction && !noOrgRestriction) {
      return organizationMatches;
    }

    // If event has both restrictions, at least one must match
    if (!noBranchRestriction && !noOrgRestriction) {
      return branchMatches || organizationMatches;
    }

    return false;
  };

  // Callback function for when countdown expires
  const handleCountdownExpire = (eventId) => {
    updateEventStatus(eventId, true);
    
    // Update local state to reflect the change
    setEvents(prevEvents => 
      prevEvents.map(event => 
        event.id === eventId 
          ? { ...event, isPublic: false, isLive: false }
          : event
      )
    );
  };

  useEffect(() => {
    // Get all events (both public and private) and filter them client-side
    const eventsQuery = query(
      collection(db, "events"),
      orderBy("date", "desc")
    );

    // Set up a real-time listener instead of a one-time fetch
    const unsubscribe = onSnapshot(
      eventsQuery,
      (querySnapshot) => {
        const allEventsData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Filter events based on visibility rules
        const visibleEvents = allEventsData.filter(canViewEvent);

        setEvents(visibleEvents);
        setFilteredEvents(visibleEvents);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching events:", error);
        setError("Failed to load events");
        setLoading(false);
      }
    );

    // Clean up the listener when component unmounts
    return () => unsubscribe();
  }, [currentUser, currentUserData]);

  // Filter events based on search term
  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredEvents(events);
    } else {
      const filtered = events.filter(
        (event) =>
          event.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          event.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          event.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          event.category?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredEvents(filtered);
    }
  }, [searchTerm, events]);

  // Loading skeletons
  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex justify-between items-center mb-8">
          <div className="h-10 w-48 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-10 w-64 bg-gray-200 rounded animate-pulse"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white rounded-lg shadow overflow-hidden border border-gray-200"
            >
              <div className="h-48 w-full bg-gray-200 animate-pulse"></div>
              <div className="p-4">
                <div className="h-4 w-24 bg-gray-200 rounded mb-2 animate-pulse"></div>
                <div className="h-6 w-full bg-gray-200 rounded animate-pulse"></div>
                <div className="space-y-2 mt-4">
                  <div className="h-4 w-full bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 w-full bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <div className="mt-4">
                  <div className="h-10 w-32 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-8 rounded-lg flex flex-col items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-12 w-12 mb-4 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 className="text-xl font-semibold mb-2">Error Loading Events</h3>
          <p>{error}</p>
          <button
            className="mt-4 px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50 transition-colors"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex flex-col gap-4 mb-8">
        <div className="flex justify-start">
          {currentUser ? (
            <Link
              to={getDashboardRoute()}
              className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Dashboard
            </Link>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Login
            </Link>
          )}
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center space-x-3">
            <List className="h-6 w-6 text-indigo-600" />
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
              Available Events
            </h1>
          </div>
          <div className="relative w-full md:w-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search events..."
              className="pl-9 w-full md:w-80 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {filteredEvents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event, index) => (
            <div
              key={event.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-indigo-200 group"
              style={{
                animationName: "fadeIn",
                animationDuration: "0.5s",
                animationTimingFunction: "ease",
                animationFillMode: "forwards",
                animationDelay: `${index * 50}ms`,
              }}
            >
              {event.image ? (
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={event.image || "/placeholder.svg"}
                    alt={event.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute bottom-2 left-2 flex flex-row gap-2">
                    {event.isLive && (
                      <div className="bg-red-600 px-2 py-1 rounded-full text-xs font-medium text-white text-center flex items-center gap-1">
                        <Radio className="h-4 w-4" />
                        Live access
                      </div>
                    )}
                    <div className={`px-2 py-1 rounded-full text-xs font-medium text-white text-center flex items-center gap-1 ${
                      event.isPublic ? 'bg-green-600' : 'bg-blue-600'
                    }`}>
                      <Globe className="h-4 w-4" />
                      {event.isPublic ? "Public Event" : "Not accessable by public"}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-48 bg-gray-100 flex items-center justify-center">
                  <Calendar className="h-12 w-12 text-gray-300" />
                </div>
              )}

              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                    <Tag className="h-3 w-3 mr-1" />
                    {event.category?.charAt(0).toUpperCase() +
                      event.category?.slice(1) || "Uncategorized"}
                  </span>

                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${event.attendees >= event.capacity
                      ? "bg-red-100 text-red-800"
                      : event.attendees >= event.capacity * 0.8
                        ? "bg-amber-100 text-amber-800"
                        : "bg-gray-100 text-gray-800"
                      }`}
                  >
                    <Users className="h-3 w-3 mr-1" />
                    {event.attendees || 0}/{event.capacity}
                  </span>
                  <div className="flex items-center justify-between text-xs">
                    <BellRing className="h-3 w-3 mr-1" />
                    <CountdownDisplay
                      eventId={event.id}
                      eventDate={event.date}
                      eventTime={event.time}
                      showSeconds={true}
                      expiredText="Not Available"
                      detailsOnClick={false}
                      onExpire={handleCountdownExpire}
                    />
                  </div>
                </div>

                <h2 className="text-xl font-semibold line-clamp-1 group-hover:text-indigo-600 transition-colors">
                  {event.title}
                </h2>

                <div className="space-y-3 mt-3">
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span>
                      {event.date} at {event.time}
                    </span>
                  </div>

                  <div className="flex items-center text-sm text-gray-600">
                    <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="truncate">{event.location}</span>
                  </div>

                  {/* Show branch and organization info for private events */}
                  {!event.isPublic && (
                    <div className="space-y-1">
                      {event.branch && (
                        <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                          Branch: {event.branch}
                        </div>
                      )}
                      {event.organization && (
                        <div className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">
                          Organization: {event.organization}
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-sm text-gray-600 line-clamp-2 mt-2">
                    {event.description}
                  </p>
                </div>

                <div className="mt-4">
                  <Link to={`/events/${event.id}`} className="w-full block">
                    <button className="w-full btn-primary text-white font-medium py-2 px-4 rounded-md text-sm transition duration-150 ease-in-out">
                      View Details
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="flex flex-col items-center justify-center">
            <Calendar className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Events Found</h3>
            {searchTerm ? (
              <p className="text-gray-600 mb-6">
                No events match your search for "{searchTerm}"
              </p>
            ) : (
              <p className="text-gray-600 mb-6">
                There are no events available for you at the moment
              </p>
            )}
            {searchTerm && (
              <button
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                onClick={() => setSearchTerm("")}
              >
                Clear Search
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}