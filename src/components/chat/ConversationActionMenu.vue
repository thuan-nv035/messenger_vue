<script setup>
import { ref, nextTick, onMounted, watch } from "vue";
import {
  Mail,
  BellOff,
  UserCircle,
  Phone,
  Video,
  Ban,
  Archive,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-vue-next";

const props = defineProps({
  conversation: {
    type: Object,
    required: true,
  },
  position: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["close", "action"]);

const menuRef = ref(null);
const arrowStyle = ref({});
const menuStyle = ref({
  top: "16px",
  left: "16px",
});

const menuItems = [
  { key: "mark_unread", label: "Đánh dấu là chưa đọc", icon: Mail },
  { key: "mute", label: "Tắt thông báo", icon: BellOff },
  { key: "profile", label: "Xem trang cá nhân", icon: UserCircle },
  { divider: true },
  { key: "audio_call", label: "Gọi thoại", icon: Phone },
  { key: "video_call", label: "Chat video", icon: Video },
  { key: "block", label: "Chặn", icon: Ban },
  { key: "archive", label: "Lưu trữ đoạn chat", icon: Archive },
  { key: "delete", label: "Xóa đoạn chat", icon: Trash2, danger: true },
  { key: "report", label: "Báo cáo", icon: TriangleAlert, danger: true },
];

const updatePosition = async () => {
  await nextTick();

  const el = menuRef.value;
  if (!el) return;

  const viewportPadding = 12;
  const menuWidth = el.offsetWidth;
  const menuHeight = el.offsetHeight;

  let top = props.position.top;
  let left = props.position.left;
  let opensUp = false;

  if (top + menuHeight > window.innerHeight - viewportPadding) {
    top = props.position.anchorTop - menuHeight - 8;
    opensUp = true;
  }

  if (top < viewportPadding) {
    top = viewportPadding;
  }

  if (left + menuWidth > window.innerWidth - viewportPadding) {
    left = window.innerWidth - menuWidth - viewportPadding;
  }

  if (left < viewportPadding) {
    left = viewportPadding;
  }

  menuStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    transformOrigin: opensUp ? "bottom right" : "top right",
  };

  const arrowX = Math.min(
    Math.max((props.position.anchorCenterX || left + menuWidth - 30) - left, 24),
    menuWidth - 24
  );

  arrowStyle.value = opensUp
    ? {
        left: `${arrowX}px`,
        bottom: "-6px",
        transform: "rotate(45deg)",
      }
    : {
        left: `${arrowX}px`,
        top: "-6px",
        transform: "rotate(45deg)",
      };
};

onMounted(() => {
  updatePosition();
});

watch(
  () => props.position,
  () => updatePosition(),
  { deep: true }
);

const handleClick = (item) => {
  if (item.divider) return;

  emit("action", {
    action: item.key,
    conversation: props.conversation,
  });
};
</script>

<template>
  <div
    class="fixed inset-0 z-[100]"
    @click="emit('close')"
    @contextmenu.prevent="emit('close')"
  >
    <Transition
      appear
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        ref="menuRef"
        class="absolute w-[330px] max-h-[calc(100vh-24px)] overflow-y-auto bg-[#242526] border border-white/10 rounded-2xl shadow-2xl py-2 text-white"
        :style="menuStyle"
        @click.stop
        @contextmenu.prevent.stop
      >
        <div
          class="absolute w-3 h-3 bg-[#242526] border-l border-t border-white/10 z-[-1]"
          :style="arrowStyle"
        />

        <div class="px-2">
          <button
            type="button"
            class="absolute right-2 top-2 w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center"
            @click="emit('close')"
          >
            <X class="w-4 h-4 text-gray-300" />
          </button>

          <div class="px-3 py-2 pr-10 border-b border-white/10 mb-1">
            <p class="font-semibold truncate">
              {{ conversation.display_name || conversation.name || `Cuộc trò chuyện #${conversation.id}` }}
            </p>
            <p class="text-xs text-gray-400">
              Tùy chọn đoạn chat
            </p>
          </div>

          <template
            v-for="(item, index) in menuItems"
            :key="index"
          >
            <div
              v-if="item.divider"
              class="h-px bg-white/10 my-2 mx-3"
            />

            <button
              v-else
              type="button"
              class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition active:scale-[0.99]"
              :class="item.danger
                ? 'hover:bg-red-500/15 text-red-300'
                : 'hover:bg-white/10 text-gray-100'"
              @click="handleClick(item)"
            >
              <component
                :is="item.icon"
                class="w-5 h-5 shrink-0"
                :class="item.danger ? 'text-red-300' : 'text-gray-200'"
              />

              <span class="font-semibold text-[15px]">
                {{ item.label }}
              </span>
            </button>
          </template>
        </div>
      </div>
    </Transition>
  </div>
</template>