import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Wallet, LogOut, ChevronRight, User as UserIcon, Award, BarChart3, Settings, History, Bell, Trash2, CheckCircle, AlertTriangle, Info, Check } from "lucide-react";
import { motion } from "motion/react";
import { api } from "../lib/api";

interface DashboardLayoutProps {
  children: React.ReactNode;
  userName: string;
  userEmail: string;
  onLogout: () => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  userName,
  userEmail,
  onLogout,
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [unreadCount, setUnreadCount] = React.useState<number>(0);
  const [isNotifOpen, setIsNotifOpen] = React.useState<boolean>(false);

  const fetchNotifications = React.useCallback(async () => {
    try {
      const res = await api.get("/notifications");
      setNotifications(res.data);
      setUnreadCount(res.data.filter((n: any) => !n.read).length);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  }, []);

  React.useEffect(() => {
    fetchNotifications();

    // Poll every 12 seconds for real-time-like notifications
    const interval = setInterval(() => {
      fetchNotifications();
    }, 12000);

    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown on click outside
  React.useEffect(() => {
    if (!isNotifOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("#notification-bell-btn") && !target.closest("#notifications-dropdown")) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [isNotifOpen]);

  const markAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.put(`/notifications/${id}/read`);
      await fetchNotifications();
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put("/notifications/read-all");
      await fetchNotifications();
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  };

  const clearAllNotifications = async () => {
    try {
      await api.delete("/notifications/clear");
      await fetchNotifications();
    } catch (err) {
      console.error("Error clearing notifications:", err);
    }
  };

  const menuItems = [
    {
      name: "Dashboard Home",
      path: "/dashboard",
      icon: LayoutDashboard,
      desc: "Overview & summary",
    },
    {
      name: "Transaction History",
      path: "/history",
      icon: History,
      desc: "Search, filter & sort",
    },
    {
      name: "Budget Planning",
      path: "/budget",
      icon: Wallet,
      desc: "Set and adjust limits",
    },
    {
      name: "Analytics & Reports",
      path: "/analytics",
      icon: BarChart3,
      desc: "Charts & Spending Insights",
    },
    {
      name: "Profile & Settings",
      path: "/settings",
      icon: Settings,
      desc: "Customize preferences",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col md:flex-row font-sans" id="app-container">
      {/* Sidebar */}
      <aside className="w-full md:w-72 bg-gray-900/40 backdrop-blur-xl border-b md:border-b-0 md:border-r border-gray-800/80 flex flex-col shrink-0" id="sidebar-panel">
        {/* Sidebar Header Brand */}
        <div className="p-6 border-b border-gray-800/60 flex items-center justify-between">
          <Link 
            to="/" 
            className="flex items-center gap-3 hover:opacity-95 transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 rounded-xl p-1"
            title="Back to Landing Page"
            id="sidebar-brand-link"
          >
            <div className="p-2.5 bg-emerald-500/5 text-emerald-400 rounded-xl border border-emerald-500/15 shadow-lg shadow-emerald-500/5 group-hover:scale-105 transition-transform">
              <Award className="h-5.5 w-5.5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-white flex items-center gap-1">
                Spend<span className="text-emerald-400">Smart</span>
              </h1>
              <span className="text-[10px] text-gray-500 font-mono font-extrabold tracking-wider uppercase block mt-0.5">
                College Edition
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4.5 py-6 flex flex-col gap-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                id={`sidebar-link-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
                className={`flex items-center justify-between px-4 py-3.5 rounded-2xl border transition-all duration-300 group ${
                  isActive
                    ? "bg-emerald-500/5 border-emerald-500/15 text-emerald-300 shadow-lg shadow-emerald-500/5"
                    : "bg-transparent border-transparent hover:bg-gray-850/50 hover:border-gray-800/50 text-gray-400 hover:text-gray-100"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <Icon className={`h-4.5 w-4.5 shrink-0 transition-transform duration-300 group-hover:scale-105 ${isActive ? "text-emerald-400" : "text-gray-400 group-hover:text-gray-300"}`} />
                  <div>
                    <span className="text-xs font-bold block">{item.name}</span>
                    <span className="text-[10px] text-gray-500 font-semibold leading-none block mt-1 transition-colors group-hover:text-gray-400">{item.desc}</span>
                  </div>
                </div>
                <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-all duration-300 ${
                  isActive ? "text-emerald-400 translate-x-0.5" : "text-gray-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5"
                }`} />
              </Link>
            );
          })}
        </nav>

        {/* User Card & Logout Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/30 flex flex-col gap-3">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-gray-950/40 border border-gray-800/80 shadow-inner">
            <div className="p-2 bg-emerald-500/5 border border-emerald-500/15 rounded-xl text-emerald-400">
              <UserIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-extrabold text-gray-200 block truncate">{userName}</span>
              <span className="text-[10px] text-gray-500 font-semibold block truncate mt-0.5">{userEmail}</span>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold bg-gray-950/40 hover:bg-rose-500/5 border border-gray-800/80 hover:border-rose-500/15 text-gray-400 hover:text-rose-400 transition-all duration-300 group cursor-pointer"
            id="logout-button"
          >
            <LogOut className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col min-w-0" id="main-panel">
        {/* Top Navbar */}
        <header className="h-20 bg-gray-950/20 border-b border-gray-800/60 flex items-center justify-between px-6 md:px-10 shrink-0 sticky top-0 backdrop-blur-md z-40" id="navbar">
          <div>
            <span className="text-[10px] text-gray-500 font-mono font-extrabold tracking-wider uppercase block">
              Workspace
            </span>
            <h2 className="text-base md:text-lg font-black text-white tracking-tight mt-0.5">
              {location.pathname === "/dashboard"
                ? "Financial Dashboard"
                : location.pathname === "/history"
                ? "Transaction History"
                : location.pathname === "/budget"
                ? "Budget Allocation & Planning"
                : location.pathname === "/analytics"
                ? "Analytics & Spending Insights"
                : "Profile & Settings"}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="relative p-2.5 text-gray-400 hover:text-white bg-gray-900 border border-gray-800 hover:border-gray-750 rounded-xl transition-all cursor-pointer focus:outline-none focus:ring-4 focus:ring-emerald-500/10 flex items-center justify-center shadow-sm"
                id="notification-bell-btn"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white ring-2 ring-gray-950 animate-pulse" id="unread-badge">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown List */}
              {isNotifOpen && (
                <div 
                  className="absolute right-0 mt-3.5 w-80 sm:w-96 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-4 flex flex-col gap-3.5 z-50 text-gray-200 shadow-gray-950/40"
                  id="notifications-dropdown"
                >
                  <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                    <div>
                      <h4 className="text-sm font-extrabold text-white">Notifications</h4>
                      <span className="text-[10px] text-gray-500 mt-0.5 block">
                        Queue-based live alerts
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 transition-all cursor-pointer border border-emerald-500/20"
                          id="mark-all-read-btn"
                        >
                          Mark all read
                        </button>
                      )}
                      <button
                        onClick={clearAllNotifications}
                        className="text-gray-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-gray-800 transition-all cursor-pointer"
                        title="Clear all"
                        id="clear-all-notif-btn"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* List Container */}
                  <div className="flex flex-col gap-2 max-h-[340px] overflow-y-auto pr-1" id="notifications-list">
                    {notifications.length > 0 ? (
                      notifications.map((notif: any) => {
                        const isWarning = notif.type === "warning";
                        const isSuccess = notif.type === "success";
                        return (
                          <div
                            key={notif._id}
                            className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all relative ${
                              !notif.read ? "bg-gray-800/30 border-gray-700/50 shadow-sm" : "bg-gray-950/10 border-gray-850/40 opacity-70"
                            }`}
                          >
                            {/* Blue dot indicator for unread */}
                            {!notif.read && (
                              <span className="absolute top-4 right-4 h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                            )}

                            {/* Icon */}
                            <div
                              className={`p-1.5 rounded-lg shrink-0 ${
                                isWarning
                                  ? "bg-rose-500/5 text-rose-400 border border-rose-500/15 shadow-inner"
                                  : isSuccess
                                  ? "bg-emerald-500/5 text-emerald-400 border border-emerald-500/15 shadow-inner"
                                  : "bg-blue-500/5 text-blue-400 border border-blue-500/15 shadow-inner"
                              }`}
                            >
                              {isWarning ? (
                                <AlertTriangle className="h-4 w-4" />
                              ) : isSuccess ? (
                                <CheckCircle className="h-4 w-4" />
                              ) : (
                                <Info className="h-4 w-4" />
                              )}
                            </div>

                            {/* Message & Title */}
                            <div className="flex-1 min-w-0 pr-2">
                              <span className="text-xs font-bold text-white block truncate">{notif.title}</span>
                              <p className="text-[11px] text-gray-400 font-semibold leading-relaxed mt-1 break-words">
                                {notif.message}
                              </p>
                              <span className="text-[9px] text-gray-500 font-mono font-bold mt-1.5 block">
                                {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(notif.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                              </span>
                            </div>

                            {/* Actions */}
                            {!notif.read && (
                              <button
                                onClick={(e) => markAsRead(notif._id, e)}
                                className="text-gray-500 hover:text-emerald-400 p-1.5 rounded-lg hover:bg-gray-800 shrink-0 self-center transition-all cursor-pointer"
                                title="Mark as read"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-8 text-center text-gray-500 flex flex-col items-center justify-center gap-2.5">
                        <Bell className="h-7 w-7 text-gray-700" />
                        <span className="text-xs font-semibold text-gray-400">All caught up! No notifications.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[10px] font-black tracking-wider uppercase text-emerald-400 bg-emerald-500/5 px-3 py-1.5 border border-emerald-500/15 rounded-full shadow-sm">
                Active Student
              </span>
            </div>
          </div>
        </header>

        {/* Page Content area */}
        <main className="flex-1 p-6 md:p-10 overflow-y-auto" id="main-content">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="h-full"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
};
