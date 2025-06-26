import React, { useRef, useEffect, useState } from "react";
import { SketchPicker } from "react-color";
import UserCursors from "./UserCursors";
import "../style/canvasBoard.css";

function CanvasBoard({
  color,
  setColor,
  socket,
  roomId,
  cursors,
  username,
  setIsDrawing,
  isDrawing,
  contextRef,
}) {
  const canvasRef = useRef(null);
  const [brushSize, setBrushSize] = useState(5);
  const [isEraser, setIsEraser] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 100;
    canvas.style.border = "1px solid #000";

    const context = canvas.getContext("2d");
    context.lineCap = "round";
    context.lineWidth = brushSize;
    contextRef.current = context;

    socket.on(
      "draw",
      ({ offsetX, offsetY, prevX, prevY, color, brushSize }) => {
        context.save();
        context.strokeStyle = color;
        context.lineWidth = brushSize || 5;
        context.beginPath();
        context.moveTo(prevX, prevY);
        context.lineTo(offsetX, offsetY);
        context.stroke();
        context.restore();
      }
    );

    socket.on("clear", () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
    });

    return () => {
      socket.off("draw");
      socket.off("clear");
    };
  }, [socket, contextRef, roomId]);

  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = isEraser ? "#ffffff" : color;
    }
  }, [color, isEraser]);

  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.lineWidth = brushSize;
    }
  }, [brushSize]);

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
    const { offsetX, offsetY } = getOffset(e);
    const context = contextRef.current;
    context.lineTo(offsetX, offsetY);
    context.stroke();

    socket.emit("draw", {
      roomId,
      offsetX,
      offsetY,
      prevX: context.__lastX || offsetX,
      prevY: context.__lastY || offsetY,
      color: isEraser ? "#ffffff" : color,
      brushSize,
    });

    socket.emit("cursor-move", {
      roomId,
      id: socket.id,
      x: offsetX,
      y: offsetY,
      username,
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

  const toggleEraser = () => {
    setIsEraser(!isEraser);
  };

  return (
    <div className="canvas-container">
      <div className="canvas-controls">
        <SketchPicker
          color={color}
          onChangeComplete={(c) => setColor(c.hex)}
          disableAlpha
        />
        <button onClick={clearCanvas}>Clear</button>
        <button onClick={downloadCanvas}>Download</button>
        <button
          onClick={toggleEraser}
          className={isEraser ? "eraser-button active" : "eraser-button"}
        >
          {isEraser ? "Eraser On" : "Eraser Off"}
        </button>
        <div>
          <label>Brush Size:</label>
          <select
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
          >
            <option value={2}>Thin</option>
            <option value={5}>Medium</option>
            <option value={10}>Thick</option>
          </select>
        </div>
      </div>

      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
        />
        <UserCursors cursors={cursors} />
      </div>
    </div>
  );
}

export default CanvasBoard;
