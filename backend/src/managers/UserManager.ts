import WebSocket from "ws"

let USER_ID = 1

interface UserProp {
    userName: string; 
    ws: WebSocket;
    offer? : RTCSessionDescriptionInit;
    iceCandidates?: RTCIceCandidateInit[]
}

export class UserManager {
  private users: Map<string, UserProp>;

  constructor() {
    this.users = new Map();
  }

  newUser(userData: UserProp) {
    this.users.set(String(USER_ID++), userData);
    return String(USER_ID - 1);
  }

  getUser(userId: string) {
    return this.users.get(userId);
  }

  setOffer(userId: string, offer: RTCSessionDescriptionInit) {
    const user = this.users.get(userId);
    if (!user) return 0;
    user.offer = offer;
    return 1;
  }

  remove(userId: string) {
    this.users.delete(userId);
  }

  setIce(userId: string, ice: RTCIceCandidateInit) {
    const user = this.users.get(userId);
    if (!user) return 0;
    (user.iceCandidates??=[]).push(ice)
    return 1;
  }
}