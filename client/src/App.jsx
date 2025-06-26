import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";

function App() {
  const [roomIdInput, setRoomIdInput] = useState("");
  const navigate = useNavigate();

  const createRoom = () => {
    const id = uuidv4().slice(0, 6); // short room ID
    navigate(`/room/${id}`);
  };

  const joinRoom = (e) => {
    e.preventDefault();
    if (roomIdInput.trim() !== "") {
      navigate(`/room/${roomIdInput}`);
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h1>Welcome to CollabBoard 🧠</h1>
      <p>Draw. Collaborate. Chat — All in one place.</p>
      <div style={{ marginTop: "30px" }}>
        <button
          onClick={createRoom}
          style={{ padding: "10px 20px", fontSize: "16px" }}
        >
          Create New Room
        </button>
      </div>
      <form onSubmit={joinRoom} style={{ marginTop: "20px" }}>
        <input
          type="text"
          placeholder="Enter Room ID"
          value={roomIdInput}
          onChange={(e) => setRoomIdInput(e.target.value)}
          style={{ padding: "8px", width: "200px" }}
        />
        <button
          type="submit"
          style={{ marginLeft: "10px", padding: "8px 16px" }}
        >
          Join
        </button>
      </form>
    </div>
  );
}

export default App;
