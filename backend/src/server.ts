import express from 'express'
import http from 'http'
import { SignallingServer } from './managers/SignallingServer.js';

const app = express();
const server = http.createServer(app);
app.use(express.json())


new SignallingServer({server})

server.listen(3000, () => {
    console.log("SERVER RUNNING ON PORT:3000")
})


