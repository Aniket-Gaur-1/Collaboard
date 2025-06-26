import React from "react";
import "../style/chatBox.css";

function ChatBox({
  messages,
  messageInput,
  setMessageInput,
  sendMessage,
  typingUsers,
  socket,
  roomId,
  username,
}) {
  let typingTimeoutRef = React.useRef(null);

  const handleChange = (e) => {
    setMessageInput(e.target.value);

    socket.emit("typing", { roomId, username });

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stop-typing", { roomId, username });
    }, 1000);
  };

  return (
    <div className="chat-box">
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className="chat-message">
            <strong>
              {msg.senderId === socket.id ? "You" : msg.username || "User"}:
            </strong>{" "}
            {msg.text}
            <span className="chat-message-time">{msg.time}</span>
          </div>
        ))}
      </div>

      {Object.keys(typingUsers).length > 0 && (
        <div className="chat-typing">
          {Object.keys(typingUsers).join(", ")}{" "}
          {Object.keys(typingUsers).length === 1 ? "is" : "are"} typing...
        </div>
      )}

      <form className="chat-form" onSubmit={sendMessage}>
        <input
          type="text"
          value={messageInput}
          onChange={handleChange}
          placeholder="Type a message..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}

export default ChatBox;
