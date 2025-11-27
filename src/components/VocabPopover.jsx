import { useState } from 'react';

/**
 * 词汇弹窗组件
 * @param {string} word - 单词
 * @param {object} vocabInfo - 词汇信息 { phonetic, meaning, example }
 * @param {function} onClose - 关闭回调
 */
const VocabPopover = ({ word, vocabInfo, onClose, position }) => {
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

                {/* 音标 */}
                {vocabInfo.phonetic && (
                    <div className="text-gray-600 mb-3 font-mono text-sm">
                        {vocabInfo.phonetic}
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
                    <div className="border-t pt-3">
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
                <div className="flex gap-2 mt-4 pt-3 border-t">
                    <button
                        onClick={() => window.open(`https://www.google.com/search?q=${word}+meaning`, '_blank')}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 transition text-sm"
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                        Google
                    </button>
                    <button
                        onClick={() => window.open(`https://cn.bing.com/dict/search?q=${word}`, '_blank')}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition text-sm"
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                        </svg>
                        必应
                    </button>
                    <button
                        onClick={() => window.open(`https://dict.youdao.com/search?q=${word}`, '_blank')}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-50 text-green-600 rounded hover:bg-green-100 transition text-sm"
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
                        </svg>
                        有道
                    </button>
                </div>
            </div>
        </>
    );
};

export default VocabPopover;
