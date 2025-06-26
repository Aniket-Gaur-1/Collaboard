import React from "react";
import "../style/userCursor.css";

function UserCursors({ cursors }) {
  return (
    <>
      {Object.entries(cursors).map(([id, pos]) => (
        <div
          key={id}
          className="user-cursor"
          style={{
            left: pos.x,
            top: pos.y,
          }}
        >
          <span className="user-cursor-label">
            {pos.username || id.slice(0, 4)}
          </span>
        </div>
      ))}
    </>
  );
}

export default UserCursors;
