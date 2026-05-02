<script setup>
import { ref } from "vue";
import { X } from "lucide-vue-next";
import { useChatStore } from "../../stores/chat";

const emit = defineEmits(["close"]);

const chat = useChatStore();

const mode = ref("private");
const userIdsText = ref("");
const groupName = ref("");
const loading = ref(false);
const error = ref("");

const parseUserIds = () => {
  return userIdsText.value
    .split(",")
    .map((id) => Number(id.trim()))
    .filter((id) => !Number.isNaN(id) && id > 0);
};

const handleCreate = async () => {
  try {
    loading.value = true;
    error.value = "";

    const memberIds = parseUserIds();
    console.log('memberIds', memberIds)
    if (memberIds.length === 0) {
      error.value = "Vui lòng nhập ít nhất 1 user_id";
      return;
    }

    const isGroup = mode.value === "group";

    if (isGroup && !groupName.value.trim()) {
      error.value = "Vui lòng nhập tên nhóm";
      return;
    }

    await chat.createConversation({
      memberIds,
      name: isGroup ? groupName.value.trim() : null,
      isGroup,
    });

    emit("close");
  } catch (err) {
    error.value =
      err.response?.data?.detail || "Không tạo được cuộc trò chuyện";
    alert(error.value)
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
    <div class="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
      <div class="px-5 py-4 border-b flex items-center justify-between">
        <h2 class="text-lg font-semibold text-gray-900">
          Tạo cuộc trò chuyện mới
        </h2>

        <button
          type="button"
          class="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center"
          @click="emit('close')"
        >
          <X class="w-5 h-5 text-gray-600" />
        </button>
      </div>

      <form @submit.prevent="handleCreate" class="p-5 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Loại cuộc trò chuyện
          </label>

          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="py-2 rounded-xl border text-sm font-medium"
              :class="mode === 'private'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 hover:bg-gray-50'"
              @click="mode = 'private'"
            >
              Chat cá nhân
            </button>

            <button
              type="button"
              class="py-2 rounded-xl border text-sm font-medium"
              :class="mode === 'group'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 hover:bg-gray-50'"
              @click="mode = 'group'"
            >
              Nhóm
            </button>
          </div>
        </div>

        <div v-if="mode === 'group'">
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Tên nhóm
          </label>

          <input
            v-model="groupName"
            type="text"
            placeholder="Ví dụ: Nhóm FastAPI"
            class="w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            User ID thành viên
          </label>

          <input
            v-model="userIdsText"
            type="text"
            placeholder="Ví dụ: 2 hoặc 2,3,4"
            class="w-full px-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
          />

          <p class="text-xs text-gray-500 mt-1">
            Nhập user_id, nếu nhiều người thì cách nhau bằng dấu phẩy.
          </p>
        </div>

        <p v-if="error" class="text-sm text-red-500">
          {{ error }}
        </p>

        <button
          type="submit"
          :disabled="loading"
          class="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-60"
        >
          {{ loading ? "Đang tạo..." : "Tạo cuộc trò chuyện" }}
        </button>
      </form>
    </div>
  </div>
</template>