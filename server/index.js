const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

app.use(cors());

const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST'],
    },
});

// Keep track of users in rooms: roomId -> Set of socket IDs
const roomUsers = {}; // roomId -> Set of socket IDs
const userNames = {}; // socket.id -> username
const userAvatars = {}; // socket.id -> avatar url

io.on('connection', (socket) => {
    let currentRoom = null;

    socket.on('join', ({ roomId, username, avatar }) => {
        const effectiveUsername = username || 'Anonymous';
        const effectiveAvatar = avatar || 'https://via.placeholder.com/100/CCCCCC/FFFFFF?text=Default';
        currentRoom = roomId;
        socket.join(roomId);
        userNames[socket.id] = effectiveUsername;
        userAvatars[socket.id] = effectiveAvatar;

        if (!roomUsers[roomId]) {
            roomUsers[roomId] = new Set();
        }
        roomUsers[roomId].add(socket.id);

        // Send all users except current socket.id to the joining user with usernames and avatars
        const otherUsers = Array.from(roomUsers[roomId])
            .filter(id => id !== socket.id)
            .map(id => ({ id, username: userNames[id], avatar: userAvatars[id] }));
        console.log(`[Server] ${effectiveUsername} (${socket.id}) joined room ${roomId}, other users: ${JSON.stringify(otherUsers)}`);
        socket.emit("all-users", otherUsers);

        // Notify others that a new user joined with username and avatar
        socket.to(roomId).emit("user-joined", { id: socket.id, username: effectiveUsername, avatar: effectiveAvatar });

        // Broadcast updated user count
        io.to(roomId).emit('user-count', roomUsers[roomId].size);

        console.log(`✅ ${socket.id} (${effectiveUsername}) joined room: ${roomId} with avatar: ${effectiveAvatar}`);
    });

    // Video call request
    socket.on('call-request', ({ roomId, callerID, callerName, userToCall }) => {
        console.log(`[Server] Call request from ${callerName} (${callerID}) to ${userToCall} in room ${roomId}`);
        if (roomUsers[roomId] && roomUsers[roomId].has(userToCall)) {
            console.log(`[Server] Emitting call-request to ${userToCall}`);
            io.to(userToCall).emit('call-request', { callerID, callerName });
        } else {
            console.error(`[Server] User ${userToCall} not found in room ${roomId}`);
        }
    });

    // Call accepted
    socket.on('call-accepted', ({ roomId, callerID, signal }) => {
        console.log(`[Server] Call accepted by ${socket.id} for caller ${callerID} in room ${roomId}`);
        io.to(callerID).emit('call-accepted', { callerID, signal });
    });

    // Call declined
    socket.on('call-declined', ({ roomId, callerID }) => {
        console.log(`[Server] Call declined by ${socket.id} for caller ${callerID} in room ${roomId}`);
        io.to(callerID).emit('call-declined', { callerID });
    });

    // Video call signaling
    socket.on('sending-signal', ({ userToSignal, callerID, signal }) => {
        console.log(`[Server] Sending signal from ${callerID} to ${userToSignal}, signal type: ${signal.type}`);
        io.to(userToSignal).emit('user-signal', { signal, callerID });
    });

    socket.on('returning-signal', ({ signal, callerID }) => {
        console.log(`[Server] Returning signal from ${socket.id} to ${callerID}, signal type: ${signal.type}`);
        io.to(callerID).emit('receiving-returned-signal', { signal, id: socket.id });
    });

    socket.on('leave-video', (roomId) => {
        console.log(`[Server] User ${socket.id} leaving video in room ${roomId}`);
        socket.to(roomId).emit('call-ended');
    });

    // Chat
    socket.on('chat', ({ roomId, text, time, senderId, username }) => {
        console.log(`[Server] Chat message from ${username} (${senderId}) in room ${roomId}: ${text}`);
        io.to(roomId).emit('chat', {
            text,
            time,
            senderId,
            username: username || userNames[socket.id] || 'User',
        });
    });

    // Typing Indicators
    socket.on('typing', ({ roomId, username }) => {
        console.log(`[Server] ${username} is typing in room ${roomId}`);
        socket.to(roomId).emit('typing', { username });
    });

    socket.on('stop-typing', ({ roomId, username }) => {
        console.log(`[Server] ${username} stopped typing in room ${roomId}`);
        socket.to(roomId).emit('stop-typing', { username });
    });

    // Cursor Movement
    socket.on('cursor-move', ({ roomId, id, x, y, username }) => {
        console.log(`[Server] Cursor move from ${username} (${id}) in room ${roomId} at (${x}, ${y})`);
        socket.to(roomId).emit('cursor-move', { id, x, y, username });
    });

    socket.on('remove-cursor', (id) => {
        console.log(`[Server] Removing cursor for ${id}`);
        socket.broadcast.emit('remove-cursor', id);
    });

    // Canvas Drawing
    socket.on('draw', ({ roomId, ...data }) => {
        console.log(`[Server] Draw event in room ${roomId}:`, data);
        socket.to(roomId).emit('draw', data);
    });

    socket.on('clear', (roomId) => {
        console.log(`[Server] Clear canvas in room ${roomId}`);
        socket.to(roomId).emit('clear');
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
        console.log(`❌ Disconnected: ${socket.id}`);
        delete userNames[socket.id];
        delete userAvatars[socket.id];

        if (currentRoom && roomUsers[currentRoom]) {
            roomUsers[currentRoom].delete(socket.id);

            if (roomUsers[currentRoom].size === 0) {
                console.log(`[Server] Room ${currentRoom} is now empty, deleting`);
                delete roomUsers[currentRoom];
            } else {
                console.log(`[Server] Broadcasting user count ${roomUsers[currentRoom].size} and user-disconnected ${socket.id} in room ${currentRoom}`);
                io.to(currentRoom).emit('user-count', roomUsers[currentRoom].size);
                io.to(currentRoom).emit('user-disconnected', socket.id);
            }
        }
    });
});

// Start server
const PORT = 5000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});