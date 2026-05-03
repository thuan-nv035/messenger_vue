<script setup>
import { ref, onMounted } from "vue";
import { X, Unlock } from "lucide-vue-next";
import { useChatStore } from "../../stores/chat";

const emit = defineEmits(["close"]);

const chat = useChatStore();

const blockedUsers = ref([]);
const loading = ref(false);
const processingId = ref(null);

const avatarUrl = (user) => {
  if (!user.avatar) return null;

  if (user.avatar.startsWith("http")) return user.avatar;

  return `${import.meta.env.VITE_API_URL}${user.avatar}`;
};

const loadBlockedUsers = async () => {
  loading.value = true;

  try {
    blockedUsers.value = await chat.fetchBlockedUsers();
  } finally {
    loading.value = false;
  }
};

const handleUnblock = async (user) => {
  const ok = confirm(`Bạn có chắc muốn gỡ chặn ${user.full_name} không?`);

  if (!ok) return;

  processingId.value = user.user_id;

  try {
    await chat.unblockUser(user.user_id);

    blockedUsers.value = blockedUsers.value.filter(
      (item) => Number(item.user_id) !== Number(user.user_id)
    );
  } finally {
    processingId.value = null;
  }
};

onMounted(() => {
  loadBlockedUsers();
});
</script>

<template>
  <div class="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center px-4">
    <div class="w-full max-w-lg bg-[#242526] text-white rounded-2xl shadow-2xl border border-white/10 overflow-hidden">
      <div class="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">
            Người đã chặn
          </h2>
          <p class="text-sm text-gray-400">
            Gỡ chặn để đoạn chat hiện lại ở danh sách chính
          </p>
        </div>

        <button
          type="button"
          class="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center"
          @click="emit('close')"
        >
          <X class="w-5 h-5 text-gray-300" />
        </button>
      </div>

      <div class="max-h-[480px] overflow-y-auto p-3">
        <div
          v-if="loading"
          class="text-center text-gray-400 py-10"
        >
          Đang tải danh sách...
        </div>

        <div
          v-else-if="blockedUsers.length === 0"
          class="text-center text-gray-400 py-10"
        >
          Bạn chưa chặn ai.
        </div>

        <div
          v-for="user in blockedUsers"
          :key="user.user_id"
          class="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/5"
        >
          <div class="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-[#5f8dff] to-[#3f5df3] flex items-center justify-center text-white font-bold shrink-0">
            <img
              v-if="avatarUrl(user)"
              :src="avatarUrl(user)"
              class="w-full h-full object-cover"
            />

            <span v-else>
              {{ user.full_name?.charAt(0).toUpperCase() || "U" }}
            </span>
          </div>

          <div class="min-w-0 flex-1">
            <p class="font-semibold text-white truncate">
              {{ user.full_name }}
            </p>

            <p class="text-sm text-gray-400 truncate">
              {{ user.email }}
            </p>
          </div>

          <button
            type="button"
            :disabled="processingId === user.user_id"
            class="px-3 py-2 rounded-xl bg-[#2d88ff] hover:bg-[#1f6fd1] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
            @click="handleUnblock(user)"
          >
            <Unlock class="w-4 h-4" />
            {{ processingId === user.user_id ? "Đang gỡ..." : "Gỡ chặn" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>