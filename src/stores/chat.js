import { defineStore } from "pinia";
import api from "../api/axios";
import axios from "axios";

export const useChatStore = defineStore("chat", {
  state: () => ({
    conversations: [],
    selectedConversation: null,
    messages: [],
    userId: JSON.parse(localStorage.getItem("user")).id,

    ws: null,
    wsConnected: false,
    reconnectTimer: null,
    isOnline: false,

    typingUsers: {},
    typingTimers: {},

    hasMoreMessages: true,
    loadingOldMessages: false,

    replyToMessage: null,
    editingMessage: null,

    incomingCall: null,
    activeCall: null,
    callEvent: null,
    callTimeoutTimer: null,

    notificationSoundEnabled:
      localStorage.getItem("notification_sound_enabled") !== "false",
    notificationAudioContext: null,
    notificationSoundUnlocked: false,

    toast: null,
    loadingConversations: false,
    loadingMessages: false,
    error: "",
  }),

  actions: {
    async fetchConversations(options = {}) {
      const { autoSelect = true } = options;
      try {
        this.loadingConversations = true;
        this.error = "";

        const res = await api.get("/conversations");
        console.log("res.data", res.data);
        this.conversations = res.data;
        if (
          autoSelect &&
          !this.selectedConversation &&
          this.conversations.length > 0
        ) {
          await this.selectConversation(this.conversations[0]);
        }

        return res.data;
      } catch (err) {
        this.error =
          err.response?.data?.detail || "Không tải được danh sách chat";
      } finally {
        this.loadingConversations = false;
      }
    },

    async selectConversation(conversation) {
      this.selectedConversation = conversation;
      console.log("first", conversation);
      this.messages = [];

      await this.fetchMessages(conversation.id);

      await this.markConversationAsRead(conversation.id);
      if (conversation.is_group === 0) {
        const member = conversation.members.filter(
          (member) => member.id != this.userId,
        );
        await this.checkIsOnlineUser(member[0].id);
      }
      const c = this.conversations.find((item) => item.id === conversation.id);

      if (c) {
        c.unread_count = 0;
      }
    },

    async fetchMessages(conversationId) {
      try {
        this.loadingMessages = true;
        this.error = "";
        this.messages = [];
        this.hasMoreMessages = true;

        const currentConversationId = conversationId;

        const res = await api.get(
          `/conversations/${conversationId}/messages?limit=20`,
        );

        if (
          Number(this.selectedConversation?.id) !==
          Number(currentConversationId)
        ) {
          return;
        }

        this.messages = res.data.messages || [];
        this.hasMoreMessages = res.data.has_more;

        return res.data;
      } catch (err) {
        console.error(err);
        this.error = err.response?.data?.detail || "Không tải được tin nhắn";
      } finally {
        this.loadingMessages = false;
      }
    },

    async loadOldMessages() {
      if (!this.selectedConversation) return;
      if (this.loadingOldMessages) return;
      if (!this.hasMoreMessages) return;
      if (this.messages.length === 0) return;

      try {
        this.loadingOldMessages = true;

        const oldestId = this.messages[0].id;
        const conversationId = this.selectedConversation.id;

        const res = await api.get(
          `/conversations/${conversationId}/messages?limit=20&before_id=${oldestId}`,
        );

        if (Number(this.selectedConversation?.id) !== Number(conversationId)) {
          return;
        }

        const oldMessages = res.data.messages || [];

        this.messages = [...oldMessages, ...this.messages];

        this.hasMoreMessages = res.data.has_more;
      } catch (err) {
        this.error = err.response?.data?.detail || "Không tải được tin nhắn cũ";
      } finally {
        this.loadingOldMessages = false;
      }
    },

    connectWebSocket(userId) {
      if (!userId) return;

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        return;
      }

      const wsUrl = `${import.meta.env.VITE_WS_URL}/${userId}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log("WebSocket connected");
        this.wsConnected = true;

        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleSocketMessage(data);
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      this.ws.onclose = () => {
        console.log("WebSocket disconnected");
        this.wsConnected = false;

        this.reconnectTimer = setTimeout(() => {
          this.connectWebSocket(userId);
        }, 3000);
      };
    },

    disconnectWebSocket() {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }

      this.wsConnected = false;
    },

    handleSocketMessage(data) {
      console.log("WS received:", data);

      if (data.type === "online") {
        return;
      }

      if (data.type === "error") {
        this.error = data.message;
        return;
      }

      if (data.type === "message") {
        this.handleIncomingMessage(data);
        return;
      }

      if (data.type === "message_reaction") {
        this.handleMessageReaction(data);
        return;
      }

      if (data.type === "message_reaction_removed") {
        this.handleMessageReactionRemoved(data);
        return;
      }

      if (data.type === "file") {
        this.handleIncomingMessage(data);
        return;
      }

      if (data.type === "typing") {
        this.handleTyping(data);
        return;
      }

      if (data.type === "seen" || data.type === "conversation_read") {
        this.handleSeen(data);
        return;
      }

      if (data.type === "message_recalled") {
        this.handleMessageRecalled(data);
        return;
      }

      if (data.type === "message_edited") {
        this.handleMessageEdited(data);
        return;
      }

      if (data.type === "message_reaction") {
        this.handleMessageReaction(data);
        return;
      }

      if (data.type === "notification") {
        console.log("Notification:", data.data);
      }

      if (data.type === "incoming_call") {
        this.incomingCall = data;
        return;
      }

      if (data.type === "call_accepted") {
        if (this.activeCall) {
          this.activeCall.status = "accepted";
          this.activeCall.call_id = data.call_id;
          this.activeCall.remote_user_id = data.user_id;
        }

        this.callEvent = {
          type: "call_accepted",
          data,
          ts: Date.now(),
        };

        return;
      }

      if (data.type === "call_rejected") {
        this.callEvent = {
          type: "call_rejected",
          data,
          ts: Date.now(),
        };

        this.activeCall = null;
        this.incomingCall = null;

        this.showToast("Người dùng đã từ chối cuộc gọi", "warning");

        return;
      }

      if (data.type === "call_ended") {
        this.callEvent = {
          type: "call_ended",
          data,
          ts: Date.now(),
        };

        this.activeCall = null;
        this.incomingCall = null;

        if (data.status === "missed") {
          this.showToast("Cuộc gọi nhỡ", "warning");
        }

        return;
      }

      if (
        data.type === "webrtc_offer" ||
        data.type === "webrtc_answer" ||
        data.type === "ice_candidate"
      ) {
        this.callEvent = {
          type: data.type,
          data,
          ts: Date.now(),
        };

        return;
      }

      if (data.type === "call_started") {
        if (this.activeCall) {
          this.activeCall.call_id = data.call_id;
          this.activeCall.status = "calling";
        }

        this.callEvent = {
          type: "call_started",
          data,
          ts: Date.now(),
        };

        return;
      }

      if (data.type === "call_failed") {
        this.callEvent = {
          type: "call_failed",
          data,
          ts: Date.now(),
        };

        this.activeCall = null;
        this.incomingCall = null;
        this.error = data.message;

        this.showToast(data.message || "Không thể thực hiện cuộc gọi", "error");

        return;
      }
    },

    handleIncomingMessage(data) {
      const currentUserId = this.getCurrentUserId();

      const message = {
        id: data.id,
        conversation_id: data.conversation_id,
        sender_id: data.sender_id,
        content: data.content || null,
        file_url: data.file_url || null,
        file_type: data.file_type || null,
        reply_to_id: data.reply_to_id || null,
        reply_to: data.reply_to || null,
        is_recalled: data.is_recalled || 0,
        is_edited: data.is_edited || 0,
        edited_at: data.edited_at || null,
        edit_count: data.edit_count || 0,
        message_type: data.message_type || "text",
        call_status: data.call_status || null,
        created_at: data.created_at,
      };
      const isMine = Number(message.sender_id) === Number(currentUserId);

      const isCurrentConversation =
        Number(this.selectedConversation?.id) === Number(data.conversation_id);

      if (isCurrentConversation) {
        const exists = this.messages.some(
          (m) => Number(m.id) === Number(message.id),
        );

        if (!exists) {
          this.messages.push(message);
        }

        if (!isMine) {
          this.markConversationAsRead(data.conversation_id);
        }
      }

      const conversation = this.conversations.find(
        (c) => Number(c.id) === Number(message.conversation_id),
      );

      // Nếu conversation đã bị user xóa khỏi sidebar,
      // nhưng người kia nhắn tin mới thì phải load lại danh sách chat.
      if (!conversation && message.sender_id !== currentUserId) {
        this.fetchConversations({
          autoSelect: false,
        });

        return;
      }

      this.updateConversationLastMessage(message);

      if (conversation && !isCurrentConversation && !isMine) {
        conversation.unread_count = (conversation.unread_count || 0) + 1;
      }
      if (!isMine) {
        const targetConversation = this.conversations.find(
          (c) => Number(c.id) === Number(message.conversation_id),
        );

        const isMuted =
          targetConversation?.is_muted === true ||
          targetConversation?.is_muted === 1;

        if (!conversation && !isMine) {
          this.playNotificationSound();

          this.fetchConversations({
            autoSelect: false,
          });

          return;
        }
      }
    },
    updateConversationLastMessage(message) {
      const conversation = this.conversations.find(
        (c) => Number(c.id) === Number(message.conversation_id),
      );

      if (!conversation) return;

      let content = "";

      if (message.message_type === "call") {
        content = message.content;
      } else if (message.is_recalled === 1) {
        content = "Tin nhắn đã được thu hồi";
      } else if (message.content) {
        content = message.content;
      } else if (message.file_type === "image") {
        content = "Đã gửi một hình ảnh";
      } else if (message.file_type === "video") {
        content = "Đã gửi một video";
      } else if (message.file_type === "audio") {
        content = "Đã gửi một âm thanh";
      } else if (message.file_url) {
        content = "Đã gửi một tệp";
      }

      conversation.last_message = {
        id: message.id,
        sender_id: message.sender_id,
        content,
        created_at: message.created_at,
      };

      const sorted = [...this.conversations].sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;

        const timeA = a.last_message?.created_at
          ? new Date(a.last_message.created_at).getTime()
          : new Date(a.created_at).getTime();

        const timeB = b.last_message?.created_at
          ? new Date(b.last_message.created_at).getTime()
          : new Date(b.created_at).getTime();

        return timeB - timeA;
      });

      this.conversations = sorted;
    },

    handleMessageRecalled(data) {
      const msg = this.messages.find(
        (m) => Number(m.id) === Number(data.message_id),
      );

      if (msg) {
        msg.content = "Tin nhắn đã được thu hồi";
        msg.file_url = null;
        msg.file_type = null;
        msg.is_recalled = 1;
      }

      const conversation = this.conversations.find(
        (c) => Number(c.id) === Number(data.conversation_id),
      );

      if (conversation?.last_message?.id === data.message_id) {
        conversation.last_message.content = "Tin nhắn đã được thu hồi";
      }
    },

    handleMessageEdited(data) {
      const msg = this.messages.find(
        (m) => Number(m.id) === Number(data.message_id),
      );

      if (msg) {
        msg.content = data.content;
        msg.is_edited = data.is_edited;
        msg.edited_at = data.edited_at;
      }

      const conversation = this.conversations.find(
        (c) => Number(c.id) === Number(data.conversation_id),
      );

      if (conversation?.last_message?.id === data.message_id) {
        conversation.last_message.content = data.content;
      }
    },

    handleMessageReaction(data) {
      const msg = this.messages.find(
        (m) => Number(m.id) === Number(data.message_id),
      );

      if (!msg) return;

      if (!msg.reactions) {
        msg.reactions = {
          total: 0,
          summary: {
            like: 0,
            love: 0,
            haha: 0,
            wow: 0,
            sad: 0,
            angry: 0,
          },
          users: [],
        };
      }

      const oldReaction = msg.reactions.users.find(
        (u) => Number(u.user_id) === Number(data.user_id),
      );

      if (oldReaction) {
        if (msg.reactions.summary[oldReaction.reaction_type] > 0) {
          msg.reactions.summary[oldReaction.reaction_type] -= 1;
        }

        oldReaction.reaction_type = data.reaction_type;
        msg.reactions.summary[data.reaction_type] += 1;
      } else {
        msg.reactions.users.push({
          user_id: data.user_id,
          reaction_type: data.reaction_type,
        });

        msg.reactions.summary[data.reaction_type] += 1;
        msg.reactions.total += 1;
      }
    },

    handleMessageReactionRemoved(data) {
      const msg = this.messages.find(
        (m) => Number(m.id) === Number(data.message_id),
      );

      if (!msg || !msg.reactions) return;

      const index = msg.reactions.users.findIndex(
        (u) => Number(u.user_id) === Number(data.user_id),
      );

      if (index === -1) return;

      const oldReaction = msg.reactions.users[index];

      if (msg.reactions.summary[oldReaction.reaction_type] > 0) {
        msg.reactions.summary[oldReaction.reaction_type] -= 1;
      }

      msg.reactions.users.splice(index, 1);
      msg.reactions.total = Math.max(0, msg.reactions.total - 1);
    },

    sendTextMessage(content, replyToId = null) {
      if (!this.selectedConversation) {
        this.error = "Chưa chọn cuộc trò chuyện";
        return;
      }

      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.error = "WebSocket chưa kết nối";
        return;
      }

      if (!content.trim()) return;

      this.ws.send(
        JSON.stringify({
          type: "message",
          conversation_id: this.selectedConversation.id,
          content: content.trim(),
          reply_to_id: replyToId,
        }),
      );

      this.clearReplyMessage();
    },

    sendTyping() {
      if (!this.selectedConversation) return;

      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      this.ws.send(
        JSON.stringify({
          type: "typing",
          conversation_id: this.selectedConversation.id,
        }),
      );
    },

    handleTyping(data) {
      const conversationId = data.conversation_id;
      const userId = data.user_id;

      if (!this.typingUsers[conversationId]) {
        this.typingUsers[conversationId] = [];
      }

      const exists = this.typingUsers[conversationId].includes(userId);

      if (!exists) {
        this.typingUsers[conversationId].push(userId);
      }

      const key = `${conversationId}_${userId}`;

      if (this.typingTimers[key]) {
        clearTimeout(this.typingTimers[key]);
      }

      this.typingTimers[key] = setTimeout(() => {
        this.typingUsers[conversationId] = this.typingUsers[
          conversationId
        ].filter((id) => id !== userId);
      }, 2500);
    },

    async markConversationAsRead(conversationId) {
      const conversation = this.conversations.find(
        (c) => c.id === conversationId,
      );

      if (conversation) {
        conversation.unread_count = 0;
      }

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: "seen",
            conversation_id: conversationId,
          }),
        );
      }

      try {
        await api.patch(`/conversations/${conversationId}/read`);
      } catch (err) {
        console.warn("Mark read failed:", err);
      }
    },

    handleSeen(data) {
      if (!this.selectedConversation) return;

      if (this.selectedConversation.id !== data.conversation_id) return;

      this.messages = this.messages.map((msg) => {
        if (msg.id <= data.last_read_message_id) {
          return {
            ...msg,
            is_seen: 1,
          };
        }

        return msg;
      });
    },

    sendFileMessage(fileUrl, fileType, replyToId = null) {
      if (!this.selectedConversation) {
        this.error = "Chưa chọn cuộc trò chuyện";
        return;
      }

      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.error = "WebSocket chưa kết nối";
        return;
      }
      this.ws.send(
        JSON.stringify({
          type: "file",
          conversation_id: this.selectedConversation.id,
          file_url: fileUrl,
          file_type: fileType,
          reply_to_id: replyToId,
        }),
      );
      // this.fetchConversationMedia(this.selectedConversation.id);
    },

    getCurrentUserId() {
      const user = JSON.parse(localStorage.getItem("user"));
      return user?.id;
    },

    setReplyMessage(message) {
      this.replyToMessage = message;
      this.editingMessage = null;
    },

    clearReplyMessage() {
      this.replyToMessage = null;
    },

    setEditingMessage(message) {
      this.editingMessage = message;
      this.replyToMessage = null;
    },

    clearEditingMessage() {
      this.editingMessage = null;
    },

    recallMessage(messageId) {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.error = "WebSocket chưa kết nối";
        return;
      }

      this.ws.send(
        JSON.stringify({
          type: "recall_message",
          message_id: messageId,
        }),
      );
    },

    async editMessage(messageId, content) {
      try {
        const res = await api.patch(`/messages/${messageId}/edit`, {
          content,
        });

        this.clearEditingMessage();

        return res.data;
      } catch (err) {
        this.error = err.response?.data?.detail || "Không sửa được tin nhắn";
        alert(this.error);
        throw err;
      }
    },

    async reactMessage(messageId, reactionType) {
      try {
        const res = await api.post(`/messages/${messageId}/reactions`, {
          reaction_type: reactionType,
        });

        return res.data;
      } catch (err) {
        this.error =
          err.response?.data?.detail || "Không reaction được tin nhắn";
        throw err;
      }
    },

    async removeMessageReaction(messageId) {
      try {
        const res = await api.delete(`/messages/${messageId}/reactions`);
        return res.data;
      } catch (err) {
        this.error = err.response?.data?.detail || "Không bỏ được reaction";
        throw err;
      }
    },

    async createConversation({ memberIds, name = null, isGroup = false }) {
      try {
        this.error = "";

        const res = await api.post("/conversations", {
          member_ids: memberIds,
          name,
          is_group: isGroup,
        });

        await this.fetchConversations();

        const conversation = this.conversations.find(
          (c) => Number(c.id) === Number(res.data.conversation_id),
        );

        if (conversation) {
          await this.selectConversation(conversation);
        }

        return res.data;
      } catch (err) {
        this.error =
          err.response?.data?.detail || "Không tạo được cuộc trò chuyện";
        throw err;
      }
    },
    async deleteConversationForMe(conversationId) {
      try {
        await api.delete(`/conversations/${conversationId}/delete-for-me`);

        this.conversations = this.conversations.filter(
          (c) => Number(c.id) !== Number(conversationId),
        );

        if (Number(this.selectedConversation?.id) === Number(conversationId)) {
          this.selectedConversation = null;
          this.messages = [];
        }
      } catch (err) {
        this.error =
          err.response?.data?.detail || "Không xóa được cuộc trò chuyện";
        throw err;
      }
    },
    async searchUsers(q = "") {
      try {
        const res = await api.get("/users/search", {
          params: {
            q,
            limit: 20,
          },
        });
        console.log("res.data", res.data);
        return res.data;
      } catch (err) {
        this.error = err.response?.data?.detail || "Không tìm được user";
        return [];
      }
    },

    async archiveConversation(conversationId) {
      try {
        await api.post(`/archive/conversations/${conversationId}`);

        this.conversations = this.conversations.filter(
          (c) => Number(c.id) !== Number(conversationId),
        );

        if (Number(this.selectedConversation?.id) === Number(conversationId)) {
          this.selectedConversation = null;
          this.messages = [];
        }
      } catch (err) {
        this.error =
          err.response?.data?.detail || "Không lưu trữ được đoạn chat";
        throw err;
      }
    },

    async muteConversation(conversationId) {
      try {
        await api.post(`/mute/conversations/${conversationId}`);

        const c = this.conversations.find(
          (item) => Number(item.id) === Number(conversationId),
        );

        if (c) {
          c.is_muted = true;
        }
      } catch (err) {
        this.error = err.response?.data?.detail || "Không tắt thông báo được";
        throw err;
      }
    },

    async markConversationUnread(conversationId) {
      const c = this.conversations.find(
        (item) => Number(item.id) === Number(conversationId),
      );

      if (c) {
        c.unread_count = Math.max(c.unread_count || 0, 1);
      }
    },

    async blockUser(userId, conversationId = null) {
      try {
        const res = await api.post(`/block/${userId}`);

        const hiddenConversationId = conversationId || res.data.conversation_id;

        if (hiddenConversationId) {
          this.conversations = this.conversations.filter(
            (c) => Number(c.id) !== Number(hiddenConversationId),
          );

          if (
            Number(this.selectedConversation?.id) ===
            Number(hiddenConversationId)
          ) {
            this.selectedConversation = null;
            this.messages = [];
          }
        }

        this.showToast("Đã chặn người dùng", "success");

        return res.data;
      } catch (err) {
        this.error = err.response?.data?.detail || "Không chặn được user";
        this.showToast(this.error, "error");
        throw err;
      }
    },

    async fetchBlockedUsers() {
      try {
        const res = await api.get("/block/users");
        return res.data;
      } catch (err) {
        this.error =
          err.response?.data?.detail || "Không tải được danh sách chặn";
        this.showToast(this.error, "error");
        return [];
      }
    },

    async unblockUser(userId) {
      try {
        const res = await api.delete(`/block/${userId}`);

        await this.fetchConversations({
          autoSelect: false,
        });

        this.showToast("Đã gỡ chặn người dùng", "success");

        return res.data;
      } catch (err) {
        this.error = err.response?.data?.detail || "Không gỡ chặn được user";
        this.showToast(this.error, "error");
        throw err;
      }
    },

    async fetchConversationMedia(conversationId) {
      try {
        const res = await api.get(`/conversations/${conversationId}/media`);
        return res.data;
      } catch (err) {
        this.error =
          err.response?.data?.detail || "Không tải được file phương tiện";
        return [];
      }
    },

    async uploadChatFile(file) {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await api.post("/upload", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        return res.data;
      } catch (err) {
        this.error = err.response?.data?.detail || "Không upload được file";
        throw err;
      }
    },

    sendSocket(payload) {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.error = "WebSocket chưa kết nối";
        return false;
      }

      this.ws.send(JSON.stringify(payload));
      return true;
    },

    getOtherUserId(conversation) {
      const user = JSON.parse(localStorage.getItem("user"));
      const currentUserId = user?.id;

      if (!conversation || Number(conversation.is_group) === 1) {
        return null;
      }

      const other = conversation.members?.find(
        (u) => Number(u.id) !== Number(currentUserId),
      );

      return other?.id || null;
    },

    startVideoCall(conversation) {
      const receiverId = this.getOtherUserId(conversation);

      if (!receiverId) {
        this.error = "Chỉ hỗ trợ gọi 1-1 ở bước này";
        return;
      }

      this.activeCall = {
        call_id: null,
        conversation_id: conversation.id,
        receiver_id: receiverId,
        remote_user_id: receiverId,
        call_type: "video",
        status: "calling",
        isCaller: true,
      };

      this.sendSocket({
        type: "call_request",
        receiver_id: receiverId,
        conversation_id: conversation.id,
        call_type: "video",
      });
    },

    acceptCall() {
      if (!this.incomingCall) return;

      const call = this.incomingCall;

      this.activeCall = {
        call_id: call.call_id,
        conversation_id: call.conversation_id,
        receiver_id: call.caller_id,
        remote_user_id: call.caller_id,
        call_type: call.call_type || "video",
        status: "accepted",
        isCaller: false,
      };

      this.sendSocket({
        type: "call_accept",
        call_id: call.call_id,
        receiver_id: call.caller_id,
        conversation_id: call.conversation_id,
      });

      this.incomingCall = null;
    },

    rejectCall() {
      if (!this.incomingCall) return;

      const call = this.incomingCall;

      this.sendSocket({
        type: "call_reject",
        call_id: call.call_id,
        receiver_id: call.caller_id,
        conversation_id: call.conversation_id,
      });

      this.incomingCall = null;
    },

    endCall() {
      if (!this.activeCall) return;

      if (this.activeCall.call_id) {
        this.sendSocket({
          type: "call_end",
          call_id: this.activeCall.call_id,
          receiver_id:
            this.activeCall.remote_user_id || this.activeCall.receiver_id,
          conversation_id: this.activeCall.conversation_id,
        });
      }

      this.activeCall = null;
    },

    sendWebRTCOffer(receiverId, offer) {
      this.sendSocket({
        type: "webrtc_offer",
        receiver_id: receiverId,
        conversation_id: this.activeCall?.conversation_id,
        offer,
      });
    },

    sendWebRTCAnswer(receiverId, answer) {
      this.sendSocket({
        type: "webrtc_answer",
        receiver_id: receiverId,
        conversation_id: this.activeCall?.conversation_id,
        answer,
      });
    },

    sendIceCandidate(receiverId, candidate) {
      this.sendSocket({
        type: "ice_candidate",
        receiver_id: receiverId,
        conversation_id: this.activeCall?.conversation_id,
        candidate,
      });
    },

    showToast(message, type = "info") {
      this.toast = {
        message,
        type,
        ts: Date.now(),
      };

      setTimeout(() => {
        if (this.toast?.message === message) {
          this.toast = null;
        }
      }, 3000);
    },

    startAudioCall(conversation) {
      const receiverId = this.getOtherUserId(conversation);

      if (!receiverId) {
        this.error = "Chỉ hỗ trợ gọi thoại 1-1";
        this.showToast("Chỉ hỗ trợ gọi thoại 1-1", "warning");
        return;
      }

      this.activeCall = {
        call_id: null,
        conversation_id: conversation.id,
        receiver_id: receiverId,
        remote_user_id: receiverId,
        call_type: "audio",
        status: "calling",
        isCaller: true,
      };

      this.sendSocket({
        type: "call_request",
        receiver_id: receiverId,
        conversation_id: conversation.id,
        call_type: "audio",
      });
    },

    async unlockAudioContext() {
      try {
        if (!this.notificationAudioContext) {
          this.notificationAudioContext = new AudioContext();
        }

        if (this.notificationAudioContext.state === "suspended") {
          await this.notificationAudioContext.resume();
        }

        this.notificationSoundUnlocked = true;
      } catch (err) {
        console.warn("Không thể bật âm thanh thông báo:", err);
      }
    },

    async playBeepSound() {
      try {
        if (!this.notificationAudioContext) {
          this.notificationAudioContext = new AudioContext();
        }

        if (this.notificationAudioContext.state === "suspended") {
          await this.notificationAudioContext.resume();
        }

        const ctx = this.notificationAudioContext;

        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, ctx.currentTime);

        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

        oscillator.connect(gain);
        gain.connect(ctx.destination);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.2);
      } catch (err) {
        console.warn("Không phát được âm thanh:", err);
      }
    },

    async unlockNotificationSound() {
      await this.unlockAudioContext();
    },

    async playNotificationSound() {
      if (!this.notificationSoundEnabled) return;

      await this.playBeepSound();
    },

    toggleNotificationSound() {
      this.notificationSoundEnabled = !this.notificationSoundEnabled;

      localStorage.setItem(
        "notification_sound_enabled",
        this.notificationSoundEnabled ? "true" : "false",
      );

      this.showToast(
        this.notificationSoundEnabled
          ? "Đã bật âm thanh thông báo"
          : "Đã tắt âm thanh thông báo",
        "info",
      );
    },

    async fetchConversationMembers(conversationId) {
      try {
        const res = await api.get(`/conversations/${conversationId}/settings`);
        return res.data;
      } catch (err) {
        this.error =
          err.response?.data?.detail || "Không tải được danh sách thành viên";
        this.showToast(this.error, "error");
        return [];
      }
    },

    async addMembersToConversation(conversationId, userIds) {
      try {
        const res = await api.post(`/conversations/${conversationId}/members`, {
          user_ids: userIds,
        });

        this.showToast("Đã thêm thành viên", "success");

        return res.data;
      } catch (err) {
        this.error = err.response?.data?.detail || "Không thêm được thành viên";
        this.showToast(this.error, "error");
        throw err;
      }
    },

    async removeMemberFromConversation(conversationId, userId) {
      try {
        const res = await api.delete(
          `/conversations/${conversationId}/members/${userId}`,
        );

        this.showToast("Đã xóa thành viên khỏi nhóm", "success");

        return res.data;
      } catch (err) {
        this.error = err.response?.data?.detail || "Không xóa được thành viên";
        this.showToast(this.error, "error");
        throw err;
      }
    },

    async updateMemberRole(conversationId, userId, role) {
      try {
        const res = await api.patch(
          `/conversations/${conversationId}/members/${userId}/promote-admin`,
          {
            role,
          },
        );

        this.showToast(
          role === "admin"
            ? "Đã set làm quản trị viên"
            : "Đã gỡ quyền quản trị viên",
          "success",
        );

        return res.data;
      } catch (err) {
        this.error = err.response?.data?.detail || "Không cập nhật được quyền";
        this.showToast(this.error, "error");
        throw err;
      }
    },

    async deleteConversation(conversationId) {
      try {
        await api.delete(`/conversations/${conversationId}`);

        this.conversations = this.conversations.filter(
          (c) => Number(c.id) !== Number(conversationId),
        );

        if (Number(this.selectedConversation?.id) === Number(conversationId)) {
          this.selectedConversation = null;
          this.messages = [];
        }

        this.showToast("Đã xóa nhóm thành công", "success");
      } catch (err) {
        this.error = err.response?.data?.detail || "Không xóa được nhóm";
        this.showToast(this.error, "error");
        throw err;
      }
    },

    async checkIsOnlineUser(userId) {
      try {
        const res = await api.get(`/users/${userId}/online`);
        if (res.data.online) {
          this.isOnline = true;
        } else {
          this.isOnline = false;
        }
      } catch (err) {
        throw err;
      }
    },

    async createInviteLink(conversationId) {
      try {
        const res = await api.post(`/group-invites/conversations/${conversationId}`)
        console.log(res)
      }catch(err) {
        this.showToast('Bạn không có quyền tạo link', 'error')
        throw err
      }
    },

    clearChat() {
      this.selectedConversation = null;
      this.messages = [];
      this.disconnectWebSocket();
    },
  },
});
