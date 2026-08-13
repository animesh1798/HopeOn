import React from 'react'

let peerConnection : RTCPeerConnection;
let remoteStream : MediaStream;
let localStream;

const stunServers = {
    iceServers : [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]
}

const Conversation = ({socket}) => {

    const userId = React.useRef<string>("")
    const roomId = React.useRef<string>("")
    const remoteStreamRef  = React.useRef<HTMLVideoElement>(null)
    const localStreamRef = React.useRef<HTMLVideoElement>(null)

    const isPCReady = React.useRef<boolean>(false)
    const pendingMessages = React.useRef<{type: string, data: any}[]>([])

    React.useEffect(()=>{
        if (!socket) return

        console.log("socket working")

        socket.onmessage = (event) => {
            console.log("received Message")
            const {type, data} = JSON.parse(event.data)
            console.log(JSON.parse(event.data))

            if ((type === "offer" || type === "icecandidate") && !isPCReady.current) {
                console.log(`Queuing ${type}, peerConnection not ready yet`)
                pendingMessages.current.push({type, data})
                return
            }

            handleServerResponse(type, data)
    }
    }, [socket])


    const drainQueue = async () => {
        isPCReady.current = true
        const queued = pendingMessages.current
        pendingMessages.current = []
        for (const msg of queued) {
            await handleServerResponse(msg.type, msg.data)
        }
    }

    
    const makeRTCConnection = async (isInitiator: boolean) => {
        peerConnection = new RTCPeerConnection(stunServers)
        
        peerConnection.ontrack = (event) => {
            console.log("RECEIEVED TRACK")
            event.streams[0].getTracks().forEach((track) => {
                remoteStream.addTrack(track)
            })
        }

        
        peerConnection.onicecandidate = async (event) => {
            if (event.candidate) {
                console.log("sending ice candidate")
                socket.send(JSON.stringify({
                    type: "icecandidate",
                    data : {
                        iceCandidate : event.candidate,
                        userId: userId.current,
                        roomId: roomId.current
                    }
                }))
            }
        }
        peerConnection.oniceconnectionstatechange = () => {
            console.log(peerConnection.connectionState)
        }

        localStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true
        })
        localStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, localStream)
        })
        localStreamRef.current.srcObject = localStream
        console.log(localStreamRef.current.srcObject)

        remoteStream = new MediaStream()
        remoteStreamRef.current.srcObject = remoteStream
        console.log(remoteStreamRef.current.srcObject)  

        console.log(isInitiator)
        if (isInitiator){
            console.log("sending offer")
            const offer = await peerConnection.createOffer()
            await peerConnection.setLocalDescription(offer)
            console.log(offer.sdp)
            console.log(userId.current, roomId.current)
            socket.send(JSON.stringify({
                type: "offer",
                data: {
                    roomId: roomId.current,
                    userId: userId.current,
                    offer
                }   
            }))
        }
        await drainQueue()
    }
    
    const handleServerResponse = async (type: string, data: any) => {
        
        switch(type) {
            case "login-response" : {
                if (data instanceof String){
                    console.log(data)
                }
                else if (data instanceof Object) {
    
                    const {message} = data
                    userId.current = message.userId
                    roomId.current = message.roomId

                    await makeRTCConnection( message.isInitiator)
                    console.log(userId.current, roomId.current)

                }
                return
            }
            case "offer-response" : {
                const {status, message} = data
                console.log(status, " : ", message)
                return
            }
            case "offer" : {
                
                if (!data) {
                    console.warn("Received empty offer, ignoring")
                    return
                }
                
                const offer = data as RTCSessionDescriptionInit
                console.log("OFFER:" , offer)
                if (offer.type === "offer"){
                    console.log("Received offer")
                    await peerConnection.setRemoteDescription(offer)
                    const answer = await peerConnection.createAnswer()
                    console.log(answer.sdp)
                    
                    await peerConnection.setLocalDescription(answer)
                    socket.send(JSON.stringify({
                        type: "answer",
                        data : {
                            userId: userId.current,
                            roomId: roomId.current, 
                            offer: answer
                        }
                    }))
                }
                else if (offer.type === "answer") {
                    console.log("Received answer")
                    await peerConnection.setRemoteDescription(offer)
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
                console.log("in ICE : ", data)
                const icecandidate = data as RTCIceCandidateInit
                try {
                    await peerConnection.addIceCandidate(icecandidate)
                } catch (err) {
                    console.error("Failed to add ICE candidate", err)
                }
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
            <div className="videoplayer h-3/5 w-4/5 bg-black mt-10">
            <video className="local-stream" ref={localStreamRef} playsInline autoPlay></video>        
            </div>
            <div className="videoplayer h-3/5 w-4/5 bg-black mt-10">
            <video className="remote-stream" ref={remoteStreamRef} playsInline autoPlay></video> 
            </div>
        </>
    )

}

export default Conversation