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
    // 笔记相关 props
    note = null,
    onNoteClick,
    // 本子相关 props
    onAddToNotebook,
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

    const handleNoteClick = (e) => {
        e.stopPropagation();
        if (onNoteClick) onNoteClick(index);
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
            className={`relative pl-10 pr-20 py-3 rounded-lg cursor-pointer transition-all duration-200 ${
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

            {/* 笔记按钮（右侧第三，最左）- 挖空模式不显示 */}
            {mode !== 'cloze' && onNoteClick && (
                <button
                    onClick={handleNoteClick}
                    className={`absolute right-14 top-3 p-1 rounded-full transition-colors ${note
                        ? 'text-violet-500 hover:bg-violet-100'
                        : 'text-gray-300 hover:text-gray-400 hover:bg-gray-100'
                        }`}
                    title={note ? "编辑笔记" : "添加笔记"}
                >
                    <svg className="w-4 h-4" fill={note ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </button>
            )}

            {/* 收藏按钮（右侧第二）- 挖空模式不显示 */}
            {mode !== 'cloze' && onToggleFavorite && (
                <button
                    onClick={handleFavoriteClick}
                    className={`absolute right-8 top-3 p-1 rounded-full transition-colors ${isFavorite
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

            {/* 本子按钮（右侧第一，最右）- 挖空模式不显示 */}
            {mode !== 'cloze' && onAddToNotebook && (
                <button
                    onClick={(e) => { e.stopPropagation(); onAddToNotebook(getSentenceId()); }}
                    className="absolute right-2 top-3 p-1 rounded-full transition-colors text-gray-300 hover:text-violet-500 hover:bg-violet-50"
                    title="加入本子"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
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

                {/* 笔记内容（字幕下方小字显示） */}
                {note && (
                    <div className="mt-1.5 pl-2 border-l-2 border-violet-300 dark:border-violet-600">
                        <p className="text-xs leading-relaxed text-violet-600 dark:text-violet-400">{note}</p>
                    </div>
                )}
            </div>
        </div>
    );
});

export default SubtitleItem;

