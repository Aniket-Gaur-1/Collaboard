import React, { useRef, useEffect, useState } from "react";
import Peer from "simple-peer";
import socket from "./socket";
import "../style/videoChat.css";

function VideoChat({ roomId, username }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [otherUserId, setOtherUserId] = useState(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [otherUsername, setOtherUsername] = useState(null);

  // Ensure username is valid
  const effectiveUsername = username || "Anonymous";

  // Get media stream once
  useEffect(() => {
    console.log(
      `[VideoChat] Requesting media stream for user: ${effectiveUsername}, room: ${roomId}`
    );
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((currentStream) => {
        console.log(
          `[VideoChat] Media stream acquired for ${effectiveUsername}`
        );
        setStream(currentStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = currentStream;
        }
      })
      .catch((error) => {
        console.error(
          `[VideoChat] Error accessing media devices for ${effectiveUsername}:`,
          error
        );
      });
  }, [roomId, effectiveUsername]);

  // Toggle microphone
  const toggleMic = () => {
    if (stream) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !isMicOn;
      });
      console.log(
        `[VideoChat] Mic toggled to ${
          !isMicOn ? "on" : "off"
        } for ${effectiveUsername}`
      );
      setIsMicOn(!isMicOn);
    }
  };

  // Toggle video
  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks().forEach((track) => {
        track.enabled = !isVideoOn;
      });
      console.log(
        `[VideoChat] Video toggled to ${
          !isVideoOn ? "on" : "off"
        } for ${effectiveUsername}`
      );
      setIsVideoOn(!isVideoOn);
    }
  };

  // Setup socket events
  useEffect(() => {
    if (!stream) {
      console.log(
        `[VideoChat] Stream not ready for ${effectiveUsername}, skipping socket setup`
      );
      return;
    }

    console.log(
      `[VideoChat] Setting up socket events for ${effectiveUsername} in room ${roomId}`
    );
    socket.emit("join", { roomId, username: effectiveUsername });

    const handleAllUsers = (users) => {
      console.log(
        `[VideoChat] Received all-users: ${JSON.stringify(
          users
        )} for ${effectiveUsername}`
      );
      if (users.length > 0) {
        setOtherUserId(users[0].id);
        setOtherUsername(users[0].username);
      } else {
        setOtherUserId(null);
        setOtherUsername(null);
        setCallAccepted(false);
        setIncomingCall(null);
        if (peerRef.current) {
          peerRef.current.destroy();
          peerRef.current = null;
        }
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
      }
    };

    const handleUserJoined = ({ id, username }) => {
      console.log(
        `[VideoChat] User joined: ${id} (${username}) in room ${roomId}`
      );
      setOtherUserId(id);
      setOtherUsername(username);
    };

    const handleCallRequest = ({ callerID, callerName }) => {
      console.log(
        `[VideoChat] Received call request from ${callerName} (${callerID}) for ${effectiveUsername}`
      );
      setIncomingCall({ callerID, callerName });
    };

    const handleCallAccepted = ({ callerID, signal }) => {
      console.log(
        `[VideoChat] Call accepted by ${callerID} for ${effectiveUsername}`
      );
      if (peerRef.current && peerRef.current.signalingState !== "stable") {
        const peer = addPeer(signal, callerID, stream);
        peerRef.current = peer;
        setCallAccepted(true);
        setIncomingCall(null);
      } else {
        console.warn(
          `[VideoChat] Peer not ready or in stable state for ${effectiveUsername}`
        );
      }
    };

    const handleCallDeclined = ({ callerID }) => {
      console.log(
        `[VideoChat] Call declined by ${callerID} for ${effectiveUsername}`
      );
      setIncomingCall(null);
    };

    const handleUserSignal = ({ signal, callerID }) => {
      console.log(
        `[VideoChat] Received user-signal from ${callerID} for ${effectiveUsername}`
      );
      if (!peerRef.current || peerRef.current.signalingState === "stable") {
        const peer = addPeer(signal, callerID, stream);
        peerRef.current = peer;
        setCallAccepted(true);
      } else {
        console.warn(
          `[VideoChat] Ignoring user-signal, peer not ready or in stable state for ${effectiveUsername}`
        );
      }
    };

    const handleReceivingReturnedSignal = ({ signal, id }) => {
      console.log(
        `[VideoChat] Received returned signal from ${id} for ${effectiveUsername}`
      );
      if (peerRef.current && peerRef.current.signalingState !== "stable") {
        try {
          peerRef.current.signal(signal);
          setCallAccepted(true);
          setOtherUserId(id);
        } catch (error) {
          console.error(
            `[VideoChat] Error processing returned signal for ${effectiveUsername}:`,
            error
          );
        }
      } else {
        console.warn(
          `[VideoChat] Peer not ready or in stable state for returned signal for ${effectiveUsername}`
        );
      }
    };

    const handleUserDisconnected = (userId) => {
      console.log(
        `[VideoChat] User disconnected: ${userId} for ${effectiveUsername}`
      );
      if (userId === otherUserId) {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
        if (peerRef.current) {
          peerRef.current.destroy();
          peerRef.current = null;
        }
        setCallAccepted(false);
        setOtherUserId(null);
        setOtherUsername(null);
        setIncomingCall(null);
      }
    };

    const handleCallEnded = () => {
      console.log(
        `[VideoChat] Call ended for ${effectiveUsername}, otherUserId: ${otherUserId}, otherUsername: ${otherUsername}`
      );
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      setCallAccepted(false);
      setIncomingCall(null);
    };

    socket.on("all-users", handleAllUsers);
    socket.on("user-joined", handleUserJoined);
    socket.on("call-request", handleCallRequest);
    socket.on("call-accepted", handleCallAccepted);
    socket.on("call-declined", handleCallDeclined);
    socket.on("user-signal", handleUserSignal);
    socket.on("receiving-returned-signal", handleReceivingReturnedSignal);
    socket.on("user-disconnected", handleUserDisconnected);
    socket.on("call-ended", handleCallEnded);

    return () => {
      console.log(
        `[VideoChat] Cleaning up socket events for ${effectiveUsername}`
      );
      socket.emit("leave-video", roomId);
      socket.off("all-users", handleAllUsers);
      socket.off("user-joined", handleUserJoined);
      socket.off("call-request", handleCallRequest);
      socket.off("call-accepted", handleCallAccepted);
      socket.off("call-declined", handleCallDeclined);
      socket.off("user-signal", handleUserSignal);
      socket.off("receiving-returned-signal", handleReceivingReturnedSignal);
      socket.off("user-disconnected", handleUserDisconnected);
      socket.off("call-ended", handleCallEnded);
      if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
      }
    };
  }, [roomId, effectiveUsername, stream]);

  // Create peer as caller
  const createPeer = (userToSignal, stream) => {
    console.log(
      `[VideoChat] Creating peer as caller to ${userToSignal} for ${effectiveUsername}`
    );
    if (peerRef.current) {
      console.log(
        `[VideoChat] Destroying existing peer for ${effectiveUsername}`
      );
      peerRef.current.destroy();
      peerRef.current = null;
    }
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
    });

    peer.on("signal", (signal) => {
      console.log(
        `[VideoChat] Sending signal to ${userToSignal} from ${effectiveUsername}`
      );
      socket.emit("sending-signal", {
        userToSignal,
        callerID: socket.id,
        signal,
      });
    });

    peer.on("stream", (remoteStream) => {
      if (remoteVideoRef.current) {
        console.log(
          `[VideoChat] Received remote stream for ${effectiveUsername}`
        );
        remoteVideoRef.current.srcObject = remoteStream;
      }
    });

    peer.on("error", (error) => {
      console.error(`[VideoChat] Peer error for ${effectiveUsername}:`, error);
    });

    return peer;
  };

  // Add peer as callee
  const addPeer = (incomingSignal, callerID, stream) => {
    console.log(
      `[VideoChat] Adding peer as callee for ${callerID} for ${effectiveUsername}`
    );
    if (peerRef.current) {
      console.log(
        `[VideoChat] Destroying existing peer for ${effectiveUsername}`
      );
      peerRef.current.destroy();
      peerRef.current = null;
    }
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
    });

    peer.on("signal", (signal) => {
      console.log(
        `[VideoChat] Returning signal to ${callerID} from ${effectiveUsername}`
      );
      socket.emit("returning-signal", { signal, callerID });
    });

    peer.on("stream", (remoteStream) => {
      if (remoteVideoRef.current) {
        console.log(
          `[VideoChat] Received remote stream for ${effectiveUsername}`
        );
        remoteVideoRef.current.srcObject = remoteStream;
      }
    });

    peer.on("error", (error) => {
      console.error(`[VideoChat] Peer error for ${effectiveUsername}:`, error);
    });

    try {
      peer.signal(incomingSignal);
    } catch (error) {
      console.error(
        `[VideoChat] Error signaling incoming signal for ${effectiveUsername}:`,
        error
      );
    }

    return peer;
  };

  // Send call request
  const sendCallRequest = () => {
    if (otherUserId) {
      console.log(
        `[VideoChat] Sending call request from ${effectiveUsername} to ${otherUserId}`
      );
      socket.emit("call-request", {
        roomId,
        callerID: socket.id,
        callerName: effectiveUsername,
        userToCall: otherUserId,
      });
    } else {
      console.log(
        `[VideoChat] No other user available to call for ${effectiveUsername}`
      );
    }
  };

  // Accept call
  const acceptCall = () => {
    if (incomingCall && stream) {
      console.log(
        `[VideoChat] Accepting call from ${incomingCall.callerID} for ${effectiveUsername}`
      );
      const peer = createPeer(incomingCall.callerID, stream);
      peerRef.current = peer;
      socket.emit("call-accepted", {
        roomId,
        callerID: incomingCall.callerID,
        signal: null,
      });
      setCallAccepted(true);
      setIncomingCall(null);
    }
  };

  // Decline call
  const declineCall = () => {
    if (incomingCall) {
      console.log(
        `[VideoChat] Declining call from ${incomingCall.callerID} for ${effectiveUsername}`
      );
      socket.emit("call-declined", {
        roomId,
        callerID: incomingCall.callerID,
      });
      setIncomingCall(null);
    }
  };

  // Leave call
  const leaveCall = () => {
    if (peerRef.current) {
      console.log(
        `[VideoChat] Leaving call for ${effectiveUsername}, otherUserId: ${otherUserId}, otherUsername: ${otherUsername}`
      );
      peerRef.current.destroy();
      peerRef.current = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setCallAccepted(false);
    setIncomingCall(null);

    console.log(
      `[VideoChat] Emitting leave-video for ${effectiveUsername} in room ${roomId}`
    );
    socket.emit("leave-video", roomId);
  };

  return (
    <div className="video-chat-container">
      <div className="video-chat-section">
        {otherUserId && !callAccepted && !incomingCall && (
          <button className="call-request-button" onClick={sendCallRequest}>
            Send Call Request
          </button>
        )}

        {incomingCall && !callAccepted && (
          <div className="incoming-call">
            <p>Incoming call from {incomingCall.callerName || "User"}...</p>
            <button className="accept-button" onClick={acceptCall}>
              Accept
            </button>
            <button className="decline-button" onClick={declineCall}>
              Decline
            </button>
          </div>
        )}

        <h4>You</h4>
        <div className="video-container">
          <video ref={localVideoRef} autoPlay muted playsInline />
        </div>

        {callAccepted && (
          <div className="video-controls">
            <button
              className={isMicOn ? "mic-button" : "mic-button off"}
              onClick={toggleMic}
            >
              {isMicOn ? "Mic On" : "Mic Off"}
            </button>
            <button
              className={isVideoOn ? "video-button" : "video-button off"}
              onClick={toggleVideo}
            >
              {isVideoOn ? "Video On" : "Video Off"}
            </button>
            <button className="leave-button" onClick={leaveCall}>
              Leave Call
            </button>
          </div>
        )}
      </div>

      <div className="video-chat-section">
        <h4>{otherUsername || "No User"}</h4>
        <div className="video-container">
          <video ref={remoteVideoRef} autoPlay playsInline />
        </div>
      </div>
    </div>
  );
}

export default VideoChat;
