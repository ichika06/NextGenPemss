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
  Filter,
  ChevronDown,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useOptimizedIndexedDBCache } from "../components/useIndexedDBCache"
import CountdownDisplay from "../components/CountingDisplay";
import CachePermissionToast from "../components/CachePermissionToast";

export default function PublicEventsList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [sortBy, setSortBy] = useState("latest");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [dataSource, setDataSource] = useState("network"); // "network", "cache", or "offline"
  const [lastUpdated, setLastUpdated] = useState(null);

  const { currentUser, userRole, currentUserData } = useAuth();
  const { cachePermission, setCachePermissionStatus, fetchWithCache, clearCache, checkCacheStatus } =
    useOptimizedIndexedDBCache()

  // Sort options
  const sortOptions = [
    { value: "latest", label: "Latest Added" },
    { value: "ending-soon", label: "Will start Soon" },
    { value: "oldest", label: "Oldest Added" },
  ];

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
    const eventDateObj = new Date(eventDate);
    const endOfEventDay = new Date(eventDateObj);
    endOfEventDay.setHours(23, 59, 59, 999);
    return now > endOfEventDay;
  };

  // Function to check if event is currently happening
  const isEventCurrentlyLive = (eventDate, eventTime) => {
    const now = new Date();
    const eventStart = new Date(`${eventDate} ${eventTime}`);
    const eventEnd = new Date(eventStart);
    eventEnd.setHours(23, 59, 59, 999);
    return now >= eventStart && now <= eventEnd;
  };

  // Function to get time until event ends
  const getTimeUntilEventEnds = (eventDate, eventTime, duration = 2) => {
    const now = new Date();
    const eventStart = new Date(`${eventDate} ${eventTime}`);
    const eventEnd = new Date(eventStart.getTime() + (duration * 60 * 60 * 1000));
    return eventEnd.getTime() - now.getTime();
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
    const expired = isEventExpired(event.date, event.time);
    if (expired) {
      if (event.isPublic || event.isLive) {
        updateEventStatus(event.id, true);
      }
      return false;
    }

    if (event.isPublic) {
      return true;
    }

    if (!currentUser || !currentUserData) {
      return false;
    }

    const userBranch = currentUserData.branch;
    const userOrganization = currentUserData.organization;
    const eventBranch = event.branch;
    const eventOrganization = event.organization;

    const noBranchRestriction = !eventBranch || eventBranch.trim() === "";
    const noOrgRestriction = !eventOrganization || eventOrganization.trim() === "";
    const branchMatches = eventBranch && userBranch === eventBranch;
    const organizationMatches = eventOrganization && userOrganization === eventOrganization;

    if (noBranchRestriction && noOrgRestriction) {
      return true;
    }

    if (!noBranchRestriction && noOrgRestriction) {
      return branchMatches;
    }

    if (noBranchRestriction && !noOrgRestriction) {
      return organizationMatches;
    }

    if (!noBranchRestriction && !noOrgRestriction) {
      return branchMatches && organizationMatches;
    }

    return false;
  };

  // Helper function to safely convert Firestore timestamp to Date
  const getDateFromTimestamp = (timestamp) => {
    if (!timestamp) return null;

    if (timestamp instanceof Date) {
      return timestamp;
    }

    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }

    if (timestamp && timestamp.seconds) {
      return new Date(timestamp.seconds * 1000);
    }

    if (typeof timestamp === 'string') {
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? null : date;
    }

    if (typeof timestamp === 'number') {
      return new Date(timestamp);
    }

    return null;
  };

  // Function to sort events
  const sortEvents = (eventsToSort, sortType) => {
    const sorted = [...eventsToSort];

    switch (sortType) {
      case "latest":
        return sorted.sort((a, b) => {
          const aDate = getDateFromTimestamp(a.createdAt);
          const bDate = getDateFromTimestamp(b.createdAt);

          if (aDate && bDate) {
            return bDate.getTime() - aDate.getTime();
          }

          if (aDate && !bDate) return -1;
          if (!aDate && bDate) return 1;

          return 0;
        });

      case "oldest":
        return sorted.sort((a, b) => {
          const aDate = getDateFromTimestamp(a.createdAt);
          const bDate = getDateFromTimestamp(b.createdAt);

          if (aDate && bDate) {
            return aDate.getTime() - bDate.getTime();
          }

          if (aDate && !bDate) return -1;
          if (!aDate && bDate) return 1;

          return 0;
        });

      case "currently-live":
        return sorted.sort((a, b) => {
          const aIsLive = isEventCurrentlyLive(a.date, a.time);
          const bIsLive = isEventCurrentlyLive(b.date, b.time);

          if (aIsLive && !bIsLive) return -1;
          if (!aIsLive && bIsLive) return 1;

          const aDate = new Date(`${a.date} ${a.time}`);
          const bDate = new Date(`${b.date} ${b.time}`);
          return aDate - bDate;
        });

      case "ending-soon":
        return sorted.sort((a, b) => {
          const aTimeLeft = getTimeUntilEventEnds(a.date, a.time);
          const bTimeLeft = getTimeUntilEventEnds(b.date, b.time);
          const aIsHappening = isEventCurrentlyLive(a.date, a.time);
          const bIsHappening = isEventCurrentlyLive(b.date, b.time);

          if (aIsHappening && !bIsHappening) return -1;
          if (!aIsHappening && bIsHappening) return 1;

          if (aIsHappening && bIsHappening) {
            return aTimeLeft - bTimeLeft;
          }

          const aDate = new Date(`${a.date} ${a.time}`);
          const bDate = new Date(`${b.date} ${b.time}`);
          return aDate - bDate;
        });

      default:
        return sorted;
    }
  };

  // Callback function for when countdown expires
  const handleCountdownExpire = (eventId) => {
    updateEventStatus(eventId, true);
    setEvents(prevEvents =>
      prevEvents.filter(event => event.id !== eventId)
    );
  };

  // Function to fetch events from Firestore
  const fetchEventsFromFirestore = async () => {
    return new Promise((resolve, reject) => {
      let eventsQuery;

      try {
        eventsQuery = query(
          collection(db, "events"),
          orderBy("createdAt", "desc")
        );
      } catch (error) {
        console.log("createdAt field not available for ordering, using default order");
        eventsQuery = query(collection(db, "events"));
      }

      const unsubscribe = onSnapshot(
        eventsQuery,
        (querySnapshot) => {
          const allEventsData = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          const visibleEvents = allEventsData.filter(canViewEvent);
          resolve(visibleEvents);
          unsubscribe(); // Clean up the listener after getting data
        },
        (error) => {
          console.error("Error fetching events:", error);
          reject(error);
          unsubscribe();
        }
      );
    });
  };

  // Load events with cache strategy
  const loadEvents = async (forceRefresh = false) => {
    setLoading(true);
    setError("");

    try {
      const result = await fetchWithCache(
        fetchEventsFromFirestore,
        {
          forceRefresh,
          saveToCache: true,
          cacheFirst: !forceRefresh
        }
      );

      setEvents(result.data || []);
      setDataSource(result.fromCache ? 'cache' : 'network');
      setLastUpdated(result.lastUpdate);

      if (result.networkError) {
        console.warn('Using cached data due to network error:', result.networkError);
        setDataSource('offline');
      }

    } catch (error) {
      console.error("Error loading events:", error);
      setError("Failed to load events");
      setDataSource('offline');
    } finally {
      setLoading(false);
    }
  };

  // Handle cache permission
  const handleCachePermission = (granted) => {
    setCachePermissionStatus(granted);
    if (granted) {
      // Reload events to populate cache
      loadEvents(false);
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    if (isOnline) {
      loadEvents(true);
    }
  };

  // Handle clear cache
  const handleClearCache = async () => {
    try {
      await clearCache();
      loadEvents(true); // Reload from network
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  };

  // Initial load
  useEffect(() => {
    loadEvents(false);
  }, [currentUser, currentUserData]);

  // Filter and sort events based on search term and sort option
  useEffect(() => {
    let filtered = events;

    if (searchTerm.trim() !== "") {
      filtered = events.filter(
        (event) =>
          event.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          event.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          event.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          event.category?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    const sorted = sortEvents(filtered, sortBy);
    setFilteredEvents(sorted);
  }, [searchTerm, events, sortBy]);

  // Loading skeletons
  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex justify-between items-center mb-8">
          <div className="h-10 w-48 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse"></div>
          <div className="h-10 w-64 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-zinc-800 rounded-lg shadow overflow-hidden border border-gray-200 dark:border-zinc-700"
            >
              <div className="h-48 w-full bg-gray-200 dark:bg-zinc-900 animate-pulse"></div>
              <div className="p-4">
                <div className="h-4 w-24 bg-gray-200 dark:bg-zinc-900 rounded mb-2 animate-pulse"></div>
                <div className="h-6 w-full bg-gray-200 dark:bg-zinc-900 rounded animate-pulse"></div>
                <div className="space-y-2 mt-4">
                  <div className="h-4 w-full bg-gray-200 dark:bg-zinc-900 rounded animate-pulse"></div>
                  <div className="h-4 w-full bg-gray-200 dark:bg-zinc-900 rounded animate-pulse"></div>
                  <div className="h-4 w-3/4 bg-gray-200 dark:bg-zinc-900 rounded animate-pulse"></div>
                </div>
                <div className="mt-4">
                  <div className="h-10 w-32 bg-gray-200 dark:bg-zinc-900 rounded animate-pulse"></div>
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
        <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-6 py-8 rounded-lg flex flex-col items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-12 w-12 mb-4 text-red-500 dark:text-red-200"
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
          <div className="flex space-x-2 mt-4">
            <button
              className="px-4 py-2 border border-red-300 text-red-700 dark:text-red-200 rounded-md hover:bg-red-50 dark:hover:bg-red-800 transition-colors"
              onClick={() => loadEvents(true)}
            >
              Try Again
            </button>
            {cachePermission === 'granted' && (
              <button
                className="px-4 py-2 bg-red-600 dark:bg-red-800 text-white rounded-md hover:bg-red-700 dark:hover:bg-red-900 transition-colors"
                onClick={handleClearCache}
              >
                Clear Cache
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl bg-gray-50 dark:bg-zinc-900 min-h-screen">
      {/* Cache Permission Toast */}
      <CachePermissionToast
        onPermissionSet={handleCachePermission}
        autoShow={true}
        position="top-right"
      />

      <div className="flex flex-col gap-4 mb-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            {currentUser ? (
              <Link
                to={getDashboardRoute()}
                className="inline-flex items-center px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md text-sm font-medium text-gray-700 dark:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to Dashboard
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md text-sm font-medium text-gray-700 dark:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Login
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center space-x-3">
            <List className="h-6 w-6 text-indigo-600" />
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-zinc-100">
              Available Events
            </h1>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-zinc-500" />
              <input
                type="text"
                placeholder="Search events..."
                className="pl-9 w-full sm:w-80 h-10 border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-zinc-900 dark:text-zinc-100"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-zinc-700 rounded-md text-sm font-medium text-gray-700 dark:text-zinc-100 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-auto justify-between"
              >
                <div className="flex items-center">
                  <Filter className="h-4 w-4 mr-2" />
                  {sortOptions.find(option => option.value === sortBy)?.label}
                </div>
                <ChevronDown className="h-4 w-4 ml-2" />
              </button>

              {showSortDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-md shadow-lg z-10">
                  <div className="py-1">
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setSortBy(option.value);
                          setShowSortDropdown(false);
                        }}
                        className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-800 ${
                          sortBy === option.value
                            ? 'bg-indigo-50 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200'
                            : 'text-gray-700 dark:text-zinc-100'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Last updated info */}
        {lastUpdated && (
          <div className="text-xs text-gray-500 dark:text-zinc-400">
            Last updated: {new Date(lastUpdated).toLocaleString()}
          </div>
        )}
      </div>

      {filteredEvents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event, index) => {
            const isCurrentlyLive = isEventCurrentlyLive(event.date, event.time);

            return (
              <div
                key={event.id}
                className={`bg-white dark:bg-zinc-800 rounded-lg shadow-sm border overflow-hidden transition-all duration-300 hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-400 group ${
                  isCurrentlyLive
                    ? 'border-green-300 dark:border-green-700 ring-2 ring-green-100 dark:ring-green-900'
                    : 'border-gray-200 dark:border-zinc-700'
                }`}
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
                      {isCurrentlyLive && (
                        <div className="bg-green-600 px-2 py-1 rounded-full text-xs font-medium text-white text-center flex items-center gap-1 animate-pulse">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                          Happening Now
                        </div>
                      )}
                      <div className={`px-2 py-1 rounded-full text-xs font-medium text-white text-center flex items-center gap-1 ${
                        event.isPublic
                          ? 'bg-green-600'
                          : 'bg-blue-600'
                      }`}>
                        <Globe className="h-4 w-4" />
                        {event.isPublic ? "Public Event" : "Not accessible by public"}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-48 bg-gray-100 dark:bg-zinc-900 flex items-center justify-center">
                    <Calendar className="h-12 w-12 text-gray-300 dark:text-zinc-600" />
                  </div>
                )}

                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
                      <Tag className="h-3 w-3 mr-1" />
                      {event.category?.charAt(0).toUpperCase() +
                        event.category?.slice(1) || "Uncategorized"}
                    </span>

                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        event.attendees >= event.capacity
                          ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
                          : event.attendees >= event.capacity * 0.8
                          ? "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200"
                          : "bg-gray-100 dark:bg-zinc-900 text-gray-800 dark:text-zinc-200"
                      }`}
                    >
                      <Users className="h-3 w-3 mr-1" />
                      {event.attendees || 0}/{event.capacity}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs mb-2">
                    <div className="flex items-center">
                      <BellRing className="h-3 w-3 mr-1" />
                      <CountdownDisplay
                        eventId={event.id}
                        eventDate={event.date}
                        eventTime={event.time}
                        showSeconds={true}
                        expiredText="Event Ended"
                        detailsOnClick={false}
                        onExpire={handleCountdownExpire}
                      />
                    </div>
                  </div>

                  <h2 className="text-xl font-semibold line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors dark:text-zinc-100">
                    {event.title}
                  </h2>

                  <div className="space-y-3 mt-3">
                    <div className="flex items-center text-sm text-gray-600 dark:text-zinc-300">
                      <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span>
                        {event.date} at {event.time}
                      </span>
                    </div>

                    <div className="flex items-center text-sm text-gray-600 dark:text-zinc-300">
                      <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="truncate">{event.location}</span>
                    </div>

                    {!event.isPublic && (
                      <div className="space-y-1">
                        {event.branch && (
                          <div className="text-xs text-blue-600 dark:text-blue-200 bg-blue-50 dark:bg-blue-900 px-2 py-1 rounded">
                            Branch: {event.branch}
                          </div>
                        )}
                        {event.organization && (
                          <div className="text-xs text-purple-600 dark:text-purple-200 bg-purple-50 dark:bg-purple-900 px-2 py-1 rounded">
                            Organization: {event.organization}
                          </div>
                        )}
                      </div>
                    )}

                    <p className="text-sm text-gray-600 dark:text-zinc-300 line-clamp-2 mt-2">
                      {event.description}
                    </p>
                  </div>

                  <div className="mt-4">
                    <Link to={`/events/${event.id}`} className="w-full block">
                      <button className={`w-full font-medium py-2 px-4 rounded-md text-sm transition duration-150 ease-in-out ${
                        isCurrentlyLive
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'btn-primary text-white'
                      }`}>
                        {isCurrentlyLive ? 'Join Now' : 'View Details'}
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-12 text-center">
          <div className="flex flex-col items-center justify-center">
            <Calendar className="h-16 w-16 text-gray-300 dark:text-zinc-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2 dark:text-zinc-100">No Events Found</h3>
            {searchTerm ? (
              <p className="text-gray-600 dark:text-zinc-300 mb-6">
                No events match your search for "{searchTerm}"
              </p>
            ) : (
              <p className="text-gray-600 dark:text-zinc-300 mb-6">
                There are no events available for you at the moment
              </p>
            )}
            {searchTerm && (
              <button
                className="px-4 py-2 border border-gray-300 dark:border-zinc-700 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors"
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