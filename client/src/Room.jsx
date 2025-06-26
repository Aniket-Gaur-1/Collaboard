import React, { useRef, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import io from "socket.io-client";
import { SketchPicker } from "react-color";

const socket = io("http://localhost:5000");

function Room() {
  const { roomId } = useParams();
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#000");

  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [userCount, setUserCount] = useState(1);
  const [cursors, setCursors] = useState({});

  const [username, setUsername] = useState("");
  const [hasSetUsername, setHasSetUsername] = useState(false);

  const [typingUsers, setTypingUsers] = useState({});
  let typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!hasSetUsername) {
      let name = prompt("Enter your name") || "Anonymous";
      setUsername(name);
      setHasSetUsername(true);
    }
  }, [hasSetUsername]);
  // 👇 NEW useEffect — waits for username to be ready
  useEffect(() => {
    if (username && roomId) {
      socket.emit("join", { roomId, username });
    }
  }, [username, roomId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 100;
    canvas.style.border = "1px solid #000";

    const context = canvas.getContext("2d");
    context.lineCap = "round";
    context.strokeStyle = color;
    context.lineWidth = 5;
    contextRef.current = context;

    socket.on("chat", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on("user-count", (count) => {
      setUserCount(count);
    });
    socket.on("cursor-move", ({ id, x, y, username }) => {
      setCursors((prev) => ({
        ...prev,
        [id]: { x, y, username },
      }));
    });

    socket.on("remove-cursor", (id) => {
      setCursors((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    });

    socket.on("draw", ({ offsetX, offsetY, prevX, prevY, color }) => {
      context.beginPath();
      context.strokeStyle = color;
      context.moveTo(prevX, prevY);
      context.lineTo(offsetX, offsetY);
      context.stroke();
    });

    socket.on("clear", () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
    });

    socket.on("typing", ({ username }) => {
      setTypingUsers((prev) => ({ ...prev, [username]: true }));
    });

    socket.on("stop-typing", ({ username }) => {
      setTypingUsers((prev) => {
        const copy = { ...prev };
        delete copy[username];
        return copy;
      });
    });
  }, [roomId]);

  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = color;
    }
  }, [color]);
  useEffect(() => {
    return () => {
      socket.emit("remove-cursor", socket.id);
    };
  }, []);

  const getOffset = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    const { offsetX, offsetY } = getOffset(e);
    contextRef.current.beginPath();
    contextRef.current.moveTo(offsetX, offsetY);
  };

  const draw = (e) => {
    if (!isDrawing) return;

    const { offsetX, offsetY } = getOffset(e); // relative to canvas

    const context = contextRef.current;
    context.lineTo(offsetX, offsetY);
    context.stroke();

    socket.emit("draw", {
      roomId,
      offsetX,
      offsetY,
      prevX: context.__lastX || offsetX,
      prevY: context.__lastY || offsetY,
      color,
    });

    // Send cursor position relative to canvas (NOT clientX/clientY)
    socket.emit("cursor-move", {
      roomId,
      id: socket.id,
      x: offsetX,
      y: offsetY,
      username, // ✅ Include username here
    });

    context.__lastX = offsetX;
    context.__lastY = offsetY;
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    contextRef.current.closePath();
    delete contextRef.current.__lastX;
    delete contextRef.current.__lastY;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    context.clearRect(0, 0, canvas.width, canvas.height);
    socket.emit("clear", roomId);
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    const image = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = image;
    link.download = `whiteboard-${roomId}.png`;
    link.click();
  };
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
    <div>
      <div
        style={{
          display: "flex",
          gap: "1rem",
          padding: "10px",
          alignItems: "center",
        }}
      >
        <SketchPicker color={color} onChangeComplete={(c) => setColor(c.hex)} />
        <button onClick={clearCanvas}>Clear</button>
        <button onClick={downloadCanvas}>Download</button>
      </div>
      <p style={{ textAlign: "center", marginTop: "10px", fontWeight: "bold" }}>
        Active Users in Room: {userCount}
      </p>

      <div
        style={{
          position: "relative", // ✅ IMPORTANT: relative container
          width: "100%",
          height: window.innerHeight - 100,
          overflow: "hidden", // Optional: prevent cursor overflow
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          style={{ display: "block", margin: "0 auto" }}
        />

        {Object.entries(cursors).map(([id, pos]) => (
          <div
            key={id}
            style={{
              position: "absolute",
              left: pos.x,
              top: pos.y,
              width: 10,
              height: 10,
              backgroundColor: "red",
              borderRadius: "50%",
              pointerEvents: "none",
              transform: "translate(-50%, -50%)",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: -20,
                fontSize: "12px",
                color: "#555",
              }}
            >
              {pos.username || id.slice(0, 4)}
            </span>
          </div>
        ))}
      </div>

      <div style={{ maxWidth: "600px", margin: "20px auto", padding: "10px" }}>
        <div
          style={{
            height: "200px",
            overflowY: "auto",
            border: "1px solid #ccc",
            padding: "10px",
            borderRadius: "5px",
            background: "#f9f9f9",
          }}
        >
          {messages.map((msg, index) => (
            <div key={index} style={{ marginBottom: "8px" }}>
              <strong>
                {msg.senderId === socket.id ? "You" : msg.username || "User"}:
              </strong>{" "}
              {msg.text}
              <span
                style={{ float: "right", fontSize: "0.8rem", color: "#888" }}
              >
                {msg.time}
              </span>
            </div>
          ))}
        </div>

        {/* Move typing indicator outside scrollable area */}
        {Object.keys(typingUsers).length > 0 && (
          <div
            style={{
              fontStyle: "italic",
              color: "#888",
              marginTop: "5px",
              marginBottom: "5px",
            }}
          >
            {Object.keys(typingUsers).join(", ")}{" "}
            {Object.keys(typingUsers).length === 1 ? "is" : "are"} typing...
          </div>
        )}

        <form
          onSubmit={sendMessage}
          style={{ marginTop: "10px", display: "flex", gap: "8px" }}
        >
          <input
            type="text"
            value={messageInput}
            onChange={(e) => {
              setMessageInput(e.target.value);

              socket.emit("typing", { roomId, username });

              clearTimeout(typingTimeoutRef.current);
              typingTimeoutRef.current = setTimeout(() => {
                socket.emit("stop-typing", { roomId, username });
              }, 1000);
            }}
            placeholder="Type a message..."
            style={{ flex: 1, padding: "8px" }}
          />
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}

export default Room;
