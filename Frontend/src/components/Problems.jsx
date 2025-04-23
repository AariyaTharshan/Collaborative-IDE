import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Problems = ({ onSelectProblem, onClose }) => {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [difficulty, setDifficulty] = useState('all');
  const [topic, setTopic] = useState('all');

  // Define Striver Sheet topics
  const topics = [
    'Arrays',
    'Arrays II',
    'Arrays III',
    'Arrays IV',
    'Linked List',
    'Linked List II',
    'Two Pointers',
    'Greedy',
    'Recursion',
    'Recursion and Backtracking',
    'Binary Search',
    'Heaps',
    'Stack and Queue',
    'String',
    'String II',
    'Binary Tree',
    'Binary Tree II',
    'Binary Tree III',
    'Binary Search Tree',
    'Binary Search Tree II',
    'Graph',
    'Graph II',
    'Dynamic Programming',
    'Dynamic Programming II',
    'Trie',
    'Operating System',
    'DBMS',
    'System Design'
  ];

  // Striver's SDE Sheet problems
  const striverProblems = [
    // Arrays
    {
      id: 1,
      title: "Set Matrix Zeros",
      difficulty: "Medium",
      topics: ["Arrays"],
      description: "Given a matrix if an element in the matrix is 0 then you will have to set its entire column and row to 0 and then return the matrix.",
      url: "https://takeuforward.org/data-structure/set-matrix-zero/"
    },
    {
      id: 2,
      title: "Pascal's Triangle",
      difficulty: "Easy",
      topics: ["Arrays"],
      description: "Given an integer N, return the first N rows of Pascal's triangle.",
      url: "https://takeuforward.org/data-structure/program-to-generate-pascals-triangle/"
    },
    {
      id: 3,
      title: "Next Permutation",
      difficulty: "Medium",
      topics: ["Arrays"],
      description: "Implement next permutation, which rearranges numbers into the lexicographically next greater permutation of numbers.",
      url: "https://takeuforward.org/data-structure/next_permutation-find-next-lexicographically-greater-permutation/"
    },
    {
      id: 4,
      title: "Maximum Subarray Sum",
      difficulty: "Medium",
      topics: ["Arrays"],
      description: "Given an integer array nums, find the contiguous subarray with the largest sum, and return its sum.",
      url: "https://takeuforward.org/data-structure/kadanes-algorithm-maximum-subarray-sum-in-an-array/"
    },
    {
      id: 5,
      title: "Sort an array of 0's 1's & 2's",
      difficulty: "Medium",
      topics: ["Arrays"],
      description: "Given an array consisting of only 0s, 1s, and 2s. Write a program to in-place sort the array.",
      url: "https://takeuforward.org/data-structure/sort-an-array-of-0s-1s-and-2s/"
    },
    {
      id: 6,
      title: "Stock Buy and Sell",
      difficulty: "Medium",
      topics: ["Arrays"],
      description: "Find the maximum profit you can achieve by buying and selling stocks.",
      url: "https://takeuforward.org/data-structure/stock-buy-and-sell/"
    },
    // Arrays II
    {
      id: 7,
      title: "Rotate Matrix",
      difficulty: "Medium",
      topics: ["Arrays II"],
      description: "Given a matrix, rotate the matrix by 90 degrees clockwise.",
      url: "https://takeuforward.org/data-structure/rotate-image-by-90-degree/"
    },
    {
      id: 8,
      title: "Merge Overlapping Intervals",
      difficulty: "Medium",
      topics: ["Arrays II"],
      description: "Given an array of intervals, merge all overlapping intervals.",
      url: "https://takeuforward.org/data-structure/merge-overlapping-sub-intervals/"
    },
    {
      id: 9,
      title: "Merge Two Sorted Arrays Without Extra Space",
      difficulty: "Hard",
      topics: ["Arrays II"],
      description: "Merge two sorted arrays in-place.",
      url: "https://takeuforward.org/data-structure/merge-two-sorted-arrays-without-extra-space/"
    },
    {
      id: 10,
      title: "Find Duplicate in Array",
      difficulty: "Medium",
      topics: ["Arrays II"],
      description: "Find the duplicate number in an array of N+1 integers.",
      url: "https://takeuforward.org/data-structure/find-the-duplicate-in-an-array-of-n1-integers/"
    },
    // Arrays III
    {
      id: 11,
      title: "Search in 2D Matrix",
      difficulty: "Medium",
      topics: ["Arrays III"],
      description: "Search for a value in a 2D matrix.",
      url: "https://takeuforward.org/data-structure/search-in-a-sorted-2d-matrix/"
    },
    {
      id: 12,
      title: "Pow(x,n)",
      difficulty: "Medium",
      topics: ["Arrays III"],
      description: "Implement pow(x, n), which calculates x raised to the power n.",
      url: "https://takeuforward.org/data-structure/implement-powxn-x-raised-to-the-power-n/"
    },
    {
      id: 13,
      title: "Majority Element (>N/2 times)",
      difficulty: "Easy",
      topics: ["Arrays III"],
      description: "Find the majority element that appears more than N/2 times.",
      url: "https://takeuforward.org/data-structure/find-the-majority-element-that-occurs-more-than-n-2-times/"
    },
    {
      id: 51,
      title: "Unique Paths",
      difficulty: "Medium",
      topics: ["Arrays III"],
      description: "Find number of unique paths from top-left to bottom-right corner of a grid.",
      url: "https://takeuforward.org/data-structure/grid-unique-paths-count-paths-from-left-top-to-the-right-bottom-of-a-matrix/"
    },
    {
      id: 52,
      title: "Reverse Pairs",
      difficulty: "Hard",
      topics: ["Arrays III"],
      description: "Count reverse pairs in an array.",
      url: "https://takeuforward.org/data-structure/count-reverse-pairs/"
    },
    // Arrays IV
    {
      id: 14,
      title: "Two Sum",
      difficulty: "Easy",
      topics: ["Arrays IV"],
      description: "Find two numbers in array that add up to target.",
      url: "https://takeuforward.org/data-structure/two-sum-check-if-a-pair-with-given-sum-exists-in-array/"
    },
    {
      id: 15,
      title: "4 Sum",
      difficulty: "Medium",
      topics: ["Arrays IV"],
      description: "Find four numbers that add up to target.",
      url: "https://takeuforward.org/data-structure/4-sum-find-quads-that-add-up-to-a-target-value/"
    },
    {
      id: 53,
      title: "4 Sum Problem",
      difficulty: "Medium",
      topics: ["Arrays IV"],
      description: "Find quadruplets that sum to a target value.",
      url: "https://takeuforward.org/data-structure/4-sum-find-quads-that-add-up-to-a-target-value/"
    },
    {
      id: 54,
      title: "Longest Consecutive Sequence",
      difficulty: "Medium",
      topics: ["Arrays IV"],
      description: "Find length of longest consecutive elements sequence.",
      url: "https://takeuforward.org/data-structure/longest-consecutive-sequence-in-an-array/"
    },
    // Linked List
    {
      id: 16,
      title: "Reverse Linked List",
      difficulty: "Easy",
      topics: ["Linked List"],
      description: "Reverse a singly linked list.",
      url: "https://takeuforward.org/data-structure/reverse-a-linked-list/"
    },
    {
      id: 17,
      title: "Middle of Linked List",
      difficulty: "Easy",
      topics: ["Linked List"],
      description: "Find middle element of linked list.",
      url: "https://takeuforward.org/data-structure/find-middle-element-in-a-linked-list/"
    },
    {
      id: 18,
      title: "Merge Two Sorted Lists",
      difficulty: "Easy",
      topics: ["Linked List"],
      description: "Merge two sorted linked lists.",
      url: "https://takeuforward.org/data-structure/merge-two-sorted-linked-lists/"
    },
    // Linked List II
    {
      id: 19,
      title: "Detect Cycle in Linked List",
      difficulty: "Medium",
      topics: ["Linked List II"],
      description: "Find if linked list has a cycle.",
      url: "https://takeuforward.org/data-structure/detect-a-cycle-in-a-linked-list/"
    },
    {
      id: 20,
      title: "Reverse Nodes in k-Group",
      difficulty: "Hard",
      topics: ["Linked List II"],
      description: "Reverse every k nodes in linked list.",
      url: "https://takeuforward.org/data-structure/reverse-linked-list-in-groups-of-size-k/"
    },
    // Linked List III
    {
      id: 55,
      title: "Reverse Nodes in k-Group",
      difficulty: "Hard",
      topics: ["Linked List III"],
      description: "Reverse nodes in k-group in a linked list.",
      url: "https://takeuforward.org/data-structure/reverse-linked-list-in-groups-of-size-k/"
    },
    {
      id: 56,
      title: "Rotate Linked List",
      difficulty: "Medium",
      topics: ["Linked List III"],
      description: "Rotate a linked list by k positions.",
      url: "https://takeuforward.org/data-structure/rotate-a-linked-list/"
    },
    // Greedy
    {
      id: 21,
      title: "N Meetings in One Room",
      difficulty: "Easy",
      topics: ["Greedy"],
      description: "Find maximum meetings that can be held in one room.",
      url: "https://takeuforward.org/data-structure/n-meetings-in-one-room/"
    },
    {
      id: 67,
      title: "N Meetings in One Room",
      difficulty: "Easy",
      topics: ["Greedy Algorithm"],
      description: "Find maximum meetings that can be held in one room.",
      url: "https://takeuforward.org/data-structure/n-meetings-in-one-room/"
    },
    // Recursion
    {
      id: 22,
      title: "Subset Sums",
      difficulty: "Medium",
      topics: ["Recursion"],
      description: "Find all possible subset sums of an array.",
      url: "https://takeuforward.org/data-structure/subset-sum-sum-of-all-subsets/"
    },
    // Binary Tree
    {
      id: 23,
      title: "Inorder Traversal",
      difficulty: "Easy",
      topics: ["Binary Tree"],
      description: "Perform inorder traversal of binary tree.",
      url: "https://takeuforward.org/data-structure/inorder-traversal-of-binary-tree/"
    },
    {
      id: 24,
      title: "Preorder Traversal",
      difficulty: "Easy",
      topics: ["Binary Tree"],
      description: "Perform preorder traversal of binary tree.",
      url: "https://takeuforward.org/data-structure/preorder-traversal-of-binary-tree/"
    },
    // Binary Search Tree
    {
      id: 25,
      title: "Search in BST",
      difficulty: "Easy",
      topics: ["Binary Search Tree"],
      description: "Search for a node in Binary Search Tree.",
      url: "https://takeuforward.org/data-structure/search-in-a-binary-search-tree/"
    },
    // Graph
    {
      id: 26,
      title: "BFS",
      difficulty: "Medium",
      topics: ["Graph"],
      description: "Implement Breadth First Search.",
      url: "https://takeuforward.org/data-structure/breadth-first-search-bfs-level-order-traversal/"
    },
    {
      id: 27,
      title: "DFS",
      difficulty: "Medium",
      topics: ["Graph"],
      description: "Implement Depth First Search.",
      url: "https://takeuforward.org/data-structure/depth-first-search-dfs/"
    },
    // Graph III
    {
      id: 57,
      title: "Bellman Ford Algorithm",
      difficulty: "Medium",
      topics: ["Graph III"],
      description: "Find shortest paths from source to all vertices.",
      url: "https://takeuforward.org/data-structure/bellman-ford-algorithm-shortest-distance-with-negative-edges/"
    },
    {
      id: 58,
      title: "Floyd Warshall Algorithm",
      difficulty: "Medium",
      topics: ["Graph III"],
      description: "Find shortest paths between all pairs of vertices.",
      url: "https://takeuforward.org/data-structure/floyd-warshall-algorithm-shortest-distance-between-every-pair/"
    },
    // Dynamic Programming
    {
      id: 28,
      title: "Maximum Product Subarray",
      difficulty: "Medium",
      topics: ["Dynamic Programming"],
      description: "Find subarray with maximum product.",
      url: "https://takeuforward.org/data-structure/maximum-product-subarray/"
    },
    {
      id: 29,
      title: "Longest Common Subsequence",
      difficulty: "Medium",
      topics: ["Dynamic Programming"],
      description: "Find length of longest common subsequence.",
      url: "https://takeuforward.org/data-structure/longest-common-subsequence-dp-25/"
    },
    // Dynamic Programming III
    {
      id: 59,
      title: "Maximum Sum Increasing Subsequence",
      difficulty: "Medium",
      topics: ["Dynamic Programming III"],
      description: "Find maximum sum increasing subsequence.",
      url: "https://takeuforward.org/data-structure/maximum-sum-increasing-subsequence-dp-41/"
    },
    {
      id: 60,
      title: "Matrix Chain Multiplication",
      difficulty: "Hard",
      topics: ["Dynamic Programming III"],
      description: "Find minimum number of operations for matrix chain multiplication.",
      url: "https://takeuforward.org/dynamic-programming/matrix-chain-multiplication-dp-48/"
    },
    // Trie
    {
      id: 30,
      title: "Implement Trie",
      difficulty: "Medium",
      topics: ["Trie"],
      description: "Implement Trie data structure.",
      url: "https://takeuforward.org/data-structure/implement-trie-1/"
    },
    // Dynamic Programming II
    {
      id: 31,
      title: "0/1 Knapsack",
      difficulty: "Medium",
      topics: ["Dynamic Programming II"],
      description: "Solve the 0/1 knapsack problem using dynamic programming.",
      url: "https://takeuforward.org/data-structure/0-1-knapsack-dp-19/"
    },
    {
      id: 32,
      title: "Edit Distance",
      difficulty: "Hard",
      topics: ["Dynamic Programming II"],
      description: "Find minimum operations required to convert one string to another.",
      url: "https://takeuforward.org/data-structure/edit-distance-dp-33/"
    },
    // Binary Tree II
    {
      id: 33,
      title: "Height of Binary Tree",
      difficulty: "Easy",
      topics: ["Binary Tree II"],
      description: "Find the height/depth of binary tree.",
      url: "https://takeuforward.org/data-structure/maximum-depth-of-a-binary-tree/"
    },
    {
      id: 34,
      title: "Diameter of Binary Tree",
      difficulty: "Easy",
      topics: ["Binary Tree II"],
      description: "Find the diameter of binary tree.",
      url: "https://takeuforward.org/data-structure/calculate-the-diameter-of-a-binary-tree/"
    },
    // Binary Tree III
    {
      id: 35,
      title: "Binary Tree Maximum Path Sum",
      difficulty: "Hard",
      topics: ["Binary Tree III"],
      description: "Find the maximum path sum in binary tree.",
      url: "https://takeuforward.org/data-structure/maximum-path-sum-in-binary-tree/"
    },
    // Binary Search Tree II
    {
      id: 36,
      title: "Construct BST from Preorder",
      difficulty: "Medium",
      topics: ["Binary Search Tree II"],
      description: "Construct Binary Search Tree from Preorder Traversal.",
      url: "https://takeuforward.org/data-structure/construct-a-bst-from-preorder-traversal/"
    },
    // Binary Tree IV
    {
      id: 61,
      title: "Construct Binary Tree from Inorder and Preorder",
      difficulty: "Medium",
      topics: ["Binary Tree IV"],
      description: "Construct binary tree from inorder and preorder traversal.",
      url: "https://takeuforward.org/data-structure/construct-a-binary-tree-from-inorder-and-preorder-traversal/"
    },
    // Graph II
    {
      id: 37,
      title: "Strongly Connected Components",
      difficulty: "Hard",
      topics: ["Graph II"],
      description: "Find strongly connected components using Kosaraju's algorithm.",
      url: "https://takeuforward.org/data-structure/strongly-connected-components-kosarajus-algorithm/"
    },
    // String
    {
      id: 38,
      title: "Reverse Words in a String",
      difficulty: "Easy",
      topics: ["String"],
      description: "Reverse the order of words in a string.",
      url: "https://takeuforward.org/data-structure/reverse-words-in-a-string/"
    },
    {
      id: 39,
      title: "Longest Palindromic Substring",
      difficulty: "Medium",
      topics: ["String"],
      description: "Find the longest palindromic substring in a string.",
      url: "https://takeuforward.org/data-structure/longest-palindromic-substring/"
    },
    // String II
    {
      id: 40,
      title: "KMP Algorithm",
      difficulty: "Hard",
      topics: ["String II"],
      description: "Implement KMP Pattern Searching algorithm.",
      url: "https://takeuforward.org/data-structure/kmp-algorithm/"
    },
    // String III
    {
      id: 65,
      title: "Count and Say",
      difficulty: "Medium",
      topics: ["String III"],
      description: "Generate nth term of count-and-say sequence.",
      url: "https://takeuforward.org/data-structure/count-and-say/"
    },
    {
      id: 66,
      title: "Compare Version Numbers",
      difficulty: "Medium",
      topics: ["String III"],
      description: "Compare two version numbers.",
      url: "https://takeuforward.org/data-structure/compare-version-numbers/"
    },
    // Recursion and Backtracking
    {
      id: 41,
      title: "N Queens Problem",
      difficulty: "Hard",
      topics: ["Recursion and Backtracking"],
      description: "Place N queens on an N×N chessboard so that no two queens attack each other.",
      url: "https://takeuforward.org/data-structure/n-queen-problem-return-all-distinct-solutions-to-the-n-queens-puzzle/"
    },
    {
      id: 42,
      title: "Sudoku Solver",
      difficulty: "Hard",
      topics: ["Recursion and Backtracking"],
      description: "Solve a Sudoku puzzle by filling the empty cells.",
      url: "https://takeuforward.org/data-structure/sudoku-solver/"
    },
    // Binary Search
    {
      id: 43,
      title: "Nth Root of a Number",
      difficulty: "Medium",
      topics: ["Binary Search"],
      description: "Find the Nth root of a number using binary search.",
      url: "https://takeuforward.org/data-structure/nth-root-of-a-number-using-binary-search/"
    },
    {
      id: 44,
      title: "Median of Two Sorted Arrays",
      difficulty: "Hard",
      topics: ["Binary Search"],
      description: "Find the median of two sorted arrays.",
      url: "https://takeuforward.org/data-structure/median-of-two-sorted-arrays-of-different-sizes/"
    },
    // Heaps
    {
      id: 45,
      title: "Kth Largest Element",
      difficulty: "Medium",
      topics: ["Heaps"],
      description: "Find the kth largest element in an array.",
      url: "https://takeuforward.org/data-structure/kth-largest-smallest-element-in-an-array/"
    },
    // Stack and Queue
    {
      id: 46,
      title: "Implement Stack using Array",
      difficulty: "Easy",
      topics: ["Stack and Queue"],
      description: "Implement stack data structure using array.",
      url: "https://takeuforward.org/data-structure/implement-stack-using-array/"
    },
    {
      id: 47,
      title: "Implement Queue using Array",
      difficulty: "Easy",
      topics: ["Stack and Queue"],
      description: "Implement queue data structure using array.",
      url: "https://takeuforward.org/data-structure/implement-queue-using-array/"
    },
    // Operating System
    {
      id: 48,
      title: "Process Scheduling",
      difficulty: "Medium",
      topics: ["Operating System"],
      description: "Understand different process scheduling algorithms.",
      url: "https://takeuforward.org/operating-system/process-scheduling-in-operating-system/"
    },
    // DBMS
    {
      id: 49,
      title: "SQL Basics",
      difficulty: "Easy",
      topics: ["DBMS"],
      description: "Learn basic SQL queries and database concepts.",
      url: "https://takeuforward.org/dbms/sql-basics/"
    },
    // System Design
    {
      id: 50,
      title: "URL Shortener",
      difficulty: "Medium",
      topics: ["System Design"],
      description: "Design a URL shortening service like TinyURL.",
      url: "https://takeuforward.org/system-design/design-url-shortener-tinyurl/"
    },
    {
      id: 68,
      title: "Minimum Platforms",
      difficulty: "Medium",
      topics: ["Greedy Algorithm"],
      description: "Find minimum number of platforms required for railway station.",
      url: "https://takeuforward.org/data-structure/minimum-number-of-platforms-required-for-a-railway/"
    },
    // Bit Manipulation
    {
      id: 69,
      title: "Power Set",
      difficulty: "Medium",
      topics: ["Bit Manipulation"],
      description: "Generate power set using bit manipulation.",
      url: "https://takeuforward.org/data-structure/power-set-print-all-the-possible-subsequences-of-the-string/"
    },
    {
      id: 70,
      title: "Calculate Square",
      difficulty: "Medium",
      topics: ["Bit Manipulation"],
      description: "Calculate square of a number without multiplication/division.",
      url: "https://takeuforward.org/data-structure/calculate-square-of-a-number-without-using-multiplication-and-division-operators/"
    }
  ];

  useEffect(() => {
    const fetchProblems = async () => {
      try {
        setLoading(true);
        setError(null);

        // Filter problems based on both difficulty and topic
        const filteredProblems = striverProblems
          .filter(problem => 
            (difficulty === 'all' || 
            (difficulty === '1' && problem.difficulty === 'Easy') ||
            (difficulty === '2' && problem.difficulty === 'Medium') ||
            (difficulty === '3' && problem.difficulty === 'Hard')) &&
            (topic === 'all' || problem.topics.includes(topic))
          );

        setProblems(filteredProblems);
        setLoading(false);
      } catch (err) {
        console.error('Error loading problems:', err);
        setError('Failed to load problems. Please try again later.');
        setLoading(false);
      }
    };

    fetchProblems();
  }, [difficulty, topic]);

  return (
    <div className="space-y-4">
      {/* Header with filters and close button */}
      <div className="sticky top-0 bg-white dark:bg-[#282828] p-4 border-b dark:border-gray-700 z-10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Striver's SDE Sheet</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300"
          >
            <option value="all">All Difficulties</option>
            <option value="1">Easy</option>
            <option value="2">Medium</option>
            <option value="3">Hard</option>
          </select>

          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300"
          >
            <option value="all">All Topics</option>
            {topics.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-4">
        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
          <div 
            className="bg-[#FFA116] h-2.5 rounded-full" 
            style={{ width: `${(problems.filter(p => p.completed).length / problems.length) * 100}%` }}
          ></div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          {problems.filter(p => p.completed).length} of {problems.length} completed
        </p>
      </div>

      {/* Loading and Error States */}
      {loading && (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#FFA116]"></div>
        </div>
      )}

      {error && (
        <div className="p-4 text-red-500 bg-red-100 dark:bg-red-900/10 rounded-lg mx-4">
          {error}
        </div>
      )}

      {/* Problems List */}
      {!loading && !error && (
        <div className="space-y-4 px-4 pb-4">
          {problems.map((problem) => (
            <div key={problem.id} 
              className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {problem.id}. {problem.title}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {problem.topics.map(topic => (
                      <span key={topic} 
                        className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    {problem.description}
                  </p>
                </div>
                <span className={`px-2 py-1 text-xs rounded ${
                  problem.difficulty === 'Easy' ? 'bg-green-100 text-green-800' :
                  problem.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {problem.difficulty}
                </span>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => onSelectProblem(problem)}
                  className="px-4 py-2 bg-[#FFA116] text-white rounded-lg hover:bg-[#FF9100] transition-colors"
                >
                  Solve
                </button>
                <a
                  href={problem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  View Solution
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Problems;