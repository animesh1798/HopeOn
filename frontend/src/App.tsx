import React from 'react'
import WelcomePage from './components/WelcomePage'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Conversation from './components/Conversation'

const App = () => {

  const [socket, setSocket] = React.useState<WebSocket|null>(null)


  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<WelcomePage socket={socket} setSocket={setSocket}/>} />
        <Route path='/conversation' element ={<Conversation socket={socket} />} />
      </Routes>
    </BrowserRouter>
  )

}

export default App