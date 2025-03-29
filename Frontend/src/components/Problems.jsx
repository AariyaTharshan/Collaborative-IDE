import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Problems = ({ onSelectProblem, onClose }) => {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [difficulty, setDifficulty] = useState('all');

  // Sample problems data
  const sampleProblems = [
    {
      id: 1,
      title: "Two Sum",
      difficulty: "Easy",
      description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
      url: "https://leetcode.com/problems/two-sum"
    },
    {
      id: 2,
      title: "Add Two Numbers",
      difficulty: "Medium",
      description: "Given two non-empty linked lists representing two non-negative integers. The digits are stored in reverse order, and each node contains a single digit.",
      url: "https://leetcode.com/problems/add-two-numbers"
    },
    {
      id: 3,
      title: "Longest Substring Without Repeating Characters",
      difficulty: "Medium",
      description: "Given a string s, find the length of the longest substring without repeating characters.",
      url: "https://leetcode.com/problems/longest-substring-without-repeating-characters"
    },
    {
      id: 4,
      title: "Median of Two Sorted Arrays",
      difficulty: "Hard",
      description: "Given two sorted arrays nums1 and nums2 of size m and n respectively, return the median of the two sorted arrays.",
      url: "https://leetcode.com/problems/median-of-two-sorted-arrays"
    },
    {
      id: 5,
      title: "Valid Parentheses",
      difficulty: "Easy",
      description: "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.",
      url: "https://leetcode.com/problems/valid-parentheses"
    },
    {
      id: 6,
      title: "Merge k Sorted Lists",
      difficulty: "Hard",
      description: "You are given an array of k linked-lists lists, each linked-list is sorted in ascending order. Merge all the linked-lists into one sorted linked-list.",
      url: "https://leetcode.com/problems/merge-k-sorted-lists"
    },
    {
      id: 7,
      title: "Best Time to Buy and Sell Stock",
      difficulty: "Easy",
      description: "You are given an array prices where prices[i] is the price of a given stock on the ith day. Maximize your profit by choosing a single day to buy and a single day to sell.",
      url: "https://leetcode.com/problems/best-time-to-buy-and-sell-stock"
    },
    {
      id: 8,
      title: "Maximum Subarray",
      difficulty: "Medium",
      description: "Given an integer array nums, find the contiguous subarray which has the largest sum and return its sum.",
      url: "https://leetcode.com/problems/maximum-subarray"
    },
    {
      id: 9,
      title: "Word Search",
      difficulty: "Medium",
      description: "Given an m x n grid of characters board and a string word, return true if word exists in the grid. The word can be constructed from letters of sequentially adjacent cells.",
      url: "https://leetcode.com/problems/word-search"
    },
    {
      id: 10,
      title: "Regular Expression Matching",
      difficulty: "Hard",
      description: "Given an input string s and a pattern p, implement regular expression matching with support for '.' and '*' where '.' matches any single character and '*' matches zero or more of the preceding element.",
      url: "https://leetcode.com/problems/regular-expression-matching"
    }
  ];

  useEffect(() => {
    const fetchProblems = async () => {
      try {
        setLoading(true);
        setError(null);

        // Using sample data instead of API call
        const filteredProblems = sampleProblems
          .filter(problem => 
            difficulty === 'all' || 
            (difficulty === '1' && problem.difficulty === 'Easy') ||
            (difficulty === '2' && problem.difficulty === 'Medium') ||
            (difficulty === '3' && problem.difficulty === 'Hard')
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
  }, [difficulty]);

  return (
    <div className="space-y-4">
      {/* Header with close button */}
      <div className="flex justify-between items-center mb-4 sticky top-0 bg-white dark:bg-[#282828] p-4 border-b dark:border-gray-700 z-10">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">LeetCode Problems</h2>
        <div className="flex items-center gap-2">
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-700 dark:text-gray-300"
          >
            <option value="all">All</option>
            <option value="1">Easy</option>
            <option value="2">Medium</option>
            <option value="3">Hard</option>
          </select>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

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
                  View Details
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