import React, { useEffect, useState } from 'react';
import { useMonaco } from '@monaco-editor/react';

const SNIPPETS = {
  javascript: [
    {
      trigger: 'cl',
      description: 'Console log statement',
      code: 'console.log(${1:value});'
    },
    {
      trigger: 'fn',
      description: 'Function declaration',
      code: 'function ${1:name}(${2:params}) {\n  ${3:// code here}\n}'
    },
    {
      trigger: 'afn',
      description: 'Arrow function',
      code: 'const ${1:name} = (${2:params}) => {\n  ${3:// code here}\n}'
    },
    {
      trigger: 'map',
      description: 'Array map method',
      code: 'array.map((${1:item}) => {\n  return ${2:item};\n});'
    },
    {
      trigger: 'filter',
      description: 'Array filter',
      code: 'array.filter((${1:item}) => {\n  return ${2:condition};\n});'
    },
    {
      trigger: 'reduce',
      description: 'Array reduce',
      code: 'array.reduce((${1:acc}, ${2:curr}) => {\n  return ${3:acc};\n}, ${4:initialValue});'
    }
  ],
  python: [
    {
      trigger: 'def',
      description: 'Function definition',
      code: 'def ${1:function_name}(${2:params}):\n    ${3:pass}'
    },
    {
      trigger: 'class',
      description: 'Class definition',
      code: 'class ${1:ClassName}:\n    def __init__(self${2:, params}):\n        ${3:pass}'
    },
    {
      trigger: 'for',
      description: 'For loop',
      code: 'for ${1:i} in range(${2:n}):\n    ${3:# code here}'
    },
    {
      trigger: 'while',
      description: 'While loop',
      code: 'while ${1:condition}:\n    ${2:# code here}'
    },
    {
      trigger: 'if',
      description: 'If statement',
      code: 'if ${1:condition}:\n    ${2:# code here}\nelif ${3:condition}:\n    ${4:# code here}\nelse:\n    ${5:# code here}'
    },
    {
      trigger: 'try',
      description: 'Try-except block',
      code: 'try:\n    ${1:# code here}\nexcept ${2:Exception} as ${3:e}:\n    ${4:# handle error}'
    }
  ],
  cpp: [
    {
      trigger: 'cp',
      description: 'Competitive programming template',
      code: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(0);\n    cin.tie(0);\n    ${1:// code here}\n    return 0;\n}'
    },
    {
      trigger: 'for',
      description: 'For loop',
      code: 'for(int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${3:// code here}\n}'
    },
    {
      trigger: 'vec',
      description: 'Vector declaration',
      code: 'vector<${1:int}> ${2:v};'
    },
    {
      trigger: 'pb',
      description: 'Push back to vector',
      code: '${1:v}.push_back(${2:value});'
    },
    {
      trigger: 'sort',
      description: 'Sort vector',
      code: 'sort(${1:v}.begin(), ${1:v}.end());'
    },
    {
      trigger: 'binary',
      description: 'Binary search',
      code: 'bool binary_search(vector<int>& ${1:arr}, int ${2:target}) {\n    int left = 0, right = ${1:arr}.size() - 1;\n    while(left <= right) {\n        int mid = left + (right - left) / 2;\n        if(${1:arr}[mid] == ${2:target}) return true;\n        if(${1:arr}[mid] < ${2:target}) left = mid + 1;\n        else right = mid - 1;\n    }\n    return false;\n}'
    }
  ],
  java: [
    {
      trigger: 'main',
      description: 'Main method',
      code: 'public static void main(String[] args) {\n    ${1:// code here}\n}'
    },
    {
      trigger: 'sout',
      description: 'Print to console',
      code: 'System.out.println(${1:value});'
    },
    {
      trigger: 'class',
      description: 'Class definition',
      code: 'public class ${1:ClassName} {\n    ${2:// code here}\n}'
    }
  ],
  c: [
    {
      trigger: 'main',
      description: 'C main function',
      code: '#include <stdio.h>\n\nint main() {\n    // Your code here\n    return 0;\n}'
    },
    {
      trigger: 'printf',
      description: 'Print to console',
      code: 'printf("%s\\n", ${1:value});'
    },
    {
      trigger: 'for',
      description: 'For loop',
      code: 'for(int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${3:// code here}\n}'
    },
    {
      trigger: 'll',
      description: 'Singly Linked List Node',
      code: 'struct Node {\n    int data;\n    struct Node* next;\n};'
    },
    {
      trigger: 'fileio',
      description: 'File I/O',
      code: 'FILE *fptr = fopen("file.txt", "w");\nif (fptr) {\n    fprintf(fptr, "Hello, file!\\n");\n    fclose(fptr);\n}'
    },
    {
      trigger: 'bubble',
      description: 'Bubble Sort',
      code: 'void bubbleSort(int arr[], int n) {\n    for (int i = 0; i < n-1; i++) {\n        for (int j = 0; j < n-i-1; j++) {\n            if (arr[j] > arr[j+1]) {\n                int temp = arr[j];\n                arr[j] = arr[j+1];\n                arr[j+1] = temp;\n            }\n        }\n    }\n}'
    }
  ]
};

const HelpPage = ({ isOpen, onClose }) => {
  const monaco = useMonaco();
  const [registeredSnippets, setRegisteredSnippets] = useState(false);

  useEffect(() => {
    if (!monaco || registeredSnippets) return;

    // Register snippets for each language
    Object.entries(SNIPPETS).forEach(([language, languageSnippets]) => {
      monaco.languages.registerCompletionItemProvider(language, {
        provideCompletionItems: () => {
          return {
            suggestions: languageSnippets.map(snippet => ({
              label: snippet.trigger,
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: snippet.code,
              documentation: snippet.description,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            }))
          };
        },
        triggerCharacters: ['.', ' ']
      });
    });

    setRegisteredSnippets(true);
  }, [monaco, registeredSnippets]);

  if (!isOpen) return null;

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
            {Object.entries(SNIPPETS).map(([language, languageSnippets]) => (
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

            {/* DSA Concepts Section */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-[#FFA116]">
                Basic DSA Concepts
              </h3>
              <ul className="list-disc pl-6 text-gray-800 dark:text-gray-200">
                <li><b>Array:</b> A collection of elements stored at contiguous memory locations. Supports random access.</li>
                <li><b>Linked List:</b> A linear data structure where each element points to the next. Good for insertions/deletions.</li>
                <li><b>Stack:</b> LIFO (Last-In, First-Out) structure. Supports push and pop operations.</li>
                <li><b>Queue:</b> FIFO (First-In, First-Out) structure. Supports enqueue and dequeue operations.</li>
                <li><b>Tree:</b> Hierarchical structure with nodes. Binary trees, BSTs, and heaps are common types.</li>
                <li><b>Graph:</b> Set of nodes (vertices) connected by edges. Can be directed/undirected, weighted/unweighted.</li>
                <li><b>Hash Table:</b> Stores key-value pairs for fast lookup, insertion, and deletion.</li>
                <li><b>Recursion:</b> A function calling itself to solve subproblems.</li>
                <li><b>Dynamic Programming:</b> Solving problems by combining solutions to subproblems, often using memoization.</li>
                <li><b>Greedy Algorithm:</b> Makes the locally optimal choice at each step, hoping for a global optimum.</li>
                <li><b>Binary Search:</b> Efficiently finds an element in a sorted array by repeatedly dividing the search interval in half.</li>
              </ul>
            </div>

            {/* Striver's Sheet Section */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-[#FFA116]">
                Striver's Sheet (Sample)
              </h3>
              <ul className="list-disc pl-6 text-gray-800 dark:text-gray-200">
                <li><b>Set Matrix Zeroes:</b> Given an m x n integer matrix, if an element is 0, set its entire row and column to 0.</li>
                <li><b>Pascal's Triangle:</b> Given an integer numRows, return the first numRows of Pascal's triangle.</li>
                <li><b>Next Permutation:</b> Rearrange numbers into the lexicographically next greater permutation.</li>
                <li><b>Sort Colors:</b> Sort an array with n objects colored red, white, or blue in-place.</li>
                <li><b>Stock Buy and Sell:</b> Find the maximum profit from a single buy and sell of stock.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpPage; 