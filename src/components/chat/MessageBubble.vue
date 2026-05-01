<script setup>
import { computed, ref } from "vue";
import { Reply, Pencil, RotateCcw, SmilePlus } from "lucide-vue-next";
import { useAuthStore } from "../../stores/auth";

const props = defineProps({
  message: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["reply", "edit", "recall", "react"]);

const auth = useAuthStore();
const showReactions = ref(false);

const isMine = computed(() => {
  return Number(props.message.sender_id) === Number(auth.user?.id);
});

const canEdit = computed(() => {
  return (
    isMine.value &&
    props.message.is_recalled !== 1 &&
    props.message.content &&
    !props.message.file_url
  );
});

const canRecall = computed(() => {
  return isMine.value && props.message.is_recalled !== 1;
});

const fileUrl = computed(() => {
  if (!props.message.file_url) return null;

  if (props.message.file_url.startsWith("http")) {
    return props.message.file_url;
  }

  return `${import.meta.env.VITE_API_URL}${props.message.file_url}`;
});

const reactionMap = {
  like: "👍",
  love: "❤️",
  haha: "😂",
  wow: "😮",
  sad: "😢",
  angry: "😡",
};

const reactionList = [
  { type: "like", icon: "👍" },
  { type: "love", icon: "❤️" },
  { type: "haha", icon: "😂" },
  { type: "wow", icon: "😮" },
  { type: "sad", icon: "😢" },
  { type: "angry", icon: "😡" },
];

const visibleReactions = computed(() => {
  const reactions = props.message.reactions;

  if (!reactions || !reactions.summary) return [];

  return Object.entries(reactions.summary)
    .filter(([_, count]) => count > 0)
    .map(([type, count]) => ({
      type,
      count,
      icon: reactionMap[type],
    }));
});

const handleReact = (type) => {
  emit("react", props.message, type);
  showReactions.value = false;
};
</script>

<template>
  <div
    class="message-row group relative flex w-full mb-5"
    :class="isMine ? 'justify-end pr-2' : 'justify-start pl-2'"
  >
    <div
      class="relative max-w-[70%]"
      :class="isMine ? 'items-end' : 'items-start'"
    >
      <!-- Reply preview -->
      <div
        v-if="message.reply_to"
        class="mb-1 px-3 py-2 rounded-xl text-xs bg-gray-100 text-gray-500 border-l-4 border-blue-400 max-w-full"
      >
        <p class="font-semibold">
          Trả lời tin nhắn
        </p>

        <p class="truncate">
          {{ message.reply_to.content || message.reply_to.file_type || "Tin nhắn" }}
        </p>
      </div>

      <!-- Bubble -->
      <div
        class="relative px-4 py-2 rounded-2xl text-sm break-words"
        :class="isMine
          ? 'bg-blue-600 text-white rounded-br-md'
          : 'bg-gray-100 text-gray-900 rounded-bl-md'"
      >
        <template v-if="message.is_recalled === 1">
          <span class="italic opacity-70">
            Tin nhắn đã được thu hồi
          </span>
        </template>

        <template v-else>
          <p v-if="message.content">
            {{ message.content }}
          </p>

          <img
            v-if="message.file_type === 'image' && fileUrl"
            :src="fileUrl"
            class="mt-2 rounded-xl max-w-full"
          />

          <video
            v-else-if="message.file_type === 'video' && fileUrl"
            :src="fileUrl"
            controls
            class="mt-2 rounded-xl max-w-full"
          />

          <audio
            v-else-if="message.file_type === 'audio' && fileUrl"
            :src="fileUrl"
            controls
            class="mt-2"
          />

          <a
            v-else-if="message.file_url && fileUrl"
            :href="fileUrl"
            target="_blank"
            class="underline"
          >
            Tải file
          </a>
        </template>
      </div>

      <!-- Reactions dưới bubble -->
      <div
        v-if="visibleReactions.length > 0"
        class="absolute -bottom-2 bg-white border shadow-sm rounded-full px-1.5 py-0.5 flex items-center gap-0.5 text-xs z-10"
        :class="isMine ? 'right-2' : 'left-2'"
      >
        <span
          v-for="r in visibleReactions"
          :key="r.type"
        >
          {{ r.icon }}
        </span>

        <span
          v-if="message.reactions?.total > 1"
          class="text-gray-500 ml-0.5"
        >
          {{ message.reactions.total }}
        </span>
      </div>

      <!-- Time -->
      <div
        class="text-[11px] text-gray-400 mt-1 px-1"
        :class="isMine ? 'text-right' : 'text-left'"
      >
        <span v-if="message.is_edited === 1">
          đã chỉnh sửa ·
        </span>

        {{ new Date(message.created_at).toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit"
        }) }}

        <span v-if="isMine && message.is_seen === 1">
          · Đã xem
        </span>
      </div>

      <!-- Action buttons: absolute, không chiếm layout -->
      <div
        v-if="message.is_recalled !== 1"
        class="absolute top-1/2 -translate-y-1/2 z-20 hidden group-hover:flex items-center gap-1"
        :class="isMine ? '-left-40' : '-right-40'"
      >
        <div class="relative flex items-center gap-1 bg-white/95 shadow-md border rounded-full px-1 py-1">
          <button
            type="button"
            title="Reaction"
            class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
            @click.stop="showReactions = !showReactions"
          >
            <SmilePlus class="w-4 h-4 text-gray-600" />
          </button>

          <button
            type="button"
            title="Trả lời"
            class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
            @click.stop="emit('reply', message)"
          >
            <Reply class="w-4 h-4 text-gray-600" />
          </button>

          <button
            v-if="canEdit"
            type="button"
            title="Sửa"
            class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
            @click.stop="emit('edit', message)"
          >
            <Pencil class="w-4 h-4 text-gray-600" />
          </button>

          <button
            v-if="canRecall"
            type="button"
            title="Thu hồi"
            class="w-8 h-8 rounded-full hover:bg-red-50 flex items-center justify-center"
            @click.stop="emit('recall', message)"
          >
            <RotateCcw class="w-4 h-4 text-red-500" />
          </button>

          <!-- Reaction popup -->
          <div
            v-if="showReactions"
            class="absolute bottom-11 bg-white border shadow-lg rounded-full px-2 py-1 flex items-center gap-1 z-30"
            :class="isMine ? 'right-0' : 'left-0'"
          >
            <button
              v-for="r in reactionList"
              :key="r.type"
              type="button"
              class="text-xl hover:scale-125 transition"
              @click.stop="handleReact(r.type)"
            >
              {{ r.icon }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>