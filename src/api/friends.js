import api from "./axios";
export function sendFriendRequest(userId) {
  return api.post(`/friends/request/${userId}`);
}

export function acceptFriendRequest(requestId) {
  return api.post(`/friends/accept/${requestId}`);
}

export function rejectFriendRequest(requestId) {
  return api.post(`/friends/reject/${requestId}`);
}

export function cancelFriendRequest(requestId) {
  return api.delete(`/friends/cancel/${requestId}`);
}

export function getFriendRequests() {
  return api.get("/friends/requests/");
}

export function getFriends(q) {
  return api.get("/friends/list", { params: { q } });
}

export const FriendRequestStatus = {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  getFriendRequests,
  getFriends,
};
