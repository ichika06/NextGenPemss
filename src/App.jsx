/**
 * This file contains the main routing logic for the application using React Router.
 * It sets up protected routes based on user roles and renders different components accordingly.
 * @returns The main App component that wraps the entire application with authentication and notification providers.
 */
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import Register from "./pages/Register";
import AdminDashboard from "./pages/admin/Dashboard";
import RegistrarDashboard from "./pages/registrar/Dashboard";
import TeacherDashboard from "./pages/teacher/Dashboard";
import StudentDashboard from "./pages/student/Dashboard";
import PublicEventView from "./pages/PublicEventView";
import PublicEventsList from "./pages/PublicEventList";
import NFCRegisterEvent from "./components/RegisterEvent/CurrentNFCRegistration";
import NotFound from "./NotFound";
import EditEvent from "./pages/EditEvent";
import ViewEvent from "./pages/EventView";
import LandingPage from "./pages/LandingPage";
import SmoothScroll from "./components/smoothScroll";
import AttendanceNFCScan from "./pages/teacher/AttendanceNFCScan";
import TeacherAttendanceDetails from "./pages/teacher/AttendanceDetails";
import { LoadingAnimation } from "./components/LoadingAnimation";
import EventQRCodeScanner from "./pages/student/EventQRCodeScanner";
import StreamEvent from "./pages/StreamEvent";
import StreamEventDetails from "./pages/StreamEventDetails";
import CertificateBuilder from "./pages/CertificationBuilder/CertificationBuilderContainer";

// Protected route component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { currentUser, userRole, loading } = useAuth();

  if (loading)
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

  if (!currentUser) return <Navigate to="/landingPage" />;

  if (!allowedRoles.includes(userRole)) {
    // Redirect to appropriate dashboard based on role
    if (userRole === "admin") return <Navigate to="/admin" />;
    if (userRole === "registrar") return <Navigate to="/registrar" />;
    if (userRole === "teacher") return <Navigate to="/teacher" />;
    if (userRole === "student") return <Navigate to="/student" />;
    return <Navigate to="/landingPage" />;
  }

  return children;
};

const RouterRoot = () => {
  const { currentUser, userRole } = useAuth();

  if (!currentUser) {
    return <Navigate to="/landingPage" />;
  }

  // Redirect to appropriate dashboard based on role
  if (userRole === "admin") return <Navigate to="/admin" />;
  if (userRole === "registrar") return <Navigate to="/registrar" />;
  if (userRole === "teacher") return <Navigate to="/teacher" />;
  if (userRole === "student") return <Navigate to="/student" />;

  // Fallback
  return <Navigate to="/landingPage" />;
};

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <SmoothScroll />
        <Router>
          <AppRoutes />
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}

// Separate component for routes, which will have access to AuthContext
function AppRoutes() {
  const { userRole } = useAuth();
  return (
    <Routes>
      
      <Route path="/register" element={<Register />} />

      {/* Admin routes */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* Registrar routes */}
      <Route
        path="/registrar/*"
        element={
          <ProtectedRoute allowedRoles={["registrar"]}>
            <RegistrarDashboard />
          </ProtectedRoute>
        }
      />

      {/* Specific registrar route for editing events */}
      <Route
        path={`/${userRole}/edit-event/:eventId`}
        element={
          <ProtectedRoute allowedRoles={["registrar", "admin"]}>
            <EditEvent />
          </ProtectedRoute>
        }
      />

      <Route
        path={`/${userRole}/event/:eventId`}
        element={
          <ProtectedRoute allowedRoles={["registrar", "admin"]}>
            <ViewEvent />
          </ProtectedRoute>
        }
      />

      <Route
        path={`/${userRole}/certificate-builder`}
        element={
          <ProtectedRoute allowedRoles={["registrar", "admin"]}>
            <CertificateBuilder />
          </ProtectedRoute>
        }
      />

      {/* Teacher routes */}
      <Route
        path="/teacher/*"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path={`/${userRole}/attendance-details/:sessionId`}
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherAttendanceDetails />
          </ProtectedRoute>
        }
      />

      {/* Student routes */}
      <Route
        path="/student/*"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentDashboard />
          </ProtectedRoute>
        }
      />

      {/* Private Events List - accessible by anyone */}
      <Route path={`/${userRole}/events`} element={<PublicEventsList />} />

      {/* Public Events List - accessible by anyone */}
      <Route path={`/events`} element={<PublicEventsList />} />

      {/* Event details - accessible by anyone for public events */}
      <Route path="/events/:eventId" element={<PublicEventView />} />

      {/* Event details - accessible by anyone for public events */}
      <Route path="/landingPage" element={<LandingPage />} />

      {/* Redirect root to events list instead of login */}
      <Route path="/" element={<RouterRoot />} />

      {/* scan NFC-Card for attendance / public access */}
      <Route path="/scan-attendance" element={<AttendanceNFCScan />} />

      {/* stream the event in any case by accessing the url */}
      <Route path="/stream-event" element={<StreamEvent />} />

      {/* stream the event in any case by accessing the url */}
      <Route
        path="/stream-event-details/:eventId"
        element={<StreamEventDetails />}
      />

      <Route
        path="/event-qr-scanner/:eventId"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <EventQRCodeScanner />
          </ProtectedRoute>
        }
      />

      {/* Register for event - requires authentication */}
      <Route
        path="/register-event/:eventId"
        element={
          <ProtectedRoute
            allowedRoles={["admin", "registrar", "teacher", "student"]}
          >
            <NFCRegisterEvent />
          </ProtectedRoute>
        }
      />

      {/* 404 page */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;