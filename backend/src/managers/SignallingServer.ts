import { WebSocketServer } from 'ws'
import {type Server} from 'http'
import { RoomManager } from './RoomManager.js'

export class SignallingServer {
    private wss : WebSocketServer
    private rooms : RoomManager

    constructor({server}: {server: Server}) {
        
        this.wss = new WebSocketServer({ server })
        this.rooms = new RoomManager()
        
        this.wss.on("connection", async (ws, req) => {

            console.log("User connected")
            
            ws.on ("message", async (rawData) => {
                
                const {type, data} = JSON.parse(rawData.toString())
                console.log(rawData.toString())

                switch (type) {
                    case "join" :
                    case "newuser" : {
                        console.log(`${type} request recvd`)
                        const {userName, roomId} = data;
                        const newUserResponse = this.rooms.handleIncomingUser(userName, ws, roomId)
                        return ws.send(JSON.stringify({
                            type: "login-response",
                            data: newUserResponse
                        }))
                    }
                    case "offer" : 
                    case "answer" : {
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

            })
            
           ws.on("close", (code: number, rawData) => {
            const {roomId, userId} = JSON.parse(rawData.toString())
            this.rooms.remove(roomId, userId)
           })

           ws.on("error", console.log)

        })
    }

    

}