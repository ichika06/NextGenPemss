import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../contexts/AuthContext";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Eye,
  Edit,
  Trash2,
  Lock,
  Globe,
  BellRing,
  Plus,
  AlertCircle,
  Search,
  Filter,
  X,
  CalendarCog,
  Pencil,
  Wifi,
  WifiOff,
  ExternalLink,
} from "lucide-react";
import { LoadingAnimation } from "../components/LoadingAnimation";
import CountdownDisplay from "../components/CountingDisplay";
import { useAlert } from "../components/AlertProvider";

export default function ManageEvent() {
  const { currentUser, userRole } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { showAlert } = useAlert();

  // Fetch user's events
  useEffect(() => {
    async function fetchEvents() {
      if (!currentUser) {
        navigate("/login");
        return;
      }

      try {
        setLoading(true);

        // Query events based on user role
        const eventsRef = collection(db, "events");
        let q;

        if (currentUser.role === "admin") {
          // Admin can see all events
          q = query(eventsRef);
        } else {
          // Regular registrars only see their own events
          q = query(eventsRef, where("registrarId", "==", currentUser.uid));
        }

        const querySnapshot = await getDocs(q);

        const eventsList = [];
        for (const docSnapshot of querySnapshot.docs) {
          const eventData = { id: docSnapshot.id, ...docSnapshot.data() };

          // Get attendee count (you could have a separate collection for this)
          const attendeesRef = collection(db, "eventAttendees");
          const attendeesQuery = query(
            attendeesRef,
            where("eventId", "==", eventData.id)
          );
          const attendeesSnapshot = await getDocs(attendeesQuery);
          const attendeeCount = attendeesSnapshot.size;

          // Get related event documents
          const docsRef = collection(db, "eventDocuments");
          const docsQuery = query(
            docsRef,
            where("eventId", "==", eventData.id)
          );
          const docsSnapshot = await getDocs(docsQuery);
          const documents = docsSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          eventsList.push({
            ...eventData,
            attendeeCount,
            documents,
            isLive: eventData.isLive,
          });
        }

        setEvents(eventsList);
      } catch (err) {
        console.error("Error fetching events:", err);
        setError("Failed to load events. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, [currentUser, navigate]);

  // Filter and search events
  const filteredEvents = events.filter((event) => {
    // Apply visibility filter
    const visibilityMatch =
      filter === "all"
        ? true
        : filter === "public"
          ? event.isPublic
          : !event.isPublic;

    // Apply search query if present
    const searchMatch =
      searchQuery === ""
        ? true
        : event.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.description
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        event.location?.toLowerCase().includes(searchQuery.toLowerCase());

    return visibilityMatch && searchMatch;
  });

  // Handle event deletion
  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;

    try {
      setLoading(true);

      // Delete event documents
      const docsRef = collection(db, "eventDocuments");
      const docsQuery = query(
        docsRef,
        where("eventId", "==", selectedEvent.id)
      );
      const docsSnapshot = await getDocs(docsQuery);

      const deletePromises = docsSnapshot.docs.map((doc) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      // Delete event permissions
      await deleteDoc(doc(db, "eventPermissions", selectedEvent.id));

      // Delete event
      await deleteDoc(doc(db, "events", selectedEvent.id));

      // Update local state
      setEvents((prevEvents) =>
        prevEvents.filter((event) => event.id !== selectedEvent.id)
      );
      setShowDeleteModal(false);
      setSelectedEvent(null);
    } catch (err) {
      console.error("Error deleting event:", err);
      setError("Failed to delete event. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Toggle event visibility (public/private)
  const toggleEventVisibility = async (event) => {
    try {
      setLoading(true);

      const newIsPublic = !event.isPublic;

      // Update event document
      await updateDoc(doc(db, "events", event.id), {
        isPublic: newIsPublic,
      });

      // Update event permissions
      await updateDoc(doc(db, "eventPermissions", event.id), {
        isPublic: newIsPublic,
        viewers: newIsPublic ? ["*"] : [currentUser.uid],
      });

      // Update documents visibility
      const docsRef = collection(db, "eventDocuments");
      const docsQuery = query(docsRef, where("eventId", "==", event.id));
      const docsSnapshot = await getDocs(docsQuery);

      const updatePromises = docsSnapshot.docs.map((doc) =>
        updateDoc(doc.ref, { isPublic: newIsPublic })
      );

      await Promise.all(updatePromises);

      if (newIsPublic) {
        showAlert({
          icon: "success",
          header: "Change Public event",
          description: "Event is now in Public event",
          variant: "success",
          position: window.innerWidth < 768 ? "top-center" : "top-right",
          animation: window.innerWidth < 768 ? "slide-down" : "slide-left",
          duration: 3000,
          headerColor: "#086d3f",
          descriptionColor: "#086d3f",
          borderColor: "#086d3f",
          width: window.innerWidth < 768 ? "sm" : "md",
          responsiveMode: window.innerWidth < 768 ? "inline" : "stack",
        });
      } else {
        showAlert({
          icon: "success",
          header: "Change Public event",
          description: "Event is remove in Public event",
          variant: "success",
          position: window.innerWidth < 768 ? "top-center" : "top-right",
          animation: window.innerWidth < 768 ? "slide-down" : "slide-left",
          duration: 3000,
          headerColor: "#086d3f",
          descriptionColor: "#086d3f",
          borderColor: "#086d3f",
          width: window.innerWidth < 768 ? "sm" : "md",
          responsiveMode: window.innerWidth < 768 ? "inline" : "stack",
        });
      }

      // Update local state
      setEvents((prevEvents) =>
        prevEvents.map((e) =>
          e.id === event.id ? { ...e, isPublic: newIsPublic } : e
        )
      );
    } catch (err) {
      console.error("Error updating event visibility:", err);
      setError("Failed to update event visibility.");
    } finally {
      setLoading(false);
    }
  };

  // Toggle event live status
  const toggleEventLiveStatus = async (event) => {
    try {
      setLoading(true);

      const newIsLive = !event.isLive;

      // Update event document
      await updateDoc(doc(db, "events", event.id), {
        isLive: newIsLive,
      });

      if (newIsLive) {
        showAlert({
          icon: "success",
          header: "Change live event",
          description: "Event can now accept registraion",
          variant: "success",
          position: window.innerWidth < 768 ? "top-center" : "top-right",
          animation: window.innerWidth < 768 ? "slide-down" : "slide-left",
          duration: 3000,
          headerColor: "#086d3f",
          descriptionColor: "#086d3f",
          borderColor: "#086d3f",
          width: window.innerWidth < 768 ? "sm" : "md",
          responsiveMode: window.innerWidth < 768 ? "inline" : "stack",
        });
      } else {
        showAlert({
          icon: "success",
          header: "Change live event",
          description: "Event will not accept registration",
          variant: "success",
          position: window.innerWidth < 768 ? "top-center" : "top-right",
          animation: window.innerWidth < 768 ? "slide-down" : "slide-left",
          duration: 3000,
          headerColor: "#086d3f",
          descriptionColor: "#086d3f",
          borderColor: "#086d3f",
          width: window.innerWidth < 768 ? "sm" : "md",
          responsiveMode: window.innerWidth < 768 ? "inline" : "stack",
        });
      }

      // Update local state
      setEvents((prevEvents) =>
        prevEvents.map((e) =>
          e.id === event.id ? { ...e, isLive: newIsLive } : e
        )
      );
    } catch (err) {
      console.error("Error updating event live status:", err);
      showAlert({
        icon: "error",
        header: "Changin Live properties",
        description: "Getting an erro while changing the event live property", err,
        variant: "error",
        position: window.innerWidth < 768 ? "top-center" : "top-right",
        animation: window.innerWidth < 768 ? "slide-down" : "slide-left",
        duration: 3000,
        headerColor: "#36b37e",
        descriptionColor: "#36b37e",
        borderColor: "#36b37e",
        width: window.innerWidth < 768 ? "sm" : "md",
        responsiveMode: window.innerWidth < 768 ? "inline" : "stack",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle viewing private event details
  const handleViewPrivateEvent = (event) => {
    // Open the event details in a new tab/window
    const eventDetailsURL = `/stream-event-details/${event.id}`;
    window.open(eventDetailsURL, '_blank');
  };

  const handleRegisterPrivateEvent = (event) => {
    // Open the event details in a new tab/window
    const eventDetailsURL = `/events/${event.id}`;
    window.open(eventDetailsURL, '_blank');
  };



  // Calculate event status
  const getEventStatus = (event) => {
    const eventDate = new Date(event.date);
    const today = new Date();

    if (eventDate < today) {
      return { label: "Past", color: "bg-gray-100 text-gray-700" };
    }

    if (event.attendeeCount >= event.capacity) {
      return { label: "Full", color: "bg-amber-100 text-amber-700" };
    }

    return { label: "Upcoming", color: "bg-emerald-100 text-emerald-700" };
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-3">
            <CalendarCog className="h-6 w-6 text-indigo-600" />
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
              Manage Events
            </h1>
          </div>
          <p className="text-gray-500 text-sm sm:text-base">
            Create, edit, and manage your school events
          </p>
        </div>
        <button
          onClick={() => navigate(`/${userRole}/create-event`)}
          className="btn-primary text-white font-medium py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-150 ease-in-out flex items-center"
        >
          <Plus className="h-5 w-5 mr-1.5" /> Create New Event
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg mb-6 flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Error</p>
            <p>{error}</p>
          </div>
          <button
            onClick={() => setError("")}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div className="relative w-full sm:w-64 md:w-80">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full py-2 px-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 rounded-lg flex items-center text-sm font-medium transition-colors ${filter === "all"
                  ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200"
                  }`}
              >
                <Filter className="h-4 w-4 mr-1.5" /> All Events
              </button>
              <button
                onClick={() => setFilter("public")}
                className={`px-3 py-1.5 rounded-lg flex items-center text-sm font-medium transition-colors ${filter === "public"
                  ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200"
                  }`}
              >
                <Globe className="h-4 w-4 mr-1.5" /> Public
              </button>
              <button
                onClick={() => setFilter("private")}
                className={`px-3 py-1.5 rounded-lg flex items-center text-sm font-medium transition-colors ${filter === "private"
                  ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200"
                  }`}
              >
                <Lock className="h-4 w-4 mr-1.5" /> Private
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col justify-center items-center h-64 bg-gray-50">
            <LoadingAnimation
              type="spinner"
              size="md"
              variant="primary"
              text="Loading event, please wait..."
            />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-8 text-center bg-gray-50">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
              <Calendar className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No events found
            </h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              {searchQuery
                ? "No events match your search criteria. Try a different search term or clear the filters."
                : "You haven't created any events yet. Create your first event to get started."}
            </p>
            <button
              onClick={() => navigate(`/${userRole}/create-event`)}
              className="inline-flex items-center px-4 py-2 btn-primary text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="h-5 w-5 mr-1.5" /> Create New Event
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredEvents.map((event) => {
              const status = getEventStatus(event);
              return (
                <div
                  key={event.id}
                  className="p-4 sm:p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col md:flex-row gap-4">
                    {/* Event Image */}
                    {event.image && (
                      <div className="w-full md:w-40 h-40 flex-shrink-0 order-1 md:order-2">
                        <img
                          src={event.image || "/placeholder.svg"}
                          alt={event.title}
                          className="w-full h-full object-cover rounded-lg shadow-sm"
                        />
                      </div>
                    )}

                    {/* Event Details */}
                    <div className="flex-1 order-2 md:order-1">
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <h3 className="text-xl font-semibold text-gray-800">
                          {event.title}
                        </h3>

                        {/* Status badges */}
                        <span
                          className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full ${status.color}`}
                        >
                          {status.label}
                        </span>

                        {event.isPublic ? (
                          <span className="inline-flex items-center bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full">
                            <Globe className="h-3 w-3 mr-1" /> Public
                          </span>
                        ) : (
                          <span className="inline-flex items-center bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full">
                            <Lock className="h-3 w-3 mr-1" /> Private
                          </span>
                        )}

                        {/* Live Status Badge */}
                        {event.isLive ? (
                          <span className="inline-flex items-center bg-green-50 text-green-700 text-xs px-2.5 py-1 rounded-full">
                            <Wifi className="h-3 w-3 mr-1" /> Live
                          </span>
                        ) : (
                          <span className="inline-flex items-center bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full">
                            <WifiOff className="h-3 w-3 mr-1" /> Not Live
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-gray-600 mb-4">
                        <div className="flex items-center bg-gray-50 p-2 rounded-lg">
                          <Calendar className="h-4 w-4 mr-2 text-indigo-500" />
                          <span>{event.date}</span>
                        </div>
                        <div className="flex items-center bg-gray-50 p-2 rounded-lg">
                          <BellRing className="h-4 w-4 mr-2 text-indigo-500" />
                          <CountdownDisplay
                            detailsOnClick={false}
                            eventDate={event.date}
                            eventTime={event.time}
                            showSeconds={true}
                            expiredText="Not Available"
                          />
                        </div>
                        <div className="flex items-center bg-gray-50 p-2 rounded-lg">
                          <Clock className="h-4 w-4 mr-2 text-indigo-500" />
                          <span>{event.time}</span>
                        </div>
                        <div className="flex items-center bg-gray-50 p-2 rounded-lg">
                          <MapPin className="h-4 w-4 mr-2 text-indigo-500" />
                          <span>{event.location}</span>
                        </div>
                        <div className="flex items-center bg-gray-50 p-2 rounded-lg">
                          <Users className="h-4 w-4 mr-2 text-indigo-500" />
                          <span>
                            {event.attendeeCount || 0} / {event.capacity}{" "}
                            attendees
                          </span>
                        </div>
                      </div>

                      <p className="text-sm text-gray-500 line-clamp-2 mb-4">
                        {event.description}
                      </p>

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Link
                          to={`/${userRole}/event/${event.id}`}
                          className="inline-flex items-center px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-sm text-gray-700 transition-colors"
                        >
                          <Eye className="h-4 w-4 mr-1.5" /> View
                        </Link>

                        {/* Show Private Event Details Button - only for private events */}
                        {!event.isPublic && (
                          <button
                            onClick={() => handleViewPrivateEvent(event)}
                            className="inline-flex items-center px-3 py-1.5 bg-purple-50 border border-purple-200 hover:bg-purple-100 rounded-lg text-sm text-purple-700 transition-colors"
                            title="View private event details in new tab"
                          >
                            <ExternalLink className="h-4 w-4 mr-1.5" /> Stream
                          </button>
                        )}

                        {!event.isPublic && (
                          <button
                            onClick={() => handleRegisterPrivateEvent(event)}
                            className="inline-flex items-center px-3 py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg text-sm text-blue-700 transition-colors"
                            title="View private event details in new tab"
                          >
                            <Pencil className="h-4 w-4 mr-1.5" /> Register
                          </button>
                        )}


                        <Link
                          to={`/${userRole}/edit-event/${event.id}`}
                          className="inline-flex items-center px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-sm text-gray-700 transition-colors"
                        >
                          <Edit className="h-4 w-4 mr-1.5" /> Edit
                        </Link>
                        <button
                          onClick={() => toggleEventVisibility(event)}
                          className="inline-flex items-center px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-sm text-gray-700 transition-colors"
                        >
                          {event.isPublic ? (
                            <>
                              <Lock className="h-4 w-4 mr-1.5" /> Make Private
                            </>
                          ) : (
                            <>
                              <Globe className="h-4 w-4 mr-1.5" /> Make Public
                            </>
                          )}
                        </button>

                        {/* Toggle Live Status Button */}
                        <button
                          onClick={() => toggleEventLiveStatus(event)}
                          className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm transition-colors ${event.isLive
                            ? "bg-green-50 border border-green-200 hover:bg-green-100 text-green-700"
                            : "bg-white border border-gray-300 hover:bg-gray-50 text-gray-700"
                            }`}
                        >
                          {event.isLive ? (
                            <>
                              <WifiOff className="h-4 w-4 mr-1.5" /> Set Not
                              Live
                            </>
                          ) : (
                            <>
                              <Wifi className="h-4 w-4 mr-1.5" /> Set Live
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => {
                            setSelectedEvent(event);
                            setShowDeleteModal(true);
                          }}
                          className="inline-flex items-center px-3 py-1.5 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg text-sm text-red-600 transition-colors"
                        >
                          <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 backdrop-blur-xs backdrop-grayscale-150 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 text-center mb-2">
              Delete Event
            </h3>
            <p className="text-gray-600 text-center mb-6">
              Are you sure you want to delete "{selectedEvent?.title}"? This
              action cannot be undone.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="order-2 sm:order-1 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteEvent}
                disabled={loading}
                className="order-1 sm:order-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <LoadingAnimation
                      type="spinner"
                      size="md"
                      variant="info"
                      text="Deleting, please wait..."
                    />
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-1.5" /> Delete Event
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}