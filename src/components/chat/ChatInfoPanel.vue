<script setup>
import { computed, ref, watch } from "vue";
import {
  User,
  Bell,
  Search,
  ChevronDown,
  Image,
  FileText,
  Video,
  ExternalLink,
} from "lucide-vue-next";

import { useChatStore } from "../../stores/chat";
import { useAuthStore } from "../../stores/auth";

const chat = useChatStore();
const auth = useAuthStore();

const openSections = ref({
  info: true,
  customize: false,
  media: true,
  privacy: false,
});

const mediaItems = ref([]);
const loadingMedia = ref(false);

const toggleSection = (key) => {
  openSections.value[key] = !openSections.value[key];
};

const otherUser = computed(() => {
  const c = chat.selectedConversation;
  if (!c || Number(c.is_group) === 1) return null;

  return c.members?.find(
    (u) => Number(u.id) !== Number(auth.user?.id)
  );
});

const panelTitle = computed(() => {
  const c = chat.selectedConversation;

  if (!c) return "";

  return (
    c.display_name ||
    c.name ||
    `Cuộc trò chuyện #${c.id}`
  );
});

const avatarUrl = (user) => {
  if (!user?.avatar) return null;

  if (user.avatar.startsWith("http")) return user.avatar;

  return `${import.meta.env.VITE_API_URL}${user.avatar}`;
};

const conversationAvatar = computed(() => {
  if (otherUser.value?.avatar) {
    return avatarUrl(otherUser.value);
  }

  if (chat.selectedConversation?.display_avatar) {
    const avatar = chat.selectedConversation.display_avatar;

    if (avatar.startsWith("http")) return avatar;

    return `${import.meta.env.VITE_API_URL}${avatar}`;
  }

  return null;
});

const fullFileUrl = (url) => {
  if (!url) return "";

  if (url.startsWith("http")) return url;

  return `${import.meta.env.VITE_API_URL}${url}`;
};

const imageItems = computed(() => {
  return mediaItems.value.filter((item) => item.file_type === "image");
});

const videoItems = computed(() => {
  return mediaItems.value.filter((item) => item.file_type === "video");
});

const fileItems = computed(() => {
  return mediaItems.value.filter(
    (item) => item.file_type !== "image" && item.file_type !== "video"
  );
});

const loadMedia = async () => {
  if (!chat.selectedConversation?.id) return;

  loadingMedia.value = true;

  try {
    mediaItems.value = await chat.fetchConversationMedia(
      chat.selectedConversation.id
    );
  } finally {
    loadingMedia.value = false;
  }
};

watch(
  () => chat.selectedConversation?.id,
  () => {
    mediaItems.value = [];
    loadMedia();
  },
  { immediate: true }
);
</script>

<template>
  <aside
    v-if="chat.selectedConversation"
    class="w-[340px] min-w-[340px] h-screen bg-[#242526] border-l border-white/10 flex flex-col text-white"
  >
    <!-- User / Conversation header -->
    <div class="flex flex-col items-center py-6 border-b border-white/10">
      <div
        class="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-[#5f8dff] to-[#3f5df3] flex items-center justify-center text-white text-4xl font-bold"
      >
        <img
          v-if="conversationAvatar"
          :src="conversationAvatar"
          class="w-full h-full object-cover"
        />

        <span v-else>
          {{ panelTitle.charAt(0).toUpperCase() }}
        </span>
      </div>

      <h3 class="mt-3 font-semibold text-lg text-white text-center px-4 truncate max-w-full">
        {{ panelTitle }}
      </h3>

      <p class="text-sm text-gray-400">
        Hoạt động gần đây
      </p>

      <div class="flex gap-4 mt-5">
        <button class="flex flex-col items-center text-gray-300 hover:text-white">
          <div class="w-11 h-11 rounded-full bg-[#3A3B3C] flex items-center justify-center">
            <User class="w-5 h-5" />
          </div>
          <span class="text-xs mt-1 max-w-[72px] text-center">Trang cá nhân</span>
        </button>

        <button class="flex flex-col items-center text-gray-300 hover:text-white">
          <div class="w-11 h-11 rounded-full bg-[#3A3B3C] flex items-center justify-center">
            <Bell class="w-5 h-5" />
          </div>
          <span class="text-xs mt-1 max-w-[72px] text-center">Tắt thông báo</span>
        </button>

        <button class="flex flex-col items-center text-gray-300 hover:text-white">
          <div class="w-11 h-11 rounded-full bg-[#3A3B3C] flex items-center justify-center">
            <Search class="w-5 h-5" />
          </div>
          <span class="text-xs mt-1 max-w-[72px] text-center">Tìm kiếm</span>
        </button>
      </div>
    </div>

    <!-- Sections -->
    <div class="flex-1 overflow-y-auto">
      <!-- Info -->
      <div class="border-b border-white/10">
        <button
          class="w-full flex justify-between items-center px-4 py-4 text-left text-white hover:bg-white/5"
          @click="toggleSection('info')"
        >
          <span class="font-semibold text-sm">
            Thông tin về đoạn chat
          </span>

          <ChevronDown
            class="w-4 h-4 transition"
            :class="openSections.info ? 'rotate-180' : ''"
          />
        </button>

        <div v-if="openSections.info" class="px-4 pb-4 text-sm text-gray-400">
          <p v-if="Number(chat.selectedConversation.is_group) === 1">
            Đây là nhóm chat.
          </p>

          <p v-else>
            Đây là đoạn chat giữa bạn và {{ otherUser?.full_name || panelTitle }}.
          </p>
        </div>
      </div>

      <!-- Customize -->
      <div class="border-b border-white/10">
        <button
          class="w-full flex justify-between items-center px-4 py-4 text-left text-white hover:bg-white/5"
          @click="toggleSection('customize')"
        >
          <span class="font-semibold text-sm">
            Tùy chỉnh đoạn chat
          </span>

          <ChevronDown
            class="w-4 h-4 transition"
            :class="openSections.customize ? 'rotate-180' : ''"
          />
        </button>

        <div v-if="openSections.customize" class="px-4 pb-4 space-y-2 text-sm">
          <button class="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-gray-300">
            Đổi màu đoạn chat
          </button>

          <button class="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-gray-300">
            Đổi biệt danh
          </button>

          <button class="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-gray-300">
            Đổi emoji nhanh
          </button>
        </div>
      </div>

      <!-- Media -->
      <div class="border-b border-white/10">
        <button
          class="w-full flex justify-between items-center px-4 py-4 text-left text-white hover:bg-white/5"
          @click="toggleSection('media')"
        >
          <span class="font-semibold text-sm">
            File phương tiện & file
          </span>

          <ChevronDown
            class="w-4 h-4 transition"
            :class="openSections.media ? 'rotate-180' : ''"
          />
        </button>

        <div v-if="openSections.media" class="px-4 pb-4">
          <div v-if="loadingMedia" class="text-sm text-gray-400 py-3">
            Đang tải file...
          </div>

          <template v-else>
            <!-- Images -->
            <div v-if="imageItems.length > 0" class="mb-5">
              <div class="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-2">
                <Image class="w-4 h-4" />
                Ảnh
              </div>

              <div class="grid grid-cols-3 gap-2">
                <a
                  v-for="item in imageItems.slice(0, 9)"
                  :key="item.id"
                  :href="fullFileUrl(item.file_url)"
                  target="_blank"
                  class="aspect-square rounded-lg overflow-hidden bg-[#3A3B3C]"
                >
                  <img
                    :src="fullFileUrl(item.file_url)"
                    class="w-full h-full object-cover hover:scale-105 transition"
                  />
                </a>
              </div>
            </div>

            <!-- Videos -->
            <div v-if="videoItems.length > 0" class="mb-5">
              <div class="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-2">
                <Video class="w-4 h-4" />
                Video
              </div>

              <div class="space-y-2">
                <a
                  v-for="item in videoItems.slice(0, 5)"
                  :key="item.id"
                  :href="fullFileUrl(item.file_url)"
                  target="_blank"
                  class="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#3A3B3C] hover:bg-white/10"
                >
                  <Video class="w-5 h-5 text-[#2d88ff]" />

                  <div class="min-w-0 flex-1">
                    <p class="text-sm text-white truncate">
                      Video đã gửi
                    </p>

                    <p class="text-xs text-gray-400">
                      {{ new Date(item.created_at).toLocaleDateString("vi-VN") }}
                    </p>
                  </div>

                  <ExternalLink class="w-4 h-4 text-gray-400" />
                </a>
              </div>
            </div>

            <!-- Files -->
            <div v-if="fileItems.length > 0">
              <div class="flex items-center gap-2 text-sm font-semibold text-gray-300 mb-2">
                <FileText class="w-4 h-4" />
                File
              </div>

              <div class="space-y-2">
                <a
                  v-for="item in fileItems.slice(0, 8)"
                  :key="item.id"
                  :href="fullFileUrl(item.file_url)"
                  target="_blank"
                  class="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#3A3B3C] hover:bg-white/10"
                >
                  <FileText class="w-5 h-5 text-[#2d88ff]" />

                  <div class="min-w-0 flex-1">
                    <p class="text-sm text-white truncate">
                      Tệp đã gửi
                    </p>

                    <p class="text-xs text-gray-400">
                      {{ new Date(item.created_at).toLocaleDateString("vi-VN") }}
                    </p>
                  </div>

                  <ExternalLink class="w-4 h-4 text-gray-400" />
                </a>
              </div>
            </div>

            <div
              v-if="mediaItems.length === 0"
              class="text-sm text-gray-500 py-3"
            >
              Chưa có file phương tiện nào.
            </div>
          </template>
        </div>
      </div>

      <!-- Privacy -->
      <div class="border-b border-white/10">
        <button
          class="w-full flex justify-between items-center px-4 py-4 text-left text-white hover:bg-white/5"
          @click="toggleSection('privacy')"
        >
          <span class="font-semibold text-sm">
            Quyền riêng tư và hỗ trợ
          </span>

          <ChevronDown
            class="w-4 h-4 transition"
            :class="openSections.privacy ? 'rotate-180' : ''"
          />
        </button>

        <div v-if="openSections.privacy" class="px-4 pb-4 space-y-2 text-sm">
          <button class="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-gray-300">
            Chặn người dùng
          </button>

          <button class="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-red-300">
            Báo cáo đoạn chat
          </button>

          <button class="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-red-300">
            Xóa đoạn chat
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>