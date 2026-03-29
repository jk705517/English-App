import { useMemo, memo } from 'react';

// 4色循环（按词汇在列表中的顺序）：背景色 + 同色系深色文字
const VOCAB_COLORS = [
    { bg: '#E8D5FF', text: '#7C3AED' },
    { bg: '#FFE0CC', text: '#C2500A' },
    { bg: '#C8F0E0', text: '#0D7A4E' },
    { bg: '#CCE8FF', text: '#1A5FA8' },
];

/**
 * 高亮文本组件 - 自动识别并高亮重点词汇
 * 点击词汇直接跳转到词卡Tab的该词条详情页
 */
const HighlightedText = ({
    text,
    highlights = [],
    className = '',
    onVocabNavigate,  // (vocabIndex) => void — 跳转到词卡详情
    onWordClick,      // (word) => void — 点击普通词查词
}) => {
    // 如果没有高亮词汇且无查词功能，直接返回原文本
    if ((!highlights || highlights.length === 0) && !onWordClick) {
        return <span className={className}>{text}</span>;
    }

    // 使用 useMemo 缓存文本分割结果
    const parts = useMemo(() => {
        if (!highlights || highlights.length === 0) {
            return [{ type: 'text', content: text }];
        }
        const words = highlights.map(h => h.word.toLowerCase());
        const pattern = new RegExp(`\\b(${words.join('|')})\\b`, 'gi');

        const result = [];
        let lastIndex = 0;
        let match;

        while ((match = pattern.exec(text)) !== null) {
            if (match.index > lastIndex) {
                result.push({ type: 'text', content: text.slice(lastIndex, match.index) });
            }

            const matchedWord = match[0];
            const vocabIndex = highlights.findIndex(
                h => h.word.toLowerCase() === matchedWord.toLowerCase()
            );
            const vocabInfo = vocabIndex >= 0 ? highlights[vocabIndex] : null;

            if (vocabInfo && vocabInfo.meaning) {
                result.push({ type: 'highlight', content: matchedWord, vocabInfo, vocabIndex });
            } else {
                result.push({ type: 'highlight-no-data', content: matchedWord, vocabInfo: null, vocabIndex });
            }

            lastIndex = pattern.lastIndex;
        }

        if (lastIndex < text.length) {
            result.push({ type: 'text', content: text.slice(lastIndex) });
        }

        return result;
    }, [text, highlights]);

    return (
        <span className={className}>
            {parts.map((part, index) => {
                if (part.type === 'text') {
                    // 有 onWordClick 时，把普通文本拆成可点击的单词 span
                    if (onWordClick) {
                        const tokens = part.content.split(/(\s+)/);
                        return tokens.map((token, ti) => {
                            if (!token || /^\s+$/.test(token)) {
                                return <span key={`${index}-${ti}`}>{token}</span>;
                            }
                            // 去掉首尾标点，得到查词用的词形
                            const lookupWord = token.replace(/^[^a-zA-Z0-9']+|[^a-zA-Z0-9']+$/g, '');
                            if (!lookupWord) {
                                return <span key={`${index}-${ti}`}>{token}</span>;
                            }
                            return (
                                <span
                                    key={`${index}-${ti}`}
                                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); onWordClick(lookupWord); }}
                                    onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); onWordClick(lookupWord); }}
                                    className="cursor-pointer hover:underline"
                                >
                                    {token}
                                </span>
                            );
                        });
                    }
                    return <span key={index}>{part.content}</span>;
                } else if (part.type === 'highlight') {
                    const color = VOCAB_COLORS[part.vocabIndex % VOCAB_COLORS.length];
                    return (
                        <span
                            key={index}
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                if (onVocabNavigate) onVocabNavigate(part.vocabIndex);
                            }}
                            onTouchEnd={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (onVocabNavigate) onVocabNavigate(part.vocabIndex);
                            }}
                            style={{ backgroundColor: color.bg, color: color.text }}
                            className="px-0.5 cursor-pointer rounded-sm transition-opacity hover:opacity-75"
                            title={part.vocabInfo?.meaning || '点击查看释义'}
                        >
                            {part.content}
                        </span>
                    );
                } else {
                    // 无词汇数据
                    return (
                        <span
                            key={index}
                            style={{ backgroundColor: '#F0F0F0', color: '#666' }}
                            className="px-0.5 rounded-sm"
                            title="暂无词汇数据"
                        >
                            {part.content}
                        </span>
                    );
                }
            })}
        </span>
    );
};

export default memo(HighlightedText);
