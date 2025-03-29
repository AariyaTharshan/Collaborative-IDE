import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Templates = ({ language, onSelectTemplate }) => {
  const [templates, setTemplates] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/templates/${language}`);
        setTemplates(response.data);
      } catch (error) {
        console.error('Error fetching templates:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [language]);

  if (loading) {
    return <div className="text-center">Loading templates...</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Templates</h3>
      <div className="grid grid-cols-1 gap-4">
        {Object.entries(templates).map(([name, code]) => (
          <button
            key={name}
            onClick={() => onSelectTemplate(code)}
            className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
          >
            <div className="font-medium text-gray-900 dark:text-white">{name}</div>
            <pre className="mt-2 text-sm text-gray-600 dark:text-gray-400 overflow-hidden">
              {code.slice(0, 100)}...
            </pre>
          </button>
        ))}
      </div>
    </div>
  );
};

export default Templates; 