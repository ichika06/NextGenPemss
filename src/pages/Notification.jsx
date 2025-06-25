/**
 * Component to display and manage notifications for the user.
 * Uses Firebase Firestore to update and delete notifications.
 * @returns JSX element containing the notifications UI.
 */
import { useEffect, useState } from "react";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useNotifications } from "../contexts/NotificationContext";
import { 
  Bell, User, Trash2, Check, RefreshCw, 
  AlertCircle, CheckCircle, Clock, BellOff,
  Info
} from "lucide-react";

export default function RegistrarNotifications() {
  const { 
    notifications, 
    loading, 
    updateNotification, 
    removeNotification, 
    markAllAsRead 
  } = useNotifications();

  const [selected, setSelected] = useState([]);
  const allSelected = notifications.length > 0 && selected.length === notifications.length;

  const markAsRead = async (notificationId) => {
    try {
      const notificationRef = doc(db, "notifications", notificationId);
      await updateDoc(notificationRef, {
        read: true
      });
      
      // Update context state
      updateNotification(notificationId, { read: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await deleteDoc(doc(db, "notifications", notificationId));
      
      // Update context state
      removeNotification(notificationId);
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      // Update all unread notifications
      const unreadNotifications = notifications.filter(notification => !notification.read);
      
      // Update in firestore
      for (const notification of unreadNotifications) {
        await updateDoc(doc(db, "notifications", notification.id), {
          read: true
        });
      }
      
      // Update context state
      markAllAsRead();
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  const handleSelectAll = () => {
    if (allSelected) setSelected([]);
    else setSelected(notifications.map(n => n.id));
  };

  const handleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = async () => {
    for (const id of selected) {
      await deleteNotification(id);
    }
    setSelected([]);
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "event":
        return <Clock className="h-6 w-6 text-indigo-500" />;
      case "user":
        return <User className="h-6 w-6 text-green-500" />;
      case "alert":
        return <AlertCircle className="h-6 w-6 text-red-500" />;
      case "success":
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case "info":
        return <Info className="h-6 w-6 text-blue-500" />;
      default:
        return <Bell className="h-6 w-6 text-gray-500" />;
    }
  };

  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const diff = Math.floor((now - timestamp) / 1000); // difference in seconds
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
    
    return timestamp.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900">
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-center">
            <Bell className="h-6 w-6 text-indigo-600 dark:text-indigo-300 mr-3" />
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">Notifications</h1>
          </div>
          <div className="mt-4 sm:mt-0 flex flex-wrap gap-2 sm:mr-11">
            <button
              onClick={handleMarkAllAsRead}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-200 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Check className="h-4 w-4 mr-2" /> Mark all as read
            </button>
            {selected.length > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="inline-flex items-center px-4 py-2 border border-red-300 dark:border-red-600 text-sm font-medium rounded-lg text-red-700 dark:text-red-200 bg-white dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete Selected ({selected.length})
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin" />
            <span className="ml-2 text-gray-600 dark:text-gray-300">Loading notifications...</span>
          </div>
        ) : notifications.length > 0 ? (
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-700">
            <div className="flex items-center px-5 py-3 border-b border-gray-200 dark:border-zinc-700">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleSelectAll}
                className="form-checkbox h-5 w-5 text-indigo-600 dark:bg-zinc-800 dark:border-zinc-600"
                aria-label="Select all notifications"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-200">
                Select All
              </span>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-zinc-700">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-5 flex items-start transition-colors ${
                    notification.read
                      ? "bg-white dark:bg-zinc-800"
                      : "bg-indigo-50 dark:bg-zinc-900"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(notification.id)}
                    onChange={() => handleSelect(notification.id)}
                    className="form-checkbox h-5 w-5 text-indigo-600 dark:bg-zinc-800 dark:border-zinc-600 mt-1 mr-4"
                    aria-label="Select notification"
                  />
                  <div className="flex-shrink-0 mr-4">
                    <div className="rounded-full bg-gray-100 dark:bg-zinc-700 p-2">
                      {getNotificationIcon(notification.type)}
                    </div>
                  </div>
                  <div className="flex-grow">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3
                          className={`text-base font-medium ${
                            notification.read
                              ? "text-gray-900 dark:text-gray-100"
                              : "text-indigo-700 dark:text-indigo-300"
                          }`}
                        >
                          {notification.title}
                        </h3>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                          {notification.message}
                        </p>
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          {formatTimestamp(notification.timestamp)}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="p-1 rounded-full text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-zinc-800"
                            title="Mark as read"
                          >
                            <Check className="h-5 w-5" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="p-1 rounded-full text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-zinc-800"
                          title="Delete notification"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-700 p-12 text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-gray-100 dark:bg-zinc-700 mb-4">
              <BellOff className="h-8 w-8 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No notifications
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              You don't have any notifications at the moment. New notifications will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}