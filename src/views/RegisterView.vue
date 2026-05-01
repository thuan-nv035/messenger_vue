<script setup>
import { ref } from "vue";
import { useRouter, RouterLink } from "vue-router";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const auth = useAuthStore();

const fullName = ref("");
const email = ref("");
const password = ref("");
const loading = ref(false);
const error = ref("");

const handleRegister = async () => {
  try {
    loading.value = true;
    error.value = "";

    await auth.register({
      full_name: fullName.value,
      email: email.value,
      password: password.value,
    });

    router.push("/login");
  } catch (err) {
    error.value =
      err.response?.data?.detail || "Đăng ký thất bại";
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-100 px-4">
    <div class="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
      <h1 class="text-3xl font-bold text-blue-600 text-center mb-2">
        Tạo tài khoản
      </h1>

      <p class="text-center text-gray-500 mb-8">
        Đăng ký tài khoản mới
      </p>

      <form @submit.prevent="handleRegister" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Họ tên
          </label>
          <input
            v-model="fullName"
            type="text"
            required
            class="w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Nguyễn Văn A"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            v-model="email"
            type="email"
            required
            class="w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="example@gmail.com"
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
          {{ loading ? "Đang đăng ký..." : "Đăng ký" }}
        </button>
      </form>

      <p class="text-center text-sm text-gray-500 mt-6">
        Đã có tài khoản?
        <RouterLink to="/login" class="text-blue-600 font-semibold">
          Đăng nhập
        </RouterLink>
      </p>
    </div>
  </div>
</template>