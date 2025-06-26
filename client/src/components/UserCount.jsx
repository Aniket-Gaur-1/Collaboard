import React from "react";
import "../style/userCount.css";

function UserCount({ userCount }) {
  return <p className="user-count">Active Users in Room: {userCount}</p>;
}

export default UserCount;
