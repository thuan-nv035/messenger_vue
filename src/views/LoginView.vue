<script setup>
import { ref } from "vue";
import { useRouter, RouterLink } from "vue-router";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const auth = useAuthStore();

const email = ref("");
const password = ref("");
const loading = ref(false);
const error = ref("");

const handleLogin = async () => {
  try {
    loading.value = true;
    error.value = "";

    await auth.login(email.value, password.value);

    router.push("/");
  } catch (err) {
    error.value =
      err.response?.data?.detail || "Đăng nhập thất bại, kiểm tra lại tài khoản";
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-100 px-4">
    <div class="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
      <h1 class="text-3xl font-bold text-blue-600 text-center mb-2">
        Messenger
      </h1>

      <p class="text-center text-gray-500 mb-8">
        Đăng nhập để tiếp tục
      </p>

      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            v-model="email"
            type="email"
            required
            class="w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Nhập email"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Mật khẩu
          </label>
          <input
            v-model="password"
            type="password"
            required
            class="w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Nhập mật khẩu"
          />
        </div>

        <p v-if="error" class="text-red-500 text-sm">
          {{ error }}
        </p>

        <button
          type="submit"
          :disabled="loading"
          class="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-60"
        >
          {{ loading ? "Đang đăng nhập..." : "Đăng nhập" }}
        </button>
      </form>

      <p class="text-center text-sm text-gray-500 mt-6">
        Chưa có tài khoản?
        <RouterLink to="/register" class="text-blue-600 font-semibold">
          Đăng ký
        </RouterLink>
      </p>
    </div>
  </div>
</template>