import React, { memo, useState, useEffect, useRef } from 'react';
import HighlightedText from './HighlightedText';
import { recordingStorage } from '../utils/recordingStorage';

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
    // 普通词点击查词 prop
    onWordClick,
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
    // 录音相关 props
    hasRecording = false,
    isRecording = false,
    onRecordClick,
    onPlayOriginal,
    onDeleteRecording,
    isDebug = false,
}) => {
    // Helper: generate stable ID for sentence
    const getSentenceId = () => {
        if (item.id !== undefined && item.id !== null) return item.id;
        return `${videoId}-${index}`;
    };

    // 录音本地播放状态
    const [audioUrl, setAudioUrl] = useState(null);
    const [isPlayingMyRecording, setIsPlayingMyRecording] = useState(false);
    const myAudioRef = useRef(null);

    // hasRecording 变为 false 时清理 audio URL
    useEffect(() => {
        if (!hasRecording) {
            if (myAudioRef.current) {
                myAudioRef.current.pause();
                myAudioRef.current = null;
            }
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
                setAudioUrl(null);
            }
            setIsPlayingMyRecording(false);
        }
    }, [hasRecording]);

    // 开始重新录音时清除缓存的 audioUrl，确保录完后能读到新录音
    useEffect(() => {
        if (isRecording) {
            if (myAudioRef.current) {
                myAudioRef.current.pause();
                myAudioRef.current = null;
            }
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
                setAudioUrl(null);
            }
            setIsPlayingMyRecording(false);
        }
    }, [isRecording]);

    // 播放我的录音
    const handlePlayMyRecording = async (e) => {
        e?.stopPropagation();
        if (isDebug) alert(`1.入口: index=${index}, isPlaying=${isPlayingMyRecording}, hasRef=${!!myAudioRef.current}`);

        // 先彻底清理旧的 Audio 对象和 URL
        if (myAudioRef.current) {
            myAudioRef.current.pause();
            myAudioRef.current = null;
        }
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
        }

        // 如果之前是播放状态，点击就是停止，不再重新播放
        if (isPlayingMyRecording) {
            if (isDebug) alert('2.走了暂停分支 return');
            setIsPlayingMyRecording(false);
            return;
        }

        // 从 IndexedDB 加载录音
        try {
            const blob = await recordingStorage.get(videoId, index);
            if (isDebug) alert(`3.读取: blob=${blob ? 'size='+blob.size : 'null'}`);
            if (!blob) return;

            const url = URL.createObjectURL(blob);
            setAudioUrl(url);
            const audio = new Audio(url);
            myAudioRef.current = audio;

            audio.onended = () => {
                setIsPlayingMyRecording(false);
                myAudioRef.current = null;
            };
            audio.onerror = () => {
                setIsPlayingMyRecording(false);
                myAudioRef.current = null;
            };

            await audio.play();
            if (isDebug) alert('4.播放成功');
            setIsPlayingMyRecording(true);
        } catch (err) {
            if (isDebug) alert(`5.出错: ${err.message}`);
            setIsPlayingMyRecording(false);
            myAudioRef.current = null;
        }
    };

    // 点击收藏按钮
    const handleFavoriteClick = (e) => {
        e.stopPropagation();
        if (onToggleFavorite) onToggleFavorite(getSentenceId());
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
            className={`relative pl-10 pr-3 md:pr-28 py-3 rounded-lg cursor-pointer transition-all duration-200 ${
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

            {/* 录音按钮（PC右侧，手机端隐藏）- 挖空模式不显示 */}
            {mode !== 'cloze' && onRecordClick && (
                <button
                    onClick={(e) => { e.stopPropagation(); onRecordClick(index); }}
                    className={`hidden md:block absolute right-20 top-3 p-1 rounded-full transition-colors ${
                        isRecording
                            ? 'text-red-500 animate-pulse'
                            : hasRecording
                            ? 'text-violet-500 hover:bg-violet-100'
                            : 'text-gray-300 hover:text-gray-400 hover:bg-gray-100'
                    }`}
                    title={isRecording ? "停止录音" : hasRecording ? "重新录音" : "开始录音"}
                >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                    </svg>
                </button>
            )}

            {/* 笔记按钮（PC右侧，手机端隐藏）- 挖空模式不显示 */}
            {mode !== 'cloze' && onNoteClick && (
                <button
                    onClick={handleNoteClick}
                    className={`hidden md:block absolute right-14 top-3 p-1 rounded-full transition-colors ${note
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

            {/* 收藏按钮（PC右侧，手机端隐藏）- 挖空模式不显示 */}
            {mode !== 'cloze' && onToggleFavorite && (
                <button
                    onClick={handleFavoriteClick}
                    className={`hidden md:block absolute right-8 top-3 p-1 rounded-full transition-colors ${isFavorite
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

            {/* 本子按钮（PC右侧，手机端隐藏）- 挖空模式不显示 */}
            {mode !== 'cloze' && onAddToNotebook && (
                <button
                    onClick={(e) => { e.stopPropagation(); onAddToNotebook(getSentenceId()); }}
                    className="hidden md:block absolute right-2 top-3 p-1 rounded-full transition-colors text-gray-300 hover:text-violet-500 hover:bg-violet-50"
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
                                onWordClick={onWordClick}
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

                {/* 手机端按钮行（md以下显示，PC隐藏）- 挖空模式不显示 */}
                {mode !== 'cloze' && (onNoteClick || onToggleFavorite || onAddToNotebook || onRecordClick) && (
                    <div className="flex md:hidden items-center gap-0.5 mt-2" onClick={(e) => e.stopPropagation()}>
                        {/* 笔记 */}
                        {onNoteClick && (
                            <button
                                onClick={handleNoteClick}
                                className={`p-1.5 rounded-full transition-colors ${note ? 'text-violet-500' : 'text-gray-400 hover:text-gray-600'}`}
                                title={note ? "编辑笔记" : "添加笔记"}
                            >
                                <svg className="w-4 h-4" fill={note ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </button>
                        )}
                        {/* 收藏 */}
                        {onToggleFavorite && (
                            <button
                                onClick={handleFavoriteClick}
                                className={`p-1.5 rounded-full transition-colors ${isFavorite ? 'text-yellow-500' : 'text-gray-400 hover:text-gray-600'}`}
                                title={isFavorite ? "取消收藏" : "收藏句子"}
                            >
                                <svg className="w-4 h-4" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                </svg>
                            </button>
                        )}
                        {/* 本子 */}
                        {onAddToNotebook && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onAddToNotebook(getSentenceId()); }}
                                className="p-1.5 rounded-full transition-colors text-gray-400 hover:text-violet-500"
                                title="加入本子"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            </button>
                        )}
                        {/* 录音（最右） */}
                        {onRecordClick && (
                            <>
                                <div className="flex-1" />
                                <button
                                    onClick={(e) => { e.stopPropagation(); onRecordClick(index); }}
                                    className={`p-1.5 rounded-full transition-colors ${isRecording ? 'text-red-500 animate-pulse' : hasRecording ? 'text-violet-500' : 'text-gray-400 hover:text-gray-600'}`}
                                    title={isRecording ? "停止录音" : hasRecording ? "重新录音" : "开始录音"}
                                >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                                    </svg>
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* 录音播放条（有录音时显示）- 挖空模式不显示 */}
                {hasRecording && mode !== 'cloze' && (
                    <div
                        className="mt-2 flex items-center gap-1 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg px-2 py-1.5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* ▶/⏸ 播放我的录音 */}
                        <button
                            onClick={handlePlayMyRecording}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors text-xs font-medium"
                            title={isPlayingMyRecording ? "暂停" : "播放我的录音"}
                        >
                            {isPlayingMyRecording ? (
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
                            ) : (
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            )}
                            我的录音
                        </button>

                        {/* 分隔 */}
                        <div className="w-px h-4 bg-red-200 dark:bg-red-800 mx-0.5" />

                        {/* 🔊 播放原音 */}
                        <button
                            onClick={(e) => { e.stopPropagation(); onPlayOriginal && onPlayOriginal(index); }}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-xs"
                            title="播放原音"
                        >
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
                            原音
                        </button>

                        <div className="flex-1" />

                        {/* 🔄 重录 */}
                        <button
                            onClick={(e) => { e.stopPropagation(); onRecordClick && onRecordClick(index); }}
                            className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            title="重新录音"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                        </button>

                        {/* 🗑️ 删除录音 */}
                        <button
                            onClick={(e) => { e.stopPropagation(); onDeleteRecording && onDeleteRecording(index); }}
                            className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="删除录音"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
});

export default SubtitleItem;
