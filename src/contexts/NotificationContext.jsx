/**
 * NotificationProvider component that manages the state of notifications for the current user.
 * @param {{children}} children - The child components to be wrapped by the NotificationProvider.
 * @returns JSX element that provides the notification context to its children.
 */
import React, { createContext, useState, useContext, useEffect } from "react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "./AuthContext";

const NotificationContext = createContext();

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const { currentUser } = useAuth();

  useEffect(() => {
    async function fetchNotifications() {
      if (!currentUser) {
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
        return;
      }

      try {
        const notificationsQuery = query(
          collection(db, "notifications"),
          where("recipientId", "==", currentUser.uid),
          orderBy("timestamp", "desc")
        );
        
        const snapshot = await getDocs(notificationsQuery);
        const notificationsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate?.() || new Date(doc.data().timestamp)
        }));
        
        setNotifications(notificationsData);
        
        // Calculate unread count
        const unreadNotifications = notificationsData.filter(notification => !notification.read);
        setUnreadCount(unreadNotifications.length);
        
        setLoading(false);
      } catch (error) {
        console.error("Error fetching notifications:", error);
        setLoading(false);
      }
    }

    fetchNotifications();
    
    // Set up a refresh interval (optional)
    const intervalId = setInterval(fetchNotifications, 60000); // Refresh every minute
    
    return () => clearInterval(intervalId);
  }, [currentUser]);

  // Function to update a notification
  const updateNotification = (notificationId, updateData) => {
    setNotifications(prevNotifications => {
      const updatedNotifications = prevNotifications.map(notification =>
        notification.id === notificationId
          ? { ...notification, ...updateData }
          : notification
      );
      
      // Recalculate unread count
      const unreadNotifications = updatedNotifications.filter(notification => !notification.read);
      setUnreadCount(unreadNotifications.length);
      
      return updatedNotifications;
    });
  };

  // Function to remove a notification
  const removeNotification = (notificationId) => {
    setNotifications(prevNotifications => {
      const updatedNotifications = prevNotifications.filter(
        notification => notification.id !== notificationId
      );
      
      // Recalculate unread count
      const unreadNotifications = updatedNotifications.filter(notification => !notification.read);
      setUnreadCount(unreadNotifications.length);
      
      return updatedNotifications;
    });
  };

  // Function to mark all notifications as read
  const markAllAsRead = () => {
    setNotifications(prevNotifications => {
      const updatedNotifications = prevNotifications.map(notification => ({
        ...notification,
        read: true
      }));
      
      setUnreadCount(0);
      return updatedNotifications;
    });
  };

  const value = {
    notifications,
    loading,
    unreadCount,
    updateNotification,
    removeNotification,
    markAllAsRead,
    refreshNotifications: async () => {
      setLoading(true);
      await fetchNotifications();
    }
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}