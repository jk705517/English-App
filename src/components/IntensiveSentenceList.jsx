import React, { useEffect, useRef, useState } from 'react';
import IntensiveCard from './IntensiveCard';

const IntensiveSentenceList = ({
    transcript,
    currentIndex,
    visitedSet,
    onSelectSentence,
    // Favorite props
    favoriteSentenceIds = [],
    onToggleFavorite,
    // Notebook props
    onAddToNotebook,
    // Video ID for generating fallback sentence IDs
    videoId
}) => {
    const activeRef = useRef(null);
    const stickyHeaderRef = useRef(null);
    const hasMountedRef = useRef(false);
    const [showExplanations, setShowExplanations] = useState(true);

    // Auto-scroll to active item
    // 首次挂载（从其他模式切到精读）用 'auto' 直接定位，避免看到画面被拉的感觉
    // 后续 currentIndex 变化（播放推进）用 'smooth' 保持平滑跟随
    // 手机端视频区是 fixed 顶栏，高度随视口宽度变化，固定 scroll-mt 无法兼容所有宽度
    // 这里动态测量视口顶部 fixed 元素的最低边，作为内联 scroll-margin-top 写到卡片上
    // 由 scrollIntoView 自动处理滚动容器（桌面是右侧面板，手机是 window）
    useEffect(() => {
        if (!activeRef.current) return;
        const card = activeRef.current;
        let topInset = 0;
        const halfH = window.innerHeight / 2;
        // 手机端：测量视口顶部 fixed 元素的最低边（视频区+tab 栏）
        document.querySelectorAll('*').forEach(el => {
            const cs = window.getComputedStyle(el);
            if (cs.position !== 'fixed') return;
            const r = el.getBoundingClientRect();
            if (r.top < halfH && r.width > window.innerWidth * 0.5 && r.bottom > topInset && r.bottom < halfH) {
                topInset = r.bottom;
            }
        });
        // 桌面端：精读列表自己的 sticky 进度条只在「右侧面板」这种子滚动容器里真的会粘顶
        // 手机端整页 window 滚动，sticky 进度条会随内容滚走，不需要加它的高度
        let p = card.parentElement;
        let hasSubScroll = false;
        while (p) {
            const cs = window.getComputedStyle(p);
            if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && p.scrollHeight > p.clientHeight) {
                hasSubScroll = true;
                break;
            }
            p = p.parentElement;
        }
        if (hasSubScroll && stickyHeaderRef.current) {
            topInset += stickyHeaderRef.current.offsetHeight;
        }
        card.style.scrollMarginTop = (topInset + 8) + 'px';
        card.scrollIntoView({
            behavior: hasMountedRef.current ? 'smooth' : 'auto',
            block: 'start'
        });
        hasMountedRef.current = true;
    }, [currentIndex]);

    if (!transcript || transcript.length === 0) {
        return (
            <div className="p-8 text-center text-gray-400">
                暂无字幕数据
            </div>
        );
    }

    const visitedCount = visitedSet ? visitedSet.size : 0;
    const totalCount = transcript.length;
    const progressPercentage = Math.min(100, (visitedCount / totalCount) * 100);

    // Helper: generate stable ID for sentence
    // Uses existing id if available, otherwise creates fallback from videoId-index
    const getSentenceId = (item, index) => {
        if (item.id !== undefined && item.id !== null) {
            return item.id;
        }
        // Fallback: videoId-index (e.g., "123-0", "123-1")
        return `${videoId}-${index}`;
    };

    return (
        <div className="space-y-6">
            {/* Header: Progress & Toggle */}
            <div ref={stickyHeaderRef} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sticky top-0 z-10">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900">
                            精读模式 · 第 {currentIndex + 1} 句 / 共 {totalCount} 句
                        </span>
                        <span className="text-xs text-gray-500 mt-0.5">
                            已精读 {visitedCount} 句
                        </span>
                    </div>

                    {/* 开关区域：紧凑布局，适配手机端 */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`text-xs font-medium whitespace-nowrap ${!showExplanations ? 'text-violet-500' : 'text-gray-400'}`}>
                            只看中英
                        </span>
                        <button
                            onClick={() => setShowExplanations(!showExplanations)}
                            className={`
                                relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-1
                                ${showExplanations ? 'bg-violet-400' : 'bg-gray-200'}
                            `}
                        >
                            <span
                                className={`
                                    inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform
                                    ${showExplanations ? 'translate-x-[18px]' : 'translate-x-0.5'}
                                `}
                            />
                        </button>
                        <span className={`text-xs font-medium whitespace-nowrap ${showExplanations ? 'text-violet-500' : 'text-gray-400'}`}>
                            中文解析
                        </span>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                        className="bg-violet-400 h-2 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>
            </div>

            {/* List of Cards */}
            <div className="space-y-4 pb-20">
                {transcript.map((item, index) => {
                    const isActive = index === currentIndex;
                    const isVisited = visitedSet ? visitedSet.has(index) : false;
                    // Generate stable sentence ID (use existing or fallback)
                    const sentenceId = getSentenceId(item, index);
                    const isFavorite = favoriteSentenceIds.some(fid => String(fid) === String(sentenceId));
                    // Enrich sentence object with stable id for IntensiveCard
                    const enrichedSentence = { ...item, id: sentenceId };

                    return (
                        <div key={index} ref={isActive ? activeRef : null}>
                            <IntensiveCard
                                index={index}
                                sentence={enrichedSentence}
                                isActive={isActive}
                                isVisited={isVisited}
                                showExplanations={showExplanations}
                                onSelect={onSelectSentence}
                                isFavorite={isFavorite}
                                onToggleFavorite={onToggleFavorite}
                                onAddToNotebook={onAddToNotebook}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default IntensiveSentenceList;
