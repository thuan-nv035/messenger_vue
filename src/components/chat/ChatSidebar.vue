<script setup>
import { ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import {
  Search,
  SquarePen,
  LogOut,
  Ellipsis,
  VolumeX,
  Pin,
} from "lucide-vue-next";

import { useAuthStore } from "../../stores/auth";
import { useChatStore } from "../../stores/chat";
import NewConversationModal from "./NewConversationModal.vue";
import ConversationActionMenu from "./ConversationActionMenu.vue";
import BlockedUsersModal from "./BlockedUsersModal.vue";
const router = useRouter();
const auth = useAuthStore();
const chat = useChatStore();
const showBlockedUsersModal = ref(false);
const showNewConversationModal = ref(false);
const keyword = ref("");
const activeTab = ref("all");
const apiUrl = import.meta.env.VITE_API_URL;
const messageRequests = ref([]);
const logout = () => {
  chat.disconnectWebSocket();
  auth.logout();
  chat.clearChat();
  router.push("/login");
};

const isMuted = (conversation) => {
  return conversation.is_muted === true || conversation.is_muted === 1;
};

const getConversationTitle = (conversation) => {
  return (
    conversation.display_name ||
    conversation.name ||
    `Cuộc trò chuyện #${conversation.id}`
  );
};

const getAvatarText = (conversation) => {
  return getConversationTitle(conversation).charAt(0).toUpperCase();
};

const formatTime = (dateString) => {
  if (!dateString) return "";

  const date = new Date(dateString);
  const now = new Date();

  const diffMs = now - date;
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return "Vừa xong";
  if (diffMinutes < 60) return `${diffMinutes} phút`;
  if (diffHours < 24) return `${diffHours} giờ`;
  if (diffDays < 7) return `${diffDays} ngày`;

  return date.toLocaleDateString("vi-VN");
};

const getLastMessagePreview = (conversation) => {
  const msg = conversation?.last_message;
  if (!msg) return "Chưa có tin nhắn";

  if (msg.content) return msg.content;
  return "Tin nhắn mới";
};

const filteredConversations = computed(() => {
  let items = activeTab.value === "requests"
    ? [...messageRequests.value]
    : [...chat.conversations];

  if (activeTab.value === "unread") {
    items = items.filter((c) => (c.unread_count || 0) > 0);
  }

  if (activeTab.value === "group") {
    items = items.filter((c) => Number(c.is_group) === 1);
  }

  if (keyword.value.trim()) {
    const q = keyword.value.trim().toLowerCase();

    items = items.filter((c) => {
      const name = getConversationTitle(c).toLowerCase();
      const preview = getLastMessagePreview(c).toLowerCase();

      return name.includes(q) || preview.includes(q);
    });
  }

  return items;
});

const selectConversation = async (conversation) => {
  await chat.selectConversation(conversation);
};

const openedMenuConversation = ref(null);
const menuPosition = ref({
  top: 0,
  left: 0,
});

const openConversationMenu = (event, conversation) => {
  event.preventDefault();
  event.stopPropagation();

  const rect = event.currentTarget.getBoundingClientRect();

  openedMenuConversation.value = conversation;

  menuPosition.value = {
    top: rect.bottom + 8,
    left: rect.right - 330,
    anchorTop: rect.top,
    anchorCenterX: rect.left + rect.width / 2,
  };
};

const closeConversationMenu = () => {
  openedMenuConversation.value = null;
};

const getOtherUserId = (conversation) => {
  if (Number(conversation.is_group) === 1) return null;

  const currentUserId = auth.user?.id;

  const other = conversation.members?.find(
    (u) => Number(u.id) !== Number(currentUserId),
  );

  return other?.id || null;
};

const handleConversationMenuAction = async ({ action, conversation }) => {
  closeConversationMenu();

  if (action === "mark_unread") {
    await chat.markConversationUnread(conversation.id);
    return;
  }

  if (action === "mute") {
    await chat.muteConversation(conversation.id);
    return;
  }

  if (action === "archive") {
    await chat.archiveConversation(conversation.id);
    return;
  }

  if (action === "delete") {
    const ok = confirm("Bạn có chắc muốn xóa đoạn chat này không?");

    if (!ok) return;

    await chat.deleteConversationForMe(conversation.id);
    return;
  }

  if (action === "block") {
    const otherUserId = getOtherUserId(conversation);

    if (!otherUserId) {
      chat.showToast("Chỉ có thể chặn trong chat cá nhân", "warning");
      return;
    }

    const ok = confirm("Bạn có chắc muốn chặn người này không?");

    if (!ok) return;

    await chat.blockUser(otherUserId, conversation.id);
    return;
  }

  if (action === "report") {
    alert("lLàm sau.");
  }
};

const loadMessageRequests = async () => {
  messageRequests.value = await chat.fetchMessageRequests();
};

watch(activeTab, async (tab) => {
  if (tab === "requests") {
    await loadMessageRequests();
  }
});
</script>

<template>
  <aside
    class="w-[420px] min-w-[420px] h-screen bg-[#18191A] text-white border-r border-white/10 flex flex-col"
  >
    <!-- Header -->
    <div class="px-5 pt-6 pb-4">
      <div class="flex items-center justify-between">
        <h1 class="text-[22px] font-bold tracking-tight">Đoạn chat</h1>

        <div class="flex items-center gap-2">
          <button
            @click="showBlockedUsersModal = true"
            type="button"
            class="w-10 h-10 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center transition"
          >
            <Ellipsis class="w-5 h-5 text-white" />
          </button>

          <button
            type="button"
            class="w-10 h-10 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center transition"
            @click="showNewConversationModal = true"
          >
            <SquarePen class="w-5 h-5 text-white" />
          </button>

          <button
            type="button"
            class="w-10 h-10 rounded-full bg-red-500/15 hover:bg-red-500/20 flex items-center justify-center transition"
            @click="logout"
          >
            <LogOut class="w-5 h-5 text-[#ff6b6b]" />
          </button>
        </div>
      </div>

      <!-- Search -->
      <div class="mt-5">
        <div class="h-11 rounded-full bg-white/10 flex items-center px-4 gap-3">
          <Search class="w-5 h-5 text-gray-400" />
          <input
            v-model="keyword"
            type="text"
            placeholder="Tìm kiếm trên Messenger"
            class="flex-1 bg-transparent outline-none text-[15px] text-white placeholder:text-gray-400"
          />
        </div>
      </div>

      <!-- Tabs -->
      <div class="mt-5 flex items-center gap-3">
        <button
          type="button"
          class="px-4 h-10 rounded-full text-[15px] font-semibold transition"
          :class="
            activeTab === 'all'
              ? 'bg-[#263951] text-[#5aa7ff]'
              : 'text-gray-200 hover:bg-white/10'
          "
          @click="activeTab = 'all'"
        >
          Tất cả
        </button>

        <button
          type="button"
          class="px-4 h-10 rounded-full text-[15px] font-semibold transition"
          :class="
            activeTab === 'unread'
              ? 'bg-[#263951] text-[#5aa7ff]'
              : 'text-gray-200 hover:bg-white/10'
          "
          @click="activeTab = 'unread'"
        >
          Chưa đọc
        </button>

        <button
          type="button"
          class="px-4 h-10 rounded-full text-[15px] font-semibold transition"
          :class="
            activeTab === 'group'
              ? 'bg-[#263951] text-[#5aa7ff]'
              : 'text-gray-200 hover:bg-white/10'
          "
          @click="activeTab = 'group'"
        >
          Nhóm
        </button>

        <button
          type="button"
          class="px-4 h-10 rounded-full text-[15px] font-semibold transition"
          :class="
            activeTab === 'requests'
              ? 'bg-[#263951] text-[#5aa7ff]'
              : 'text-gray-200 hover:bg-white/10'
          "
          @click="activeTab = 'requests'"
        >
          Tin nhắn chờ
        </button>

        <button
          type="button"
          class="w-10 h-10 rounded-full text-gray-300 hover:bg-white/10 flex items-center justify-center"
        >
          <Ellipsis class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- Conversation list -->
    <div class="flex-1 overflow-y-auto px-2 pb-4">
      <button
        v-for="conversation in filteredConversations"
        :key="conversation.id"
        type="button"
        class="group w-full rounded-2xl px-3 py-3 flex items-center gap-3 text-left transition mb-1"
        :class="
          Number(chat.selectedConversation?.id) === Number(conversation.id)
            ? 'bg-[#263951]'
            : 'hover:bg-white/5'
        "
        @click="selectConversation(conversation)"
        @contextmenu.prevent="openConversationMenu($event, conversation)"
      >
        <!-- Avatar -->
        <div class="relative shrink-0">
          <div
            class="w-16 h-16 rounded-full bg-gradient-to-br from-[#5f8dff] to-[#3f5df3] overflow-hidden flex items-center justify-center text-white text-[26px] font-semibold"
          >
            <img
              v-if="conversation.display_avatar"
              :src="
                conversation.display_avatar.startsWith('http')
                  ? conversation.display_avatar
                  : `${apiUrl}${conversation.display_avatar}`
              "
              class="w-full h-full object-cover"
            />

            <span v-else>
              {{ getAvatarText(conversation) }}
            </span>
          </div>

          <div
            v-if="conversation.is_online"
            class="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-[#31d158] border-2 border-[#18191A]"
          />
        </div>

        <!-- Main content -->
        <div class="min-w-0 flex-1">
          <p class="text-[17px] font-semibold text-white truncate">
            {{ getConversationTitle(conversation) }}
          </p>

          <p
            class="mt-1 text-[15px] truncate"
            :class="
              (conversation.unread_count || 0) > 0
                ? 'text-white font-medium'
                : 'text-gray-400'
            "
          >
            {{ getLastMessagePreview(conversation) }}
          </p>
        </div>

        <!-- Right meta -->
        <div
          class="w-[72px] shrink-0 flex flex-col items-end justify-center gap-2"
        >
          <div class="h-7 flex items-center justify-end">
            <button
              type="button"
              class="w-8 h-8 rounded-full hover:bg-white/10 hidden group-hover:flex items-center justify-center"
              @click="openConversationMenu($event, conversation)"
            >
              <Ellipsis class="w-5 h-5 text-gray-300" />
            </button>

            <span
              v-if="!isMuted(conversation)"
              class="text-[14px] text-gray-400 group-hover:hidden"
            >
              {{
                formatTime(
                  conversation.last_message?.created_at ||
                    conversation.created_at,
                )
              }}
            </span>

            <div
              v-else
              class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:hidden"
              title="Đã tắt thông báo"
            >
              <VolumeX class="w-4 h-4 text-gray-400" />
            </div>
          </div>

          <span
            v-if="(conversation.unread_count || 0) > 0"
            class="min-w-6 h-6 px-1 rounded-full bg-[#2d88ff] text-white text-[12px] font-semibold flex items-center justify-center"
          >
            {{
              conversation.unread_count > 99 ? "99+" : conversation.unread_count
            }}
          </span>
        </div>
      </button>

      <div
        v-if="filteredConversations.length === 0"
        class="px-4 py-10 text-center text-gray-400"
      >
        Không có cuộc trò chuyện nào
      </div>
    </div>

    <BlockedUsersModal
      v-if="showBlockedUsersModal"
      @close="showBlockedUsersModal = false"
    />

    <ConversationActionMenu
      v-if="openedMenuConversation"
      :conversation="openedMenuConversation"
      :position="menuPosition"
      @close="closeConversationMenu"
      @action="handleConversationMenuAction"
    />

    <NewConversationModal
      v-if="showNewConversationModal"
      @close="showNewConversationModal = false"
    />
  </aside>
</template>
