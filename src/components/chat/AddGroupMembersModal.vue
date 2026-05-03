<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { X, Search, Check } from "lucide-vue-next";
import { useChatStore } from "../../stores/chat";

const props = defineProps({
  conversationId: {
    type: Number,
    required: true,
  },
  currentMemberIds: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["close", "added"]);

const chat = useChatStore();

const searchText = ref("");
const users = ref([]);
const selectedUsers = ref([]);
const loadingUsers = ref(false);
const submitting = ref(false);
const error = ref("");

let searchTimer = null;

const selectedUserIds = computed(() => {
  return selectedUsers.value.map((u) => u.id);
});

const avatarUrl = (user) => {
  if (!user.avatar) return null;

  if (user.avatar.startsWith("http")) return user.avatar;

  return `${import.meta.env.VITE_API_URL}${user.avatar}`;
};

const isSelected = (user) => {
  return selectedUsers.value.some((u) => Number(u.id) === Number(user.id));
};

const isAlreadyMember = (user) => {
  return props.currentMemberIds.some(
    (id) => Number(id) === Number(user.id)
  );
};

const loadUsers = async () => {
  loadingUsers.value = true;

  try {
    const result = await chat.searchUsers(searchText.value);

    users.value = result.filter((user) => !isAlreadyMember(user));
  } finally {
    loadingUsers.value = false;
  }
};

watch(searchText, () => {
  clearTimeout(searchTimer);

  searchTimer = setTimeout(() => {
    loadUsers();
  }, 300);
});

onMounted(() => {
  loadUsers();
});

const toggleUser = (user) => {
  if (isAlreadyMember(user)) return;

  if (isSelected(user)) {
    selectedUsers.value = selectedUsers.value.filter(
      (u) => Number(u.id) !== Number(user.id)
    );
  } else {
    selectedUsers.value.push(user);
  }
};

const removeSelectedUser = (user) => {
  selectedUsers.value = selectedUsers.value.filter(
    (u) => Number(u.id) !== Number(user.id)
  );
};

const handleSubmit = async () => {
  if (selectedUserIds.value.length === 0) {
    error.value = "Vui lòng chọn ít nhất 1 người";
    return;
  }

  try {
    submitting.value = true;
    error.value = "";

    await chat.addMembersToConversation(
      props.conversationId,
      selectedUserIds.value
    );

    emit("added");
    emit("close");
  } catch (err) {
    error.value = err.response?.data?.detail || "Không thêm được thành viên";
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <div class="fixed inset-0 bg-black/60 z-[140] flex items-center justify-center px-4">
    <div class="w-full max-w-lg bg-[#242526] text-white rounded-2xl shadow-2xl border border-white/10 overflow-hidden">
      <div class="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">
            Thêm thành viên
          </h2>

          <p class="text-sm text-gray-400">
            Chọn người dùng muốn thêm vào nhóm
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

      <div class="p-5 space-y-4">
        <div v-if="selectedUsers.length > 0" class="flex flex-wrap gap-2">
          <button
            v-for="user in selectedUsers"
            :key="user.id"
            type="button"
            class="flex items-center gap-2 bg-[#263951] text-[#5aa7ff] px-3 py-1.5 rounded-full text-sm"
            @click="removeSelectedUser(user)"
          >
            <span>{{ user.full_name }}</span>
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="h-12 rounded-xl bg-[#3A3B3C] border border-white/10 flex items-center px-4 gap-3">
          <Search class="w-5 h-5 text-gray-400" />

          <input
            v-model="searchText"
            type="text"
            placeholder="Tìm theo tên hoặc email..."
            class="flex-1 bg-transparent outline-none text-white placeholder:text-gray-400"
          />
        </div>

        <div class="max-h-72 overflow-y-auto space-y-1 pr-1">
          <div
            v-if="loadingUsers"
            class="text-center text-gray-400 py-6"
          >
            Đang tải user...
          </div>

          <div
            v-else-if="users.length === 0"
            class="text-center text-gray-400 py-6"
          >
            Không tìm thấy user phù hợp
          </div>

          <button
            v-for="user in users"
            :key="user.id"
            type="button"
            class="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition"
            :class="isSelected(user)
              ? 'bg-[#263951]'
              : 'hover:bg-white/10'"
            @click="toggleUser(user)"
          >
            <div class="w-11 h-11 rounded-full bg-gradient-to-br from-[#5f8dff] to-[#3f5df3] overflow-hidden flex items-center justify-center text-white font-semibold shrink-0">
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

            <div
              v-if="isSelected(user)"
              class="w-7 h-7 rounded-full bg-[#2d88ff] flex items-center justify-center shrink-0"
            >
              <Check class="w-4 h-4 text-white" />
            </div>
          </button>
        </div>

        <p v-if="error" class="text-sm text-red-400">
          {{ error }}
        </p>

        <button
          type="button"
          :disabled="submitting"
          class="w-full py-3 bg-[#2d88ff] text-white rounded-xl font-semibold hover:bg-[#1f6fd1] disabled:opacity-60"
          @click="handleSubmit"
        >
          {{ submitting ? "Đang thêm..." : "Thêm thành viên" }}
        </button>
      </div>
    </div>
  </div>
</template>