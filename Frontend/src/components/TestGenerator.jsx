import React, { useState } from 'react';
import axios from 'axios';

const TestGenerator = ({ onGenerateTest }) => {
  const [type, setType] = useState('array');
  const [params, setParams] = useState({
    size: 10,
    maxValue: 100,
    length: 10,
    nodes: 7
  });

  const handleGenerate = async () => {
    try {
      const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/generate-tests`, {
        type,
        params
      });
      onGenerateTest(response.data.testCases);
    } catch (error) {
      console.error('Error generating test cases:', error);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Test Case Generator</h3>
      <div className="space-y-4">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
        >
          <option value="array">Array</option>
          <option value="string">String</option>
          <option value="tree">Binary Tree</option>
        </select>

        {type === 'array' && (
          <>
            <input
              type="number"
              value={params.size}
              onChange={(e) => setParams({ ...params, size: parseInt(e.target.value) })}
              placeholder="Array size"
              className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            />
            <input
              type="number"
              value={params.maxValue}
              onChange={(e) => setParams({ ...params, maxValue: parseInt(e.target.value) })}
              placeholder="Max value"
              className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            />
          </>
        )}

        <button
          onClick={handleGenerate}
          className="w-full py-2 bg-[#FFA116] text-white rounded-lg hover:bg-[#FF9100] transition-colors"
        >
          Generate Test Case
        </button>
      </div>
    </div>
  );
};

export default TestGenerator; 