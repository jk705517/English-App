import React, { memo } from 'react';
import HighlightedText from './HighlightedText';

// 🚀 性能优化：字幕行组件（使用 React.memo 避免不必要的 re-render）
// 只在 isActive 或 item 内容变化时才重新渲染
const SubtitleItem = memo(({
    item,
    index,
    isActive,
    mode,
    clozePattern,
    vocab,
    onSeek,
    playerRef,
    renderClozeText,
    onSetIsPlaying,
    // 收藏相关 props
    isFavorite = false,
    onToggleFavorite,
    // Video ID for generating fallback sentence IDs
    videoId,
    // 词汇导航 prop
    onVocabNavigate,
    abMode = 0,
    onSetAbPoint,
    isAbPointA = false,
    isAbPointB = false,
    loopCountdown = null,
    subtitleFontSize = 16,
}) => {
    // Helper: generate stable ID for sentence
    // Uses existing id if available, otherwise creates fallback from videoId-index
    const getSentenceId = () => {
        if (item.id !== undefined && item.id !== null) {
            return item.id;
        }
        // Fallback: videoId-index (e.g., "123-0", "123-1")
        return `${videoId}-${index}`;
    };

    // 点击收藏按钮（阻止事件冒泡，避免触发 seek）
    const handleFavoriteClick = (e) => {
        e.stopPropagation();
        if (onToggleFavorite) {
            const sentenceId = getSentenceId();
            onToggleFavorite(sentenceId);
        }
    };

    return (
        <div
            onClick={() => {
                if (abMode === 1 || abMode === 2) {
                    if (onSetAbPoint) onSetAbPoint(item.start, index);
                    return;
                }
                onSeek(item.start);
            }}
            data-subtitle-index={index}
            className={`relative pl-10 pr-12 py-3 rounded-lg cursor-pointer transition-all duration-200 ${
                isAbPointA ? 'bg-yellow-50 dark:bg-yellow-900/20 ring-1 ring-yellow-300' :
                isAbPointB ? 'bg-green-50 dark:bg-green-900/20 ring-1 ring-green-300' :
                isActive ? 'bg-white dark:bg-gray-700 shadow-md' : 'hover:bg-white/60 dark:hover:bg-gray-700/50'
            }`}
        >
            {/* 字幕行编号 */}
            <span className="absolute left-2 top-3 text-xs font-medium text-gray-400 dark:text-gray-500">
                {index + 1}
            </span>

            {/* 单句循环倒计时 */}
            {loopCountdown !== null && (
                <span className="absolute right-10 top-1/2 -translate-y-1/2 text-4xl font-bold text-violet-600 bg-violet-100 px-3 py-1 rounded-2xl tabular-nums z-10 shadow-sm">
                    {loopCountdown}s
                </span>
            )}

            {/* 收藏按钮（右侧）- 挖空模式不显示 */}
            {mode !== 'cloze' && onToggleFavorite && (
                <button
                    onClick={handleFavoriteClick}
                    className={`absolute right-2 top-3 p-1 rounded-full transition-colors ${isFavorite
                        ? 'text-yellow-500 hover:bg-yellow-100'
                        : 'text-gray-300 hover:text-gray-400 hover:bg-gray-100'
                        }`}
                    title={isFavorite ? "取消收藏" : "收藏句子"}
                >
                    <svg className="w-4 h-4" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                </button>
            )}

            {/* 文字内容 */}
            <div className="flex-1">
                {/* 英文 */}
                <div className="subtitle-en-text dark:text-gray-100 mb-1" style={{ fontSize: `${subtitleFontSize}px`, letterSpacing: '0.025em', lineHeight: '1.8' }}>
                    {mode === 'cloze' ? (
                        renderClozeText(item.text, index)
                    ) : (
                        mode === 'cn' ? null : (
                            <HighlightedText
                                text={item.text}
                                highlights={vocab || []}
                                onVocabNavigate={onVocabNavigate}
                            />
                        )
                    )}
                </div>

                {/* 中文 */}
                <div
                    className={`transition-all duration-300 ${mode === 'en'
                        ? 'blur-sm bg-gray-200 dark:bg-gray-600 text-transparent select-none hover:blur-0 hover:bg-transparent hover:text-gray-600 dark:hover:text-gray-300'
                        : 'subtitle-cn-text'
                    }`}
                    style={{ fontSize: `${Math.max(subtitleFontSize - 2, 10)}px` }}
                >
                    {item.cn}
                </div>
            </div>
        </div>
    );
});

export default SubtitleItem;

