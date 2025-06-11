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

export default function PublicEventsCalendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    function fetchPublicEvents() {
      try {
        setLoading(true);
        const eventsQuery = query(
          collection(db, "events"),
          where("isPublic", "==", true)
        );

        // Set up a real-time listener using onSnapshot
        const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
          const eventsData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          setEvents(eventsData);
          setLoading(false);
        });

        // Return cleanup function to unsubscribe when the component unmounts
        return () => unsubscribe();
      } catch (err) {
        console.error("Error fetching public events:", err);
        setError("Failed to load events. Please try again later.");
        setLoading(false);
      }
    }

    fetchPublicEvents();
  }, []);


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
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8  min-h-screen">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-3">
            <Calendar className="h-6 w-6 text-indigo-600" />
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
              Calendar
            </h1>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
        {/* Calendar header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b bg-gradient-to-r from-purple-50 to-indigo-50">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-full hover:bg-white hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5 text-purple-700" />
          </button>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h2>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-full hover:bg-white hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5 text-purple-700" />
          </button>
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px bg-gray-200">
          {/* Day names */}
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="bg-gray-100 text-center py-2 font-semibold text-xs sm:text-sm text-gray-700"
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
                  min-h-[60px] sm:min-h-[80px] md:min-h-[100px] p-1 sm:p-2 bg-white relative 
                  ${!day.empty
                    ? "cursor-pointer hover:bg-gray-50 transition-colors"
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
                          ? "text-gray-500"
                          : day.status === "present"
                            ? "bg-purple-100 text-purple-800 font-bold"
                            : "text-gray-800"
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
                            className="text-xs p-1 mb-1 rounded bg-purple-100 text-purple-800 truncate relative z-10 shadow-sm"
                            title={event.title}
                          >
                            {event.title}
                          </div>
                        ))}

                        {day.events.length > 2 && (
                          <div className="text-xs text-gray-600 font-medium text-center relative z-10">
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
          <div className="mt-6 bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-100 animate-fadeIn">
            <h3 className="text-lg sm:text-xl font-semibold mb-4 text-gray-800 flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-purple-600" />
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
                  className="border-b border-gray-200 pb-6 last:border-0"
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
                      <h4 className="text-xl sm:text-2xl font-bold text-gray-800 mb-3">
                        {event.title}
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                        <div className="flex items-start">
                          <Clock className="h-4 w-4 mr-2 text-purple-600 mt-1 flex-shrink-0" />
                          <span className="text-gray-700">
                            <span className="font-medium">Time:</span>{" "}
                            {event.time}
                          </span>
                        </div>

                        <div className="flex items-start">
                          <MapPin className="h-4 w-4 mr-2 text-purple-600 mt-1 flex-shrink-0" />
                          <span className="text-gray-700">
                            <span className="font-medium">Location:</span>{" "}
                            {event.location}
                          </span>
                        </div>

                        <div className="flex items-start">
                          <Tag className="h-4 w-4 mr-2 text-purple-600 mt-1 flex-shrink-0" />
                          <span className="text-gray-700">
                            <span className="font-medium">Category:</span>{" "}
                            {event.category}
                          </span>
                        </div>

                        <div className="flex items-start">
                          <Users className="h-4 w-4 mr-2 text-purple-600 mt-1 flex-shrink-0" />
                          <span className="text-gray-700">
                            <span className="font-medium">Capacity:</span>{" "}
                            {event.capacity}
                            {event.attendees !== undefined && (
                              <span className="ml-1 text-purple-700">
                                ({event.attendees} registered)
                              </span>
                            )}
                          </span>
                        </div>

                        {/* <div className="flex items-start">
                          <Code className="h-4 w-4 mr-2 text-purple-600 mt-1 flex-shrink-0" />
                          <span className="text-gray-700">
                            <span className="font-medium">Event Code:</span>{" "}
                            {event.eventCode}
                          </span>
                        </div> */}

                        <div className="flex items-start">
                          <User className="h-4 w-4 mr-2 text-purple-600 mt-1 flex-shrink-0" />
                          <span className="text-gray-700">
                            <span className="font-medium">Organized by:</span>{" "}
                            {event.registrarName}
                          </span>
                        </div>

                        <div className="flex items-start sm:col-span-2">
                          <Mail className="h-4 w-4 mr-2 text-purple-600 mt-1 flex-shrink-0" />
                          <span className="text-gray-700">
                            <span className="font-medium">Contact:</span>{" "}
                            {event.registrarEmail}
                          </span>
                        </div>
                      </div>

                      <div className="bg-purple-50 p-3 rounded-lg">
                        <p className="text-gray-700 text-sm sm:text-base">
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
  );
}