import React from 'react'

let peerConnection : RTCPeerConnection;
let remoteStream;
let localStream;

const stunServers = {
    iceServers : [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]
}

const Conversation = ({socket}) => {

    const [userId, setUserId] = React.useState<string>("")
    const [roomId, setRoomId] = React.useState<string>("")
    const remoteStreamRef  = React.useRef<HTMLVideoElement>(null)
    const localStreamRef = React.useRef<HTMLVideoElement>(null)

    React.useEffect(()=>{
        if (!socket) return

        socket.onmessage = (event) => {
            const {type, data} = JSON.parse(event.data)
            console.log(JSON.parse(event.data))
            handleServerResponse(type, data)
    }
    }, [socket])


    
    const makeRTCConnection = async (userId : string, roomId : string) => {
        peerConnection = new RTCPeerConnection(stunServers)

        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true
        })
        localStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, localStream)
        })
        localStreamRef.current.srcObject = localStream

        remoteStream = new MediaStream()
        remoteStreamRef.current.srcObject = remoteStream

        peerConnection.ontrack = (event) => {
            event.streams[0].getTracks().forEach((track) => {
                remoteStream.addTrack(track)
            })
        }

        
        peerConnection.onicecandidate = async (event) => {
            if (event.candidate) {
                socket.send(JSON.stringify({
                    type: "icecandidate",
                    data : {
                        iceCandidate : event.candidate,
                        userId: userId,
                        roomId: roomId
                    }
                }))
            }
        }
        
        const offer = await peerConnection.createOffer()
        await peerConnection.setLocalDescription(offer)

        socket.send(JSON.stringify({
            type: "offer",
            data: {
                roomId,
                userId,
                offer
            }
        }))

        

    }
    
    const handleServerResponse = async (type: string, data: any) => {
        
        switch(type) {
            case "login-response" : {
                if (data instanceof String){
                    console.log(data)
                }
                else if (data instanceof Object) {
                    const { userId, roomId } = data

                    setUserId(userId)
                    setRoomId(roomId)

                    await makeRTCConnection(userId, roomId)
                    console.log(userId, roomId)

                }
                return
            }
            case "offer-response" : {
                const {status, message} = data
                console.log(status, " : ", message)
                return
            }
            case "offer" : {
                const offer = data as RTCSessionDescriptionInit
                if (offer.type === "offer" || offer.type === "answer"){
                    await peerConnection.setRemoteDescription(offer)
                    const answer = await peerConnection.createAnswer()
                    await peerConnection.setLocalDescription(answer)
                    socket.send(JSON.stringify({
                        type: "answer",
                        data : {
                            userId,
                            roomId, 
                            offer: answer
                        }
                    }))
                }

                console.log(`${offer.type} : `, offer)
                return
            }
            case "ice-response" : {
                const response = data as string
                console.log(response)
                return
            }
            case "icecandidate" : {
                const icecandidate = data as RTCIceCandidateInit
                await peerConnection.addIceCandidate(icecandidate)
                console.log(icecandidate)
                return
            }
            case "error" : {
                const {status, message} = data 
                console.error(`${status} : ${message}`)
            }
        }
    }

    return (
        <>
            <video className="local-stream" ref={localStreamRef}></video>        
            <video className="remote-stream" ref={remoteStreamRef}></video>        
        </>
    )

}

export default Conversation