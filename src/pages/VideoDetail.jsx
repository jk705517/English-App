import React, { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactPlayer from 'react-player';
import { mockVideos } from '../data/mockData';

const VideoDetail = () => {
    const { id } = useParams();
    const playerRef = useRef(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [videoData, setVideoData] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    // 从 localStorage 读取用户上次选择的模式，如果没有则默认为 'dual'
    const [mode, setMode] = useState(() => {
        return localStorage.getItem('studyMode') || 'dual';
    });

    // 初始化数据
    useEffect(() => {
        const video = mockVideos.find(v => v.id === parseInt(id));
        if (video) {
            setVideoData(video);
        }
    }, [id]);

    // 监听 mode 变化，自动保存到 localStorage
    useEffect(() => {
        localStorage.setItem('studyMode', mode);
    }, [mode]);

    // 处理点击字幕跳转
    const handleSeek = (seconds) => {
        console.log("试图跳转到秒数:", seconds);
        if (playerRef.current) {
            playerRef.current.seekTo(seconds, 'seconds');
            setIsPlaying(true);
        } else {
            console.log("播放器实例未找到！");
        }
    };

    // Cloze 模式：随机挖空 30% 的单词
    const renderClozeText = (text) => {
        const words = text.split(' ');
        return words.map((word, idx) => {
            const shouldBlur = Math.random() < 0.3;
            if (shouldBlur) {
                return (
                    <span
                        key={idx}
                        className="inline-block mx-1 bg-gray-200 text-transparent rounded px-1 select-none transition-all duration-200 hover:bg-indigo-100 hover:text-indigo-700 cursor-pointer"
                    >
                        {word}
                    </span>
                );
            }
            return <span key={idx}>{word} </span>;
        });
    };

    if (!videoData) return <div className="p-8">Loading...</div>;

    return (
        <div className="flex h-screen bg-gray-50">
            {/* 左侧：视频区 */}
            <div className="w-2/3 p-6 flex flex-col">
                <Link to="/" className="mb-4 text-gray-600 hover:text-blue-600 flex items-center">
                    ← 返回首页
                </Link>

                <h1 className="text-2xl font-bold mb-2">{videoData.title}</h1>

                <div className="flex-1 bg-black rounded-xl overflow-hidden shadow-lg relative">
                    <ReactPlayer
                        ref={playerRef}
                        url={videoData.videoUrl}
                        width="100%"
                        height="100%"
                        controls={true}
                        playing={isPlaying}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onProgress={({ playedSeconds }) => {
                            setCurrentTime(playedSeconds);
                        }}
                        config={{
                            youtube: {
                                playerVars: { showinfo: 1 }
                            }
                        }}
                    />
                </div>

                {/* 下方：单词卡片 */}
                <div className="mt-6 p-6 bg-white rounded-xl shadow-sm">
                    <h3 className="text-xl font-bold mb-4">重点词汇</h3>
                    <div className="grid grid-cols-3 gap-4">
                        {videoData.vocab?.map((item, index) => (
                            <div key={index} className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                                <div className="flex items-end mb-2">
                                    <span className="text-lg font-bold text-indigo-700 mr-2">{item.word}</span>
                                    <span className="text-sm text-gray-500">{item.type}</span>
                                </div>
                                <p className="text-gray-600 font-medium">{item.meaning}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 右侧：字幕区 */}
            <div className="w-1/3 bg-white border-l flex flex-col h-full">
                <div className="p-4 border-b flex items-center justify-between">
                    <h2 className="text-lg font-bold flex items-center">
                        📖 字幕
                    </h2>

                    {/* 磨砂玻璃风格多模式工具栏 */}
                    <div className="flex gap-2 bg-gray-50 p-1 rounded-full">
                        <button
                            onClick={() => setMode('dual')}
                            className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 ${mode === 'dual'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            双语
                        </button>
                        <button
                            onClick={() => setMode('en')}
                            className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 ${mode === 'en'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            英
                        </button>
                        <button
                            onClick={() => setMode('cn')}
                            className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 ${mode === 'cn'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            中
                        </button>
                        <button
                            onClick={() => setMode('cloze')}
                            className={`px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 ${mode === 'cloze'
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            挖空
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {videoData.transcript?.map((item, index) => {
                        const nextItem = videoData.transcript[index + 1];
                        const isActive = currentTime >= item.start && (!nextItem || currentTime < nextItem.start);

                        return (
                            <div
                                key={index}
                                onClick={() => handleSeek(item.start)}
                                className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ${isActive
                                        ? 'bg-indigo-100 border-l-4 border-indigo-600 shadow-sm'
                                        : 'hover:bg-gray-50 text-gray-600'
                                    }`}
                            >
                                {/* 英文部分 - 根据模式显示 */}
                                {mode === 'cloze' ? (
                                    <p className="text-sm font-medium mb-1">
                                        {renderClozeText(item.text)}
                                    </p>
                                ) : (
                                    <p
                                        className={`text-sm font-medium mb-1 ${mode === 'cn'
                                                ? 'bg-gray-200 select-none text-transparent transition-all duration-300 hover:bg-transparent hover:text-gray-700 rounded px-1'
                                                : ''
                                            }`}
                                    >
                                        {item.text}
                                    </p>
                                )}

                                {/* 中文部分 - 根据模式显示 */}
                                <p
                                    className={`text-xs ${mode === 'en'
                                            ? 'bg-gray-200 select-none text-transparent transition-all duration-300 hover:bg-transparent hover:text-gray-700 rounded px-1'
                                            : 'text-gray-400'
                                        }`}
                                >
                                    {item.cn}
                                </p>

                                <span className="text-xs text-indigo-400 mt-1 block">
                                    {Math.floor(item.start)}s
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default VideoDetail;