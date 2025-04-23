import React, { useLayoutEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { useSocket } from '../context/SocketContext';

const Whiteboard = ({ roomId }) => {
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const socket = useSocket();
  const [activeTool, setActiveTool] = useState('brush');
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
      isDrawingMode: true,
      width: dimensions.width,
      height: dimensions.height,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      selection: true,
      stateful: true,
      perPixelTargetFind: true,
      targetFindTolerance: 5
    });

    const canvas = fabricRef.current;

    // Set up drawing brush with better visibility
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.width = 3;
    canvas.freeDrawingBrush.color = '#000000';
    canvas.freeDrawingBrush.strokeLineCap = 'round';
    canvas.freeDrawingBrush.strokeLineJoin = 'round';

    // Debounce function to prevent too frequent updates
    let timeoutId = null;
    const emitCanvasState = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (socket && roomId) {
          const canvasState = JSON.stringify(canvas.toJSON([
            'selectable', 'hasControls', 'radius', 'startAngle', 'endAngle',
            'strokeUniform', 'strokeWidth', 'strokeLineCap', 'strokeLineJoin',
            'objectType', 'text', 'fontSize', 'fill', 'stroke', 'path'
          ]));
          socket.emit('whiteboard-draw', {
            roomId,
            canvasState
          });
        }
      }, 50);
    };

    // Handle all object modifications
    const handleModification = () => {
      canvas.getObjects().forEach(obj => {
        obj.setCoords();
        obj.selectable = true;
        obj.hasControls = true;
      });
      emitCanvasState();
    };

    canvas.on('object:modified', handleModification);
    canvas.on('path:created', handleModification);
    canvas.on('object:added', handleModification);
    canvas.on('object:removed', handleModification);
    canvas.on('object:moving', (e) => {
      const obj = e.target;
      obj.setCoords();
    });

    if (socket) {
      // Handle incoming drawing updates
      socket.on('whiteboard-draw', ({ canvasState }) => {
        if (canvasState) {
          try {
            const parsedState = JSON.parse(canvasState);
            canvas.loadFromJSON(parsedState, () => {
              canvas.getObjects().forEach(obj => {
                obj.setCoords();
                if (obj.type !== 'path') {
                  obj.selectable = true;
                  obj.hasControls = true;
                }
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
        canvas.setBackgroundColor('#ffffff', () => {
          canvas.requestRenderAll();
        });
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
                if (obj.type !== 'path') {
                  obj.selectable = true;
                  obj.hasControls = true;
                }
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
      canvas.off('object:modified', handleModification);
      canvas.off('path:created', handleModification);
      canvas.off('object:added', handleModification);
      canvas.off('object:removed', handleModification);
      canvas.off('object:moving');
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

  const handleToolChange = (tool) => {
    setActiveTool(tool);
    if (fabricRef.current) {
      fabricRef.current.isDrawingMode = tool === 'brush';
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

    canvas.requestRenderAll();
    emitCanvasState();
  };

  const drawBFS = () => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    canvas.clear();

    // Create BFS visualization with level-wise traversal
    const nodes = [
      { x: 300, y: 100, text: 'A', order: '1' },
      { x: 200, y: 200, text: 'B', order: '2' },
      { x: 400, y: 200, text: 'C', order: '3' },
      { x: 100, y: 300, text: 'D', order: '4' },
      { x: 300, y: 300, text: 'E', order: '5' },
      { x: 500, y: 300, text: 'F', order: '6' }
    ];

    // Draw nodes with order numbers
    nodes.forEach(node => {
      const circle = new fabric.Circle({
        radius: 25,
        fill: 'transparent',
        stroke: '#2196F3',
        strokeWidth: 2,
        left: node.x,
        top: node.y
      });

      const nodeText = new fabric.Text(node.text, {
        left: node.x - 10,
        top: node.y - 10,
        fontSize: 20,
        fill: '#000000'
      });

      const orderText = new fabric.Text(node.order, {
        left: node.x + 15,
        top: node.y - 25,
        fontSize: 16,
        fill: '#2196F3',
        fontWeight: 'bold'
      });

      canvas.add(circle, nodeText, orderText);
    });

    // Draw edges with arrows showing BFS flow
    const edges = [
      [0, 1], [0, 2], [1, 3], [1, 4], [2, 4], [2, 5]
    ];

    edges.forEach(([from, to]) => {
      // Create arrow line
      const fromNode = nodes[from];
      const toNode = nodes[to];
      
      // Calculate arrow points
      const dx = toNode.x - fromNode.x;
      const dy = toNode.y - fromNode.y;
      const angle = Math.atan2(dy, dx);
      
      // Adjust start and end points to be on circle edge
      const startX = fromNode.x + 25 * Math.cos(angle);
      const startY = fromNode.y + 25 * Math.sin(angle);
      const endX = toNode.x - 25 * Math.cos(angle);
      const endY = toNode.y - 25 * Math.sin(angle);

      // Draw arrow line
      const line = new fabric.Line([startX, startY, endX, endY], {
        stroke: '#2196F3',
        strokeWidth: 2
      });

      // Add arrowhead
      const arrowSize = 10;
      const arrowAngle = Math.PI / 6;
      const arrow = new fabric.Triangle({
        left: endX - arrowSize * Math.cos(angle - Math.PI),
        top: endY - arrowSize * Math.sin(angle - Math.PI),
        angle: (angle * 180) / Math.PI,
        width: arrowSize * 2,
        height: arrowSize,
        fill: '#2196F3',
        selectable: false
      });

      canvas.add(line, arrow);
    });

    // Add BFS explanation with level indicators
    const explanation = new fabric.Text('BFS Traversal:\nLevel 0: A\nLevel 1: B → C\nLevel 2: D → E → F\n\nBFS visits all nodes at current level\nbefore moving to next level', {
      left: 600,
      top: 150,
      fontSize: 16,
      fill: '#000000',
      lineHeight: 1.5
    });

    // Add background rectangle for explanation
    const bfsExplanationBg = new fabric.Rect({
      left: 590,
      top: 140,
      width: 300,
      height: 160,
      fill: '#f8f9fa',
      stroke: '#2196F3',
      strokeWidth: 1,
      rx: 5,
      ry: 5
    });

    canvas.add(bfsExplanationBg, explanation);

    canvas.requestRenderAll();
    emitCanvasState();
  };

  const drawDFS = () => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    canvas.clear();

    // Create DFS visualization with depth-first order
    const nodes = [
      { x: 300, y: 100, text: 'A', order: '1' },
      { x: 200, y: 200, text: 'B', order: '2' },
      { x: 400, y: 200, text: 'C', order: '5' },
      { x: 100, y: 300, text: 'D', order: '3' },
      { x: 300, y: 300, text: 'E', order: '4' },
      { x: 500, y: 300, text: 'F', order: '6' }
    ];

    // Draw nodes with order numbers
    nodes.forEach(node => {
      const circle = new fabric.Circle({
        radius: 25,
        fill: 'transparent',
        stroke: '#4CAF50',
        strokeWidth: 2,
        left: node.x,
        top: node.y
      });

      const nodeText = new fabric.Text(node.text, {
        left: node.x - 10,
        top: node.y - 10,
        fontSize: 20,
        fill: '#000000'
      });

      const orderText = new fabric.Text(node.order, {
        left: node.x + 15,
        top: node.y - 25,
        fontSize: 16,
        fill: '#4CAF50',
        fontWeight: 'bold'
      });

      canvas.add(circle, nodeText, orderText);
    });

    // Draw edges with arrows showing DFS flow
    const dfsPath = [
      [0, 1], [1, 3], [3, 4], [0, 2], [2, 5]  // Edges in DFS order
    ];

    let delay = 0;
    dfsPath.forEach(([from, to], index) => {
      // Create arrow line
      const fromNode = nodes[from];
      const toNode = nodes[to];
      
      // Calculate arrow points
      const dx = toNode.x - fromNode.x;
      const dy = toNode.y - fromNode.y;
      const angle = Math.atan2(dy, dx);
      
      // Adjust start and end points to be on circle edge
      const startX = fromNode.x + 25 * Math.cos(angle);
      const startY = fromNode.y + 25 * Math.sin(angle);
      const endX = toNode.x - 25 * Math.cos(angle);
      const endY = toNode.y - 25 * Math.sin(angle);

      // Draw arrow line with sequence number
      const line = new fabric.Line([startX, startY, endX, endY], {
        stroke: '#4CAF50',
        strokeWidth: 2
      });

      // Add arrowhead
      const arrowSize = 10;
      const arrow = new fabric.Triangle({
        left: endX - arrowSize * Math.cos(angle - Math.PI),
        top: endY - arrowSize * Math.sin(angle - Math.PI),
        angle: (angle * 180) / Math.PI,
        width: arrowSize * 2,
        height: arrowSize,
        fill: '#4CAF50',
        selectable: false
      });

      // Add sequence number near arrow
      const seqText = new fabric.Text((index + 1).toString(), {
        left: (startX + endX) / 2 - 10,
        top: (startY + endY) / 2 - 10,
        fontSize: 14,
        fill: '#4CAF50',
        backgroundColor: '#ffffff',
        fontWeight: 'bold'
      });

      canvas.add(line, arrow, seqText);
    });

    // Add DFS explanation with path sequence
    const explanation = new fabric.Text('DFS Traversal:\nPath: A → B → D → E → C → F\n\nDFS explores as far as possible\nalong each branch before backtracking\n\nNumbers on arrows show traversal sequence', {
      left: 600,
      top: 150,
      fontSize: 16,
      fill: '#000000',
      lineHeight: 1.5
    });

    // Add background rectangle for explanation
    const dfsExplanationBg = new fabric.Rect({
      left: 590,
      top: 140,
      width: 300,
      height: 160,
      fill: '#f8f9fa',
      stroke: '#4CAF50',
      strokeWidth: 1,
      rx: 5,
      ry: 5
    });

    canvas.add(dfsExplanationBg, explanation);

    canvas.requestRenderAll();
    emitCanvasState();
  };

  const drawDP = () => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    canvas.clear();

    // Create DP visualization (Fibonacci)
    const nodes = [
      { x: 300, y: 100, text: 'F(5)' },
      { x: 200, y: 200, text: 'F(4)' },
      { x: 400, y: 200, text: 'F(3)' },
      { x: 150, y: 300, text: 'F(3)' },
      { x: 250, y: 300, text: 'F(2)' },
      { x: 350, y: 300, text: 'F(2)' },
      { x: 450, y: 300, text: 'F(1)' }
    ];

    // Draw nodes
    nodes.forEach(node => {
      const rect = new fabric.Rect({
        width: 60,
        height: 40,
        fill: 'transparent',
        stroke: '#9C27B0',
        strokeWidth: 2,
        left: node.x - 30,
        top: node.y - 20
      });

      const text = new fabric.Text(node.text, {
        left: node.x - 20,
        top: node.y - 10,
        fontSize: 16,
        fill: '#000000'
      });

      canvas.add(rect, text);
    });

    // Draw edges
    const edges = [
      [0, 1], [0, 2], [1, 3], [1, 4], [2, 4], [2, 5], [2, 6]
    ];

    edges.forEach(([from, to]) => {
      const line = new fabric.Line([
        nodes[from].x, nodes[from].y + 20,
        nodes[to].x, nodes[to].y - 20
      ], {
        stroke: '#9C27B0',
        strokeWidth: 2
      });
      canvas.add(line);
    });

    // Add DP explanation
    const explanation = new fabric.Text('Dynamic Programming: Fibonacci\nMemoization of subproblems to avoid redundant calculations', {
      left: 50,
      top: 400,
      fontSize: 16,
      fill: '#000000'
    });
    canvas.add(explanation);

    canvas.requestRenderAll();
    emitCanvasState();
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
          <button
            onClick={() => handleToolChange('brush')}
            className={`px-4 py-2 rounded-md transition-colors ${
              activeTool === 'brush' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            Brush
          </button>
          <button
            onClick={() => handleToolChange('select')}
            className={`px-4 py-2 rounded-md transition-colors ${
              activeTool === 'select' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            Select
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

        <div className="border-l border-gray-300 dark:border-gray-600 h-8 mx-2" />

        <div className="flex items-center gap-2">
          <button
            onClick={drawBFS}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            BFS
          </button>
          <button
            onClick={drawDFS}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
          >
            DFS
          </button>
          <button
            onClick={drawDP}
            className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors"
          >
            DP
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