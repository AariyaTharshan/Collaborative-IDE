import React from 'react';

const HelpPage = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const snippets = {
    javascript: [
      {
        trigger: 'cl',
        description: 'Console log statement',
        code: 'console.log(value);'
      },
      {
        trigger: 'fn',
        description: 'Function declaration',
        code: `function name(params) {
  // code here
}`
      },
      {
        trigger: 'afn',
        description: 'Arrow function',
        code: `const name = (params) => {
  // code here
}`
      },
      {
        trigger: 'map',
        description: 'Array map method',
        code: `array.map((item) => {
  return item;
});`
      },
      {
        trigger: 'filter',
        description: 'Array filter',
        code: `array.filter((item) => {
  return condition;
});`
      },
      {
        trigger: 'reduce',
        description: 'Array reduce',
        code: `array.reduce((acc, curr) => {
  return acc;
}, initialValue);`
      }
    ],
    python: [
      {
        trigger: 'def',
        description: 'Function definition',
        code: `def function_name(params):
    pass`
      },
      {
        trigger: 'class',
        description: 'Class definition',
        code: `class ClassName:
    def __init__(self):
        pass`
      },
      {
        trigger: 'for',
        description: 'For loop',
        code: `for i in range(n):
    # code here`
      },
      {
        trigger: 'while',
        description: 'While loop',
        code: `while condition:
    # code here`
      },
      {
        trigger: 'if',
        description: 'If statement',
        code: `if condition:
    # code here
elif condition:
    # code here
else:
    # code here`
      },
      {
        trigger: 'try',
        description: 'Try-except block',
        code: `try:
    # code here
except Exception as e:
    # handle error`
      }
    ],
    cpp: [
      {
        trigger: 'cp',
        description: 'Competitive programming template',
        code: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(0);
    cin.tie(0);
    // code here
    return 0;
}`,
      },
      {
        trigger: 'for',
        description: 'For loop',
        code: `for(int i = 0; i < n; i++) {
    // code here
}`
      },
      {
        trigger: 'vec',
        description: 'Vector declaration',
        code: 'vector<int> v;'
      },
      {
        trigger: 'pb',
        description: 'Push back to vector',
        code: 'v.push_back(value);'
      },
      {
        trigger: 'sort',
        description: 'Sort vector',
        code: 'sort(v.begin(), v.end());'
      },
      {
        trigger: 'binary',
        description: 'Binary search',
        code: `bool binary_search(vector<int>& arr, int target) {
    int left = 0, right = arr.size() - 1;
    while(left <= right) {
        int mid = left + (right - left) / 2;
        if(arr[mid] == target) return true;
        if(arr[mid] < target) left = mid + 1;
        else right = mid - 1;
    }
    return false;
}`
      }
    ],
    java: [
      {
        trigger: 'main',
        description: 'Main method',
        code: `public static void main(String[] args) {
    // code here
}`
      },
      {
        trigger: 'sout',
        description: 'Print to console',
        code: 'System.out.println(value);'
      },
      {
        trigger: 'class',
        description: 'Class definition',
        code: `public class ClassName {
    // code here
}`
      }
    ],
    general: [
      {
        trigger: 'for + Space',
        description: 'For loop template',
        code: `for (let i = 0; i < length; i++) {
    // code
}`
      },
      {
        trigger: 'array methods',
        description: 'Common array methods',
        code: '.map/filter/reduce/forEach/find/some/every'
      },
      {
        trigger: 'dfs',
        description: 'Depth First Search',
        code: `void dfs(int node, vector<bool>& visited) {
    visited[node] = true;
    for(int next : graph[node]) {
        if(!visited[next]) {
            dfs(next, visited);
        }
    }
}`
      },
      {
        trigger: 'bfs',
        description: 'Breadth First Search',
        code: `void bfs(int start) {
    queue<int> q;
    vector<bool> visited(n, false);
    q.push(start);
    visited[start] = true;
    
    while(!q.empty()) {
        int node = q.front();
        q.pop();
        for(int next : graph[node]) {
            if(!visited[next]) {
                visited[next] = true;
                q.push(next);
            }
        }
    }
}`
      }
    ]
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-[#282828] w-11/12 max-w-4xl max-h-[90vh] rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Code Snippets Guide</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-4rem)]">
          <div className="space-y-8">
            {Object.entries(snippets).map(([language, languageSnippets]) => (
              <div key={language} className="space-y-4">
                <h3 className="text-xl font-semibold text-[#FFA116] capitalize">
                  {language} Snippets
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {languageSnippets.map((snippet, index) => (
                    <div
                      key={index}
                      className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm px-2 py-1 bg-[#FFA116] text-white rounded">
                          {snippet.trigger}
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {snippet.description}
                        </span>
                      </div>
                      <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md overflow-x-auto text-sm font-mono text-gray-800 dark:text-gray-200">
                        {snippet.code}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Keyboard Shortcuts */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-[#FFA116]">
                Keyboard Shortcuts
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <li className="flex justify-between">
                      <span>Trigger suggestions</span>
                      <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">Ctrl + Space</kbd>
                    </li>
                    <li className="flex justify-between">
                      <span>Format document</span>
                      <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">Shift + Alt + F</kbd>
                    </li>
                    <li className="flex justify-between">
                      <span>Quick command</span>
                      <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">F1</kbd>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpPage; 