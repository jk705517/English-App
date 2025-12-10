import { useState, useMemo, useEffect } from 'react';

/**
 * 词汇弹窗组件 v3.0 - 手机端 Bottom Sheet + 全屏详情版本
 * @param {string} word - 单词
 * @param {object} vocabInfo - 词汇信息 { phonetic, meaning, example, ... }
 * @param {function} onClose - 关闭回调
 * @param {object} position - 弹窗位置 { x, y }
 * @param {function} onPauseVideo - 暂停视频回调
 * @param {boolean} isMobile - 是否为手机端
 */
const VocabPopover = ({ word, vocabInfo, onClose, position, onPauseVideo, isMobile = false }) => {
    const [showFullDetail, setShowFullDetail] = useState(false);

    // 计算PC端安全的弹窗位置（防溢出）
    const safePosition = useMemo(() => {
        if (isMobile) return position; // 手机端不需要计算

        const popoverWidth = 320;
        const popoverHeight = 350;
        let x = position.x;
        let y = position.y;

        // 右边界检测
        if (x + popoverWidth > window.innerWidth - 16) {
            x = window.innerWidth - popoverWidth - 16;
        }
        // 左边界检测
        if (x < 16) x = 16;
        // 下边界检测 - 如果超出则显示在上方
        if (y + popoverHeight > window.innerHeight + window.scrollY) {
            y = position.y - popoverHeight - 40;
        }
        // 上边界检测
        if (y < window.scrollY + 16) {
            y = window.scrollY + 16;
        }

        return { x, y };
    }, [position, isMobile]);

    // 滚动到对应的词汇卡片（PC端使用）
    const scrollToVocabCard = () => {
        const vocabCards = document.querySelectorAll('[data-vocab-word]');
        const targetCard = Array.from(vocabCards).find(
            card => card.getAttribute('data-vocab-word')?.toLowerCase() === word.toLowerCase()
        );
        if (targetCard) {
            targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetCard.classList.add('ring-2', 'ring-indigo-500', 'ring-offset-2');
            setTimeout(() => {
                targetCard.classList.remove('ring-2', 'ring-indigo-500', 'ring-offset-2');
            }, 2000);
        }
    };

    // 「查看完整卡片」按钮处理
    const handleViewFullCard = (e) => {
        e.stopPropagation();
        if (onPauseVideo) onPauseVideo();

        if (isMobile) {
            // 手机端：展开为全屏详情
            setShowFullDetail(true);
        } else {
            // PC端：滚动到词汇卡片
            scrollToVocabCard();
            onClose();
        }
    };

    // 关闭全屏详情
    const handleCloseFullDetail = () => {
        setShowFullDetail(false);
        onClose();
    };

    // 全屏词汇详情页（仅手机端）
    if (showFullDetail && isMobile) {
        return (
            <div className="fixed inset-0 z-[60] bg-white overflow-y-auto animate-fade-in-scale">
                {/* 顶部导航栏 */}
                <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm">
                    <button
                        onClick={handleCloseFullDetail}
                        className="flex items-center gap-1 text-gray-600 hover:text-gray-800"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        <span>返回</span>
                    </button>
                    <h2 className="text-lg font-bold text-gray-800">{word}</h2>
                    <div className="w-16"></div>
                </div>

                {/* 词汇详情内容 */}
                <div className="p-5 space-y-5">
                    {/* 单词标题 */}
                    <div className="flex items-center gap-3">
                        <svg className="w-6 h-6 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                        </svg>
                        <h1 className="text-2xl font-bold text-gray-800">{word}</h1>
                    </div>

                    {/* 发音区域 */}
                    <div className="bg-indigo-50 rounded-lg p-4">
                        {vocabInfo.ipa_us && (
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-sm text-gray-500 font-medium w-8">US</span>
                                <span className="font-mono text-lg text-indigo-600">/{vocabInfo.ipa_us}/</span>
                            </div>
                        )}
                        {vocabInfo.ipa_uk && (
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-500 font-medium w-8">UK</span>
                                <span className="font-mono text-lg text-indigo-600">/{vocabInfo.ipa_uk}/</span>
                            </div>
                        )}
                        {!vocabInfo.ipa_us && !vocabInfo.ipa_uk && vocabInfo.phonetic && (
                            <div className="font-mono text-lg text-indigo-600">{vocabInfo.phonetic}</div>
                        )}
                    </div>

                    {/* 词性和释义 */}
                    <div className="bg-white rounded-lg border p-4">
                        <div className="flex items-start gap-3">
                            <span className="inline-block bg-blue-100 text-blue-700 text-sm px-3 py-1 rounded font-medium">
                                {vocabInfo.type || '单词'}
                            </span>
                            <p className="text-gray-800 text-lg font-medium flex-1">
                                {vocabInfo.meaning}
                            </p>
                        </div>
                    </div>

                    {/* 英文释义 */}
                    {vocabInfo.definition && (
                        <div className="bg-gray-50 rounded-lg p-4">
                            <h3 className="text-sm font-bold text-gray-500 mb-2">英文释义</h3>
                            <p className="text-gray-700 italic leading-relaxed">
                                {vocabInfo.definition}
                            </p>
                        </div>
                    )}

                    {/* 例句 */}
                    {(vocabInfo.example || (vocabInfo.examples && vocabInfo.examples.length > 0)) && (
                        <div className="bg-white rounded-lg border p-4">
                            <h3 className="text-sm font-bold text-gray-500 mb-3">例句</h3>
                            {vocabInfo.example && (
                                <div className="mb-3">
                                    <p className="text-gray-800 leading-relaxed">{vocabInfo.example}</p>
                                    {vocabInfo.exampleCn && (
                                        <p className="text-gray-500 text-sm mt-1">{vocabInfo.exampleCn}</p>
                                    )}
                                </div>
                            )}
                            {vocabInfo.examples && vocabInfo.examples.map((ex, i) => (
                                <div key={i} className="mb-3 last:mb-0">
                                    <p className="text-gray-800 leading-relaxed">{ex.en}</p>
                                    <p className="text-gray-500 text-sm mt-1">{ex.cn}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 搭配 */}
                    {vocabInfo.collocations && vocabInfo.collocations.length > 0 && (
                        <div className="bg-white rounded-lg border p-4">
                            <h3 className="text-sm font-bold text-gray-500 mb-3">常见搭配</h3>
                            <div className="flex flex-wrap gap-2">
                                {vocabInfo.collocations.map((col, i) => (
                                    <span key={i} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-sm">
                                        {col}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 外部词典链接 */}
                    <div className="pt-4 border-t">
                        <h3 className="text-sm font-bold text-gray-500 mb-3">查看更多</h3>
                        <div className="flex gap-3">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    // 确保视频保持暂停状态
                                    if (onPauseVideo) onPauseVideo();
                                    window.open(`https://www.google.com/search?q=${word}+meaning`, '_blank');
                                }}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
                                </svg>
                                Google
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    // 确保视频保持暂停状态
                                    if (onPauseVideo) onPauseVideo();
                                    window.open(`https://dict.youdao.com/result?word=${word}&lang=en`, '_blank');
                                }}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                </svg>
                                有道词典
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // 手机端：底部全宽弹窗（Bottom Sheet）
    if (isMobile) {
        return (
            <>
                {/* 遮罩层 */}
                <div
                    className="fixed inset-0 z-40 bg-black/30"
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                />

                {/* 底部弹窗 */}
                <div
                    className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl animate-slide-up max-h-[75vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* 拖拽指示条 */}
                    <div className="flex justify-center pt-3 pb-2">
                        <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
                    </div>

                    <div className="px-5 pb-6">
                        {/* 单词标题 */}
                        <div className="flex items-center gap-2 mb-3">
                            <svg className="w-5 h-5 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                            </svg>
                            <h3 className="text-xl font-bold text-gray-800">{word}</h3>
                        </div>

                        {/* 音标 */}
                        {(vocabInfo.ipa_us || vocabInfo.phonetic) && (
                            <div className="mb-3">
                                {vocabInfo.ipa_us && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-xs text-gray-400 font-medium w-8">US</span>
                                        <span className="font-mono text-indigo-600">/{vocabInfo.ipa_us}/</span>
                                    </div>
                                )}
                                {!vocabInfo.ipa_us && vocabInfo.phonetic && (
                                    <div className="font-mono text-sm text-indigo-600">{vocabInfo.phonetic}</div>
                                )}
                            </div>
                        )}

                        {/* 词性和释义 */}
                        <div className="mb-4">
                            <span className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded mr-2">
                                {vocabInfo.type || '单词'}
                            </span>
                            <span className="text-gray-700 font-medium">
                                {vocabInfo.meaning}
                            </span>
                        </div>

                        {/* 英文释义 */}
                        {vocabInfo.definition && (
                            <div className="mb-3 p-3 bg-gray-50 rounded">
                                <p className="text-sm text-gray-600 italic">
                                    {vocabInfo.definition}
                                </p>
                            </div>
                        )}

                        {/* 例句（仅显示第一个） */}
                        {vocabInfo.example && (
                            <div className="border-t pt-3 mb-3">
                                <p className="text-xs text-gray-500 mb-1">例句</p>
                                <p className="text-sm text-gray-700 italic leading-relaxed">
                                    {vocabInfo.example}
                                </p>
                                {vocabInfo.exampleCn && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        {vocabInfo.exampleCn}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* 操作按钮 */}
                        <div className="flex flex-col gap-3 mt-4 pt-3 border-t">
                            <button
                                onClick={handleViewFullCard}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-sm font-medium"
                            >
                                <span>查看完整卡片</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>

                            <div className="flex gap-2">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onPauseVideo) onPauseVideo();
                                        window.open(`https://www.google.com/search?q=${word}+meaning`, '_blank');
                                    }}
                                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
                                >
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
                                    </svg>
                                    Google
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onPauseVideo) onPauseVideo();
                                        window.open(`https://dict.youdao.com/result?word=${word}&lang=en`, '_blank');
                                    }}
                                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
                                >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                    </svg>
                                    有道
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    // PC端：原有弹窗，添加边界检测
    return (
        <>
            {/* 遮罩层 */}
            <div
                className="fixed inset-0 z-40"
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                }}
            />

            {/* 弹窗主体 */}
            <div
                className="fixed z-50 bg-white rounded-lg shadow-2xl border border-gray-200 p-5 max-w-sm"
                style={{
                    left: `${safePosition.x}px`,
                    top: `${safePosition.y}px`,
                    transform: 'translateY(10px)'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* 关闭按钮 */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                    className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* 单词标题 */}
                <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                    </svg>
                    <h3 className="text-xl font-bold text-gray-800">{word}</h3>
                </div>

                {/* 音标 */}
                {(vocabInfo.ipa_us || vocabInfo.phonetic) && (
                    <div className="mb-3">
                        {vocabInfo.ipa_us && (
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-xs text-gray-400 font-medium w-8">US</span>
                                <span className="font-mono text-indigo-600">/{vocabInfo.ipa_us}/</span>
                            </div>
                        )}
                        {!vocabInfo.ipa_us && vocabInfo.phonetic && (
                            <div className="font-mono text-sm text-indigo-600">{vocabInfo.phonetic}</div>
                        )}
                    </div>
                )}

                {/* 词性和释义 */}
                <div className="mb-4">
                    <span className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded mr-2">
                        {vocabInfo.type || '单词'}
                    </span>
                    <span className="text-gray-700 font-medium">
                        {vocabInfo.meaning}
                    </span>
                </div>

                {/* 英文释义 */}
                {vocabInfo.definition && (
                    <div className="mb-3 p-3 bg-gray-50 rounded">
                        <p className="text-sm text-gray-600 italic">
                            {vocabInfo.definition}
                        </p>
                    </div>
                )}

                {/* 例句 */}
                {vocabInfo.example && (
                    <div className="border-t pt-3 mb-3">
                        <p className="text-xs text-gray-500 mb-1">例句</p>
                        <p className="text-sm text-gray-700 italic leading-relaxed">
                            {vocabInfo.example}
                        </p>
                        {vocabInfo.exampleCn && (
                            <p className="text-xs text-gray-500 mt-1">
                                {vocabInfo.exampleCn}
                            </p>
                        )}
                    </div>
                )}

                {/* 快捷操作按钮 */}
                <div className="flex flex-col gap-2 mt-4 pt-3 border-t">
                    <button
                        onClick={handleViewFullCard}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-sm font-medium"
                    >
                        <span>查看完整卡片</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    <div className="flex gap-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onPauseVideo) onPauseVideo();
                                window.open(`https://www.google.com/search?q=${word}+meaning`, '_blank');
                            }}
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-50 text-gray-600 rounded hover:bg-gray-100 transition text-sm"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
                            </svg>
                            Google
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onPauseVideo) onPauseVideo();
                                window.open(`https://dict.youdao.com/result?word=${word}&lang=en`, '_blank');
                            }}
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-50 text-gray-600 rounded hover:bg-gray-100 transition text-sm"
                        >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                            </svg>
                            有道
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default VocabPopover;
