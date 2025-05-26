import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import useFirestoreChecker from "../../components/reuseChecker/FirestoreCheckerHook";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../firebase/config";
import EventCard from "../../components/EventCard";
import { ChevronLeft } from "lucide-react";
import { LoadingAnimation } from "../../components/LoadingAnimation";

const StudentEventAttendance = () => {
  const { currentUser } = useAuth();
  const { checkUserEventRegistrationByEmail } = useFirestoreChecker();
  const [registeredEvents, setRegisteredEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRegisteredEvents = () => {
      if (!currentUser || !currentUser.email) {
        setLoading(false);
        return;
      }

      try {
        // Step 1: Set up a real-time listener for the user's registered events
        const attendeesRef = collection(db, "eventAttendees");
        const q = query(attendeesRef, where("email", "==", currentUser.email));

        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
          if (querySnapshot.empty) {
            setRegisteredEvents([]);
            setLoading(false);
            return;
          }

          // Step 2: Extract eventIds from the registration data
          const eventIds = querySnapshot.docs.map((doc) => doc.data().eventId);

          // Step 3: Fetch the full event details for each eventId
          const eventsData = await Promise.all(
            eventIds.map(async (eventId) => {
              const eventDocRef = doc(db, "events", eventId);
              const eventDoc = await getDoc(eventDocRef);

              if (eventDoc.exists()) {
                return { id: eventDoc.id, ...eventDoc.data() };
              }
              return null;
            })
          );

          // Filter out any null values (events that couldn't be found)
          const validEvents = eventsData.filter((event) => event !== null);
          setRegisteredEvents(validEvents);
          setLoading(false);
        });

        // Clean up listener on component unmount
        return () => unsubscribe();
      } catch (err) {
        console.error("Error fetching registered events:", err);
        setError(
          "Failed to load your registered events. Please try again later."
        );
        setLoading(false);
      }
    };

    fetchRegisteredEvents();
  }, [currentUser]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="border-b background-primary px-6 py-4">
          <h2 className="text-2xl font-bold text-primary">
            Your Registered Events
          </h2>
          <p className="text-primary-secondary mt-1">
            View and manage events you've registered to attend
          </p>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingAnimation
                type="spinner"
                size="md"
                variant="info"
                text="Loading saved registered events..."
              />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg my-4">
              <p>{error}</p>
            </div>
          ) : registeredEvents.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <h3 className="text-lg font-medium text-gray-700">
                You haven't registered for any events yet.
              </h3>
              <p className="text-gray-500 mt-2">
                Browse available events and register to see them here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
              {registeredEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentEventAttendance;
