import { defineStore } from "pinia";
import api from "../api/axios";

export const useChatStore = defineStore("chat", {
  state: () => ({
    conversations: [],
    selectedConversation: null,
    messages: [],

    ws: null,
    wsConnected: false,
    reconnectTimer: null,

    typingUsers: {},
    typingTimers: {},

    hasMoreMessages: true,
    loadingOldMessages: false,

    replyToMessage: null,
    editingMessage: null,

    loadingConversations: false,
    loadingMessages: false,
    error: "",
  }),

  actions: {
    async fetchConversations() {
      try {
        this.loadingConversations = true;
        this.error = "";

        const res = await api.get("/conversations");

        this.conversations = res.data;

        if (!this.selectedConversation && this.conversations.length > 0) {
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

      this.messages = [];

      await this.fetchMessages(conversation.id);

      await this.markConversationAsRead(conversation.id);

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
        created_at: data.created_at,
      };

      const isCurrentConversation =
        Number(this.selectedConversation?.id) === Number(data.conversation_id);

      if (isCurrentConversation) {
        const exists = this.messages.some((m) => m.id === message.id);

        if (!exists) {
          this.messages.push(message);
        }

        if (message.sender_id !== currentUserId) {
          this.markConversationAsRead(data.conversation_id);
        }
      }

      this.updateConversationLastMessage(message);

      const conversation = this.conversations.find(
        (c) => c.id === message.conversation_id,
      );

      if (
        conversation &&
        !isCurrentConversation &&
        message.sender_id !== currentUserId
      ) {
        conversation.unread_count = (conversation.unread_count || 0) + 1;
      }
    },

    updateConversationLastMessage(message) {
      const conversation = this.conversations.find(
        (c) => Number(c.id) === Number(message.conversation_id),
      );

      if (!conversation) return;

      let content = "";

      if (message.is_recalled === 1) {
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
        console.log('memberIds', memberIds)
        const res = await api.post("/conversations", {
          member_ids: memberIds,
          name,
          is_group: isGroup,
        });

        await this.fetchConversations();

        const newConversation = this.conversations.find(
          (c) => Number(c.id) === Number(res.data.conversation_id),
        );

        if (newConversation) {
          await this.selectConversation(newConversation);
        }

        return res.data;
      } catch (err) {
        this.error =
          err.response?.data?.detail || "Không tạo được cuộc trò chuyện";
        throw err;
      }
    },

    clearChat() {
      this.selectedConversation = null;
      this.messages = [];
      this.disconnectWebSocket();
    },
  },
});
