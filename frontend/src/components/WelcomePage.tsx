import React from 'react'
import { useNavigate } from 'react-router-dom'

const WelcomePage = ({socket, setSocket, name, setName}) => {

    const [currentTab, setCurrentTab] = React.useState<"newuser" | "join">("newuser")
    
    const [roomId, setRoomId] = React.useState<string>("")
    const [joining, setJoining] = React.useState<boolean>(false)
    const navigate = useNavigate()

    React.useEffect(()=>{
        if (!joining || socket) return

        console.log("here")
        const ws = new WebSocket("http://localhost:3000")
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
            setName("")
            setRoomId("")
        }
        
        navigate("/conversation")        
        
    }, [joining])

    const joinButtonHandler = () => {
        setJoining(true)
    }

    return (
        <>
            <div className="welcome-card-container flex flex-col items-center border rounded-xl w-2/6 h-72 pt-3 shadow-xl mt-30" >
                
                <div className="tabs-container flex gap-8 font-bold font-serif text-2xl cursor-pointer mt-1 mb-6">
                    <div 
                        className="newuser-tab rounded-t-2xl pl-2 pr-2" 
                        onClick={() => setCurrentTab("newuser")}>
                            New User
                    </div>
                    <div className="join-tab" onClick={() => setCurrentTab("join")}>Join</div>
                </div>
                <div className="fields-container mt-5 flex flex-col gap-4">
                    <input 
                        type="text" 
                        className="name-field relative text-gray-900 bg-gray-200 pl-3 pt-1 pb-1 rounded-2xl focus:outline-none" 
                        onChange = {e => setName(e.target.value)}
                        placeholder='Name...'
                    />
                    {currentTab==="join" && <input 
                        type="text" 
                        className="roomid-field relative text-gray-900 bg-gray-200 pl-3 pt-1 pb-1 rounded-2xl focus:outline-none" 
                        onChange = {e => setRoomId(e.target.value)}
                        placeholder='Room...'
                    />}
                </div>
                <button 
                    className="join-button bg-amber-400 pl-3 pr-3 pt-1 pb-1 text-white font-bold text-2xl rounded-xl  mt-10"
                    onClick = {joinButtonHandler}
                    disabled={joining}
                    >
                    {joining ? "Loading..." : "Enter"}
                </button>
            </div>
        </>
    )


}

export default WelcomePage