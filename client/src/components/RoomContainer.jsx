import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import socket from "./socket";
import CanvasBoard from "./CanvasBoard";
import ChatBox from "./ChatBox";
import UserCount from "./UserCount";
import VideoChat from "./VideoChat";
import "../style/roomContainer.css";

function RoomContainer() {
  const { roomId } = useParams();

  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#000");

  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [userCount, setUserCount] = useState(1);
  const [cursors, setCursors] = useState({});

  const [username, setUsername] = useState("");
  const [hasSetUsername, setHasSetUsername] = useState(false);

  const [typingUsers, setTypingUsers] = useState({});
  const contextRef = useRef(null);

  // Ask username once
  useEffect(() => {
    if (!hasSetUsername) {
      const name = prompt("Enter your name") || "Anonymous";
      setUsername(name);
      setHasSetUsername(true);
    }
  }, [hasSetUsername]);

  // Emit join only after username is set
  useEffect(() => {
    if (username && roomId) {
      socket.emit("join", { roomId, username });
    }
  }, [username, roomId]);

  useEffect(() => {
    const handleChat = (msg) => setMessages((prev) => [...prev, msg]);
    const handleUserCount = (count) => setUserCount(count);
    const handleCursorMove = ({ id, x, y, username }) => {
      setCursors((prev) => ({ ...prev, [id]: { x, y, username } }));
    };
    const handleRemoveCursor = (id) => {
      setCursors((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    };
    const handleTyping = ({ username }) => {
      setTypingUsers((prev) => ({ ...prev, [username]: true }));
    };
    const handleStopTyping = ({ username }) => {
      setTypingUsers((prev) => {
        const copy = { ...prev };
        delete copy[username];
        return copy;
      });
    };

    // Register listeners
    socket.on("chat", handleChat);
    socket.on("user-count", handleUserCount);
    socket.on("cursor-move", handleCursorMove);
    socket.on("remove-cursor", handleRemoveCursor);
    socket.on("typing", handleTyping);
    socket.on("stop-typing", handleStopTyping);

    // Cleanup on unmount
    return () => {
      socket.emit("remove-cursor", socket.id);
      socket.off("chat", handleChat);
      socket.off("user-count", handleUserCount);
      socket.off("cursor-move", handleCursorMove);
      socket.off("remove-cursor", handleRemoveCursor);
      socket.off("typing", handleTyping);
      socket.off("stop-typing", handleStopTyping);
    };
  }, []);

  const sendMessage = (e) => {
    e.preventDefault();
    if (messageInput.trim() === "") return;
    const msg = {
      text: messageInput,
      senderId: socket.id,
      username,
      time: new Date().toLocaleTimeString(),
    };

    socket.emit("chat", { roomId, ...msg });
    setMessageInput("");
  };

  return (
    <div className="room-container">
      <div className="room-content">
        <CanvasBoard
          color={color}
          setColor={setColor}
          socket={socket}
          roomId={roomId}
          cursors={cursors}
          username={username}
          isDrawing={isDrawing}
          setIsDrawing={setIsDrawing}
          contextRef={contextRef}
        />
        <UserCount userCount={userCount} />
        <VideoChat roomId={roomId} username={username} />
        <ChatBox
          messages={messages}
          messageInput={messageInput}
          setMessageInput={setMessageInput}
          sendMessage={sendMessage}
          typingUsers={typingUsers}
          socket={socket}
          roomId={roomId}
          username={username}
        />
      </div>
    </div>
  );
}

export default RoomContainer;
