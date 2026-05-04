export interface Message {
  senderId: string;
  senderName: string;
  message: string;
  timestamp: string;
}

export interface SessionInfo {
  sessionId: string;
  isHost: boolean;
  connected?: boolean;
}
