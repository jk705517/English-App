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
    onToggleFavorite
}) => {
    // 点击收藏按钮（阻止事件冒泡，避免触发 seek）
    const handleFavoriteClick = (e) => {
        e.stopPropagation();
        if (onToggleFavorite) {
            // 使用 item.id，如果不存在则使用 index（通过回调传递）
            const sentenceId = item.id;
            if (sentenceId === undefined || sentenceId === null) {
                console.warn('⚠️ SubtitleItem: item.id is missing! Please run migration script to add IDs to transcript data.');
                return;
            }
            onToggleFavorite(sentenceId);
        }
    };

    return (
        <div
            onClick={() => onSeek(item.start)}
            className={`relative pl-10 pr-12 py-3 rounded-lg cursor-pointer transition-colors duration-200 ${isActive ? 'bg-indigo-50' : 'hover:bg-gray-50'
                }`}
        >
            {/* 字幕行编号 */}
            <span className={`absolute left-2 top-3 text-xs font-medium ${isActive ? 'text-indigo-600' : 'text-gray-400'
                }`}>
                {index + 1}
            </span>

            {/* 蓝色指示条 */}
            <div
                className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg transition-opacity duration-200 ${isActive ? 'bg-indigo-600 opacity-100' : 'opacity-0'
                    }`}
            />

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
                <div className="text-base font-medium text-gray-900 leading-loose mb-1">
                    {mode === 'cloze' ? (
                        renderClozeText(item.text, index)
                    ) : (
                        mode === 'cn' ? null : (
                            <HighlightedText
                                text={item.text}
                                highlights={vocab || []}
                                onPauseVideo={() => {
                                    console.log('⏸️ 视频暂停');
                                    onSetIsPlaying(false);
                                    // 兼容原生 video 和 ReactPlayer
                                    if (playerRef.current && typeof playerRef.current.pause === 'function') {
                                        playerRef.current.pause();
                                    } else if (playerRef.current?.getInternalPlayer) {
                                        const p = playerRef.current.getInternalPlayer();
                                        if (p?.pauseVideo) p.pauseVideo();
                                        else if (p?.pause) p.pause();
                                    }
                                }}
                            />
                        )
                    )}
                </div>

                {/* 中文 */}
                <div className={`text-sm transition-all duration-300 ${mode === 'en'
                    ? 'blur-sm bg-gray-200 text-transparent select-none hover:blur-0 hover:bg-transparent hover:text-gray-600'
                    : 'text-gray-600'
                    }`}>
                    {item.cn}
                </div>
            </div>
        </div>
    );
});

export default SubtitleItem;

