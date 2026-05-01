<script setup>
import { computed } from "vue";

const props = defineProps({
  conversation: {
    type: Object,
    required: true,
  },
  active: {
    type: Boolean,
    default: false,
  },
});

const title = computed(() => {
  if (props.conversation.name) return props.conversation.name;

  if (props.conversation.is_group === 1) {
    return `Nhóm #${props.conversation.id}`;
  }

  return `Cuộc trò chuyện #${props.conversation.id}`;
});

const lastMessage = computed(() => {
  return props.conversation.last_message?.content || "Chưa có tin nhắn";
});
</script>

<template>
  <div
    class="flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition"
    :class="active ? 'bg-blue-50' : 'hover:bg-gray-100'"
  >
    <div class="relative">
      <div
        class="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center font-bold"
      >
        {{ title.charAt(0).toUpperCase() }}
      </div>

      <span
        v-if="conversation.is_pinned"
        class="absolute -top-1 -right-1 bg-yellow-400 text-[10px] w-5 h-5 flex items-center justify-center rounded-full"
      >
        📌
      </span>
    </div>

    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between gap-2">
        <h3
          class="font-semibold text-sm truncate"
          :class="active ? 'text-blue-600' : 'text-gray-900'"
        >
          {{ title }}
        </h3>

        <span
          v-if="conversation.unread_count > 0"
          class="bg-blue-600 text-white text-xs min-w-5 h-5 px-1 flex items-center justify-center rounded-full"
        >
          {{ conversation.unread_count }}
        </span>
      </div>

      <p
        class="text-sm truncate mt-0.5"
        :class="conversation.unread_count > 0 ? 'text-gray-900 font-semibold' : 'text-gray-500'"
      >
        {{ lastMessage }}
      </p>
    </div>
  </div>
</template>