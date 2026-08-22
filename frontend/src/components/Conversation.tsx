import React from 'react'
import { useNavigate } from 'react-router-dom'

let peerConnection : RTCPeerConnection;
let remoteStream : MediaStream;
let localStream : MediaStream | null = null;

const stunServers = {
    iceServers : [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]
}

const Conversation = ({socket, name, setSocketNull} : {socket: WebSocket | null, name: string, setSocketNull: ()=>void}) => {
    const navigate = useNavigate()
    const [peerName, setPeerName] = React.useState<string>("")
    const [currentRoomId, setCurrentRoomId] = React.useState<string>("")
    const [isMuted, setIsMuted] = React.useState<boolean>(false)
    const [isVideoOff, setIsVideoOff] = React.useState<boolean>(false)
    const [copied, setCopied] = React.useState<boolean>(false)

    const userId = React.useRef<string>("")
    const roomId = React.useRef<string>("")
    const remoteStreamRef  = React.useRef<HTMLVideoElement>(null)
    const localStreamRef = React.useRef<HTMLVideoElement>(null)

    const isPCReady = React.useRef<boolean>(false)
    const pendingMessages = React.useRef<{type: string, data: any}[]>([])

    React.useEffect(()=>{
        if (!socket) {
            navigate("/")
            return
        }

        console.log("socket working")

        socket.onmessage = (event) => {
            console.log("received Message")
            const {type, data} = JSON.parse(event.data)
            console.log(JSON.parse(event.data))

            if (type === "icecandidate" && JSON.parse(event.data).userName)
                setPeerName(JSON.parse(event.data).userName) 
            
            if ((type === "offer" || type === "icecandidate") && !isPCReady.current) {
                console.log(`Queuing ${type}, peerConnection not ready yet`)
                pendingMessages.current.push({type, data})
                return
            }

            handleServerResponse(type, data)
        }

        return () => {
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop())
                localStream = null
            }
            if (peerConnection) {
                peerConnection.close()
            }
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
                socket?.send(JSON.stringify({
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
            audio: true,
            video: true
        })
        localStream.getTracks().forEach((track) => {
            if (localStream) peerConnection.addTrack(track, localStream)
        })
        if (localStreamRef.current) {
            localStreamRef.current.srcObject = localStream
        }

        remoteStream = new MediaStream()
        if (remoteStreamRef.current) {
            remoteStreamRef.current.srcObject = remoteStream
        }

        console.log(isInitiator)
        if (isInitiator){
            console.log("sending offer")
            const offer = await peerConnection.createOffer()
            await peerConnection.setLocalDescription(offer)
            console.log(offer.sdp)
            console.log(userId.current, roomId.current)
            if (socket) {
                socket.send(JSON.stringify({
                    type: "offer",
                    data: {
                        roomId: roomId.current,
                        userId: userId.current,
                        offer
                    }   
                }))
            }
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
                    setCurrentRoomId(message.roomId)

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
                    socket?.send(JSON.stringify({
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
            case "peer-left" : {
                console.log("Peer left the room")
                setPeerName("")
                if (remoteStreamRef.current) {
                    remoteStreamRef.current.srcObject = null
                }
                return
            }
            case "error" : {
                const {status, message} = data 
                console.error(`${status} : ${message}`)
                alert(message || "Room does not exist")
                disconnect()
                return
            }
        }
    }

    const toggleMute = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach((track) => {
                track.enabled = isMuted
            })
            setIsMuted(!isMuted)
        }
    }

    const toggleVideo = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach((track) => {
                track.enabled = isVideoOff
            })
            setIsVideoOff(!isVideoOff)
        }
    }

    const disconnect = () => {
        if (localStream) {
            localStream.getTracks().forEach((track) => track.stop())
        }
        if (peerConnection) {
            peerConnection.close()
        }
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: "leave",
                data: {
                    userId: userId.current,
                    roomId: roomId.current
                }
            }))
            socket.close()
            setSocketNull()
        }
        navigate("/")
    }

    const copyRoomId = () => {
        if (currentRoomId) {
            navigator.clipboard.writeText(currentRoomId)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    return (
        <div className="flex-1 flex flex-col items-center justify-between h-screen w-screen overflow-hidden bg-slate-100 text-slate-800 select-none p-3 md:p-4">
            {/* Top Bar Header */}
            <div className="flex items-center justify-between w-full max-w-6xl bg-white/90 backdrop-blur-md border border-slate-200/80 px-5 py-2.5 rounded-2xl shadow-sm">
                {/* Brand & User Info */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 pr-3 border-r border-slate-200">
                        <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-xs shadow-sm">
                            H
                        </div>
                        <span className="font-bold text-slate-900 tracking-tight text-sm">HopeOn</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">You:</span>
                        <span className="text-sm font-bold text-slate-900">{name || 'User'}</span>
                    </div>
                </div>

                {/* Meeting Code Displayed in Between */}
                {currentRoomId && (
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-1 rounded-xl shadow-inner">
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">ROOM</span>
                        <span className="font-mono font-bold text-blue-600 text-sm tracking-wider">{currentRoomId}</span>
                        <button 
                            onClick={copyRoomId} 
                            className="ml-1 text-[11px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-600 px-2.5 py-0.5 rounded-lg transition cursor-pointer border border-blue-200/60"
                            title="Copy Room ID">
                            {copied ? "Copied!" : "Copy"}
                        </button>
                    </div>
                )}

                {/* Peer Info */}
                <div className="flex items-center gap-2.5">
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Peer:</span>
                    {peerName ? (
                        <span className="text-sm font-bold text-blue-600">{peerName}</span>
                    ) : (
                        <span className="text-xs font-medium bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-full border border-slate-200">
                            Waiting for guest...
                        </span>
                    )}
                </div>
            </div>

            {/* Video Stage (Google Meet Responsive Full Fit) */}
            <div className="flex-1 min-h-0 w-full max-w-400 my-3 flex items-center justify-center">
                <div className="w-full h-full max-h-full grid grid-cols-1 md:grid-cols-2 gap-4 items-center justify-center">
                    
                    {/* Local Participant Card */}
                    <div className="relative w-full h-full max-h-full bg-slate-950 rounded-3xl overflow-hidden shadow-md border border-slate-200 flex items-center justify-center">
                        <video 
                            className={`w-full h-full -scale-x-100 object-cover transition-opacity duration-200 ${isVideoOff ? 'opacity-0' : 'opacity-100'}`} 
                            ref={localStreamRef} 
                            playsInline 
                            autoPlay 
                            muted 
                        />
                        {isVideoOff && (
                            <div className="absolute flex flex-col items-center gap-2 text-slate-400 text-sm font-medium">
                                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M4 6h11a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                                </div>
                                <span>Camera Off</span>
                            </div>
                        )}
                        {/* Name badge */}
                        <div className="absolute bottom-3 left-3 bg-white/85 backdrop-blur-md px-3 py-1 rounded-xl text-xs font-bold text-slate-800 shadow-sm border border-slate-200/50 flex items-center gap-1.5">
                            <span>{name || "You"}</span>
                            {isMuted && <span className="text-red-500 font-extrabold text-[11px]">· Muted</span>}
                        </div>
                    </div>

                    {/* Remote Participant Card */}
                    <div className="relative w-full h-full max-h-full bg-slate-950 rounded-3xl overflow-hidden shadow-md border border-slate-200 flex items-center justify-center">
                        <video 
                            className="w-full h-full object-cover -scale-x-100" 
                            ref={remoteStreamRef} 
                            playsInline 
                            autoPlay 
                        />
                        {!peerName && (
                            <div className="absolute flex flex-col items-center gap-3 text-slate-300 text-sm px-4 text-center">
                                <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                <span className="font-semibold text-slate-200">Waiting for guest to join</span>
                                {currentRoomId && (
                                    <span className="text-xs text-slate-400">Share Room Code: <span className="text-blue-400 font-mono font-bold">{currentRoomId}</span></span>
                                )}
                            </div>
                        )}
                        {peerName && (
                            <div className="absolute bottom-3 left-3 bg-white/85 backdrop-blur-md px-3 py-1 rounded-xl text-xs font-bold text-blue-700 shadow-sm border border-slate-200/50">
                                {peerName}
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {/* Bottom Control Bar (Google Meet Style Floating Dock) */}
            <div className="flex items-center gap-3 bg-white/95 backdrop-blur-md border border-slate-200/90 px-6 py-2.5 rounded-full shadow-lg">
                {/* Mic Button */}
                <button 
                    onClick={toggleMute}
                    className={`p-3 rounded-full transition-all duration-150 cursor-pointer shadow-sm flex items-center justify-center ${
                        isMuted 
                            ? 'bg-red-500 hover:bg-red-600 text-white' 
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                    }`}
                    title={isMuted ? "Unmute microphone" : "Mute microphone"}
                >
                    {isMuted ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/></svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
                    )}
                </button>

                {/* Camera Button */}
                <button 
                    onClick={toggleVideo}
                    className={`p-3 rounded-full transition-all duration-150 cursor-pointer shadow-sm flex items-center justify-center ${
                        isVideoOff 
                            ? 'bg-red-500 hover:bg-red-600 text-white' 
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                    }`}
                    title={isVideoOff ? "Turn on camera" : "Turn off camera"}
                >
                    {isVideoOff ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M4 6h11a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M4 6h11a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z"/></svg>
                    )}
                </button>

                <div className="w-px h-6 bg-slate-200 mx-1"></div>

                {/* Disconnect / Leave Call Button */}
                <button 
                    onClick={disconnect}
                    className="px-5 py-2.5 rounded-full font-bold text-xs bg-red-600 hover:bg-red-700 text-white transition-all duration-150 shadow-md shadow-red-500/30 cursor-pointer flex items-center gap-2"
                    title="Leave call"
                >
                    <svg className="w-4 h-4 rotate-135" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.24 1.01l-2.21 2.2z"/></svg>
                    <span>Leave Call</span>
                </button>
            </div>
        </div>
    )
}

export default Conversation