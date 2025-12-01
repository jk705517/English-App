/**
 * 词汇弹窗组件
 * @param {string} word - 单词
 * @param {object} vocabInfo - 词汇信息 { phonetic, meaning, example }
 * @param {function} onClose - 关闭回调
 * @param {function} onPauseVideo - 暂停视频回调
 */
const VocabPopover = ({ word, vocabInfo, onClose, position, onPauseVideo }) => {
    return (
        <>
            {/* 遮罩层 - 点击关闭 */}
            <div
                className="fixed inset-0 z-40"
                onClick={onClose}
            />

            {/* 弹窗主体 */}
            <div
                className="fixed z-50 bg-white rounded-lg shadow-2xl border border-gray-200 p-5 max-w-sm"
                style={{
                    left: `${position.x}px`,
                    top: `${position.y}px`,
                    transform: 'translateY(10px)'
                }}
            >
                {/* 关闭按钮 */}
                <button
                    onClick={onClose}
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

                {/* 音标 - 只显示美音 */}
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

                {/* 英文释义（如果有） */}
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
                        onClick={() => {
                            console.log('🔴 查看完整卡片 - 暂停视频');
                            // 暂停视频
                            if (onPauseVideo) {
                                console.log('✅ onPauseVideo存在，调用中...');
                                onPauseVideo();
                            } else {
                                console.log('❌ onPauseVideo不存在!');
                            }

                            // 滚动到词汇卡片
                            const vocabCards = document.querySelectorAll('[data-vocab-word]');
                            const targetCard = Array.from(vocabCards).find(
                                card => card.getAttribute('data-vocab-word')?.toLowerCase() === word.toLowerCase()
                            );
                            if (targetCard) {
                                targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                // 添加高亮效果
                                targetCard.classList.add('ring-2', 'ring-indigo-500', 'ring-offset-2');
                                setTimeout(() => {
                                    targetCard.classList.remove('ring-2', 'ring-indigo-500', 'ring-offset-2');
                                }, 2000);
                            }
                            onClose();
                        }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-sm font-medium"
                    >
                        <span>查看完整卡片</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                console.log('🔴 Google - 暂停视频');
                                if (onPauseVideo) {
                                    console.log('✅ onPauseVideo存在，调用中...');
                                    onPauseVideo();
                                } else {
                                    console.log('❌ onPauseVideo不存在!');
                                }
                                window.open(`https://www.google.com/search?q=${word}+meaning`, '_blank');
                            }}
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-50 text-gray-600 rounded hover:bg-gray-100 transition text-sm"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
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
