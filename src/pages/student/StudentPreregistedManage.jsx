import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebase/config";
import { useAuth } from "../../contexts/AuthContext";
import {
  Calendar,
  Clock,
  MapPin,
  Trash2,
  Loader2,
  AlertCircle,
  CalendarX,
  ChevronRight,
  Tag,
  Users,
  Info,
  ArrowLeft,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export default function StudentPreRegisteredEvents() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState(null);

  useEffect(() => {
    const fetchPreRegisteredEvents = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Query usersPreRegistered collection for this user's registrations
        const preRegQuery = query(
          collection(db, "usersPreRegistered"),
          where("userId", "==", currentUser.uid)
        );

        const preRegSnapshot = await getDocs(preRegQuery);

        const preRegisteredEventsData = preRegSnapshot.docs.map((doc) => ({
          id: doc.data().eventId,
          ...doc.data(),
        }));

        // Fetch additional event details if needed
        for (let i = 0; i < preRegisteredEventsData.length; i++) {
          const eventData = preRegisteredEventsData[i];

          // If we need additional event details that weren't stored in the registration
          if (
            !eventData.description ||
            !eventData.category ||
            !eventData.imageUrl
          ) {
            try {
              const fullEventDoc = await getDoc(
                doc(db, "events", eventData.eventId)
              );

              if (fullEventDoc.exists()) {
                // Add any missing fields from the full event document
                preRegisteredEventsData[i] = {
                  ...eventData,
                  ...fullEventDoc.data(),
                  // Ensure these fields are not overwritten
                  id: eventData.eventId,
                  timestamp: eventData.timestamp,
                };
              }
            } catch (err) {
              console.error(
                `Error fetching additional event details for ${eventData.eventId}:`,
                err
              );
            }
          }
        }

        // Sort by registration timestamp (most recent first)
        preRegisteredEventsData.sort((a, b) => {
          return new Date(b.timestamp) - new Date(a.timestamp);
        });

        setEvents(preRegisteredEventsData);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching pre-registered events:", err);
        setError("Failed to load pre-registered events");
        setLoading(false);
      }
    };

    fetchPreRegisteredEvents();
  }, [currentUser]);

  const cancelPreRegistration = async (eventId) => {
    if (!currentUser || !eventId) return;

    try {
      setCancellingId(eventId);

      // Delete from usersPreRegistered collection
      const registrationId = `${currentUser.uid}_${eventId}`;
      await deleteDoc(doc(db, "usersPreRegistered", registrationId));

      // Also delete from preRegistered subcollection of the event (for backward compatibility)
      await deleteDoc(
        doc(db, "events", eventId, "preRegistered", currentUser.uid)
      );

      // Update the event's pre-registration count if possible
      try {
        const eventDoc = await getDoc(doc(db, "events", eventId));
        if (eventDoc.exists() && eventDoc.data().preRegisteredCount > 0) {
          await updateDoc(doc(db, "events", eventId), {
            preRegisteredCount: eventDoc.data().preRegisteredCount - 1,
          });
        }
      } catch (err) {
        console.error("Error updating preRegisteredCount:", err);
        // Continue even if this fails
      }

      // Update local state
      setEvents(events.filter((event) => event.id !== eventId));
      setCancellingId(null);
    } catch (err) {
      console.error("Error cancelling pre-registration:", err);
      setCancellingId(null);
      setError("Failed to cancel pre-registration. Please try again.");
    }
  };

  // Format date nicely
  const formatDate = (dateString) => {
    try {
      const options = {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      };
      return new Date(dateString).toLocaleDateString(undefined, options);
    } catch (e) {
      return dateString;
    }
  };

  // Check if event is in the past
  const isEventPast = (dateString, timeString) => {
    try {
      const [hours, minutes] = timeString
        .split(":")
        .map((num) => Number.parseInt(num));
      const eventDate = new Date(dateString);
      eventDate.setHours(hours, minutes);
      return eventDate < new Date();
    } catch (e) {
      return false;
    }
  };

  // Calculate days remaining until event
  const getDaysRemaining = (dateString) => {
    try {
      const eventDate = new Date(dateString);
      const today = new Date();

      // Reset time to compare just dates
      eventDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);

      const diffTime = eventDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return diffDays;
    } catch (e) {
      return null;
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-18 py-18">
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-lg">
          <div className="relative w-16 h-16 mb-6">
            <div className="absolute inset-0 bg-purple-100 rounded-full animate-ping opacity-75"></div>
            <div className="relative flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full">
              <Loader2 className="h-8 w-8 text-purple-600 animate-spin" />
            </div>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Loading Your Events
          </h3>
          <p className="text-gray-500">
            Please wait while we fetch your pre-registered events...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-18 py-18">
        <div className="flex flex-col items-center justify-center p-8 bg-white rounded-xl shadow-lg">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Error Loading Events
          </h3>
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-18 py-18">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CalendarX className="h-10 w-10 text-purple-500" />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-gray-900">
            No Pre-Registered Events
          </h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            You haven't pre-registered for any events yet. Browse available
            events to find something that interests you.
          </p>
          <Link
            to="/events"
            className="inline-flex items-center px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
          >
            Browse Events
            <ChevronRight className="ml-1 h-5 w-5" />
          </Link>
        </div>
      </div>
    );
  }

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-18 py-18">
      <div className="mb-6">
        <button
          onClick={handleBack}
          className="inline-flex items-center px-4 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          <span>Back to List Events</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8">
        <div className="border-b border-gray-200 pb-4 mb-6">
          <h2 className="text-2xl font-bold mb-2 text-gray-900">
            Your Pre-Registered Events
          </h2>
          <p className="text-gray-500">
            Events you've signed up for but haven't attended yet
          </p>
        </div>

        <div className="space-y-6">
          {events.map((event) => {
            const isPast = isEventPast(event.date, event.time);
            const daysRemaining = !isPast ? getDaysRemaining(event.date) : null;

            return (
              <div
                key={event.id}
                className={`border rounded-xl p-4 sm:p-6 transition-all ${
                  isPast
                    ? "border-gray-200 bg-gray-50"
                    : "border-purple-100 bg-purple-50 hover:shadow-md"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Event Image or Placeholder */}
                  <div className="lg:w-1/4 h-32 rounded-lg overflow-hidden bg-white border border-gray-200 flex-shrink-0">
                    {event.eventProfile ? (
                      <img
                        src={event.eventProfile || "/placeholder.svg"}
                        alt={event.eventTitle || event.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-purple-100">
                        <Calendar className="h-12 w-12 text-purple-300" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <h3 className="font-semibold text-xl text-gray-900">
                            <Link
                              to={`/events/${event.id}`}
                              className="hover:text-purple-700 transition-colors"
                            >
                              {event.eventTitle || event.title}
                            </Link>
                          </h3>

                          {isPast ? (
                            <span className="text-xs font-medium bg-gray-200 text-gray-700 px-2 py-1 rounded-full">
                              Past Event
                            </span>
                          ) : daysRemaining === 0 ? (
                            <span className="text-xs font-medium bg-green-100 text-green-800 px-2 py-1 rounded-full">
                              Today
                            </span>
                          ) : daysRemaining === 1 ? (
                            <span className="text-xs font-medium bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                              Tomorrow
                            </span>
                          ) : daysRemaining && daysRemaining < 7 ? (
                            <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                              In {daysRemaining} days
                            </span>
                          ) : null}

                          {event.category && (
                            <span className="text-xs font-medium bg-purple-100 text-purple-800 px-2 py-1 rounded-full flex items-center">
                              <Tag className="h-3 w-3 mr-1" />
                              {event.category}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-4 text-sm mb-3">
                          <div className="flex items-center text-gray-700">
                            <Calendar className="h-4 w-4 mr-2 text-purple-500" />
                            {formatDate(event.eventDate || event.date)}
                          </div>
                          <div className="flex items-center text-gray-700">
                            <Clock className="h-4 w-4 mr-2 text-purple-500" />
                            {event.eventTime || event.time}
                          </div>
                          <div className="flex items-center text-gray-700 md:col-span-2">
                            <MapPin className="h-4 w-4 mr-2 text-purple-500" />
                            {event.eventLocation || event.location}
                          </div>

                          {event.capacity && (
                            <div className="flex items-center text-gray-700">
                              <Users className="h-4 w-4 mr-2 text-purple-500" />
                              Capacity: {event.capacity}
                            </div>
                          )}
                        </div>

                        {event.description && (
                          <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                            {event.description}
                          </p>
                        )}

                        <div className="flex items-center text-xs text-gray-500 mt-1">
                          <Info className="h-3 w-3 mr-1" />
                          Pre-registered on{" "}
                          {new Date(event.timestamp).toLocaleString()}
                        </div>
                      </div>

                      <div className="flex items-center">
                        {!isPast && (
                          <button
                            onClick={() => cancelPreRegistration(event.id)}
                            disabled={cancellingId === event.id}
                            className={`p-3 rounded-lg transition-colors ${
                              cancellingId === event.id
                                ? "bg-red-100 text-red-300 cursor-not-allowed"
                                : "bg-red-100 text-red-600 hover:bg-red-200"
                            }`}
                            title="Cancel pre-registration"
                          >
                            {cancellingId === event.id ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <Trash2 className="h-5 w-5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}