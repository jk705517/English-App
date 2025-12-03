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
    onSetIsPlaying
}) => {
    return (
        <div
            onClick={() => onSeek(item.start)}
            className={`relative pl-10 pr-4 py-3 rounded-lg cursor-pointer transition-colors duration-200 ${isActive ? 'bg-indigo-50' : 'hover:bg-gray-50'
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
