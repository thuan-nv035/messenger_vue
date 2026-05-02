<script setup>
import { ref, computed } from "vue";
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

const router = useRouter();
const auth = useAuthStore();
const chat = useChatStore();

const showNewConversationModal = ref(false);
const keyword = ref("");
const activeTab = ref("all");

const logout = () => {
  chat.disconnectWebSocket();
  auth.logout();
  chat.clearChat();
  router.push("/login");
};

const getAvatarText = (conversation) => {
  if (conversation?.name) {
    return conversation.name.charAt(0).toUpperCase();
  }
  return "C";
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
  let items = [...chat.conversations];

  if (activeTab.value === "unread") {
    items = items.filter((c) => (c.unread_count || 0) > 0);
  }

  if (activeTab.value === "group") {
    items = items.filter((c) => c.is_group === true);
  }

  if (keyword.value.trim()) {
    const q = keyword.value.trim().toLowerCase();
    items = items.filter((c) => {
      const name = c.name?.toLowerCase() || "";
      const preview = getLastMessagePreview(c).toLowerCase();
      return name.includes(q) || preview.includes(q);
    });
  }

  return items;
});

const selectConversation = async (conversation) => {
  await chat.selectConversation(conversation);
};
</script>

<template>
  <aside
    class="w-[420px] min-w-[420px] h-screen bg-[#18191A] text-white border-r border-white/10 flex flex-col"
  >
    <!-- Header -->
    <div class="px-5 pt-6 pb-4">
      <div class="flex items-center justify-between">
        <h1 class="text-[22px] font-bold tracking-tight">
          Đoạn chat
        </h1>

        <div class="flex items-center gap-2">
          <button
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
        <div
          class="h-11 rounded-full bg-white/10 flex items-center px-4 gap-3"
        >
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
          :class="activeTab === 'all'
            ? 'bg-[#263951] text-[#5aa7ff]'
            : 'text-gray-200 hover:bg-white/10'"
          @click="activeTab = 'all'"
        >
          Tất cả
        </button>

        <button
          type="button"
          class="px-4 h-10 rounded-full text-[15px] font-semibold transition"
          :class="activeTab === 'unread'
            ? 'bg-[#263951] text-[#5aa7ff]'
            : 'text-gray-200 hover:bg-white/10'"
          @click="activeTab = 'unread'"
        >
          Chưa đọc
        </button>

        <button
          type="button"
          class="px-4 h-10 rounded-full text-[15px] font-semibold transition"
          :class="activeTab === 'group'
            ? 'bg-[#263951] text-[#5aa7ff]'
            : 'text-gray-200 hover:bg-white/10'"
          @click="activeTab = 'group'"
        >
          Nhóm
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
        class="w-full rounded-2xl px-3 py-3 flex items-center gap-3 text-left transition mb-1"
        :class="
          Number(chat.selectedConversation?.id) === Number(conversation.id)
            ? 'bg-[#263951]'
            : 'hover:bg-white/5'
        "
        @click="selectConversation(conversation)"
      >
        <!-- Avatar -->
        <div class="relative shrink-0">
          <div
            class="w-16 h-16 rounded-full bg-gradient-to-br from-[#5f8dff] to-[#3f5df3] flex items-center justify-center text-white text-[26px] font-semibold"
          >
            {{ getAvatarText(conversation) }}
          </div>

          <!-- Online dot demo -->
          <div
            v-if="conversation.is_online"
            class="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-[#31d158] border-2 border-[#18191A]"
          />
        </div>

        <!-- Content -->
        <div class="min-w-0 flex-1">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="text-[17px] font-semibold text-white truncate">
                {{ conversation.name }}
              </p>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <Pin
                v-if="conversation.is_pinned"
                class="w-4 h-4 text-gray-400"
              />

              <VolumeX
                v-if="conversation.is_muted"
                class="w-4 h-4 text-gray-400"
              />
            </div>
          </div>

          <div class="mt-1 flex items-center justify-between gap-2">
            <p
              class="text-[15px] truncate"
              :class="(conversation.unread_count || 0) > 0
                ? 'text-white font-medium'
                : 'text-gray-400'"
            >
              {{ getLastMessagePreview(conversation) }}
            </p>

            <div class="shrink-0 flex items-center gap-2">
              <span class="text-[14px] text-gray-400">
                {{ formatTime(conversation.last_message?.created_at || conversation.created_at) }}
              </span>

              <span
                v-if="(conversation.unread_count || 0) > 0"
                class="min-w-6 h-6 px-1 rounded-full bg-[#2d88ff] text-white text-[12px] font-semibold flex items-center justify-center"
              >
                {{ conversation.unread_count > 99 ? "99+" : conversation.unread_count }}
              </span>
            </div>
          </div>
        </div>
      </button>

      <div
        v-if="filteredConversations.length === 0"
        class="px-4 py-10 text-center text-gray-400"
      >
        Không có cuộc trò chuyện nào
      </div>
    </div>

    <NewConversationModal
      v-if="showNewConversationModal"
      @close="showNewConversationModal = false"
    />
  </aside>
</template>