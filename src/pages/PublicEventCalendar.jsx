"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  MapPin,
  Users,
  Tag,
  Clock,
  Mail,
  User,
  Code,
} from "lucide-react";
import { LoadingAnimation } from "../components/LoadingAnimation";
import { useAuth } from "../contexts/AuthContext";

export default function PublicEventsCalendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const { currentUserData } = useAuth();
  
  useEffect(() => {
    function fetchPublicEvents() {
      try {
        setLoading(true);
        
        // Simple query to fetch all events
        const eventsQuery = query(collection(db, "events"));

        // Set up a real-time listener using onSnapshot
        const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
          const eventsData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          // Filter events based on conditions
          const filteredEvents = eventsData.filter(event => {
            // Show all public events
            if (event.isPublic === true) {
              return true;
            }
            
            // If no user data, only show public events
            if (!currentUserData) {
              return false;
            }
            
            // Show events if user is super admin
            if (currentUserData.role === "admin" && currentUserData.accessLevel === "super") {
              return true;
            }
            
            // Show events if user is the registrar/creator of the event
            if (event.registrarEmail === currentUserData.email) {
              return true;
            }
            
            // Show private events only if they match user's organization and branch
            if (event.isPublic === false) {
              return event.organization === currentUserData.organization && 
                     event.branch === currentUserData.branch;
            }
            
            return false;
          });

          setEvents(filteredEvents);
          setLoading(false);
        });

        // Return cleanup function to unsubscribe when the component unmounts
        return () => unsubscribe();
      } catch (err) {
        console.error("Error fetching events:", err);
        setError("Failed to load events. Please try again later.");
        setLoading(false);
      }
    }

    fetchPublicEvents();
  }, [currentUserData]);


  // Generate calendar days for the current month view
  const getDaysInMonth = (year, month) =>
    new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const daysInMonth = getDaysInMonth(year, month);
    const firstDayOfMonth = getFirstDayOfMonth(year, month);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push({ day: "", empty: true });
    }

    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      date.setHours(0, 0, 0, 0);

      // Find events for this day
      const dayEvents = events.filter((event) => {
        const eventDate = new Date(event.date);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate.getTime() === date.getTime();
      });

      // Determine if this date is past, present, or future
      let status = "";
      if (date.getTime() < today.getTime()) status = "past";
      else if (date.getTime() === today.getTime()) status = "present";
      else status = "future";

      days.push({
        day,
        date,
        events: dayEvents,
        status,
        empty: false,
      });
    }

    return days;
  };

  const handlePrevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    );
  };

  const handleNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    );
  };

  const handleDateClick = (day) => {
    if (!day.empty) {
      setSelectedDate(day);
    }
  };

  const calendarDays = generateCalendarDays();
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <LoadingAnimation
          type="spinner"
          size="md"
          variant="primary"
          text="Loading your file, please wait..."
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-center">
        <p className="font-medium">{error}</p>
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <div className="flex items-center space-x-3">
              <Calendar className="h-6 w-6 text-indigo-600 dark:text-indigo-300" />
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">
                Calendar
              </h1>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-zinc-700">
          {/* Calendar header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-zinc-900 dark:to-zinc-800 dark:border-zinc-700">
            <button
              onClick={handlePrevMonth}
              className="p-2 rounded-full hover:bg-white dark:hover:bg-zinc-700 hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-5 w-5 text-purple-700 dark:text-purple-300" />
            </button>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h2>
            <button
              onClick={handleNextMonth}
              className="p-2 rounded-full hover:bg-white dark:hover:bg-zinc-700 hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
              aria-label="Next month"
            >
              <ChevronRight className="h-5 w-5 text-purple-700 dark:text-purple-300" />
            </button>
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-zinc-700">
            {/* Day names */}
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div
                key={day}
                className="bg-gray-100 dark:bg-zinc-800 text-center py-2 font-semibold text-xs sm:text-sm text-gray-700 dark:text-gray-300"
              >
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {calendarDays.map((day, index) => {
              // Safely determine if there's an event with an image
              const hasEventWithImage =
                !day.empty &&
                day.events &&
                day.events.length > 0 &&
                day.events[0] &&
                day.events[0].image;

              const hasEvents = !day.empty && day.events && day.events.length > 0;

              return (
                <div
                  key={index}
                  className={`
                    min-h-[60px] sm:min-h-[80px] md:min-h-[100px] p-1 sm:p-2 bg-white dark:bg-zinc-900 relative 
                    ${!day.empty
                      ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                      : ""
                    }
                    ${selectedDate &&
                      !day.empty &&
                      selectedDate.date.getTime() === day.date.getTime()
                      ? "ring-2 ring-purple-500 ring-inset"
                      : ""
                    }
                  `}
                  onClick={() => handleDateClick(day)}
                >
                  {!day.empty && (
                    <>
                      <div
                        className={`
                        text-right p-1 rounded-full w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center
                        ${day.status === "past"
                            ? "text-gray-500 dark:text-gray-500"
                            : day.status === "present"
                              ? "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 font-bold"
                              : "text-gray-800 dark:text-gray-100"
                            }
                    `}
                      >
                        {day.day}
                      </div>

                      {hasEvents && (
                        <div className="mt-1 space-y-1">
                          {hasEventWithImage ? (
                            <div
                              className="absolute inset-0 opacity-10 z-0"
                              style={{
                                backgroundImage: `url(${day.events[0].image})`,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                              }}
                            />
                          ) : null}

                          {day.events.slice(0, 2).map((event) => (
                            <div
                              key={event.id}
                              className={`text-xs p-1 mb-1 rounded truncate relative z-10 shadow-sm ${
                                event.isPublic 
                                  ? "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200" 
                                  : "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                              }`}
                              title={`${event.title} ${event.isPublic ? '(Public)' : '(Organization)'}`}
                            >
                              {event.title}
                              {!event.isPublic && (
                                <span className="ml-1 text-xs">🏢</span>
                              )}
                            </div>
                          ))}

                          {day.events.length > 2 && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 font-medium text-center relative z-10">
                              +{day.events.length - 2} more
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected event details */}
        {selectedDate &&
          selectedDate.events &&
          selectedDate.events.length > 0 && (
            <div className="mt-6 bg-white dark:bg-zinc-800 rounded-xl shadow-lg p-4 sm:p-6 border border-gray-100 dark:border-zinc-700 animate-fadeIn">
              <h3 className="text-lg sm:text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-purple-600 dark:text-purple-300" />
                Events on{" "}
                {selectedDate.date.toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </h3>

              <div className="space-y-6">
                {selectedDate.events.map((event) => (
                  <div
                    key={event.id}
                    className="border-b border-gray-200 dark:border-zinc-700 pb-6 last:border-0"
                  >
                    <div className="flex flex-col md:flex-row gap-4">
                      {event.image && (
                        <div className="md:w-1/3">
                          <img
                            src={event.image || "/placeholder.svg"}
                            alt={event.title}
                            className="rounded-lg h-48 w-full object-cover shadow-md"
                          />
                        </div>
                      )}

                      <div className={event.image ? "md:w-2/3" : "w-full"}>
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">
                            {event.title}
                          </h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            event.isPublic 
                              ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200" 
                              : "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                          }`}>
                            {event.isPublic ? "Public" : "Organization"}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                          <div className="flex items-start">
                            <Clock className="h-4 w-4 mr-2 text-purple-600 dark:text-purple-300 mt-1 flex-shrink-0" />
                            <span className="text-gray-700 dark:text-gray-200">
                              <span className="font-medium">Time:</span>{" "}
                              {event.time}
                            </span>
                          </div>

                          <div className="flex items-start">
                            <MapPin className="h-4 w-4 mr-2 text-purple-600 dark:text-purple-300 mt-1 flex-shrink-0" />
                            <span className="text-gray-700 dark:text-gray-200">
                              <span className="font-medium">Location:</span>{" "}
                              {event.location}
                            </span>
                          </div>

                          <div className="flex items-start">
                            <Tag className="h-4 w-4 mr-2 text-purple-600 dark:text-purple-300 mt-1 flex-shrink-0" />
                            <span className="text-gray-700 dark:text-gray-200">
                              <span className="font-medium">Category:</span>{" "}
                              {event.category}
                            </span>
                          </div>

                          <div className="flex items-start">
                            <Users className="h-4 w-4 mr-2 text-purple-600 dark:text-purple-300 mt-1 flex-shrink-0" />
                            <span className="text-gray-700 dark:text-gray-200">
                              <span className="font-medium">Capacity:</span>{" "}
                              {event.capacity}
                              {event.attendees !== undefined && (
                                <span className="ml-1 text-purple-700 dark:text-purple-300">
                                  ({event.attendees} registered)
                                </span>
                              )}
                            </span>
                          </div>

                          <div className="flex items-start">
                            <User className="h-4 w-4 mr-2 text-purple-600 dark:text-purple-300 mt-1 flex-shrink-0" />
                            <span className="text-gray-700 dark:text-gray-200">
                              <span className="font-medium">Organized by:</span>{" "}
                              {event.registrarName}
                            </span>
                          </div>

                          <div className="flex items-start sm:col-span-2">
                            <Mail className="h-4 w-4 mr-2 text-purple-600 dark:text-purple-300 mt-1 flex-shrink-0" />
                            <span className="text-gray-700 dark:text-gray-200">
                              <span className="font-medium">Contact:</span>{" "}
                              {event.registrarEmail}
                            </span>
                          </div>

                          {!event.isPublic && (
                            <>
                              <div className="flex items-start">
                                <Code className="h-4 w-4 mr-2 text-purple-600 dark:text-purple-300 mt-1 flex-shrink-0" />
                                <span className="text-gray-700 dark:text-gray-200">
                                  <span className="font-medium">Organization:</span>{" "}
                                  {event.organization}
                                </span>
                              </div>
                              
                              {event.branch && (
                                <div className="flex items-start">
                                  <Code className="h-4 w-4 mr-2 text-purple-600 dark:text-purple-300 mt-1 flex-shrink-0" />
                                  <span className="text-gray-700 dark:text-gray-200">
                                    <span className="font-medium">Branch:</span>{" "}
                                    {event.branch}
                                  </span>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        <div className="bg-purple-50 dark:bg-purple-900 p-3 rounded-lg">
                          <p className="text-gray-700 dark:text-gray-200 text-sm sm:text-base">
                            {event.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}