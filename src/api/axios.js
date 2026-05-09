import { data } from "autoprefixer";
import axios from "axios";

let axiosInstance = null;
let isRefreshing = false;
let failedQueue = [];

// Hàm xử lý hàng chờ các request bị 401 khi đang refresh token
const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

function getInstance() {
  if (axiosInstance) return axiosInstance;

  axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: {
      "Content-Type": "application/json",
    },
  });

  // --- Interceptor Request: Gắn Token ---
  axiosInstance.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem("access_token");

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    },
  );

  // --- Interceptor Response: Xử lý lỗi 401 (Refresh Token) ---
  axiosInstance.interceptors.response.use(
    (response) => {
      return response;
    },
    async (error) => {
      const auth = useAuthStore();
      const originalRequest = error.config;

      // Nếu lỗi 401 và không phải là request đang cố gắng refresh
      if (error.response?.status === 401 && !originalRequest._retry) {
        // Nếu đã có một request đang đi refresh rồi, cho các request sau vào hàng đợi
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return axiosInstance(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          // Gọi API refresh token (Sử dụng axios gốc để tránh lặp vô hạn)
          const { data } = await axios.post(
            `${import.meta.env.VITE_API_URL}/user/auth/refresh`,
            {
              refresh_token: auth.refreshToken,
            },
          );

          // Lưu token mới vào store (và localStorage thông qua store)
          auth.setTokens(data.access_token, data.refresh_token);

          // Giải phóng hàng đợi với token mới
          processQueue(null, data.access_token);

          // Chạy lại request bị lỗi ban đầu
          return axiosInstance(originalRequest);
        } catch (refreshError) {
          // Nếu refresh thất bại (refresh token hết hạn), đăng xuất luôn
          processQueue(refreshError, null);
          auth.logout();
          router.push("/login");
          alert("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(error);
    },
  );

  return axiosInstance;
}

// Export các phương thức tiện ích
const api = {
  get: (url, params = {}, config = {}) => getInstance().get(url, { params, ...config }),

  post: (url, data = {}, config = {}) => getInstance().post(url, data, config),

  patch: (url, data = {}, config = {}) => getInstance().patch(url, data, config),

  put: (url, data = {}, config = {}) => getInstance().put(url, data, config),

  delete: (url, config = {}) => getInstance().delete(url, config),

  setHeaders: (headers) => {
    const instance = getInstance()
    Object.assign(instance.defaults.headers, headers)
  }
}

// const api = axios.create({
//   baseURL: import.meta.env.VITE_API_URL,
// });

// api.interceptors.request.use((config) => {
//   const token = localStorage.getItem("access_token");

//   if (token) {
//     config.headers.Authorization = `Bearer ${token}`;
//   }

//   return config;
// });

export default api;
