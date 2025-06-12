/**
 * Functional component that displays an event card with details such as title, date, time, location, category, attendees, and image.
 * @param {{event: {id: string, title: string, date: string, time: string, location: string, category: string, attendees: number, image: string, isLive: boolean, isPublic: boolean}}} event - The event object containing details to display.
 * @returns JSX element representing the event card.
 */
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  BellRing,
  Globe,
  Radio,
  Tag
} from "lucide-react";
import { Link } from "react-router-dom";
import CountdownDisplay from "../components/CountingDisplay";

export default function EventCard({ event }) {
  const {
    id,
    title,
    date,
    time,
    location,
    category,
    attendees,
    image,
    isLive,
    isPublic,
  } = event;

  // Format date
  const formattedDate = new Date(date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="bg-white rounded-lg dark:shadow-gray-200 shadow-2xl overflow-hidden transition-transform duration-300 hover:shadow-2xl hover:-translate-y-1">
      <div className="relative h-48 bg-indigo-100">
        {image ? (
          <img
            src={image || "/placeholder.svg"}
            alt={title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-r from-indigo-500 to-purple-500">
            <Calendar className="h-16 w-16 text-white opacity-50" />
          </div>
        )}

        {/* Horizontal badges at bottom left */}
        <div className="absolute bottom-2 left-2 flex flex-row gap-2">
        <div className="bg-amber-50 px-2 py-1 rounded-full text-xs font-medium text-zinc-600 text-center flex items-center gap-1">
            <Tag className="h-4 w-4" />
            {category}
          </div>
          {isLive && (
            <div className="bg-red-600 px-2 py-1 rounded-full text-xs font-medium text-zinc-50 text-center flex items-center gap-1">
              <Radio className="h-4 w-4" />
              Live access
            </div>
          )}
          <div className="bg-green-600 px-2 py-1 rounded-full text-xs font-medium text-zinc-50 text-center flex items-center gap-1">
            <Globe className="h-4 w-4" />
            {isPublic ? "Public Event" : "Private Event"}
          </div>
        </div>
      </div>

      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-1">
          {title}
        </h3>

        <div className="space-y-2 mb-4">
          <div className="flex items-center text-sm text-gray-600">
            <Calendar className="h-4 w-4 mr-2 text-indigo-500" />
            {formattedDate}
          </div>

          <div className="flex items-center text-sm text-gray-600">
            <Clock className="h-4 w-4 mr-2 text-indigo-500" />
            {time}
          </div>

          <div className="flex items-center text-sm text-gray-600">
            <MapPin className="h-4 w-4 mr-2 text-indigo-500" />
            <span className="line-clamp-1">{location}</span>
          </div>

          <div className="flex items-center text-sm text-gray-600">
            <Users className="h-4 w-4 mr-2 text-indigo-500" />
            {attendees} attendees
          </div>

          <div className="flex items-center text-sm text-gray-600">
            <BellRing className="h-4 w-4 mr-2 text-indigo-500" />
            <CountdownDisplay
              eventDate={event.date}
              eventTime={event.time}
              showSeconds={true}
              expiredText="Not Available"
            />
          </div>
        </div>

        <Link
          to={`/events/${event.id}`}
          className="btn-primary block w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md transition duration-150 ease-in-out"
        >
          View Details
        </Link>
      </div>
    </div>
  );
}
