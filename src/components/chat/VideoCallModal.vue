<script setup>
import { ref, watch, onBeforeUnmount, nextTick, computed } from "vue";
import { PhoneOff, Video, Mic, MicOff } from "lucide-vue-next";
import { useChatStore } from "../../stores/chat";

const chat = useChatStore();

const localVideo = ref(null);
const remoteVideo = ref(null);

const peer = ref(null);
const localStream = ref(null);
const remoteStream = ref(null);

const micEnabled = ref(true);
const cameraEnabled = ref(true);
const peerReady = ref(false);
const pendingCandidates = ref([]);
const callSeconds = ref(0);
const durationTimer = ref(null);
const incomingTimer = ref(null);
const callingTimer = ref(null);

let audioContext = null;
let ringtoneTimer = null;
const rtcConfig = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

const getRemoteUserId = () => {
  return chat.activeCall?.remote_user_id || chat.activeCall?.receiver_id;
};

const initPeer = async () => {
  if (peerReady.value) return;

  await nextTick();

  localStream.value = await navigator.mediaDevices.getUserMedia({
    video: !isAudioCall.value,
    audio: true,
  });

  remoteStream.value = new MediaStream();

  if (localVideo.value) {
    localVideo.value.srcObject = localStream.value;
  }

  if (remoteVideo.value) {
    remoteVideo.value.srcObject = remoteStream.value;
  }

  peer.value = new RTCPeerConnection(rtcConfig);

  localStream.value.getTracks().forEach((track) => {
    peer.value.addTrack(track, localStream.value);
  });

  peer.value.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.value.addTrack(track);
    });

    if (remoteVideo.value) {
      remoteVideo.value.srcObject = remoteStream.value;
    }
  };

  peer.value.onicecandidate = (event) => {
    if (event.candidate) {
      chat.sendIceCandidate(getRemoteUserId(), event.candidate);
    }
  };

  peerReady.value = true;
};

const flushPendingCandidates = async () => {
  if (!peer.value) return;

  for (const candidate of pendingCandidates.value) {
    try {
      await peer.value.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn("ICE candidate error:", err);
    }
  }

  pendingCandidates.value = [];
};

const handleCallAccepted = async () => {
  if (!chat.activeCall?.isCaller) return;

  await initPeer();

  const offer = await peer.value.createOffer();
  await peer.value.setLocalDescription(offer);

  chat.sendWebRTCOffer(getRemoteUserId(), offer);
};

const handleOffer = async (data) => {
  await initPeer();

  await peer.value.setRemoteDescription(new RTCSessionDescription(data.offer));

  await flushPendingCandidates();

  const answer = await peer.value.createAnswer();
  await peer.value.setLocalDescription(answer);

  chat.sendWebRTCAnswer(data.sender_id, answer);
};

const handleAnswer = async (data) => {
  if (!peer.value) return;

  await peer.value.setRemoteDescription(new RTCSessionDescription(data.answer));

  await flushPendingCandidates();
};

const handleIceCandidate = async (data) => {
  if (!data.candidate) return;

  if (!peer.value || !peer.value.remoteDescription) {
    pendingCandidates.value.push(data.candidate);
    return;
  }

  try {
    await peer.value.addIceCandidate(new RTCIceCandidate(data.candidate));
  } catch (err) {
    console.warn("ICE candidate error:", err);
  }
};

const cleanup = () => {
  stopRingtone();
  clearIncomingTimeout();
  clearCallingTimeout();
  stopDurationTimer();

  if (peer.value) {
    peer.value.close();
    peer.value = null;
  }

  if (localStream.value) {
    localStream.value.getTracks().forEach((track) => track.stop());
    localStream.value = null;
  }

  if (remoteStream.value) {
    remoteStream.value.getTracks().forEach((track) => track.stop());
    remoteStream.value = null;
  }

  peerReady.value = false;
  pendingCandidates.value = [];
};

const acceptCall = async () => {
  stopRingtone();
  clearIncomingTimeout();

  chat.acceptCall();

  await nextTick();
  await initPeer();

  startDurationTimer();
};

const rejectCall = () => {
  stopRingtone();
  clearIncomingTimeout();

  chat.rejectCall();

  cleanup();
};

const endCall = () => {
  stopRingtone();
  clearIncomingTimeout();
  clearCallingTimeout();
  stopDurationTimer();

  chat.endCall();
  cleanup();
};

const toggleMic = () => {
  if (!localStream.value) return;

  micEnabled.value = !micEnabled.value;

  localStream.value.getAudioTracks().forEach((track) => {
    track.enabled = micEnabled.value;
  });
};

const toggleCamera = () => {
  if (isAudioCall.value) return;
  if (!localStream.value) return;

  cameraEnabled.value = !cameraEnabled.value;

  localStream.value.getVideoTracks().forEach((track) => {
    track.enabled = cameraEnabled.value;
  });
};

watch(
  () => chat.callEvent,
  async (event) => {
    if (!event) return;

    if (event.type === "call_accepted") {
      clearCallingTimeout();
      startDurationTimer();
      await handleCallAccepted(event.data);
    }

    if (event.type === "webrtc_offer") {
      await handleOffer(event.data);
    }

    if (event.type === "webrtc_answer") {
      await handleAnswer(event.data);
    }

    if (event.type === "ice_candidate") {
      await handleIceCandidate(event.data);
    }

    if (
      event.type === "call_rejected" ||
      event.type === "call_ended" ||
      event.type === "call_failed"
    ) {
      cleanup();
    }
  },
);

const playBeep = () => {
  if (!audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = 880;

  gain.gain.setValueAtTime(0.001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    audioContext.currentTime + 0.35,
  );

  oscillator.connect(gain);
  gain.connect(audioContext.destination);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.36);
};

const startRingtone = async () => {
  try {
    if (!audioContext) {
      audioContext = new AudioContext();
    }

    await audioContext.resume();

    stopRingtone();

    playBeep();

    ringtoneTimer = setInterval(() => {
      playBeep();
    }, 900);
  } catch (err) {
    console.warn("Ringtone blocked by browser:", err);
  }
};

const stopRingtone = () => {
  if (ringtoneTimer) {
    clearInterval(ringtoneTimer);
    ringtoneTimer = null;
  }
};

const startDurationTimer = () => {
  stopDurationTimer();

  callSeconds.value = 0;

  durationTimer.value = setInterval(() => {
    callSeconds.value += 1;
  }, 1000);
};

const stopDurationTimer = () => {
  if (durationTimer.value) {
    clearInterval(durationTimer.value);
    durationTimer.value = null;
  }
};

const startIncomingTimeout = () => {
  clearIncomingTimeout();

  incomingTimer.value = setTimeout(() => {
    if (chat.incomingCall && !chat.activeCall) {
      rejectCall();
    }
  }, 30000);
};

const clearIncomingTimeout = () => {
  if (incomingTimer.value) {
    clearTimeout(incomingTimer.value);
    incomingTimer.value = null;
  }
};

const startCallingTimeout = () => {
  clearCallingTimeout();

  callingTimer.value = setTimeout(() => {
    if (chat.activeCall?.status === "calling") {
      endCall();
    }
  }, 30000);
};

const clearCallingTimeout = () => {
  if (callingTimer.value) {
    clearTimeout(callingTimer.value);
    callingTimer.value = null;
  }
};

onBeforeUnmount(() => {
  cleanup();
});

const formatCallDuration = computed(() => {
  const minutes = Math.floor(callSeconds.value / 60);
  const seconds = callSeconds.value % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
});

watch(
  () => chat.incomingCall,
  async (call) => {
    if (call && !chat.activeCall) {
      await startRingtone();
      startIncomingTimeout();
    } else {
      stopRingtone();
      clearIncomingTimeout();
    }
  },
);

watch(
  () => chat.activeCall?.status,
  (status) => {
    if (status === "calling") {
      startCallingTimeout();
    }

    if (status === "accepted") {
      clearCallingTimeout();
      stopRingtone();
      startDurationTimer();
    }
  },
);

const isAudioCall = computed(() => {
  const call = chat.activeCall || chat.incomingCall;
  return call?.call_type === "audio";
});

const callTitle = computed(() => {
  return isAudioCall.value ? "Cuộc gọi thoại" : "Cuộc gọi video";
});
</script>

<template>
  <div
    v-if="chat.incomingCall || chat.activeCall"
    class="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center"
  >
    <!-- Incoming call -->
    <div
      v-if="chat.incomingCall && !chat.activeCall"
      class="w-full max-w-sm bg-[#242526] text-white rounded-3xl p-6 text-center shadow-2xl border border-white/10"
    >
      <div
        class="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-[#5f8dff] to-[#3f5df3] flex items-center justify-center text-4xl font-bold"
      >
        C
      </div>

      <h2 class="text-xl font-semibold mt-4">{{ callTitle }} đến</h2>

      <p class="text-gray-400 text-sm mt-1">
        User #{{ chat.incomingCall.caller_id }} đang gọi cho bạn
      </p>

      <div class="flex items-center justify-center gap-5 mt-7">
        <button
          type="button"
          class="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center"
          @click="rejectCall"
        >
          <PhoneOff class="w-6 h-6 text-white" />
        </button>

        <button
          type="button"
          class="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center"
          @click="acceptCall"
        >
          <Video v-if="!isAudioCall" class="w-6 h-6 text-white" />

          <Mic v-else class="w-6 h-6 text-white" />
        </button>
      </div>
    </div>

    <!-- Active call -->
    <div
      v-else
      class="relative w-[90vw] max-w-5xl h-[80vh] bg-[#111214] rounded-3xl overflow-hidden shadow-2xl border border-white/10"
    >
      <template v-if="!isAudioCall">
        <video
          ref="remoteVideo"
          autoplay
          playsinline
          class="w-full h-full object-cover bg-black"
        ></video>

        <div
          class="absolute right-5 top-5 w-48 h-32 bg-black rounded-2xl overflow-hidden border border-white/20 shadow-xl"
        >
          <video
            ref="localVideo"
            autoplay
            playsinline
            muted
            class="w-full h-full object-cover"
          ></video>
        </div>
      </template>

      <template v-else>
        <audio ref="remoteVideo" autoplay playsinline></audio>

        <div
          class="w-full h-full flex flex-col items-center justify-center bg-[#111214] text-white"
        >
          <div
            class="w-32 h-32 rounded-full bg-gradient-to-br from-[#5f8dff] to-[#3f5df3] flex items-center justify-center text-5xl font-bold mb-5"
          >
            C
          </div>

          <h2 class="text-2xl font-semibold">Cuộc gọi thoại</h2>

          <p class="text-gray-400 mt-2">
            <span v-if="chat.activeCall?.status === 'calling'">
              Đang gọi...
            </span>

            <span v-else>
              {{ formatCallDuration }}
            </span>
          </p>
        </div>
      </template>

      <div
        class="absolute right-5 top-5 w-48 h-32 bg-black rounded-2xl overflow-hidden border border-white/20 shadow-xl"
      >
        <video
          ref="localVideo"
          autoplay
          playsinline
          muted
          class="w-full h-full object-cover"
        ></video>
      </div>

      <div
        class="absolute top-6 left-1/2 -translate-x-1/2 bg-black/50 px-5 py-2 rounded-full text-white text-sm"
      >
        <span v-if="chat.activeCall?.status === 'calling'"> Đang gọi... </span>

        <span v-else>
          {{ formatCallDuration }}
        </span>
      </div>

      <div
        class="absolute left-1/2 -translate-x-1/2 bottom-6 flex items-center gap-4 bg-black/40 px-5 py-3 rounded-full"
      >
        <button
          type="button"
          class="w-12 h-12 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
          @click="toggleMic"
        >
          <Mic v-if="micEnabled" class="w-5 h-5 text-white" />
          <MicOff v-else class="w-5 h-5 text-red-400" />
        </button>

        <button
          v-if="!isAudioCall"
          type="button"
          class="w-12 h-12 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
          @click="toggleCamera"
        >
          <Video
            class="w-5 h-5"
            :class="cameraEnabled ? 'text-white' : 'text-red-400'"
          />
        </button>

        <button
          type="button"
          class="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center"
          @click="endCall"
        >
          <PhoneOff class="w-6 h-6 text-white" />
        </button>
      </div>
    </div>
  </div>
</template>
