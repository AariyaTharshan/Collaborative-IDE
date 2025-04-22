import React, { useEffect, useRef } from 'react';
import { fabric } from 'fabric';
import { useSocket } from '../context/SocketContext';

const Whiteboard = ({ roomId }) => {
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const socket = useSocket();

  useEffect(() => {
    // Initialize canvas
    fabricRef.current = new fabric.Canvas(canvasRef.current, {
      isDrawingMode: true,
      width: window.innerWidth * 0.75,
      height: window.innerHeight * 0.7,
      backgroundColor: '#ffffff'
    });

    const canvas = fabricRef.current;

    // Set up drawing brush
    canvas.freeDrawingBrush.width = 2;
    canvas.freeDrawingBrush.color = '#000000';

    // Handle window resize
    const handleResize = () => {
      canvas.setWidth(window.innerWidth * 0.75);
      canvas.setHeight(window.innerHeight * 0.7);
      canvas.renderAll();
    };

    window.addEventListener('resize', handleResize);

    // Socket event handlers
    const handlePathCreated = (options) => {
      socket?.emit('whiteboard-draw', {
        roomId,
        path: options.path.toJSON()
      });
    };

    canvas.on('path:created', handlePathCreated);

    socket?.on('whiteboard-draw', ({ path }) => {
      fabric.util.enlivenObjects([path], (objects) => {
        objects.forEach(obj => {
          canvas.add(obj);
          canvas.renderAll();
        });
      });
    });

    socket?.on('whiteboard-clear', () => {
      canvas.clear();
      canvas.setBackgroundColor('#ffffff', canvas.renderAll.bind(canvas));
    });

    // Load existing whiteboard state
    socket?.emit('get-whiteboard-state', { roomId });

    socket?.on('whiteboard-state', ({ objects }) => {
      if (objects && objects.length > 0) {
        fabric.util.enlivenObjects(objects, (enlivenedObjects) => {
          enlivenedObjects.forEach(obj => {
            canvas.add(obj);
          });
          canvas.renderAll();
        });
      }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.off('path:created', handlePathCreated);
      socket?.off('whiteboard-draw');
      socket?.off('whiteboard-clear');
      socket?.off('whiteboard-state');
      canvas.dispose();
    };
  }, [roomId, socket]);

  const handleClear = () => {
    if (fabricRef.current) {
      fabricRef.current.clear();
      fabricRef.current.setBackgroundColor('#ffffff', fabricRef.current.renderAll.bind(fabricRef.current));
      socket?.emit('whiteboard-clear', { roomId });
    }
  };

  const handleColorChange = (color) => {
    if (fabricRef.current) {
      fabricRef.current.freeDrawingBrush.color = color;
    }
  };

  const handleBrushSize = (size) => {
    if (fabricRef.current) {
      fabricRef.current.freeDrawingBrush.width = parseInt(size);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-t-lg">
        <button
          onClick={handleClear}
          className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
        >
          Clear Board
        </button>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-300">Color:</label>
          <input
            type="color"
            onChange={(e) => handleColorChange(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-300">Brush Size:</label>
          <input
            type="range"
            min="1"
            max="20"
            defaultValue="2"
            onChange={(e) => handleBrushSize(e.target.value)}
            className="w-32"
          />
        </div>
      </div>
      <div className="flex-1 overflow-hidden bg-white rounded-b-lg">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
};

export default Whiteboard; 