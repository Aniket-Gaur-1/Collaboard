import React, { useState } from "react";
import "./AvatarSelector.css";

const avatarOptions = [
  { id: 1, url: "https://picsum.photos/100?random=1" },
  { id: 2, url: "https://picsum.photos/100?random=2" },
  { id: 3, url: "https://picsum.photos/100?random=3" },
  { id: 4, url: "https://picsum.photos/100?random=4" },
  { id: 5, url: "https://picsum.photos/100?random=5" },
];

function AvatarSelector({ onSelectAvatar }) {
  const [selectedAvatar, setSelectedAvatar] = useState(null);

  const handleAvatarClick = (avatar) => {
    setSelectedAvatar(avatar.url);
    onSelectAvatar(avatar.url);
    console.log(`[AvatarSelector] Selected avatar: ${avatar.url}`);
  };

  return (
    <div className="avatar-selector">
      <h3>Select an Avatar</h3>
      <div className="avatar-grid">
        {avatarOptions.map((avatar) => (
          <img
            key={avatar.id}
            src={avatar.url}
            alt={`Avatar ${avatar.id}`}
            className={`avatar-image ${
              selectedAvatar === avatar.url ? "selected" : ""
            }`}
            onClick={() => handleAvatarClick(avatar)}
          />
        ))}
      </div>
      {selectedAvatar && (
        <p className="avatar-selected">
          Selected:{" "}
          <img
            src={selectedAvatar}
            alt="Selected avatar"
            className="avatar-preview"
          />
        </p>
      )}
    </div>
  );
}

export default AvatarSelector;
