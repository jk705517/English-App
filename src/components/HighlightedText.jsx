import { useState, useMemo, useEffect, memo } from 'react';
import VocabPopover from './VocabPopover';

/**
 * 高亮文本组件 - 自动识别并高亮重点词汇
 * @param {string} text - 原文本
 * @param {array} highlights - 高亮词汇数组 [{ word, phonetic, type, meaning, definition, example, exampleCn }]
 * @param {string} className - 额外样式类
 * @param {function} onPauseVideo - 暂停视频回调
 */
const HighlightedText = ({ text, highlights = [], className = '', onPauseVideo }) => {
    const [activeVocab, setActiveVocab] = useState(null);
    const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

    // 监听窗口大小变化
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // 处理词汇点击
    const handleVocabClick = (word, vocabInfo, event) => {
        event.stopPropagation();
        event.preventDefault();

        // 如果没有词汇数据，显示 Toast 提示
        if (!vocabInfo || !vocabInfo.meaning) {
            if (window.showToast) {
                window.showToast('这个词暂时没有词汇卡片');
            }
            console.warn(`⚠️ 词汇 "${word}" 没有有效的词汇数据`);
            return;
        }

        const rect = event.target.getBoundingClientRect();
        setPopoverPosition({
            x: rect.left,
            y: rect.bottom + window.scrollY
        });
        setActiveVocab({ word, vocabInfo });
    };

    // 关闭弹窗
    const closePopover = () => {
        setActiveVocab(null);
    };

    // 如果没有高亮词汇，直接返回原文本
    if (!highlights || highlights.length === 0) {
        return <span className={className}>{text}</span>;
    }

    // 🚀 性能优化：使用 useMemo 缓存文本分割结果
    // 只在 text 或 highlights 变化时重新计算，避免每次父组件 re-render 都执行正则匹配
    const parts = useMemo(() => {
        // 构建正则表达式匹配所有高亮词（忽略大小写）
        const words = highlights.map(h => h.word.toLowerCase());
        const pattern = new RegExp(`\\b(${words.join('|')})\\b`, 'gi');

        // 分割文本并高亮匹配的词汇
        const result = [];
        let lastIndex = 0;
        let match;

        while ((match = pattern.exec(text)) !== null) {
            // 添加匹配前的普通文本
            if (match.index > lastIndex) {
                result.push({
                    type: 'text',
                    content: text.slice(lastIndex, match.index)
                });
            }

            // 找到对应的词汇信息
            const matchedWord = match[0];
            const vocabInfo = highlights.find(
                h => h.word.toLowerCase() === matchedWord.toLowerCase()
            );

            // 只有有效的词汇信息才添加为高亮（有 meaning 才认为有效）
            if (vocabInfo && vocabInfo.meaning) {
                result.push({
                    type: 'highlight',
                    content: matchedWord,
                    vocabInfo
                });
            } else {
                // 没有有效词汇数据的词仍然高亮，但标记为无数据
                result.push({
                    type: 'highlight-no-data',
                    content: matchedWord,
                    vocabInfo: null
                });
            }

            lastIndex = pattern.lastIndex;
        }

        // 添加剩余的普通文本
        if (lastIndex < text.length) {
            result.push({
                type: 'text',
                content: text.slice(lastIndex)
            });
        }

        return result;
    }, [text, highlights]);

    return (
        <>
            <span className={className}>
                {parts.map((part, index) => {
                    if (part.type === 'text') {
                        return <span key={index}>{part.content}</span>;
                    } else if (part.type === 'highlight') {
                        // 有词汇数据的高亮词
                        return (
                            <span
                                key={index}
                                onClick={(e) => handleVocabClick(part.content, part.vocabInfo, e)}
                                onTouchEnd={(e) => {
                                    // 手机端也响应 touch 事件，避免延迟
                                    e.preventDefault();
                                    handleVocabClick(part.content, part.vocabInfo, e);
                                }}
                                className="font-bold border-b-2 border-indigo-500 bg-indigo-50 px-0.5 cursor-pointer hover:bg-indigo-100 hover:text-indigo-700 transition-colors rounded-sm"
                                title={part.vocabInfo?.meaning || '点击查看释义'}
                            >
                                {part.content}
                            </span>
                        );
                    } else {
                        // 无词汇数据的高亮词（样式略有不同，提示用户可能无数据）
                        return (
                            <span
                                key={index}
                                onClick={(e) => handleVocabClick(part.content, null, e)}
                                onTouchEnd={(e) => {
                                    e.preventDefault();
                                    handleVocabClick(part.content, null, e);
                                }}
                                className="font-bold border-b-2 border-gray-300 bg-gray-50 px-0.5 cursor-pointer hover:bg-gray-100 transition-colors rounded-sm"
                                title="点击查看（可能无数据）"
                            >
                                {part.content}
                            </span>
                        );
                    }
                })}
            </span>

            {/* 词汇弹窗 */}
            {activeVocab && (
                <VocabPopover
                    word={activeVocab.word}
                    vocabInfo={activeVocab.vocabInfo}
                    position={popoverPosition}
                    onClose={closePopover}
                    onPauseVideo={onPauseVideo}
                    isMobile={isMobile}
                />
            )}
        </>
    );
};

// 🚀 使用 React.memo 包装组件，只在 props 变化时才 re-render
export default memo(HighlightedText);
