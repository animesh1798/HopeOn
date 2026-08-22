import { WebSocketServer, type WebSocket } from 'ws'
import {type Server} from 'http'
import { RoomManager } from './RoomManager.js'

export class SignallingServer {
    private wss : WebSocketServer
    private rooms : RoomManager
    private userSessions : Map<WebSocket, { userId?: string, roomId?: string }>

    constructor({server}: {server: Server}) {
        
        this.wss = new WebSocketServer({ server })
        this.rooms = new RoomManager()
        this.userSessions = new Map()
        
        this.wss.on("connection", async (ws, req) => {

            console.log("User connected")
            this.userSessions.set(ws, {})
            
            ws.on ("message", async (rawData) => {
                try {
                    const {type, data} = JSON.parse(rawData.toString())

                    switch (type) {
                        case "join" :
                        case "newuser" : {
                            console.log(`${type} request recvd`)
                            const {userName, roomId} = data;
                            const res = this.rooms.handleIncomingUser(userName, ws, roomId)
                            if (res?.status === "error") {
                                ws.send(JSON.stringify({
                                    type: "error",
                                    data: {
                                        status: "4000",
                                        message: res.message
                                    }
                                }))
                                return
                            }
                            if (res?.userId && res?.roomId) {
                                this.userSessions.set(ws, { userId: res.userId, roomId: res.roomId })
                            }
                            return
                        }
                        case "leave" : {
                            const session = this.userSessions.get(ws)
                            const roomId = data?.roomId || session?.roomId
                            const userId = data?.userId || session?.userId
                            if (roomId && userId) {
                                console.log(`User ${userId} left room ${roomId}`)
                                this.rooms.remove(roomId, userId)
                            }
                            this.userSessions.delete(ws)
                            return
                        }
                        case "offer" : 
                        case "answer" : {
                            console.log(type, data)
                            const roomId = data.roomId
                            const userId = data.userId
                            const offer = data.offer
                            const offerResponse  = this.rooms.handleIncomingOffer(offer, userId, roomId)
                            if (!offerResponse) return ws.send(JSON.stringify({
                                type: "error",
                                data: {
                                    status: "4000",
                                    message: "User/Room Does not exist"
                                }
                            }))
                            return ws.send(JSON.stringify({
                                type: "offer-response",
                                data: {
                                    status: "4000",
                                    message :"Offer Sent successfully"}
                            }))
                        }
                        case "icecandidate" : {
                            const iceCandidate = data.iceCandidate
                            const userId = data.userId
                            const roomId = data.roomId
                            const iceResponse = this.rooms.handleIceCandidates(iceCandidate, userId, roomId)
                            return ws.send(JSON.stringify({
                                type: "ice-response",
                                data: iceResponse
                            }))
                        }
                    }
                } catch (err) {
                    console.error("Error processing websocket message:", err)
                }

            })
            
           ws.on("close", () => {
               const session = this.userSessions.get(ws)
               if (session?.roomId && session?.userId) {
                   console.log(`Connection closed for user ${session.userId} in room ${session.roomId}`)
                   this.rooms.remove(session.roomId, session.userId)
               }
               this.userSessions.delete(ws)
           })

           ws.on("error", console.log)

        })
    }

    

}