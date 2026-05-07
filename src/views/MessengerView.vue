<script setup>
import { onMounted, onBeforeUnmount } from "vue";
import { useAuthStore } from "../stores/auth";
import { useChatStore } from "../stores/chat";

import ChatSidebar from "../components/chat/ChatSidebar.vue";
import ChatWindow from "../components/chat/ChatWindow.vue";
import ChatInfoPanel from "../components/chat/ChatInfoPanel.vue";
import VideoCallModal from "../components/chat/VideoCallModal.vue";
import AppToast from "../components/common/AppToast.vue";
const auth = useAuthStore();
const chat = useChatStore();

const unlockSound = () => {
  chat.unlockNotificationSound();

  window.removeEventListener("click", unlockSound);
  window.removeEventListener("keydown", unlockSound);
};

onMounted(async () => {

  window.addEventListener("click", unlockSound);
  window.addEventListener("keydown", unlockSound);
  
  if (!auth.user) {
    await auth.fetchMe();
  }

  if (auth.user?.id) {
    chat.connectWebSocket(auth.user.id);
  }

  await chat.fetchConversations();
});

onBeforeUnmount(() => {
  window.removeEventListener("click", unlockSound);
  window.removeEventListener("keydown", unlockSound);
  chat.disconnectWebSocket();
});
</script>

<template>
  <div class="h-screen w-screen overflow-hidden bg-[#111214] flex">
    <ChatSidebar />
    <ChatWindow />
    <ChatInfoPanel v-if="chat.isActiveChatInfo" />
    <VideoCallModal />
    <AppToast />
  </div>
</template>
