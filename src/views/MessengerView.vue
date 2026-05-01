<script setup>
import { onMounted, onBeforeUnmount } from "vue";
import { useAuthStore } from "../stores/auth";
import { useChatStore } from "../stores/chat";

import ChatSidebar from "../components/chat/ChatSidebar.vue";
import ChatWindow from "../components/chat/ChatWindow.vue";

const auth = useAuthStore();
const chat = useChatStore();

onMounted(async () => {
  if (!auth.user) {
    await auth.fetchMe();
  }

  if (auth.user?.id) {
    chat.connectWebSocket(auth.user.id);
  }

  await chat.fetchConversations();
});

onBeforeUnmount(() => {
  chat.disconnectWebSocket();
});
</script>

<template>
  <div class="h-screen w-screen overflow-hidden bg-[#111214] flex">
    <ChatSidebar />
    <ChatWindow />
  </div>
</template>