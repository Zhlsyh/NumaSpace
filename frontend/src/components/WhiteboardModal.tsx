import React, { useRef, useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { X, Eraser, Trash2, Paintbrush, Download } from 'lucide-react';
import { WhiteboardDrawPoint } from '../types';

interface WhiteboardModalProps {
  socket: Socket | null;
  roomId: string;
  onClose: () => void;
}

export const WhiteboardModal: React.FC<WhiteboardModalProps> = ({
  socket,
  roomId,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [color, setColor] = useState<string>('#4f46e5');
  const [size, setSize] = useState<number>(4);
  const [isEraser, setIsEraser] = useState<boolean>(false);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);

  const colors = [
    '#4f46e5', // Indigo
    '#ef4444', // Red
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#8b5cf6', // Purple
    '#09090b', // Dark
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas dimensions
    canvas.width = 800;
    canvas.height = 500;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    if (socket) {
      socket.on('whiteboard_draw', (data: WhiteboardDrawPoint) => {
        if (data.clearAll) {
          clearCanvasLocal();
          return;
        }
        drawFromData(data);
      });
    }

    return () => {
      if (socket) {
        socket.off('whiteboard_draw');
      }
    };
  }, [socket]);

  const drawFromData = (data: WhiteboardDrawPoint) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.size;

    if (!data.isDrawing) {
      ctx.beginPath();
      ctx.moveTo(data.x, data.y);
    } else {
      ctx.lineTo(data.x, data.y);
      ctx.stroke();
    }
  };

  const clearCanvasLocal = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleClearAll = () => {
    clearCanvasLocal();
    socket?.emit('whiteboard_draw', {
      roomId,
      drawData: { x: 0, y: 0, color: '#ffffff', size: 1, isDrawing: false, clearAll: true },
    });
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const getTouchCanvasCoords = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !e.touches[0]) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const coords = getCanvasCoords(e);
    const drawColor = isEraser ? '#ffffff' : color;
    const drawSize = isEraser ? size * 4 : size;

    const data: WhiteboardDrawPoint = {
      x: coords.x,
      y: coords.y,
      color: drawColor,
      size: drawSize,
      isDrawing: false,
    };

    drawFromData(data);
    socket?.emit('whiteboard_draw', { roomId, drawData: data });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const coords = getCanvasCoords(e);
    const drawColor = isEraser ? '#ffffff' : color;
    const drawSize = isEraser ? size * 4 : size;

    const data: WhiteboardDrawPoint = {
      x: coords.x,
      y: coords.y,
      color: drawColor,
      size: drawSize,
      isDrawing: true,
    };

    drawFromData(data);
    socket?.emit('whiteboard_draw', { roomId, drawData: data });
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const coords = getTouchCanvasCoords(e);
    const drawColor = isEraser ? '#ffffff' : color;
    const drawSize = isEraser ? size * 4 : size;

    const data: WhiteboardDrawPoint = {
      x: coords.x,
      y: coords.y,
      color: drawColor,
      size: drawSize,
      isDrawing: false,
    };

    drawFromData(data);
    socket?.emit('whiteboard_draw', { roomId, drawData: data });
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const coords = getTouchCanvasCoords(e);
    const drawColor = isEraser ? '#ffffff' : color;
    const drawSize = isEraser ? size * 4 : size;

    const data: WhiteboardDrawPoint = {
      x: coords.x,
      y: coords.y,
      color: drawColor,
      size: drawSize,
      isDrawing: true,
    };

    drawFromData(data);
    socket?.emit('whiteboard_draw', { roomId, drawData: data });
  };

  const handleTouchEnd = () => {
    setIsDrawing(false);
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const image = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = image;
    link.download = `NumaSpace_Whiteboard_${Date.now()}.png`;

    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border-2 sm:border-4 border-indigo-500/30 w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 bg-indigo-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Paintbrush className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
            <h2 className="text-sm sm:text-lg font-black tracking-wide truncate">Papan Tulis Digital (Whiteboard)</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 sm:p-1.5 rounded-full hover:bg-indigo-800 text-indigo-200 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tools Toolbar */}
        <div className="p-2 sm:p-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 overflow-x-auto shrink-0">
          <div className="flex items-center gap-2">
            {/* Color Selectors */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setColor(c);
                    setIsEraser(false);
                  }}
                  className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full transition-transform cursor-pointer ${
                    color === c && !isEraser ? 'scale-125 ring-2 ring-indigo-500' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            {/* Eraser */}
            <button
              type="button"
              onClick={() => setIsEraser(!isEraser)}
              className={`p-1.5 sm:p-2 rounded-2xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                isEraser
                  ? 'bg-amber-400 text-indigo-950 font-black shadow'
                  : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Eraser className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Penghapus</span>
            </button>

            {/* Size Slider */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-2xl border border-slate-200">
              <span className="text-[11px] sm:text-xs font-bold text-slate-600">Size:</span>
              <input
                type="range"
                min="2"
                max="20"
                value={size}
                onChange={(e) => setSize(parseInt(e.target.value))}
                className="w-14 sm:w-20 accent-indigo-600 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClearAll}
              className="px-2.5 sm:px-3 py-1.5 rounded-2xl bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Bersihkan</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="px-3 sm:px-3.5 py-1.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 shadow-md transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Simpan</span>
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="p-2 sm:p-4 bg-slate-900 flex-1 min-h-0 flex items-center justify-center overflow-hidden">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="bg-white rounded-xl sm:rounded-2xl shadow-inner cursor-crosshair max-w-full max-h-full object-contain touch-none"
          />
        </div>
      </div>
    </div>
  );
};
