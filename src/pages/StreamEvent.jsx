import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase/config";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Tag,
  MessageSquare,
  User,
  Mail,
  X,
  BellRing,
  Search,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { LoadingAnimation } from "../components/LoadingAnimation";
import CountdownDisplay from "../components/CountingDisplay";

export default function LiveEventsList() {
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventCode, setEventCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    let unsubscribe; // To hold the unsubscribe function
    let dataTimeout;
    const fetchPublicLiveEvents = () => {
      try {
        setLoading(true);
        const eventsCollection = collection(db, "events");
        const q = query(
          eventsCollection,
          where("isPublic", "==", true),
          where("isLive", "==", true)
        );

        unsubscribe = onSnapshot(q, (querySnapshot) => {
          const eventsData = [];
          querySnapshot.forEach((doc) => {
            eventsData.push({
              id: doc.id,
              ...doc.data(),
            });
          });

          // Filter out past events (events that have already ended)
          const currentDate = new Date();
          const filteredEventsData = eventsData.filter(event => {
            const eventDate = new Date(event.date);
            
            // Check if event has an end time/date
            if (event.endDate) {
              const eventEndDate = new Date(event.endDate);
              return eventEndDate > currentDate; // Include if event hasn't ended yet
            } else {
              // If no end date, compare with start date
              // Set time to end of day for events happening today
              const eventEndOfDay = new Date(eventDate);
              eventEndOfDay.setHours(23, 59, 59, 999);
              return eventEndOfDay >= currentDate; // Include events happening today and future events
            }
          });

          // Sort events by event date (earliest first)
          const sortedEvents = filteredEventsData.sort((a, b) => {
            return new Date(a.date) - new Date(b.date);
          });

          setEvents(sortedEvents);
          setFilteredEvents(sortedEvents); // Initially set filtered events to all fetched events
          clearTimeout(dataTimeout);
          dataTimeout = setTimeout(() => {
            setDataLoaded(true);
          }, 2000); // 2 second wait
        });
      } catch (error) {
        console.error("Error fetching events:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPublicLiveEvents();

    // Cleanup the listener on component unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      clearTimeout(dataTimeout);
    };
  }, []);

  // Handle search functionality
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredEvents(events);
    } else {
      const filtered = events.filter(
        event =>
          event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          event.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          event.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
          event.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredEvents(filtered);
    }
  }, [searchQuery, events]);

  const handleEventSelect = (event) => {
    setSelectedEvent(event);
    setEventCode("");
    setCodeError("");
    setShowEventDetails(false);
  };

  const handleSubmitCode = () => {
    if (!eventCode.trim()) {
      setCodeError("Please enter the event code");
      return;
    }

    if (eventCode === selectedEvent.eventCode) {
      // Navigate to the stream event details route instead of directly rendering the component
      navigate(`/stream-event-details/${selectedEvent.id}`);
      handleCloseModal();
    } else {
      setCodeError("Invalid event code. Please try again.");
    }
  };

  const handleCloseModal = () => {
    setSelectedEvent(null);
    setEventCode("");
    setCodeError("");
    setShowEventDetails(false);
  };

  if (loading || !dataLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingAnimation
          type="spinner"
          size="md"
          variant="primary"
          text="Loading, please wait..."
        />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="w-full bg-white rounded-lg shadow-md border border-gray-200">
          <div className="flex items-center justify-center p-10">
            <div className="text-center">
              <Calendar className="h-10 w-10 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                No public live events available at the moment.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">
            Public View Events
          </h2>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700 border border-blue-100">
              <Users className="h-3.5 w-3.5 mr-1" />
              {filteredEvents.length} {filteredEvents.length === 1 ? "event" : "events"}
            </div>
          </div>
        </div>

        {/* Desktop view - Table */}
        <div className="hidden md:block">
          <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
            <div className="relative w-full overflow-auto p-1">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 font-medium">Event</th>
                    <th className="px-6 py-4 font-medium">Date & Time</th>
                    <th className="px-6 py-4 font-medium">Location</th>
                    <th className="px-6 py-4 font-medium">Category</th>
                    <th className="px-6 py-4 font-medium">Attendees</th>
                    <th className="px-6 py-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredEvents.map((event) => (
                    <tr key={event.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center border border-blue-200">
                            {event.image ? (
                              <img
                                src={event.image || "/placeholder.svg"}
                                alt={event.title}
                                className="h-10 w-10 rounded-full object-cover"
                              />
                            ) : (
                              <Calendar className="h-5 w-5 text-blue-600" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-gray-800">
                              {event.title}
                            </div>
                            <div className="text-xs text-gray-500 truncate max-w-[200px]">
                              {event.description}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center text-xs text-gray-700">
                            <Calendar className="h-3.5 w-3.5 mr-1 text-gray-500" />{" "}
                            {event.date}
                          </div>
                          <div className="flex items-center text-xs text-gray-500">
                            <Clock className="h-3.5 w-3.5 mr-1" /> {event.time}
                          </div>
                          <div className="flex items-center text-xs text-gray-500">
                            <BellRing className="h-3.5 w-3.5 mr-1" />
                            <CountdownDisplay
                              eventDate={event.date}
                              eventTime={event.time}
                              showSeconds={true}
                              expiredText="Not Available"
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center text-xs text-gray-700">
                          <MapPin className="h-3.5 w-3.5 mr-1 text-gray-500" />{" "}
                          {event.location}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                          {event.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center text-xs text-gray-700">
                          <Users className="h-3.5 w-3.5 mr-1 text-gray-500" />
                          <span>
                            {event.attendees || 0}/{event.capacity}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleEventSelect(event)}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                        >
                          <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                          <span>Show Event</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Mobile view - Cards */}
        <div className="grid grid-cols-1 gap-4 md:hidden">
          {filteredEvents.map((event) => (
            <div
              key={event.id}
              className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200"
            >
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center border border-blue-200">
                    {event.image ? (
                      <img
                        src={event.image || "/placeholder.svg"}
                        alt={event.title}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <Calendar className="h-6 w-6 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-800">
                      {event.title}
                    </h3>
                    <span className="inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                      {event.category}
                    </span>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                    {event.description}
                  </p>

                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center text-xs text-gray-700">
                      <Calendar className="h-3.5 w-3.5 mr-1.5 text-gray-500" />{" "}
                      {event.date}
                    </div>
                    <div className="flex items-center text-xs text-gray-700">
                      <Clock className="h-3.5 w-3.5 mr-1.5 text-gray-500" />{" "}
                      {event.time}
                    </div>
                    <div className="flex items-center text-xs text-gray-700">
                      <MapPin className="h-3.5 w-3.5 mr-1.5 text-gray-500" />{" "}
                      {event.location}
                    </div>
                    <div className="flex items-center text-xs text-gray-700">
                      <Users className="h-3.5 w-3.5 mr-1.5 text-gray-500" />
                      <span>
                        {event.attendees || 0}/{event.capacity}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-5 py-4 bg-gray-50 border-t border-gray-200">
                <button
                  onClick={() => handleEventSelect(event)}
                  className="w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  <MessageSquare className="h-4 w-4 mr-1.5" />
                  <span>Show Event</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Event Code Modal */}
        {selectedEvent && (
          <div
            className="fixed inset-0 z-50 overflow-y-auto"
            aria-labelledby="modal-title"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              {/* Background overlay */}
              <div
                className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
                aria-hidden="true"
                onClick={handleCloseModal}
              ></div>

              {/* Modal panel */}
              <div className="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-gray-300">
                <div className="bg-white px-6 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                      <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                        <h3
                          className="text-lg leading-6 font-medium text-gray-900"
                          id="modal-title"
                        >
                          Show Event: {selectedEvent.title}
                        </h3>
                        <button
                          type="button"
                          className="text-gray-400 hover:text-gray-500 p-1 rounded-full hover:bg-gray-100"
                          onClick={handleCloseModal}
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="mt-5 space-y-5">
                        <div className="grid grid-cols-2 gap-4 text-sm p-4 bg-gray-50 rounded-lg border border-gray-100">
                          <div className="flex items-center text-gray-600">
                            <Calendar className="h-4 w-4 mr-1.5 text-gray-500" />{" "}
                            {selectedEvent.date}
                          </div>
                          <div className="flex items-center text-gray-600">
                            <Clock className="h-4 w-4 mr-1.5 text-gray-500" />{" "}
                            {selectedEvent.time}
                          </div>
                          <div className="flex items-center text-gray-600">
                            <MapPin className="h-4 w-4 mr-1.5 text-gray-500" />{" "}
                            {selectedEvent.location}
                          </div>
                          <div className="flex items-center text-gray-600">
                            <Tag className="h-4 w-4 mr-1.5 text-gray-500" />{" "}
                            {selectedEvent.category}
                          </div>
                        </div>

                        <div className="p-4 border border-gray-100 rounded-lg bg-white">
                          <div className="space-y-3">
                            <div className="flex items-center text-sm text-gray-700">
                              <User className="h-4 w-4 mr-1.5 text-gray-500" />
                              <span>
                                Organizer:{" "}
                                <span className="font-medium">
                                  {selectedEvent.registrarName}
                                </span>
                              </span>
                            </div>
                            <div className="flex items-center text-sm text-gray-700">
                              <Mail className="h-4 w-4 mr-1.5 text-gray-500" />
                              <span>
                                Contact:{" "}
                                <span className="font-medium">
                                  {selectedEvent.registrarEmail}
                                </span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 border border-gray-200 rounded-lg bg-white">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Please enter the event code to join
                          </label>
                          <input
                            type="text"
                            value={eventCode}
                            onChange={(e) => setEventCode(e.target.value)}
                            placeholder="Enter event code"
                            className={`w-full px-4 py-2.5 border ${
                              codeError ? "border-red-500" : "border-gray-300"
                            } rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                          />
                          {codeError && (
                            <p className="mt-2 text-xs text-red-600">
                              {codeError}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2.5 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={handleSubmitCode}
                  >
                    Show Event
                  </button>
                  <button
                    type="button"
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2.5 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={handleCloseModal}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}