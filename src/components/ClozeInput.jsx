import React, { useState, useRef, useEffect } from 'react';
import VocabPopover from './VocabPopover';

/**
 * 行内挖空输入组件
 * @param {string} answer - 正确答案
 * @param {object} vocabInfo - 关联的词汇卡片数据
 * @param {function} onDone - 完成回调 (status: 'correct' | 'revealed')
 * @param {function} onFocus - 聚焦回调 (用于暂停视频)
 * @param {boolean} disabled - 是否禁用
 */
const ClozeInput = ({ answer, vocabInfo, onDone, onFocus, onStartAnswer, disabled }) => {
    const [value, setValue] = useState('');
    const [status, setStatus] = useState('idle'); // idle, error, correct, revealed
    const [attempts, setAttempts] = useState(0);
    const [showVocab, setShowVocab] = useState(false);
    const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });
    const inputRef = useRef(null);
    const [width, setWidth] = useState(0);

    // 计算大致宽度
    useEffect(() => {
        // 最小宽度 3em，每个字符约 0.6em
        const estimatedWidth = Math.max(answer.length * 0.7 + 1, 3);
        setWidth(estimatedWidth);
    }, [answer]);

    const normalize = (str) => {
        return str.toLowerCase()
            .replace(/[.,!?;:'"()]/g, '')
            .trim();
    };

    const handleInteraction = (e) => {
        // 阻止事件冒泡，防止触发父级 SubtitleItem 的 onClick (会导致 seek 和播放)
        if (e && e.stopPropagation) {
            e.stopPropagation();
        }

        if (onStartAnswer) {
            onStartAnswer();
        }
        if (onFocus) {
            onFocus();
        }
    };

    const checkAnswer = () => {
        if (!value.trim()) return;

        const isCorrect = normalize(value) === normalize(answer);

        if (isCorrect) {
            setStatus('correct');
            setValue(answer); // 修正大小写
            onDone && onDone('correct');
        } else {
            const newAttempts = attempts + 1;
            setAttempts(newAttempts);
            setStatus('error');

            // 震动动画后恢复 idle (保留 error 状态用于显示红色边框，但去掉动画类)
            setTimeout(() => {
                if (status !== 'correct' && status !== 'revealed') {
                    // 保持 error 状态让用户知道错了，或者可以切回 idle
                    // 这里我们保持 error 状态直到用户再次输入
                }
            }, 500);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            checkAnswer();
            inputRef.current?.blur();
        }
    };

    const handleBlur = () => {
        if (value.trim() && status !== 'correct' && status !== 'revealed') {
            checkAnswer();
        }
    };

    const handleShowAnswer = (e) => {
        e.stopPropagation(); // 防止触发 input focus
        setStatus('revealed');
        setValue(answer);
        onDone && onDone('revealed');
        // 恢复焦点到 input 以便继续操作? 不，显示答案后通常就结束了
    };

    const handleChange = (e) => {
        setValue(e.target.value);
        if (status === 'error') {
            setStatus('idle');
        }
    };

    // 渲染完成状态 (正确或已揭示)
    if (status === 'correct' || status === 'revealed') {
        return (
            <span className="inline-flex items-center mx-1 align-baseline relative group">
                <span
                    className={`
                        font-medium px-1 rounded
                        ${status === 'correct' ? 'text-green-600 bg-green-50' : 'text-violet-500 border-b border-violet-300'}
                    `}
                >
                    {answer}
                </span>

                {/* 词汇卡片入口图标 */}
                {vocabInfo && (
                    <>
                        <button
                            className="outline-none text-violet-400 hover:text-violet-500 transition-colors ml-1"
                            onClick={(e) => {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                // VocabPopover 使用 fixed 定位，需要视口坐标
                                // 注意：HighlightedText 中加了 scrollY，但 VocabPopover 是 fixed，理论上不应加 scrollY
                                // 这里我们直接传 rect.bottom (视口坐标)
                                setPopoverPos({
                                    x: rect.left,
                                    y: rect.bottom
                                });
                                setShowVocab(true);
                            }}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        </button>

                        {showVocab && (
                            <VocabPopover
                                word={vocabInfo.word}
                                vocabInfo={vocabInfo}
                                position={popoverPos}
                                onClose={() => setShowVocab(false)}
                                onPauseVideo={onFocus} // 复用 onFocus (暂停视频)
                            />
                        )}
                    </>
                )}
            </span>
        );
    }

    return (
        <span className="inline-block relative mx-1 align-baseline">
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onFocus={handleInteraction}
                onClick={handleInteraction}
                onBlur={handleBlur}
                disabled={disabled}
                style={{ width: `${width}em` }}
                className={`
                    text-center font-medium rounded px-1 outline-none transition-all
                    border-b-2 bg-gray-50
                    ${status === 'error' ? 'border-red-400 bg-red-50 text-red-600 animate-shake' : 'border-gray-300 focus:border-violet-500 focus:bg-white'}
                `}
            />

            {/* 错误提示 / 显示答案按钮 */}
            {status === 'error' && (
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 z-20 whitespace-nowrap">
                    {attempts >= 2 ? (
                        <button
                            onMouseDown={(e) => e.preventDefault()} // 防止 input 失焦
                            onClick={handleShowAnswer}
                            className="bg-violet-400 text-white text-xs px-2 py-1 rounded shadow hover:bg-violet-400 transition-colors flex items-center gap-1"
                        >
                            <span>显示答案</span>
                        </button>
                    ) : (
                        <span className="bg-red-100 text-red-600 text-xs px-2 py-1 rounded shadow">
                            ❌ 再试一次
                        </span>
                    )}
                </div>
            )}
        </span>
    );
};

export default ClozeInput;
