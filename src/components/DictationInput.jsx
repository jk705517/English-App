import { useState, useRef, useEffect } from 'react';

/**
 * 听写输入组件（增强版）
 * @param {string} correctAnswer - 正确答案
 * @param {function} onCorrect - 答对回调
 * @param {function} onSkip - 跳过回调
 * @param {function} onWrong - 答错回调
 * @param {number} currentIndex - 当前句子索引
 * @param {number} totalCount - 总句子数
 * @param {function} onReplay - 重播当前句子回调
 * @param {boolean} hasPlayed - 当前句是否已播放过
 */
const DictationInput = ({
    correctAnswer,
    onCorrect,
    onSkip,
    onWrong,
    currentIndex,
    totalCount,
    onReplay,
    hasPlayed = false
}) => {
    const [userInput, setUserInput] = useState('');
    const [status, setStatus] = useState('editing'); // editing | correct | wrong
    const [showAnswer, setShowAnswer] = useState(false);
    const [hint, setHint] = useState('');
    const [originalInput, setOriginalInput] = useState(''); // 🆕 保存用户原始输入用于差异对比
    const inputRef = useRef(null);

    // 自动聚焦
    useEffect(() => {
        inputRef.current?.focus();
    }, [correctAnswer]);

    // 标准化文本（用于比较）
    const normalizeText = (text) => {
        return text
            .toLowerCase()
            .replace(/[.,!?;:'"()]/g, '') // 移除标点
            .replace(/\s+/g, ' ') // 多个空格变一个
            .trim();
    };

    // 提交验证
    const handleSubmit = () => {
        if (!userInput.trim()) return;

        const isCorrect = normalizeText(userInput) === normalizeText(correctAnswer);

        if (isCorrect) {
            setStatus('correct');
            setTimeout(() => {
                onCorrect?.();
                // 重置状态准备下一句
                setUserInput('');
                setOriginalInput(''); // 🆕 清空原始输入
                setStatus('editing');
                setShowAnswer(false);
                setHint('');
            }, 1500);
        } else {
            setStatus('wrong');
            onWrong?.(); // 调用答错回调
        }
    };

    // 重试
    const handleRetry = () => {
        setUserInput('');
        setOriginalInput(''); // 🆕 清空原始输入
        setStatus('editing');
        setShowAnswer(false);
        inputRef.current?.focus();
    };

    // 显示答案
    const handleShowAnswer = () => {
        setOriginalInput(userInput); // 🆕 先保存用户的原始输入
        setShowAnswer(true);
        // 不再替换 userInput，保持输入框显示正确答案供用户参考
        setUserInput(correctAnswer);
    };

    // 获取首字母提示
    const handleHint = () => {
        const words = correctAnswer.split(' ');
        const hintText = words.map(word => word[0]).join(' ');
        setHint(hintText);
    };

    // Enter 提交，Esc 跳过
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && status === 'editing') {
            handleSubmit();
        } else if (e.key === 'Escape') {
            onSkip?.();
        }
    };

    // 计算相似度并高亮差异（简化版）
    // 🆕 使用 originalInput（用户原始输入）进行对比
    const renderDiff = () => {
        const userWords = normalizeText(originalInput).split(' ').filter(w => w);
        const correctWords = correctAnswer.split(' ');

        return correctWords.map((word, index) => {
            const userWord = userWords[index] || '';
            const isCorrect = normalizeText(word) === normalizeText(userWord);
            return (
                <span
                    key={index}
                    className={isCorrect ? 'text-green-600' : 'text-red-600 font-bold'}
                >
                    {word}{' '}
                </span>
            );
        });
    };

    return (
        <div className="space-y-4">
            {/* 进度提示 */}
            <div className="flex items-center justify-between text-sm text-gray-600">
                <span>听写练习：第 {currentIndex + 1} / {totalCount} 句</span>
                <button
                    onClick={onReplay}
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
                >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                    </svg>
                    {hasPlayed ? '重听' : '播放'}
                </button>
            </div>

            {/* 输入区域 */}
            <div className="relative">
                <textarea
                    ref={inputRef}
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={status !== 'editing'}
                    placeholder="请输入你听到的内容..."
                    className={`
            w-full p-4 border-2 rounded-lg resize-none
            focus:outline-none focus:ring-2 transition-all
            ${status === 'correct' ? 'border-green-500 bg-green-50' : ''}
            ${status === 'wrong' ? 'border-red-500 bg-red-50' : ''}
            ${status === 'editing' ? 'border-gray-300 focus:border-blue-500 focus:ring-blue-200' : ''}
          `}
                    rows={3}
                />

                {/* 提示文字 */}
                {hint && status === 'editing' && (
                    <div className="absolute top-2 right-2 text-xs text-gray-500 bg-yellow-100 px-2 py-1 rounded">
                        提示: {hint}
                    </div>
                )}
            </div>

            {/* 状态反馈 */}
            {status === 'correct' && (
                <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">答对了！太棒了 🎉</span>
                </div>
            )}

            {status === 'wrong' && (
                <div className="space-y-3">
                    <div className="flex items-start gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                        <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                            <p className="font-medium mb-1">再试一次吧！</p>
                            {!showAnswer && (
                                <p className="text-sm">
                                    你的答案：<span className="font-mono">{userInput}</span>
                                </p>
                            )}
                        </div>
                    </div>

                    {/* 显示答案后的对比 */}
                    {showAnswer && (
                        <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-sm text-gray-600 mb-1">正确答案：</p>
                            <p className="text-base font-medium">{correctAnswer}</p>
                            <p className="text-sm text-gray-600 mt-2 mb-1">差异对比：</p>
                            <p className="text-base">{renderDiff()}</p>
                        </div>
                    )}
                </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-2">
                {status === 'editing' && (
                    <>
                        <button
                            onClick={handleSubmit}
                            disabled={!userInput.trim()}
                            className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
                        >
                            提交答案 (Enter)
                        </button>
                        <button
                            onClick={handleHint}
                            className="px-4 py-2.5 border-2 border-yellow-500 text-yellow-700 rounded-lg hover:bg-yellow-50 transition-colors"
                            title="显示首字母提示"
                        >
                            💡 提示
                        </button>
                        <button
                            onClick={onSkip}
                            className="px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                            title="跳过这一句 (Esc)"
                        >
                            跳过
                        </button>
                    </>
                )}

                {status === 'wrong' && (
                    <>
                        <button
                            onClick={handleRetry}
                            className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                            🔄 重新输入
                        </button>
                        {!showAnswer && (
                            <button
                                onClick={handleShowAnswer}
                                className="flex-1 bg-gray-600 text-white py-2.5 rounded-lg hover:bg-gray-700 transition-colors font-medium"
                            >
                                👁️ 显示答案
                            </button>
                        )}
                        {showAnswer && (
                            <button
                                onClick={() => {
                                    onSkip?.();
                                    setUserInput('');
                                    setStatus('editing');
                                    setShowAnswer(false);
                                }}
                                className="flex-1 bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700 transition-colors font-medium"
                            >
                                下一句 →
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* 键盘提示 */}
            <div className="text-xs text-gray-500 text-center">
                按 <kbd className="px-2 py-1 bg-gray-200 rounded">Enter</kbd> 提交，
                <kbd className="px-2 py-1 bg-gray-200 rounded">Esc</kbd> 跳过
            </div>
        </div>
    );
};

export default DictationInput;