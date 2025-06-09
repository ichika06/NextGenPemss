/**
 * SidebarNavigation component that displays navigation items based on the user's role and access level.
 * @param {{string}} role - The role of the user (e.g., admin, registrar, teacher).
 * @param {{string}} accessLevel - The access level of the user (e.g., elevated, super).
 * @param {{number}} unreadCount - The count of unread notifications.
 * @param {{function}} setIsOpen - Function to set the open state of the sidebar.
 * @param {{number}} windowWidth - The width of the window.
 * @returns A sidebar navigation component with dynamic navigation items based on the user's role and access level.
 */
import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Calendar,
  Trash,
  Users,
  Bell,
  User,
  FolderOpen,
  LayoutDashboard,
  ChevronRight,
  ChevronDown,
  CreditCard,
  Settings,
  PlusCircle,
  List,
  UserCheck,
  Key,
  Database,
  ClipboardCheck,
  BookOpen,
  CalendarCheck2,
  MessageSquare,
  Clock,
  CheckCircle,
  FileText,
  Calendar1,
  BellPlus
} from "lucide-react";

const SidebarNavigation = ({ role, accessLevel, unreadCount, setIsOpen, windowWidth }) => {
  const location = useLocation();
  const [activeGroup, setActiveGroup] = React.useState(null);

  // Set initial active group based on current path
  React.useEffect(() => {
    const currentPath = location.pathname;
    const navItems = getNavItems();
    
    // Reset activeGroup first
    let foundGroup = null;

    // Find which group contains the current path
    navItems.forEach((item) => {
      if (item.isGroup && item.items) {
        if (item.items.some((subItem) => subItem.path === currentPath)) {
          foundGroup = item.name;
        }
      }
    });

    // Only set activeGroup if we found a matching group, otherwise set to null
    setActiveGroup(foundGroup);
  }, [location.pathname]);

  const isActive = (path) => {
    return location.pathname === path;
  };

  const toggleGroup = (group) => {
    setActiveGroup(activeGroup === group ? null : group);
  };

  // Handle navigation item click
  const handleNavItemClick = (item) => {
    // Close sidebar on mobile
    if (windowWidth < 1024) {
      setIsOpen(false);
    }
    
    // If clicking on a non-group item, close all groups
    if (!item.isGroup) {
      // Check if this item belongs to any group
      const navItems = getNavItems();
      const belongsToGroup = navItems.some(navItem => 
        navItem.isGroup && navItem.items && navItem.items.some(subItem => subItem.path === item.path)
      );
      
      // If the item doesn't belong to any group, close all dropdowns
      if (!belongsToGroup) {
        setActiveGroup(null);
      }
    }
  };

  // Define navigation items based on role
  const getNavItems = () => {
    // Common items for all roles
    const dashboardItem = {
      name: "Dashboard",
      path: `/${role}`,
      icon: <LayoutDashboard className="h-5 w-5" />,
    };

    const publiceventcalendar = {
      name: "Calendar",
      path: `/${role}/public-event-calendar`,
      icon: <Calendar1 className="h-5 w-5" />,
    };

    // Role-specific items
    if (role === "registrar") {
      return [
        dashboardItem,
        {
          name: "Events",
          icon: <Calendar className="h-5 w-5" />,
          isGroup: true,
          items: [
            {
              name: "Public Events",
              path: `/${role}/events`,
              icon: <Calendar className="h-4 w-4" />,
            },
            {
              name: "Create Event",
              path: `/${role}/create-event`,
              icon: <PlusCircle className="h-4 w-4" />,
            },
            {
              name: "Manage Events",
              path: `/${role}/manage-events`,
              icon: <List className="h-4 w-4" />,
            },
            {
              name: "Certificate Builder",
              path: `/${role}/certificate-builder`,
              icon: <List className="h-4 w-4" />,
            },
            // {
            //   name: "Query",
            //   path: `/${role}/query`,
            //   icon: <PlusCircle className="h-4 w-4" />,
            // },
          ],
        },
        {
          name: "User Management",
          icon: <Users className="h-5 w-5" />,
          isGroup: true,
          items: [
            {
              name: "Add User",
              path: `/${role}/add-user`,
              icon: <User className="h-4 w-4" />,
            },
            {
              name: "Delete Users",
              path: `/${role}/delete-users`,
              icon: <Trash className="h-4 w-4" />,
            },
            {
              name: "All Users",
              path: `/${role}/showallusers`,
              icon: <User className="h-4 w-4" />,
            },
            {
              name: "NFC Registration",
              path: `/${role}/nfc-card-setup`,
              icon: <CreditCard className="h-4 w-4" />,
            },
          ],
        },
        {
          name: "Send Notifications",
          path: `/${role}/notification-send-notif`,
          icon: <BellPlus className="h-5 w-5" />,
        },
        {
          name: "File Manager",
          path: `/${role}/file-manager`,
          icon: <FolderOpen className="h-5 w-5" />,
        },
        {
          name: "Notifications",
          path: `/${role}/notifications`,
          icon: <Bell className="h-5 w-5" />,
          badge: unreadCount > 0 ? unreadCount : null,
        },
        publiceventcalendar,
        {
          name: "Profile",
          path: `/${role}/profile`,
          icon: <User className="h-5 w-5" />,
        },
        // {
        //   name: "Settings",
        //   path: `/${role}/settings`,
        //   icon: <Settings className="h-5 w-5" />,
        // },
        {
          name: "Wifi Config",
          path: `/${role}/wificonfig`,
          icon: <Settings className="h-5 w-5" />,
        },
      ];
    } else if (role === "admin") {
      // Base admin navigation items
      const adminItems = [
        dashboardItem,
        {
          name: "Events",
          icon: <Calendar className="h-5 w-5" />,
          isGroup: true,
          items: [
            {
              name: "Create Event",
              path: `/${role}/create-event`,
              icon: <Calendar className="h-4 w-4" />,
            },
            {
              name: "Public Events",
              path: `/events`,
              icon: <Calendar className="h-4 w-4" />,
            },
            {
              name: "Manage Events",
              path: `/${role}/manage-events`,
              icon: <List className="h-4 w-4" />,
            },
          ],
        },
        {
          name: "File Manager",
          path: `/${role}/file-manager`,
          icon: <FolderOpen className="h-5 w-5" />,
        },
        publiceventcalendar,
        {
          name: "Notifications",
          path: `/${role}/notifications`,
          icon: <Bell className="h-5 w-5" />,
          badge: unreadCount > 0 ? unreadCount : null,
        },
        {
          name: "Profile",
          path: `/${role}/profile`,
          icon: <User className="h-5 w-5" />,
        },
        // {
        //   name: "Settings",
        //   path: `/${role}/settings`,
        //   icon: <Settings className="h-5 w-5" />,
        // },
        {
          name: "Wifi Config",
          path: `/${role}/wificonfig`,
          icon: <Settings className="h-5 w-5" />,
        },
      ];

      // Add elevated access level items
      if (accessLevel === "elevated") {
        adminItems.splice(1, 0, {
          name: "User Management",
          icon: <Users className="h-5 w-5" />,
          isGroup: true,
          items: [
            {
              name: "All Users",
              path: `/${role}/users`,
              icon: <User className="h-4 w-4" />,
            }
          ],
        });
      }

      // Add super admin level items
      if (accessLevel === "super") {
        adminItems.splice(1, 0, {
          name: "User Management",
          icon: <Users className="h-5 w-5" />,
          isGroup: true,
          items: [
            {
              name: "Add User",
              path: `/${role}/add-user`,
              icon: <User className="h-4 w-4" />,
            },
            {
              name: "Delete Users",
              path: `/${role}/delete-users`,
              icon: <Trash className="h-4 w-4" />,
            },
            {
              name: "All Users",
              path: `/${role}/showallusers`,
              icon: <User className="h-4 w-4" />,
            },
            {
              name: "NFC Registration",
              path: `/${role}/nfc-card-setup`,
              icon: <CreditCard className="h-4 w-4" />,
            },
          ],
        },
          {
            name: "Send Notifications",
            path: `/${role}/notification-send-notif`,
            icon: <BellPlus className="h-5 w-5" />,
          },
        );
        // Find the Events group in adminItems and add Certificate Builder to it
        const eventsGroupIndex = adminItems.findIndex(item => item.name === "Events");
        if (eventsGroupIndex !== -1) {
          adminItems[eventsGroupIndex].items.push({
            name: "Certificate Builder",
            path: `/${role}/certificate-builder`,
            icon: <List className="h-4 w-4" />,
          });
        }
      }

      return adminItems;
    } else if (role === "teacher") {
      // Enhanced teacher navigation items with improved attendance tracking
      return [
        dashboardItem,
        {
          name: "Attendance",
          icon: <ClipboardCheck className="h-5 w-5" />,
          isGroup: true,
          items: [
            {
              name: "Create Attendance",
              path: `/${role}/create-attendance`,
              icon: <PlusCircle className="h-4 w-4" />,
            },
            {
              name: "Manage Attendance",
              path: `/${role}/manage-attendance/`,
              icon: <CheckCircle className="h-4 w-4" />,
            }
          ],
        },
        {
          name: "Messages",
          path: `/${role}/messages`,
          icon: <MessageSquare className="h-5 w-5" />,
          // badge: unreadCount > 0 ? unreadCount : null,
        },
        {
          name: "Events",
          path: `/events`,
          icon: <Calendar className="h-5 w-5" />,
        },
        publiceventcalendar,
        {
          name: "Notifications",
          path: `/${role}/notifications`,
          icon: <Bell className="h-5 w-5" />,
          badge: unreadCount > 0 ? unreadCount : null,
        },
        {
          name: "Profile",
          path: `/${role}/profile`,
          icon: <User className="h-5 w-5" />,
        },
        // {
        //   name: "Settings",
        //   path: `/${role}/settings`,
        //   icon: <Settings className="h-5 w-5" />,
        // },
      ];
    }

    // Updated items for student role with attendance features
    return [
      dashboardItem,
      {
        name: "Events",
        path: `/events`,
        icon: <Calendar className="h-5 w-5" />,
      },
      {
        name: "Event Attendance",
        path: `/${role}/event-attendance`,
        icon: <CalendarCheck2 className="h-5 w-5" />,
      },
      {
        name: "Event Pre-Registered",
        icon: <UserCheck className="h-5 w-5" />,
        path: `/${role}/pre-registered`,
      },
      {
        name: "Class Attendance",
        icon: <ClipboardCheck className="h-5 w-5" />,
        path: `/${role}/upcoming-attendance`,
      },
      publiceventcalendar,
      {
        name: "Notifications",
        path: `/${role}/notifications`,
        icon: <Bell className="h-5 w-5" />,
        badge: unreadCount > 0 ? unreadCount : null,
      },
      {
        name: "Messages",
        path: `/${role}/messages`,
        icon: <MessageSquare className="h-5 w-5" />,
        // badge: unreadCount > 0 ? unreadCount : null,
      },
      {
        name: "Profile",
        path: `/${role}/profile`,
        icon: <User className="h-5 w-5" />,
      },
      // {
      //   name: "Settings",
      //   path: `/${role}/settings`,
      //   icon: <Settings className="h-5 w-5" />,
      // },
    ];
  };

  const navItems = getNavItems();

  // Render a navigation item
  const renderNavItem = (item) => {
    if (item.isGroup) {
      const isGroupActive =
        activeGroup === item.name || (item.items && item.items.some((subItem) => isActive(subItem.path)));

      return (
        <div key={item.name} className="space-y-1">
          <button
            onClick={() => toggleGroup(item.name)}
            className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium rounded-md transition-colors ${isGroupActive ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
          >
            <div className="flex items-center">
              <span className={`mr-3 ${isGroupActive ? "text-indigo-700" : "text-gray-500"}`}>{item.icon}</span>
              {item.name}
            </div>
            <span className="transition-transform duration-200">
              {isGroupActive ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </span>
          </button>

          {isGroupActive && (
            <div className="pl-10 space-y-1 animate-fadeIn">
              {item.items.map((subItem) => (
                <Link
                  key={subItem.path}
                  to={subItem.path}
                  onClick={() => handleNavItemClick(subItem)}
                  className={`flex items-center px-4 py-3 text-sm rounded-md ${isActive(subItem.path)
                    ? "bg-indigo-100 text-indigo-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                >
                  <span className={`mr-3 ${isActive(subItem.path) ? "text-indigo-700" : "text-gray-500"}`}>
                    {subItem.icon}
                  </span>
                  {subItem.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={() => handleNavItemClick(item)}
        className={`group flex items-center justify-between px-4 py-3 text-sm font-medium rounded-md transition-colors ${isActive(item.path) ? "bg-indigo-100 text-indigo-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          }`}
      >
        <div className="flex items-center">
          <span className={`mr-3 ${isActive(item.path) ? "text-indigo-700" : "text-gray-500"}`}>{item.icon}</span>
          {item.name}
        </div>

        {item.badge && (
          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-indigo-600 rounded-full">
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  return <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">{navItems.map(renderNavItem)}</nav>;
};

export default SidebarNavigation;