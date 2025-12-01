import { useState } from 'react';
import VocabPopover from './VocabPopover';

/**
 * 高亮文本组件 - 自动识别并高亮重点词汇
 * @param {string} text - 原文本
 * @param {array} highlights - 高亮词汇数组 [{ word, phonetic, type, meaning, definition, example, exampleCn }]
 * @param {string} className - 额外样式类
 */
const HighlightedText = ({ text, highlights = [], className = '' }) => {
    const [activeVocab, setActiveVocab] = useState(null);
    const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });

    // 处理词汇点击
    const handleVocabClick = (word, vocabInfo, event) => {
        event.stopPropagation();
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

    // 构建正则表达式匹配所有高亮词（忽略大小写）
    const words = highlights.map(h => h.word.toLowerCase());
    const pattern = new RegExp(`\\b(${words.join('|')})\\b`, 'gi');

    // 分割文本并高亮匹配的词汇
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
        // 添加匹配前的普通文本
        if (match.index > lastIndex) {
            parts.push({
                type: 'text',
                content: text.slice(lastIndex, match.index)
            });
        }

        // 找到对应的词汇信息
        const matchedWord = match[0];
        const vocabInfo = highlights.find(
            h => h.word.toLowerCase() === matchedWord.toLowerCase()
        );

        // 添加高亮词汇
        parts.push({
            type: 'highlight',
            content: matchedWord,
            vocabInfo
        });

        lastIndex = pattern.lastIndex;
    }

    // 添加剩余的普通文本
    if (lastIndex < text.length) {
        parts.push({
            type: 'text',
            content: text.slice(lastIndex)
        });
    }

    return (
        <>
            <span className={className}>
                {parts.map((part, index) => {
                    if (part.type === 'text') {
                        return <span key={index}>{part.content}</span>;
                    } else {
                        return (
                            <span
                                key={index}
                                onClick={(e) => handleVocabClick(part.content, part.vocabInfo, e)}
                                className="font-bold border-b-2 border-indigo-500 cursor-pointer hover:text-indigo-600 transition-colors"
                                title={part.vocabInfo?.meaning || '点击查看释义'}
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
                />
            )}
        </>
    );
};

export default HighlightedText;
