/**
 * 句子复习卡片组件
 * @param {object} sentence - 句子对象 { id, videoId, index, en, cn, episode, title }
 * @param {boolean} isFlipped - 是否已翻面
 * @param {function} onFlip - 翻面回调
 * @param {boolean} canReveal - 是否允许翻面（冷却期后为 true）
 * @param {function} onGoToVideo - 去原视频回调
 */
const SentenceReviewCard = ({
    sentence,
    isFlipped,
    onFlip,
    canReveal = true,
    onGoToVideo
}) => {
    if (!sentence) return null;

    const { en, cn, index, episode, title } = sentence;

    // 点击卡片时需要检查 canReveal
    const handleCardClick = () => {
        if (!canReveal) return; // 冷却期内不允许翻面
        onFlip();
    };

    return (
        <div
            onClick={handleCardClick}
            className={`w-[90%] max-w-lg mx-auto bg-white rounded-2xl shadow-xl transition-all duration-300 hover:shadow-2xl min-h-[280px] md:min-h-[360px] flex flex-col ${canReveal ? 'cursor-pointer transform hover:scale-[1.02]' : 'cursor-default'
                }`}
        >
            {/* 正面：只显示英文句子 */}
            {!isFlipped ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    {/* 英文句子 */}
                    <p className="text-xl md:text-2xl text-gray-800 leading-relaxed font-medium">
                        {en}
                    </p>

                    {/* 提示文案 */}
                    <p className="mt-8 text-sm text-gray-400">
                        先在心里用中文复述这句话的大意，再点卡片看答案 👀
                    </p>
                </div>
            ) : (
                /* 背面：显示中英对照 */
                <div className="flex-1 flex flex-col p-6 overflow-y-auto">
                    {/* 英文句子 */}
                    <div className="mb-4">
                        <p className="text-xl md:text-2xl text-gray-800 leading-relaxed font-medium">
                            {en}
                        </p>
                    </div>

                    {/* 分割线 */}
                    <div className="border-t border-gray-200 my-4"></div>

                    {/* 中文翻译 */}
                    {cn && (
                        <div className="mb-4">
                            <p className="text-lg text-indigo-700 leading-relaxed">
                                {cn}
                            </p>
                        </div>
                    )}

                    {/* 来源信息 */}
                    <div className="mt-auto pt-4 text-sm text-gray-400">
                        {episode && <span>第 {episode} 期</span>}
                        {episode && title && <span> · </span>}
                        {title && <span>{title}</span>}
                        {typeof index === 'number' && (
                            <span className="ml-2">（第 {index + 1} 句）</span>
                        )}
                    </div>

                    {/* 底部按钮区域 */}
                    <div className="flex gap-2 mt-4 pt-4 border-t">
                        {/* 去原视频 */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onGoToVideo) {
                                    onGoToVideo();
                                }
                            }}
                            className="flex-1 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            去原视频
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SentenceReviewCard;
