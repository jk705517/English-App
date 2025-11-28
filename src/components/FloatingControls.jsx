import { useState } from 'react';

/**
 * 浮动控制按钮组
 * @param {boolean} isPlaying - 是否正在播放
 * @param {function} onTogglePlay - 切换播放/暂停回调
 * @param {boolean} isLooping - 是否单句循环
 * @param {function} onToggleLoop - 切换循环回调
 * @param {boolean} isFavorited - 是否已收藏
 * @param {function} onToggleFavorite - 切换收藏回调
 * @param {boolean} isLearned - 是否已标记学习
 * @param {function} onToggleLearned - 切换学习状态回调
 */
const FloatingControls = ({
    isPlaying,
    onTogglePlay,
    isLooping,
    onToggleLoop,
    isFavorited,
    onToggleFavorite,
    isLearned,
    onToggleLearned
}) => {
    const [showTooltip, setShowTooltip] = useState(null);

    const buttons = [
        {
            id: 'play',
            icon: isPlaying ? (
                // 暂停图标
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
            ) : (
                // 播放图标
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
            ),
            label: isPlaying ? '暂停' : '播放',
            active: isPlaying,
            onClick: onTogglePlay,
            activeColor: 'bg-indigo-500 hover:bg-indigo-600',
            inactiveColor: 'bg-gray-600 hover:bg-gray-700'
        },
        {
            id: 'loop',
            icon: isLooping ? (
                // 循环开启图标
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
            ) : (
                // 循环关闭图标
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
            ),
            label: '单句循环',
            active: isLooping,
            onClick: onToggleLoop,
            activeColor: 'bg-blue-500 hover:bg-blue-600',
            inactiveColor: 'bg-gray-600 hover:bg-gray-700'
        },
        {
            id: 'favorite',
            icon: isFavorited ? (
                // 已收藏图标（实心）
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
            ) : (
                // 未收藏图标（空心）
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
            ),
            label: '收藏',
            active: isFavorited,
            onClick: onToggleFavorite,
            activeColor: 'bg-yellow-500 hover:bg-yellow-600',
            inactiveColor: 'bg-gray-600 hover:bg-gray-700'
        },
        {
            id: 'learned',
            icon: isLearned ? (
                // 已学习图标（实心对勾）
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
            ) : (
                // 未学习图标（空心对勾）
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            label: '标记已学',
            active: isLearned,
            onClick: onToggleLearned,
            activeColor: 'bg-green-500 hover:bg-green-600',
            inactiveColor: 'bg-gray-600 hover:bg-gray-700'
        }
    ];

    return (
        <div className="fixed right-6 bottom-24 z-30 flex flex-col gap-3">
            {buttons.map((button) => (
                <div key={button.id} className="relative group">
                    {/* 按钮 */}
                    <button
                        onClick={button.onClick}
                        onMouseEnter={() => setShowTooltip(button.id)}
                        onMouseLeave={() => setShowTooltip(null)}
                        className={`
              w-12 h-12 rounded-full shadow-lg 
              flex items-center justify-center
              text-white transition-all duration-200
              ${button.active ? button.activeColor : button.inactiveColor}
              hover:scale-110 active:scale-95
            `}
                        aria-label={button.label}
                    >
                        {button.icon}
                    </button>

                    {/* Tooltip */}
                    {showTooltip === button.id && (
                        <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap">
                            <div className="bg-gray-800 text-white text-sm px-3 py-1.5 rounded shadow-lg">
                                {button.label}
                                {/* 小三角形 */}
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full">
                                    <div className="border-8 border-transparent border-l-gray-800"></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default FloatingControls;
