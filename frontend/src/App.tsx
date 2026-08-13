import React from 'react'
import WelcomePage from './components/WelcomePage'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Conversation from './components/Conversation'

const App = () => {

  const [socket, setSocket] = React.useState<WebSocket|null>(null)
  const [name, setName] = React.useState<string>("")

  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<WelcomePage socket={socket} setSocket={setSocket} name={name} setName={setName}/>} />
        <Route path='/conversation' element ={<Conversation socket={socket} name={name} />} />
      </Routes>
    </BrowserRouter>
  )

}

export default App