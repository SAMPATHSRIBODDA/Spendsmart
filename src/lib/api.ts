import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
});

// Interceptor to attach JWT token to every request automatically
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor to intercept expired tokens and redirect if needed
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // If unauthorized, clear token and trigger a reload/redirect
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      // Check if we are already on login or signup to prevent loop
      if (!window.location.pathname.includes("/login") && !window.location.pathname.includes("/signup")) {
        window.location.href = "/login?expired=true";
      }
    }
    return Promise.reject(error);
  }
);
