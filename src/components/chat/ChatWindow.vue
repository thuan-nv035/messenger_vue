<script setup>
import { computed, ref, nextTick, watch } from "vue";
import {
  Phone,
  Video,
  Info,
  Image,
  Smile,
  SendHorizonal,
  MoreHorizontal,
} from "lucide-vue-next";

import { useChatStore } from "../../stores/chat";
import MessageBubble from "./MessageBubble.vue";

const chat = useChatStore();

const messageText = ref("");
const messagesContainer = ref(null);

let typingTimeout = null;

const handleTyping = () => {
  if (typingTimeout) return;

  chat.sendTyping();

  typingTimeout = setTimeout(() => {
    typingTimeout = null;
  }, 1500);
};

const conversationTitle = computed(() => {
  const c = chat.selectedConversation;

  if (!c) return "Chưa chọn cuộc trò chuyện";

  if (c.name) return c.name;

  if (c.is_group === 1) return `Nhóm #${c.id}`;

  return `Cuộc trò chuyện #${c.id}`;
});

const scrollToBottom = async () => {
  await nextTick();

  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

watch(
  () => chat.selectedConversation?.id,
  async () => {
    await scrollToBottom();
  },
);

watch(
  () => chat.messages.length,
  async () => {
    const el = messagesContainer.value;

    if (!el) return;

    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;

    if (isNearBottom) {
      await scrollToBottom();
    }
  },
);

const handleSendMessage = async () => {
  if (!messageText.value.trim()) return;

  if (chat.editingMessage) {
    await chat.editMessage(chat.editingMessage.id, messageText.value);
    messageText.value = "";
    return;
  }

  chat.sendTextMessage(messageText.value, chat.replyToMessage?.id || null);

  messageText.value = "";
};
const typingText = computed(() => {
  const conversationId = chat.selectedConversation?.id;

  if (!conversationId) return "";

  const users = chat.typingUsers[conversationId] || [];

  if (users.length === 0) return "";

  return "Đang nhập...";
});

const handleScroll = async () => {
  const el = messagesContainer.value;

  if (!el) return;

  // Khi kéo gần lên đầu thì load tin cũ
  if (el.scrollTop <= 80 && chat.hasMoreMessages && !chat.loadingOldMessages) {
    const oldScrollHeight = el.scrollHeight;

    await chat.loadOldMessages();

    await nextTick();

    // Giữ nguyên vị trí scroll, không bị nhảy màn hình
    const newScrollHeight = el.scrollHeight;
    el.scrollTop = newScrollHeight - oldScrollHeight;
  }
};

const replyPreview = computed(() => chat.replyToMessage);
const editingPreview = computed(() => chat.editingMessage);

const handleReply = (message) => {
  chat.setReplyMessage(message);
};

const handleEdit = (message) => {
  chat.setEditingMessage(message);
  messageText.value = message.content || "";
};

const handleRecall = (message) => {
  const ok = confirm("Bạn có chắc muốn thu hồi tin nhắn này không?");

  if (!ok) return;

  chat.recallMessage(message.id);
};

const handleReact = async (message, reactionType) => {
  await chat.reactMessage(message.id, reactionType);
};
</script>

<template>
  <main class="flex-1 h-screen flex flex-col bg-[#f0f2f5]">
    <template v-if="chat.selectedConversation">
      <header
        class="h-16 px-5 border-b border-gray-200 flex items-center justify-between"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center font-bold"
          >
            {{ conversationTitle.charAt(0).toUpperCase() }}
          </div>

          <div>
            <h2 class="font-semibold text-gray-900">
              {{ conversationTitle }}
            </h2>

            <p
              class="text-xs"
              :class="chat.wsConnected ? 'text-green-500' : 'text-gray-400'"
            >
              {{ chat.wsConnected ? "Đang kết nối realtime" : "Mất kết nối" }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            class="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center"
          >
            <Phone class="w-5 h-5 text-blue-600" />
          </button>

          <button
            class="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center"
          >
            <Video class="w-5 h-5 text-blue-600" />
          </button>

          <button
            class="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center"
          >
            <Info class="w-5 h-5 text-blue-600" />
          </button>
        </div>
      </header>

      <section
        ref="messagesContainer"
        @scroll="handleScroll"
        class="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 bg-white"
      >
        <div
          v-if="chat.loadingMessages"
          class="text-center text-gray-500 py-10"
        >
          Đang tải tin nhắn...
        </div>

        <div
          v-else-if="chat.messages.length === 0"
          class="h-full flex flex-col items-center justify-center text-center text-gray-500"
        >
          <div
            class="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center font-bold text-3xl mb-4"
          >
            {{ conversationTitle.charAt(0).toUpperCase() }}
          </div>

          <h3 class="text-lg font-semibold text-gray-800">
            {{ conversationTitle }}
          </h3>

          <p class="text-sm">Hãy bắt đầu cuộc trò chuyện</p>
        </div>
        <div
          v-if="chat.loadingOldMessages"
          class="text-center text-xs text-gray-400 py-2"
        >
          Đang tải tin nhắn cũ...
        </div>

        <div
          v-else-if="!chat.hasMoreMessages && chat.messages.length > 0"
          class="text-center text-xs text-gray-300 py-2"
        >
          Không còn tin nhắn cũ hơn
        </div>
        <MessageBubble
          v-for="message in chat.messages"
          :key="message.id"
          :message="message"
          @reply="handleReply"
          @edit="handleEdit"
          @recall="handleRecall"
          @react="handleReact"
        />
        <div v-if="typingText" class="text-sm text-gray-400 italic mt-2">
          {{ typingText }}
        </div>
      </section>

      <footer class="border-t border-gray-100 px-4 py-3">
        <div
          v-if="replyPreview"
          class="mb-2 mx-12 bg-gray-100 border-l-4 border-blue-500 rounded-xl px-4 py-2 flex items-center justify-between"
        >
          <div class="min-w-0">
            <p class="text-xs font-semibold text-blue-600">Đang trả lời</p>
            <p class="text-sm text-gray-600 truncate">
              {{ replyPreview.content || replyPreview.file_type || "Tin nhắn" }}
            </p>
          </div>

          <button
            type="button"
            class="text-gray-400 hover:text-gray-700"
            @click="chat.clearReplyMessage()"
          >
            ✕
          </button>
        </div>

        <div
          v-if="editingPreview"
          class="mb-2 mx-12 bg-yellow-50 border-l-4 border-yellow-500 rounded-xl px-4 py-2 flex items-center justify-between"
        >
          <div class="min-w-0">
            <p class="text-xs font-semibold text-yellow-700">
              Đang sửa tin nhắn
            </p>
            <p class="text-sm text-gray-600 truncate">
              {{ editingPreview.content }}
            </p>
          </div>

          <button
            type="button"
            class="text-gray-400 hover:text-gray-700"
            @click="
              chat.clearEditingMessage();
              messageText = '';
            "
          >
            ✕
          </button>
        </div>
        <form @submit.prevent="handleSendMessage" class="flex items-end gap-2">
          <button
            type="button"
            class="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center"
          >
            <MoreHorizontal class="w-5 h-5 text-blue-600" />
          </button>

          <button
            type="button"
            class="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center"
          >
            <Image class="w-5 h-5 text-blue-600" />
          </button>

          <div
            class="flex-1 bg-gray-100 rounded-2xl flex items-center px-4 py-2"
          >
            <textarea
              @input="handleTyping"
              v-model="messageText"
              rows="1"
              :placeholder="
                editingPreview ? 'Nhập nội dung chỉnh sửa...' : 'Aa'
              "
              class="flex-1 bg-transparent outline-none resize-none text-sm max-h-28"
            ></textarea>

            <button type="button" class="ml-2">
              <Smile class="w-5 h-5 text-blue-600" />
            </button>
          </div>

          <button
            type="submit"
            class="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center"
          >
            <SendHorizonal class="w-5 h-5 text-white" />
          </button>
        </form>
      </footer>
    </template>

    <template v-else>
      <div
        class="flex-1 flex items-center justify-center text-center text-gray-500"
      >
        <div>
          <div
            class="w-24 h-24 mx-auto rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-4xl mb-4"
          >
            💬
          </div>

          <h2 class="text-xl font-semibold text-gray-800">
            Chọn một cuộc trò chuyện
          </h2>

          <p class="text-sm">Tin nhắn sẽ hiển thị ở đây</p>
        </div>
      </div>
    </template>
  </main>
</template>
