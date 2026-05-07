<script setup>
import { computed, ref, nextTick, watch, onMounted } from "vue";
import {
  Phone,
  Video,
  Info,
  Image,
  Smile,
  SendHorizonal,
  MoreHorizontal,
  X,
  Mic,
  Square,
  Trash2,
} from "lucide-vue-next";

import { useChatStore } from "../../stores/chat";
import MessageBubble from "./MessageBubble.vue";

const chat = useChatStore();
const fileInput = ref(null);
const uploadingFile = ref(false);
const messageText = ref("");
const messagesContainer = ref(null);
let typingTimeout = null;
const isRecording = ref(false);
const recordingTime = ref(0);
const mediaRecorder = ref(null);
const audioChunks = ref([]);
const recordingTimer = ref(null);
const conversationTitle = computed(() => {
  const c = chat.selectedConversation;

  if (!c) return "Chưa chọn cuộc trò chuyện";

  return (
    c.display_name ||
    c.name ||
    (Number(c.is_group) === 1 ? `Nhóm #${c.id}` : `Cuộc trò chuyện #${c.id}`)
  );
});

const replyPreview = computed(() => chat.replyToMessage);
const editingPreview = computed(() => chat.editingMessage);

const typingText = computed(() => {
  const conversationId = chat.selectedConversation?.id;

  if (!conversationId) return "";

  const users = chat.typingUsers[conversationId] || [];

  if (users.length === 0) return "";

  return "Đang nhập...";
});

const scrollToBottom = async () => {
  await nextTick();

  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

const handleScroll = async () => {
  const el = messagesContainer.value;

  if (!el) return;

  if (el.scrollTop <= 80 && chat.hasMoreMessages && !chat.loadingOldMessages) {
    const oldScrollHeight = el.scrollHeight;

    await chat.loadOldMessages();

    await nextTick();

    const newScrollHeight = el.scrollHeight;
    el.scrollTop = newScrollHeight - oldScrollHeight;
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

const handleTyping = () => {
  if (typingTimeout) return;

  chat.sendTyping();

  typingTimeout = setTimeout(() => {
    typingTimeout = null;
  }, 1500);
};

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

const cancelReply = () => {
  chat.clearReplyMessage();
};

const cancelEdit = () => {
  chat.clearEditingMessage();
  messageText.value = "";
};

const openFilePicker = () => {
  fileInput.value?.click();
};

const handleFileChange = async (event) => {
  const file = event.target.files?.[0];

  if (!file) return;

  try {
    uploadingFile.value = true;

    const uploaded = await chat.uploadChatFile(file);

    chat.sendFileMessage(
      uploaded.file_url,
      uploaded.file_type,
      chat.replyToMessage?.id || null,
    );
  } catch (err) {
    alert(chat.error || "Upload file thất bại");
  } finally {
    uploadingFile.value = false;
    event.target.value = "";
  }
};

const formatRecordingTime = computed(() => {
  const minutes = Math.floor(recordingTime.value / 60);
  const seconds = recordingTime.value % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
});

const startRecording = async () => {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Trình duyệt không hỗ trợ ghi âm");
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    audioChunks.value = [];
    recordingTime.value = 0;

    let options = {};

    if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
      options = {
        mimeType: "audio/webm;codecs=opus",
      };
    } else if (MediaRecorder.isTypeSupported("audio/webm")) {
      options = {
        mimeType: "audio/webm",
      };
    }

    mediaRecorder.value = new MediaRecorder(stream, options);

    mediaRecorder.value.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.value.push(event.data);
      }
    };

    mediaRecorder.value.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
    };

    mediaRecorder.value.start();

    isRecording.value = true;

    recordingTimer.value = setInterval(() => {
      recordingTime.value += 1;
    }, 1000);
  } catch (err) {
    console.error(err);
    alert("Không thể truy cập micro. Hãy cấp quyền micro cho trình duyệt.");
  }
};

const cancelRecording = () => {
  if (mediaRecorder.value && mediaRecorder.value.state !== "inactive") {
    mediaRecorder.value.stop();
  }

  if (recordingTimer.value) {
    clearInterval(recordingTimer.value);
    recordingTimer.value = null;
  }

  audioChunks.value = [];
  recordingTime.value = 0;
  isRecording.value = false;
};

const stopAndSendRecording = async () => {
  if (!mediaRecorder.value) return;

  try {
    uploadingFile.value = true;

    await new Promise((resolve) => {
      mediaRecorder.value.onstop = () => {
        resolve();
      };

      if (mediaRecorder.value.state !== "inactive") {
        mediaRecorder.value.stop();
      } else {
        resolve();
      }
    });

    if (recordingTimer.value) {
      clearInterval(recordingTimer.value);
      recordingTimer.value = null;
    }

    const audioBlob = new Blob(audioChunks.value, {
      type: "audio/webm",
    });

    if (audioBlob.size <= 0) {
      alert("Không có dữ liệu ghi âm");
      return;
    }

    const audioFile = new File([audioBlob], `voice-${Date.now()}.webm`, {
      type: "audio/webm",
    });

    const uploaded = await chat.uploadChatFile(audioFile);

    chat.sendFileMessage(
      uploaded.file_url,
      uploaded.file_type,
      chat.replyToMessage?.id || null,
    );

    audioChunks.value = [];
    recordingTime.value = 0;
    isRecording.value = false;
  } catch (err) {
    console.error(err);
    alert(chat.error || "Gửi ghi âm thất bại");
  } finally {
    uploadingFile.value = false;
  }
};

const startVideoCall = () => {
  if (!chat.selectedConversation) return;

  if (Number(chat.selectedConversation.is_group) === 1) {
    alert("Bước này mới hỗ trợ video call 1-1");
    return;
  }

  chat.startVideoCall(chat.selectedConversation);
};

const startAudioCall = () => {
  if (!chat.selectedConversation) return;

  if (Number(chat.selectedConversation.is_group) === 1) {
    chat.showToast("Bước này mới hỗ trợ gọi thoại 1-1", "warning");
    return;
  }

  chat.startAudioCall(chat.selectedConversation);
};
</script>

<template>
  <main class="flex-1 h-screen flex flex-col bg-[#242526] text-white">
    <template v-if="chat.selectedConversation">
      <!-- Header -->
      <header
        class="h-[76px] px-6 border-b border-white/10 flex items-center justify-between bg-[#242526]"
      >
        <div class="flex items-center gap-3 min-w-0">
          <div class="relative">
            <div
              class="w-12 h-12 rounded-full bg-gradient-to-br from-[#5f8dff] to-[#3f5df3] text-white flex items-center justify-center font-bold text-xl shrink-0"
            >
              {{ conversationTitle.charAt(0).toUpperCase() }}
            </div>

            <div
              v-if="chat.isOnline"
              class="absolute bottom-1 right-0 w-3 h-3 rounded-full bg-[#31d158] border-2 border-[#18191A]"
            />
          </div>

          <div class="min-w-0">
            <h2 class="font-semibold text-[17px] text-white truncate">
              {{ conversationTitle }}
            </h2>

            <p
              class="text-[13px]"
              :class="chat.isOnline ? 'text-[#31d158]' : 'text-gray-400'"
            >
              {{ chat.isOnline ? "Đang hoạt động" : "Không hoạt động" }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition"
            @click="startAudioCall"
          >
            <Phone class="w-5 h-5 text-[#2d88ff]" />
          </button>

          <button
            type="button"
            class="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition"
            @click="startVideoCall"
          >
            <Video class="w-5 h-5 text-[#2d88ff]" />
          </button>

          <button
            @click="chat.handleActiveInfo"
            type="button"
            class="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition"
          >
            <Info class="w-5 h-5 text-[#2d88ff]" />
          </button>
        </div>
      </header>

      <!-- Messages -->
      <section
        ref="messagesContainer"
        @scroll="handleScroll"
        class="flex-1 overflow-y-auto overflow-x-hidden px-7 py-5 bg-[#242526]"
      >
        <div
          v-if="chat.loadingOldMessages"
          class="text-center text-xs text-gray-500 py-2"
        >
          Đang tải tin nhắn cũ...
        </div>

        <div
          v-else-if="!chat.hasMoreMessages && chat.messages.length > 0"
          class="text-center text-xs text-gray-500 py-2"
        >
          Không còn tin nhắn cũ hơn
        </div>

        <div
          v-if="chat.loadingMessages"
          class="text-center text-gray-400 py-10"
        >
          Đang tải tin nhắn...
        </div>

        <div
          v-else-if="chat.messages.length === 0"
          class="h-full flex flex-col items-center justify-center text-center text-gray-400"
        >
          <div
            class="w-24 h-24 rounded-full bg-gradient-to-br from-[#5f8dff] to-[#3f5df3] text-white flex items-center justify-center font-bold text-4xl mb-4"
          >
            {{ conversationTitle.charAt(0).toUpperCase() }}
          </div>

          <h3 class="text-xl font-semibold text-white">
            {{ conversationTitle }}
          </h3>

          <p class="text-sm text-gray-400 mt-1">Hãy bắt đầu cuộc trò chuyện</p>
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

        <div v-if="typingText" class="text-sm text-gray-400 italic mt-2 ml-4">
          {{ typingText }}
        </div>
      </section>

      <!-- Footer -->
      <footer class="border-t border-white/10 bg-[#242526] px-5 py-4">
        <!-- Reply preview -->
        <div
          v-if="replyPreview"
          class="mb-3 mx-12 bg-[#3A3B3C] border-l-4 border-[#2d88ff] rounded-xl px-4 py-2 flex items-center justify-between"
        >
          <div class="min-w-0">
            <p class="text-xs font-semibold text-[#5aa7ff]">Đang trả lời</p>

            <p class="text-sm text-gray-300 truncate">
              {{ replyPreview.content || replyPreview.file_type || "Tin nhắn" }}
            </p>
          </div>

          <button
            type="button"
            class="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center"
            @click="cancelReply"
          >
            <X class="w-4 h-4 text-gray-300" />
          </button>
        </div>

        <!-- Edit preview -->
        <div
          v-if="editingPreview"
          class="mb-3 mx-12 bg-[#3A3B3C] border-l-4 border-yellow-500 rounded-xl px-4 py-2 flex items-center justify-between"
        >
          <div class="min-w-0">
            <p class="text-xs font-semibold text-yellow-400">
              Đang sửa tin nhắn
            </p>

            <p class="text-sm text-gray-300 truncate">
              {{ editingPreview.content }}
            </p>
          </div>

          <button
            type="button"
            class="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center"
            @click="cancelEdit"
          >
            <X class="w-4 h-4 text-gray-300" />
          </button>
        </div>

        <input
          ref="fileInput"
          type="file"
          class="hidden"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar"
          @change="handleFileChange"
        />

        <div
          v-if="isRecording"
          class="mb-3 mx-12 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 flex items-center justify-between"
        >
          <div class="flex items-center gap-3">
            <div class="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>

            <div>
              <p class="text-sm font-semibold text-red-300">Đang ghi âm</p>
              <p class="text-xs text-gray-400">
                {{ formatRecordingTime }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              class="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center"
              @click="cancelRecording"
            >
              <Trash2 class="w-4 h-4 text-red-400" />
            </button>

            <button
              type="button"
              class="w-9 h-9 rounded-full bg-[#2d88ff] hover:bg-[#1f6fd1] flex items-center justify-center"
              @click="stopAndSendRecording"
            >
              <Square class="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        <form @submit.prevent="handleSendMessage" class="flex items-end gap-2">
          <button
            type="button"
            class="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition"
          >
            <MoreHorizontal class="w-5 h-5 text-[#2d88ff]" />
          </button>

          <button
            type="button"
            :disabled="uploadingFile"
            class="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition disabled:opacity-50"
            @click="openFilePicker"
          >
            <Image class="w-5 h-5 text-[#2d88ff]" />
          </button>

          <button
            type="button"
            :disabled="uploadingFile || isRecording"
            class="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center transition disabled:opacity-50"
            @click="startRecording"
          >
            <Mic class="w-5 h-5 text-[#2d88ff]" />
          </button>
          <div
            class="flex-1 bg-[#3A3B3C] rounded-3xl flex items-center px-4 py-2"
          >
            <textarea
              v-model="messageText"
              @input="handleTyping"
              rows="1"
              :placeholder="
                editingPreview ? 'Nhập nội dung chỉnh sửa...' : 'Aa'
              "
              class="flex-1 bg-transparent outline-none resize-none text-[15px] max-h-28 text-white placeholder:text-gray-400"
            ></textarea>

            <button type="button" class="ml-2">
              <Smile class="w-5 h-5 text-[#2d88ff]" />
            </button>
          </div>

          <span v-if="uploadingFile" class="text-xs text-gray-400 px-2">
            Đang upload...
          </span>

          <button
            type="submit"
            class="w-11 h-11 rounded-full bg-[#2d88ff] hover:bg-[#1f6fd1] flex items-center justify-center transition"
          >
            <SendHorizonal class="w-5 h-5 text-white" />
          </button>
        </form>
      </footer>
    </template>

    <template v-else>
      <div
        class="flex-1 flex items-center justify-center text-center text-gray-400"
      >
        <div>
          <div
            class="w-28 h-28 mx-auto rounded-full bg-[#3A3B3C] text-[#2d88ff] flex items-center justify-center text-5xl mb-4"
          >
            💬
          </div>

          <h2 class="text-xl font-semibold text-white">
            Chọn một cuộc trò chuyện
          </h2>

          <p class="text-sm text-gray-400 mt-1">Tin nhắn sẽ hiển thị ở đây</p>
        </div>
      </div>
    </template>
  </main>
</template>
