import { useState, useRef, useEffect } from 'react';

/**
 * 逐词对比：返回对比结果数组
 * type: 'correct' | 'wrong' | 'missing' | 'extra'
 */
function compareSentences(userText, correctText) {
    const normalize = (word) => word.toLowerCase().replace(/[.,!?;:'"()]/g, '');
    const userWords = userText.trim().split(/\s+/).filter(Boolean);
    const correctWords = correctText.trim().split(/\s+/).filter(Boolean);
    const results = [];
    const maxLen = Math.max(userWords.length, correctWords.length);
    for (let i = 0; i < maxLen; i++) {
        const u = userWords[i] || null;
        const c = correctWords[i] || null;
        if (!u && c) {
            results.push({ type: 'missing', correct: c });
        } else if (u && !c) {
            results.push({ type: 'extra', user: u });
        } else if (normalize(u) === normalize(c)) {
            results.push({ type: 'correct', word: u });
        } else {
            results.push({ type: 'wrong', user: u, correct: c });
        }
    }
    return results;
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

    // 挂载后自动聚焦（每次新句子 key 变化时组件重挂，自动触发）
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = () => {
        if (!userInput.trim()) return;
        const result = compareSentences(userInput, correctAnswer);
        const allCorrect = result.every(r => r.type === 'correct');
        setDiffResult(result);
        if (allCorrect) {
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
                        if (item.type === 'wrong') {
                            return (
                                <span key={i} className="inline-flex items-center gap-1">
                                    <span className="text-red-500 line-through opacity-75">{item.user}</span>
                                    <span className="text-green-600 dark:text-green-400 font-bold">{item.correct}</span>
                                </span>
                            );
                        }
                        if (item.type === 'missing') {
                            return (
                                <span key={i} className="text-green-600 dark:text-green-400 font-bold underline decoration-dotted">
                                    {item.correct}
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

            {/* 答对反馈 */}
            {status === 'correct' && (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">
                        {hasBeenWrong.current ? '修正正确！👍' : '太棒了！🎉'}
                    </span>
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
