import { defineStore } from "pinia";
import api from "../api/axios";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: JSON.parse(localStorage.getItem("user")) || null,
    token: localStorage.getItem("access_token") || null,
  }),

  getters: {
    isLoggedIn: (state) => !!state.token,
  },

  actions: {
    async login(email, password) {
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);

      const res = await api.post("/users/login", formData, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      this.token = res.data.access_token;

      localStorage.setItem("access_token", this.token);

      await this.fetchMe();

      return res.data;
    },

    async register(data) {
      const res = await api.post("/users/register", data);
      return res.data;
    },

    async fetchMe() {
      const res = await api.get("/users/me");

      this.user = res.data;

      localStorage.setItem("user", JSON.stringify(this.user));

      return res.data;
    },

    logout() {
      this.user = null;
      this.token = null;

      localStorage.removeItem("access_token");
      localStorage.removeItem("user");
    },
  },
});