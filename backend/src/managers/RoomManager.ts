import type { WebSocket, WebSocketServer } from "ws";
import { UserManager } from "./UserManager.js";
import type {  } from "http";

let ROOM_ID = 1


export class RoomManager {
    private rooms: Map<string, string[]>
    private users : UserManager

    constructor() {
        this.rooms = new Map()
        this.users = new UserManager()
    }

    private getRoom(roomId: string = ""){
        if (!roomId) return this.newRoom()
        if (!this.rooms.get(roomId)) return -1
        if (this.rooms.get(roomId)?.length === 2) return 0
        return roomId
    }

    private newRoom(){
        this.rooms.set(String(ROOM_ID++), [])
        return String(ROOM_ID-1)
    }    

    handleIncomingUser (userName: string,  ws: WebSocket, roomId?: string){
        const room_id = this.getRoom(roomId)
        switch (room_id) {
            case -1 : {
                return{
                    status: "error", 
                    message: "Room does not exist"
                }
            }
            case 0 : {
                return{
                    status: "error", 
                    message: "Room is full"
                }
            }
            default : {
                const userId = this.users.newUser({userName, ws})
                const room = this.rooms.get(room_id)??[]
                room.push(userId)
                this.rooms.set(room_id, room)

                //If other users present check if there are any offers
                
                const isInitiator = room.length === 1
                const newUserResponse = {
                  status: "success",
                  message: {
                    userId: userId,
                    roomId: room_id,
                    isInitiator,
                  },
                };
                ws.send(
                  JSON.stringify({
                    type: "login-response",
                    data: newUserResponse,
                  }),
                );

                !isInitiator && room.forEach((user_id) => {
                  if (user_id !== userId) {
                    console.log("found receiver")
                    //@ts-ignore
                    const { offer } = this.users.getUser(user_id);
                    if (!offer) {
                      console.log("No offer yet from initiator, skipping send");
                      return;
                    }
                    console.log("Forwarding offer to ", userId)
                    ws.send(
                      JSON.stringify({
                        type: "offer",
                        data: offer,
                      }),
                    );
                  }
                });
                room.forEach((user_id) => {
                    if (user_id != userId) {
                        //@ts-ignore
                        const { iceCandidates } = this.users.getUser(user_id);
                        if (!iceCandidates) {
                            console.error("No IceCands")
                            return
                        }
                        for (let iceCandidate of iceCandidates){
                            ws.send(
                            JSON.stringify({
                                type: "icecandidate",
                                data: iceCandidate,
                            }),
                            )
                        }
                    }
                });          
            }
        }
    }



    handleIncomingOffer(offer: RTCSessionDescriptionInit, userId: string, roomId: string){
        if (!this.users.getUser(userId) || !this.rooms.get(roomId)) {
            console.log("User : ", this.users.getUser(userId))
            console.log("Room : ", this.rooms.get(roomId));
            return false
        }
        const offerResponse = this.users.setOffer(userId, offer)
        
        console.log("Trying to send offer")
        this.rooms.get(roomId)?.forEach((user_id) => {
            if (user_id !== userId) {
                //@ts-ignore
                const { ws } = this.users.getUser(user_id)
                ws.send(JSON.stringify({
                    type: "offer",
                    data: offer
                }))
            }
        })
        return offerResponse
    }

    handleIceCandidates(iceCandidate: RTCIceCandidateInit, userId: string, roomId: string){
        if (!iceCandidate || !userId || !roomId || !this.users.getUser(userId) || !this.rooms.get(roomId)) {
            return "Failed to Send ICE"
        }

        this.users.setIce(userId, iceCandidate)

        this.rooms.get(roomId)?.forEach((user_id) => {
            if (user_id != userId) {
              //@ts-ignore
              const { ws } = this.users.getUser(user_id);
              ws.send(
                JSON.stringify({
                  type: "icecandidate",
                  data: iceCandidate,
                }),
              );
            }
        })
        return "Sent ICE"
    }

    remove(roomId: string, userId: string) {
        let room = this.rooms.get(roomId)
        room = room?.filter(userid => userid!=userId)
        if (!room) {
            this.rooms.delete(roomId)
            return
        }
        this.rooms.set(roomId, room)
        this.users.remove(userId)
    }

}