<script setup>
import { computed } from "vue";
import { useChatStore } from "../../stores/chat";
import { XCircle, Info, AlertTriangle, CheckCircle } from "lucide-vue-next";

const chat = useChatStore();

const toastClass = computed(() => {
  if (!chat.toast) return "";

  if (chat.toast.type === "error") {
    return "bg-red-500/95 text-white";
  }

  if (chat.toast.type === "warning") {
    return "bg-yellow-500/95 text-white";
  }

  if (chat.toast.type === "success") {
    return "bg-green-500/95 text-white";
  }

  return "bg-[#3A3B3C] text-white";
});

const toastIcon = computed(() => {
  if (!chat.toast) return Info;

  if (chat.toast.type === "error") return XCircle;
  if (chat.toast.type === "warning") return AlertTriangle;
  if (chat.toast.type === "success") return CheckCircle;

  return Info;
});
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0 translate-y-3 scale-95"
    enter-to-class="opacity-100 translate-y-0 scale-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="opacity-100 translate-y-0 scale-100"
    leave-to-class="opacity-0 translate-y-3 scale-95"
  >
    <div
      v-if="chat.toast"
      class="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 min-w-[280px]"
      :class="toastClass"
    >
      <component :is="toastIcon" class="w-5 h-5 shrink-0" />

      <p class="font-medium text-sm">
        {{ chat.toast.message }}
      </p>
    </div>
  </Transition>
</template>