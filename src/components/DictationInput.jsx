import { useState, useRef, useEffect } from 'react';

function levenshtein(a, b) {
    const n = a.length, m = b.length;
    if (n === 0) return m;
    if (m === 0) return n;
    let prev = Array.from({ length: m + 1 }, (_, j) => j);
    for (let i = 1; i <= n; i++) {
        const cur = new Array(m + 1);
        cur[0] = i;
        for (let j = 1; j <= m; j++) {
            cur[j] = a[i - 1] === b[j - 1]
                ? prev[j - 1]
                : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1]);
        }
        prev = cur;
    }
    return prev[m];
}

function tokenize(text) {
    return text
        .toLowerCase()
        .replace(/[.,!?;:'"()]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
}

/**
 * 词级对齐（Needleman-Wunsch）
 * 返回 { type: 'correct' | 'close' | 'wrong' | 'missing' | 'extra', ... }[]
 */
function compareSentences(userText, correctText) {
    const userWords = tokenize(userText);
    const correctWords = tokenize(correctText);
    const n = userWords.length, m = correctWords.length;
    if (n === 0 && m === 0) return [];

    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = 0; i <= n; i++) dp[i][0] = i;
    for (let j = 0; j <= m; j++) dp[0][j] = j;
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            const cost = userWords[i - 1] === correctWords[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        }
    }

    const result = [];
    let i = n, j = m;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && userWords[i - 1] === correctWords[j - 1]) {
            result.unshift({ type: 'correct', word: userWords[i - 1] });
            i--; j--;
        } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
            const user = userWords[i - 1], correct = correctWords[j - 1];
            // close: 差 ≤1 字母 且两者都 ≥3 字母（避免 i/a 这种短词被算接近）
            const isClose = levenshtein(user, correct) <= 1 && Math.min(user.length, correct.length) >= 3;
            result.unshift({ type: isClose ? 'close' : 'wrong', user, correct });
            i--; j--;
        } else if (i > 0 && (j === 0 || dp[i][j] === dp[i - 1][j] + 1)) {
            result.unshift({ type: 'extra', user: userWords[i - 1] });
            i--;
        } else {
            result.unshift({ type: 'missing', correct: correctWords[j - 1] });
            j--;
        }
    }
    return result;
}

/**
 * 听写输入组件（词级对比版）
 * status: 'editing' | 'reviewed'（有错误，可继续修改）| 'correct'
 */
const DictationInput = ({
    correctAnswer,
    onCorrect,   // ({ firstTry: boolean }) => void
    onSkip,
    currentIndex,
    totalCount,
    onReplay,
    hasPlayed = false,
}) => {
    const [userInput, setUserInput] = useState('');
    const [status, setStatus] = useState('editing');
    const [diffResult, setDiffResult] = useState([]);
    const [hint, setHint] = useState('');
    const hasBeenWrong = useRef(false);
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = () => {
        if (!userInput.trim()) return;
        const result = compareSentences(userInput, correctAnswer);
        // correct 和 close（差 1 字母）都算通过
        const passed = result.length > 0 && result.every(r => r.type === 'correct' || r.type === 'close');
        setDiffResult(result);
        if (passed) {
            setStatus('correct');
            onCorrect?.({ firstTry: !hasBeenWrong.current });
        } else {
            hasBeenWrong.current = true;
            setStatus('reviewed');
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey && status !== 'correct') {
            e.preventDefault();
            handleSubmit();
        } else if (e.key === 'Escape') {
            onSkip?.();
        }
    };

    const handleHint = () => {
        setHint(correctAnswer.split(' ').map(w => w[0]).join(' '));
    };

    return (
        <div className="space-y-3">
            {/* 进度 + 播放按钮 */}
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>听写练习：第 {currentIndex + 1} / {totalCount} 句</span>
                <button
                    onClick={onReplay}
                    className="flex items-center gap-1 text-violet-500 hover:text-violet-600 transition-colors"
                >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                    </svg>
                    {hasPlayed ? '重听' : '播放'}
                </button>
            </div>

            {/* 词级对比结果（提交后显示） */}
            {diffResult.length > 0 && (
                <div className={`p-3 rounded-lg flex flex-wrap gap-x-1.5 gap-y-1 text-base leading-relaxed ${
                    status === 'correct' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700/50'
                }`}>
                    {diffResult.map((item, i) => {
                        if (item.type === 'correct') {
                            return (
                                <span key={i} className="text-green-600 dark:text-green-400 font-medium">
                                    {item.word}
                                </span>
                            );
                        }
                        if (item.type === 'close') {
                            return (
                                <span
                                    key={i}
                                    className="inline-flex items-center gap-1 px-1.5 rounded bg-yellow-200 dark:bg-yellow-900/40 border border-yellow-300 dark:border-yellow-800"
                                    title={`拼写接近正确！应为 ${item.correct}`}
                                >
                                    <span className="text-yellow-800 dark:text-yellow-300 font-medium">{item.user}</span>
                                    <span className="text-xs text-yellow-700 dark:text-yellow-400">→</span>
                                    <span className="text-yellow-800 dark:text-yellow-300 font-semibold">{item.correct}</span>
                                </span>
                            );
                        }
                        if (item.type === 'wrong') {
                            return (
                                <span
                                    key={i}
                                    className="inline-flex items-center gap-1 px-1.5 rounded bg-red-200 dark:bg-red-900/30 border border-red-300 dark:border-red-800"
                                    title={`写错：应为 ${item.correct}`}
                                >
                                    <span className="text-red-700 dark:text-red-400 line-through opacity-80">{item.user}</span>
                                    <span className="text-xs text-red-600 dark:text-red-400">→</span>
                                    <span className="text-green-700 dark:text-green-400 font-bold">{item.correct}</span>
                                </span>
                            );
                        }
                        if (item.type === 'missing') {
                            return (
                                <span
                                    key={i}
                                    className="inline-flex items-center gap-0.5 px-1.5 rounded bg-blue-200 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-800"
                                    title={`漏写：${item.correct}`}
                                >
                                    <span className="text-blue-700 dark:text-blue-300 font-bold">+</span>
                                    <span className="text-blue-800 dark:text-blue-300 font-bold">{item.correct}</span>
                                </span>
                            );
                        }
                        if (item.type === 'extra') {
                            return (
                                <span key={i} className="text-red-500 line-through opacity-75">
                                    {item.user}
                                </span>
                            );
                        }
                        return null;
                    })}
                </div>
            )}

            {/* 输入框 */}
            <div className="relative">
                <textarea
                    ref={inputRef}
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={status === 'correct'}
                    placeholder="请输入你听到的内容..."
                    className={`w-full p-4 border-2 rounded-lg resize-none focus:outline-none focus:ring-2 transition-all dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500
                        ${status === 'correct'   ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}
                        ${status === 'reviewed'  ? 'border-yellow-400 bg-white focus:border-yellow-400 focus:ring-yellow-200 dark:border-yellow-500 dark:bg-gray-700' : ''}
                        ${status === 'editing'   ? 'border-gray-300 bg-white focus:border-violet-400 focus:ring-violet-200 dark:border-gray-600' : ''}
                    `}
                    rows={3}
                />
                {hint && status !== 'correct' && (
                    <div className="absolute top-2 right-2 text-xs text-gray-500 bg-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-300 px-2 py-1 rounded pointer-events-none">
                        提示: {hint}
                    </div>
                )}
            </div>

            {/* 答对反馈（含标准写法） */}
            {status === 'correct' && (
                <div className="flex items-start gap-2 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1 min-w-0">
                        <div className="font-medium">
                            {hasBeenWrong.current ? '修正正确！👍' : '太棒了！🎉'}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 break-words">
                            💡 标准写法：{correctAnswer}
                        </div>
                    </div>
                </div>
            )}

            {/* 操作按钮 */}
            {status !== 'correct' && (
                <div className="flex gap-2">
                    <button
                        onClick={handleSubmit}
                        disabled={!userInput.trim()}
                        className="flex-1 bg-violet-400 text-white py-2.5 rounded-lg hover:bg-violet-500 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                        提交答案 (Enter)
                    </button>
                    <button
                        onClick={handleHint}
                        className="px-3 py-2.5 border-2 border-yellow-500 text-yellow-700 dark:text-yellow-400 rounded-lg hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors"
                        title="显示首字母提示"
                    >
                        💡
                    </button>
                    <button
                        onClick={onSkip}
                        className="px-3 py-2.5 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        title="跳过这一句 (Esc)"
                    >
                        跳过
                    </button>
                </div>
            )}

            {/* 键盘提示 */}
            <div className="text-xs text-gray-400 text-center">
                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-500 dark:text-gray-400">Enter</kbd> 提交 &nbsp;
                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-500 dark:text-gray-400">Esc</kbd> 跳过
            </div>
        </div>
    );
};

export default DictationInput;
