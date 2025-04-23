import React, { useLayoutEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { useSocket } from '../context/SocketContext';

const Whiteboard = ({ roomId }) => {
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const socket = useSocket();
  const [activeShape, setActiveShape] = useState('brush');
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth * 0.75,
    height: window.innerHeight * 0.7
  });

  // Handle window resize
  useLayoutEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth * 0.75,
        height: window.innerHeight * 0.7
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize and manage canvas
  useLayoutEffect(() => {
    if (!canvasRef.current) return;

    // Clean up previous instance if it exists
    if (fabricRef.current) {
      fabricRef.current.dispose();
      fabricRef.current = null;
    }

    // Initialize canvas with current dimensions
    fabricRef.current = new fabric.Canvas(canvasRef.current, {
      width: dimensions.width,
      height: dimensions.height,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      selection: true,
      stateful: true
    });

    const canvas = fabricRef.current;

    // Debounce function to prevent too frequent updates
    let timeoutId = null;
    const emitCanvasState = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (socket && roomId) {
          const canvasState = JSON.stringify(canvas.toJSON([
            'selectable', 'hasControls', 'radius', 'startAngle', 'endAngle',
            'strokeUniform', 'strokeWidth', 'strokeLineCap', 'strokeLineJoin',
            'objectType', 'text', 'fontSize', 'fill', 'stroke'
          ]));
          socket.emit('whiteboard-draw', {
            roomId,
            canvasState
          });
        }
      }, 50); // Reduced debounce time for faster sync
    };

    // Handle all object modifications
    canvas.on('object:modified', emitCanvasState);
    canvas.on('object:added', emitCanvasState);
    canvas.on('object:removed', emitCanvasState);

    if (socket) {
      // Handle incoming drawing updates
      socket.on('whiteboard-draw', ({ canvasState }) => {
        if (canvasState) {
          try {
            const parsedState = JSON.parse(canvasState);
            canvas.loadFromJSON(parsedState, () => {
              canvas.getObjects().forEach(obj => {
                obj.setCoords();
                obj.selectable = true;
                obj.hasControls = true;
              });
              canvas.requestRenderAll();
            });
          } catch (error) {
            console.error('Error loading canvas state:', error);
          }
        }
      });

      // Handle clear board
      socket.on('whiteboard-clear', () => {
        canvas.clear();
        canvas.setBackgroundColor('#ffffff', canvas.requestRenderAll.bind(canvas));
      });

      // Request initial state
      socket.emit('get-whiteboard-state', { roomId });

      // Handle incoming state
      socket.on('whiteboard-state', ({ canvasState }) => {
        if (canvasState) {
          try {
            const parsedState = JSON.parse(canvasState);
            canvas.loadFromJSON(parsedState, () => {
              canvas.getObjects().forEach(obj => {
                obj.setCoords();
                obj.selectable = true;
                obj.hasControls = true;
              });
              canvas.requestRenderAll();
            });
          } catch (error) {
            console.error('Error loading initial canvas state:', error);
          }
        }
      });
    }

    canvas.setDimensions({
      width: dimensions.width,
      height: dimensions.height
    });
    canvas.requestRenderAll();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      canvas.off('object:modified', emitCanvasState);
      canvas.off('object:added', emitCanvasState);
      canvas.off('object:removed', emitCanvasState);
      if (socket) {
        socket.off('whiteboard-draw');
        socket.off('whiteboard-clear');
        socket.off('whiteboard-state');
      }
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [dimensions, roomId, socket]);

  const handleClear = () => {
    if (fabricRef.current) {
      fabricRef.current.clear();
      fabricRef.current.setBackgroundColor('#ffffff', fabricRef.current.renderAll.bind(fabricRef.current));
      socket?.emit('whiteboard-clear', { roomId });
    }
  };

  const handleColorChange = (color) => {
    if (fabricRef.current?.freeDrawingBrush) {
      fabricRef.current.freeDrawingBrush.color = color;
    }
  };

  const handleBrushSize = (size) => {
    if (fabricRef.current?.freeDrawingBrush) {
      fabricRef.current.freeDrawingBrush.width = parseInt(size);
    }
  };

  const addShape = (shapeType) => {
    if (!fabricRef.current) return;

    const canvas = fabricRef.current;
    let shape;

    switch (shapeType) {
      case 'array':
        // Create array cells
        const cellSize = 60;
        const arrayLength = 6;
        const startX = 100;
        const startY = 100;

        // Create array elements
        const elements = [];
        for (let i = 0; i < arrayLength; i++) {
          const rect = new fabric.Rect({
            left: i * cellSize,
            top: 0,
            width: cellSize,
            height: cellSize,
            fill: 'transparent',
            stroke: '#2196F3',
            strokeWidth: 2
          });

          const text = new fabric.Text(i.toString(), {
            left: i * cellSize + cellSize/3,
            top: cellSize/3,
            fontSize: 20,
            fill: '#000000'
          });

          elements.push(rect, text);
        }

        // Create group with all elements
        const arrayGroup = new fabric.Group(elements, {
          left: startX,
          top: startY,
          selectable: true,
          hasControls: true
        });

        canvas.add(arrayGroup);
        break;

      case 'tree':
        // Create a binary tree node
        const createNode = (left, top, text) => {
          const circle = new fabric.Circle({
            radius: 25,
            fill: 'transparent',
            stroke: '#4CAF50',
            strokeWidth: 2
          });

          const nodeText = new fabric.Text(text, {
            left: -10,
            top: -10,
            fontSize: 20,
            fill: '#000000'
          });

          // Create group for node
          const nodeGroup = new fabric.Group([circle, nodeText], {
            left: left,
            top: top,
            selectable: true,
            hasControls: true
          });

          canvas.add(nodeGroup);
          return { x: left + 25, y: top + 50 };
        };

        // Create a simple binary tree
        const rootPos = createNode(300, 50, '1');
        const leftPos = createNode(200, 150, '2');
        const rightPos = createNode(400, 150, '3');

        // Add connecting lines
        [leftPos, rightPos].forEach(pos => {
          const line = new fabric.Line([rootPos.x, rootPos.y, pos.x, pos.y - 25], {
            stroke: '#4CAF50',
            strokeWidth: 2,
            selectable: true
          });
          canvas.add(line);
        });
        break;

      case 'graph':
        // Create graph nodes with better interactivity
        const nodes = [
          { x: 300, y: 100, text: 'A' },
          { x: 200, y: 200, text: 'B' },
          { x: 400, y: 200, text: 'C' },
          { x: 300, y: 300, text: 'D' }
        ];

        const nodeGroups = nodes.map(node => {
          const circle = new fabric.Circle({
            radius: 25,
            fill: 'transparent',
            stroke: '#9C27B0',
            strokeWidth: 2
          });

          const text = new fabric.Text(node.text, {
            left: -10,
            top: -10,
            fontSize: 20,
            fill: '#000000'
          });

          // Create group for node
          const nodeGroup = new fabric.Group([circle, text], {
            left: node.x,
            top: node.y,
            selectable: true,
            hasControls: true
          });

          canvas.add(nodeGroup);
          return nodeGroup;
        });

        // Draw edges with better interactivity
        const edges = [
          [0, 1], [0, 2], [1, 3], [2, 3]
        ];

        edges.forEach(([from, to]) => {
          const line = new fabric.Line([
            nodeGroups[from].left + 25, nodeGroups[from].top + 25,
            nodeGroups[to].left + 25, nodeGroups[to].top + 25
          ], {
            stroke: '#9C27B0',
            strokeWidth: 2,
            selectable: true
          });
          canvas.add(line);
        });
        break;

      case 'pointer':
        // Create an arrow pointer
        const points = [0, 0, 50, 0, 40, -10, 50, 0, 40, 10];
        shape = new fabric.Polyline(points, {
          left: 100,
          top: 100,
          stroke: '#FF5722',
          strokeWidth: 2,
          fill: 'transparent',
          angle: 0,
          selectable: true,
          hasControls: true
        });
        canvas.add(shape);
        break;
    }

    canvas.renderAll();
    if (socket && roomId) {
      socket.emit('whiteboard-draw', {
        roomId,
        canvasState: canvas.toJSON()
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-t-lg">
        <div className="flex items-center gap-2">
          <button
            onClick={handleClear}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
          >
            Clear Board
          </button>
        </div>

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
            defaultValue="3"
            onChange={(e) => handleBrushSize(e.target.value)}
            className="w-32"
          />
        </div>

        <div className="border-l border-gray-300 dark:border-gray-600 h-8 mx-2" />

        <div className="flex items-center gap-2">
          <button
            onClick={() => addShape('array')}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            Add Array
          </button>
          <button
            onClick={() => addShape('tree')}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
          >
            Add Tree
          </button>
          <button
            onClick={() => addShape('graph')}
            className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors"
          >
            Add Graph
          </button>
          <button
            onClick={() => addShape('pointer')}
            className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors"
          >
            Add Pointer
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-white rounded-b-lg border-2 border-gray-300 dark:border-gray-600">
        <canvas ref={canvasRef} className="touch-none" />
      </div>
    </div>
  );
};

export default Whiteboard; 