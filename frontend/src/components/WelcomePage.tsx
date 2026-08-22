import React from 'react'
import { useNavigate } from 'react-router-dom'

interface WelcomePageProps {
    socket: WebSocket | null;
    setSocket: React.Dispatch<React.SetStateAction<WebSocket | null>>;
    name: string;
    setName: React.Dispatch<React.SetStateAction<string>>;
}

const WelcomePage = ({socket, setSocket, name, setName}: WelcomePageProps) => {

    const [currentTab, setCurrentTab] = React.useState<"newuser" | "join">("newuser")
    
    const [roomId, setRoomId] = React.useState<string>("")
    const [joining, setJoining] = React.useState<boolean>(false)
    const navigate = useNavigate()

    React.useEffect(()=>{
        if (!joining || socket) return

        console.log("here")
        const ws = new WebSocket("ws://localhost:3000")
        setSocket(ws)
        ws.onopen = () => {
            console.log("WebSocket connection established")
            ws.send(JSON.stringify({
                type: currentTab,
                data: {
                    userName: name,
                    roomId: roomId
                }
            }))
            console.log("Data Sent")
            setJoining(false)
            setRoomId("")
        }
        
        navigate("/conversation")        
        
    }, [joining])

    const joinButtonHandler = () => {
        setJoining(true)
    }

    return (
        <div className="flex-1 flex items-center justify-center p-6 bg-slate-50 w-full h-full">
            <div className="welcome-card-container flex flex-col items-center bg-white border border-slate-200/80 rounded-3xl w-full max-w-md p-8 shadow-xl shadow-slate-200/50">
                
                {/* Logo / Branding */}
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/30 font-black text-lg">
                        H
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-900">HopeOn</h1>
                        <p className="text-xs text-slate-500 font-medium">Real-time peer-to-peer video calls</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="tabs-container flex gap-2 font-semibold text-sm cursor-pointer my-6 bg-slate-100 p-1.5 rounded-2xl w-full border border-slate-200/60">
                    <div 
                        className={`newuser-tab flex-1 text-center py-2.5 rounded-xl transition-all duration-200 ${
                            currentTab === "newuser" 
                                ? "bg-white text-blue-600 shadow-sm font-bold" 
                                : "text-slate-600 hover:text-slate-900"
                        }`} 
                        onClick={() => setCurrentTab("newuser")}>
                            New Meeting
                    </div>
                    <div 
                        className={`join-tab flex-1 text-center py-2.5 rounded-xl transition-all duration-200 ${
                            currentTab === "join" 
                                ? "bg-white text-blue-600 shadow-sm font-bold" 
                                : "text-slate-600 hover:text-slate-900"
                        }`} 
                        onClick={() => setCurrentTab("join")}>
                            Join Room
                    </div>
                </div>

                {/* Fields */}
                <div className="fields-container w-full flex flex-col gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5 ml-1">
                            Your Name
                        </label>
                        <input 
                            type="text" 
                            className="name-field w-full text-slate-900 bg-slate-50 border border-slate-300 px-4 py-3 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition text-sm font-medium placeholder-slate-400" 
                            value={name}
                            onChange = {e => setName(e.target.value)}
                            placeholder='e.g. Alex'
                        />
                    </div>

                    {currentTab==="join" && (
                        <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5 ml-1">
                                Room ID
                            </label>
                            <input 
                                type="text" 
                                className="roomid-field w-full text-slate-900 bg-slate-50 border border-slate-300 px-4 py-3 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition text-sm font-medium placeholder-slate-400" 
                                value={roomId}
                                onChange = {e => setRoomId(e.target.value)}
                                placeholder='Enter Room Code'
                            />
                        </div>
                    )}
                </div>

                {/* Submit Button */}
                <button 
                    className="join-button w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm py-3.5 rounded-xl mt-6 shadow-md shadow-blue-500/20 transition duration-150 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    onClick = {joinButtonHandler}
                    disabled={joining}
                    >
                    <span>{joining ? "Connecting..." : (currentTab === "newuser" ? "Start Meeting" : "Join Call")}</span>
                    {!joining && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>}
                </button>
            </div>
        </div>
    )


}

export default WelcomePage