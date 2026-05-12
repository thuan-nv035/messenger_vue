<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { X, Search, Check } from "lucide-vue-next";
import { useChatStore } from "../../stores/chat";
import { FriendRequestStatus } from "../../api/friends";
const emit = defineEmits(["close"]);

const chat = useChatStore();

const mode = ref("private");
const groupName = ref("");
const searchText = ref("");
const users = ref([]);
const selectedUsers = ref([]);
const loadingUsers = ref(false);
const loadingCreate = ref(false);
const error = ref("");

let searchTimer = null;

const isGroup = computed(() => mode.value === "group");

const selectedUserIds = computed(() => {
  return selectedUsers.value.map((u) => u.id);
});

const avatarUrl = (user) => {
  if (!user.avatar) return null;

  if (user.avatar.startsWith("http")) {
    return user.avatar;
  }

  return `${import.meta.env.VITE_API_URL}${user.avatar}`;
};

const avatarText = (user) => {
  return user.full_name?.charAt(0).toUpperCase() || "U";
};

const isSelected = (user) => {
  return selectedUsers.value.some((u) => Number(u.id) === Number(user.id));
};

const priority = {
  friends: 1,
  request_sent: 2,
  request_received: 3,
  not_friend: 4,
};

const loadUsers = async () => {
  loadingUsers.value = true;

  try {
    users.value = await chat.searchUsers(searchText.value);
    // users.value = res.sort((a, b) => priority[a.friendship_status] - priority[b.friendship_status]);
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

watch(mode, () => {
  selectedUsers.value = [];
  error.value = "";
});

onMounted(() => {
  loadUsers();
});

const toggleUser = (user) => {
  error.value = "";

  if (mode.value === "private") {
    selectedUsers.value = [user];
    return;
  }

  if (isSelected(user)) {
    selectedUsers.value = selectedUsers.value.filter(
      (u) => Number(u.id) !== Number(user.id),
    );
  } else {
    selectedUsers.value.push(user);
  }
};

const removeSelectedUser = (user) => {
  selectedUsers.value = selectedUsers.value.filter(
    (u) => Number(u.id) !== Number(user.id),
  );
};

const handleCreate = async () => {
  try {
    loadingCreate.value = true;
    error.value = "";

    if (selectedUsers.value.length === 0) {
      error.value = "Vui lòng chọn ít nhất 1 người dùng";
      return;
    }

    if (mode.value === "private" && selectedUsers.value.length !== 1) {
      error.value = "Chat cá nhân chỉ được chọn 1 người";
      return;
    }

    if (mode.value === "group") {
      if (selectedUsers.value.length < 2) {
        error.value = "Chat nhóm cần chọn ít nhất 2 người";
        return;
      }

      if (!groupName.value.trim()) {
        error.value = "Vui lòng nhập tên nhóm";
        return;
      }
    }

    await chat.createConversation({
      memberIds: selectedUserIds.value,
      name: isGroup.value ? groupName.value.trim() : null,
      isGroup: isGroup.value,
    });

    emit("close");
  } catch (err) {
    error.value =
      err.response?.data?.detail || "Không tạo được cuộc trò chuyện";
  } finally {
    loadingCreate.value = false;
  }
};

const handleSendRequestFriends = async (user) => {
  try {
    if (user.friendship_status === "request_received") {
      await FriendRequestStatus.acceptFriendRequest(user.friend_request_id);
    } else if (user.friendship_status === "not_friend") {
      await FriendRequestStatus.sendFriendRequest(user.id);
    } else if (user.friendship_status === "request_sent") {
      await FriendRequestStatus.cancelFriendRequest(user.friend_request_id);
    }
    await loadUsers();
  } catch (err) {
    throw err;
  }
};

watch(
  () => chat.friendEvent,
  async (newVal) => {
    if (newVal) {
      await loadUsers();
    }
  },
);
</script>

<template>
  <div
    class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4"
  >
    <div
      class="bg-[#242526] text-white w-full max-w-xl rounded-2xl shadow-xl overflow-hidden border border-white/10"
    >
      <!-- Header -->
      <div
        class="px-5 py-4 border-b border-white/10 flex items-center justify-between"
      >
        <h2 class="text-lg font-semibold">Tạo cuộc trò chuyện mới</h2>

        <button
          type="button"
          class="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center"
          @click="emit('close')"
        >
          <X class="w-5 h-5 text-gray-300" />
        </button>
      </div>

      <form @submit.prevent="handleCreate" class="p-5 space-y-4">
        <!-- Mode -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Loại cuộc trò chuyện
          </label>

          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="py-3 rounded-xl border text-sm font-semibold transition"
              :class="
                mode === 'private'
                  ? 'bg-[#2d88ff] text-white border-[#2d88ff]'
                  : 'bg-transparent text-gray-300 border-white/10 hover:bg-white/10'
              "
              @click="mode = 'private'"
            >
              Chat cá nhân
            </button>

            <button
              type="button"
              class="py-3 rounded-xl border text-sm font-semibold transition"
              :class="
                mode === 'group'
                  ? 'bg-[#2d88ff] text-white border-[#2d88ff]'
                  : 'bg-transparent text-gray-300 border-white/10 hover:bg-white/10'
              "
              @click="mode = 'group'"
            >
              Nhóm
            </button>
          </div>
        </div>

        <!-- Group name -->
        <div v-if="isGroup">
          <label class="block text-sm font-medium text-gray-300 mb-1">
            Tên nhóm
          </label>

          <input
            v-model="groupName"
            type="text"
            placeholder="Ví dụ: Nhóm FastAPI"
            class="w-full px-4 py-3 bg-[#3A3B3C] border border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-[#2d88ff] text-white placeholder:text-gray-400"
          />
        </div>

        <!-- Selected users -->
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

        <!-- Search -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-1">
            Chọn người dùng
          </label>

          <div
            class="h-12 rounded-xl bg-[#3A3B3C] border border-white/10 flex items-center px-4 gap-3"
          >
            <Search class="w-5 h-5 text-gray-400" />

            <input
              v-model="searchText"
              type="text"
              placeholder="Tìm theo tên hoặc email..."
              class="flex-1 bg-transparent outline-none text-white placeholder:text-gray-400"
            />
          </div>
        </div>

        <!-- User list -->
        <div class="max-h-72 overflow-y-auto space-y-1 pr-1">
          <div v-if="loadingUsers" class="text-center text-gray-400 py-6">
            Đang tải người dùng...
          </div>

          <div
            v-else-if="users.length === 0"
            class="text-center text-gray-400 py-6"
          >
            Không tìm thấy user
          </div>

          <button
            v-for="user in users"
            :key="user.id"
            type="button"
            class="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition"
            :class="isSelected(user) ? 'bg-[#263951]' : 'hover:bg-white/10'"
            @click="toggleUser(user)"
          >
            <div
              class="w-11 h-11 rounded-full bg-gradient-to-br from-[#5f8dff] to-[#3f5df3] overflow-hidden flex items-center justify-center text-white font-semibold shrink-0"
            >
              <img
                v-if="avatarUrl(user)"
                :src="avatarUrl(user)"
                class="w-full h-full object-cover"
              />

              <span v-else>
                {{ avatarText(user) }}
              </span>
            </div>

            <div class="min-w-0 flex-1">
              <p class="font-semibold text-white truncate">
                {{ user.full_name }}
              </p>
              <p
                v-if="
                  mode === 'private' && user.friendship_status !== 'friends'
                "
                class="text-xs text-yellow-400 mt-1"
              >
                Chưa là bạn bè · Tin nhắn sẽ vào tin nhắn chờ
              </p>
            </div>

            <!-- <div
              v-if="isSelected(user)"
              class="w-7 h-7 rounded-full bg-[#2d88ff] flex items-center justify-center shrink-0"
            >
              <Check class="w-4 h-4 text-white" />
            </div> -->

            <div
              @click.stop="handleSendRequestFriends(user)"
              class="px-2 py-1 rounded-lg"
              :class="{
                'bg-[#2d88ff] text-white':
                  user.friendship_status === 'not_friend',
                'bg-[#4CAF50] text-white':
                  user.friendship_status === 'request_sent',
                'bg-[#FF9800] text-white':
                  user.friendship_status === 'request_received',
              }"
            >
              {{
                user.friendship_status === "not_friend"
                  ? "Thêm bạn bè"
                  : user.friendship_status === "request_sent"
                    ? "Đã gửi yêu cầu"
                    : user.friendship_status === "request_received"
                      ? "Chấp nhận yêu cầu"
                      : ""
              }}
            </div>
          </button>
        </div>

        <p v-if="error" class="text-sm text-red-400">
          {{ error }}
        </p>

        <button
          type="submit"
          :disabled="loadingCreate"
          class="w-full py-3 bg-[#2d88ff] text-white rounded-xl font-semibold hover:bg-[#1f6fd1] disabled:opacity-60"
        >
          {{ loadingCreate ? "Đang tạo..." : "Tạo cuộc trò chuyện" }}
        </button>
      </form>
    </div>
  </div>
</template>
