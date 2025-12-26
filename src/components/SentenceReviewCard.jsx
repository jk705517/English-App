/**
 * 句子复习卡片组件
 * @param {object} sentence - 句子对象 { id, videoId, index, en, cn, episode, title, analysis }
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

    const { en, cn, index, episode, title, analysis } = sentence;

    // 解析 analysis 中的字段
    const takeaway = analysis?.takeaway || '';
    const expressions = analysis?.expressions || [];
    const context = analysis?.context || '';

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
                /* 背面：显示完整信息 */
                <div className="flex-1 flex flex-col p-6 overflow-y-auto">
                    {/* 英文句子 */}
                    <div className="mb-3">
                        <p className="text-lg md:text-xl text-gray-800 leading-relaxed font-medium">
                            {en}
                        </p>
                    </div>

                    {/* 中文翻译 */}
                    {cn && (
                        <div className="mb-4 pb-4 border-b border-gray-100">
                            <p className="text-base text-violet-500 leading-relaxed">
                                {cn}
                            </p>
                        </div>
                    )}

                    {/* 学习要点 */}
                    {takeaway && (
                        <div className="mb-4">
                            <h4 className="text-xs font-medium text-gray-400 mb-1">学习要点</h4>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                {takeaway}
                            </p>
                        </div>
                    )}

                    {/* 地道表达 */}
                    {expressions.length > 0 && (
                        <div className="mb-4">
                            <h4 className="text-xs font-medium text-gray-400 mb-2">地道表达</h4>
                            <div className="space-y-2">
                                {expressions.slice(0, 2).map((expr, idx) => (
                                    <div key={idx} className="bg-violet-50 rounded-lg p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium text-violet-500">{expr.phrase || expr.word}</span>
                                            <span className="text-sm text-gray-600">{expr.explanation || expr.chinese}</span>
                                        </div>
                                        {(expr.example_en || expr.example) && (
                                            <div className="text-sm">
                                                <p className="text-gray-700">{expr.example_en || expr.example}</p>
                                                {(expr.example_cn || expr.exampleCn) && (
                                                    <p className="text-gray-500 text-xs mt-0.5">{expr.example_cn || expr.exampleCn}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 背景知识 */}
                    {context && (
                        <div className="mb-4">
                            <h4 className="text-xs font-medium text-gray-400 mb-1">背景知识</h4>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                {context}
                            </p>
                        </div>
                    )}

                    {/* 来源信息 */}
                    <div className="mt-auto pt-3 text-xs text-gray-400">
                        {episode && <span>第 {episode} 期</span>}
                        {episode && title && <span> · </span>}
                        {title && <span>{title}</span>}
                        {typeof index === 'number' && (
                            <span className="ml-2">（第 {index + 1} 句）</span>
                        )}
                    </div>

                    {/* 底部按钮区域 */}
                    <div className="mt-3 pt-3 border-t">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onGoToVideo) {
                                    onGoToVideo();
                                }
                            }}
                            className="w-full py-2 text-sm text-white bg-violet-400 rounded-lg hover:bg-violet-400 transition-colors"
                        >
                            去原视频学习
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SentenceReviewCard;
