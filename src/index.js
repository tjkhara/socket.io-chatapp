const path = require('path')
const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const Filter = require('bad-words')
const { generateMessage, generateLocationMessage } = require("./utils/messages")
const {addUser, removeUser, getUser, getUsersInRoom} = require('./utils/users')

const app = express()
const server = http.createServer(app)
const io = socketio(server)

const port = process.env.PORT || 3000

// Define paths for Express config
const publicDirectoryPath = path.join(__dirname, '../public')

// Express static middleware
app.use(express.static(publicDirectoryPath))

io.on('connection', (socket) => {
   

    socket.on('join', ({username, room}, callback) => {
        const {error, user} = addUser({id: socket.id, username, room})
        // console.log(user)

        if (error) {
            return callback(error)
        }

        socket.join(user.room)

         // console.log('New web socket connection')
        // When new connection is established a welcome message is sent out
        socket.emit('message', generateMessage("Admin", "Welcome"))

        // Sending to everyone but this user
        socket.broadcast.to(user.room).emit('message', generateMessage("Admin", `${user.username} has joined!`))

        // For user list
        // Sending event for when a user joins the room
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUsersInRoom(user.room)
        })

        callback()
    })

    // Server listening for sendMessage
    // When a form submit is done on client the server receives and sends to all clients
    socket.on('sendMessage', (message, callback) => {
        
        const user = getUser(socket.id)
        
        // Check for profanity
        const filter = new Filter()

        if(filter.isProfane(message)){
            return callback('Profanity is not allowed.')
        }

        // Send message event to all connected clients
        io.to(user.room).emit('message', generateMessage(user.username, message))
        // Call the callback to acknowledge the event
        callback()
    })

    // Server listening for sendLocation
    socket.on('sendLocation', (location, callback) => {
        
        const user = getUser(socket.id)
        // Send message event to all connected clients
        io.to(user.room).emit('locationMessage', generateLocationMessage(user.username, `https://google.com/maps?q=${location.latitude},${location.longitude}`))
        // Call the callback to acknowledge the event
        callback('Delivered')
    })

    socket.on('disconnect', () => {
        const user = removeUser(socket.id)
        
        if(user){
            io.to(user.room).emit('message', generateMessage('Admin', `${user.username} has left!`))
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            })
        }
    })
})

server.listen(port, () => {
    console.log('Server is up on port ' + port)
})