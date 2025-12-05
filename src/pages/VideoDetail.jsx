import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactPlayer from 'react-player';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { progressService } from '../services/progressService';
import { favoritesService } from '../services/favoritesService';
import HighlightedText from '../components/HighlightedText';
import SubtitleItem from '../components/SubtitleItem';
import FloatingControls from '../components/FloatingControls';
import DictationInput from '../components/DictationInput';

// 交互式填空组件
const ClozeInput = ({ originalWord, onFocus, onBlur }) => {
    const [value, setValue] = useState('');
    const [status, setStatus] = useState('idle');

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            const cleanWord = originalWord.replace(/[.,!?;:]/g, '');
            if (value.trim().toLowerCase() === cleanWord.toLowerCase()) {
                setStatus('correct');
            } else {
                setStatus('error');
                setTimeout(() => setStatus('idle'), 500);
            }
        }
    };

    if (status === 'correct') {
        return <span className="text-green-600 font-medium mx-1">{originalWord}</span>;
    }

    return (
        <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={onFocus}
            onBlur={onBlur}
            style={{ width: `${Math.max(originalWord.length * 0.65, 2.5)}em` }}
            className={`inline-block text-center font-medium rounded mx-1 px-1 align-baseline bg-gray-100 text-indigo-600 border-none outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors ${status === 'error' ? 'animate-shake text-red-500 bg-red-50' : ''}`}
        />
    );
};

// TTS 朗读函数
const speak = (text, lang = 'en-US') => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
};

const VideoDetail = () => {
    const { id } = useParams();
    const { user } = useAuth();
    const playerRef = useRef(null);
    const playerContainerRef = useRef(null);
    const transcriptRefs = useRef([]);
    const [currentTime, setCurrentTime] = useState(0);
    const [videoData, setVideoData] = useState(null);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [allVideos, setAllVideos] = useState([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLooping, setIsLooping] = useState(false);
    const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
    // 移动端：是否显示顶部"继续播放"小条（暂停+播放器被滚动隐藏时）
    const [showMobileMiniBar, setShowMobileMiniBar] = useState(false);
    // 移动端：暂停后是否已滚动（用于延迟切换小窗口模式）
    const [hasScrolledAfterPause, setHasScrolledAfterPause] = useState(false);
    // 检测是否为移动端
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
    // 移动端：是否在页面顶部（用于标题区显示控制）
    const [isAtTop, setIsAtTop] = useState(true);
    const [clozeCache, setClozeCache] = useState({});
    // 移动端：是否为首次加载（保证初始进入页面时显示标题区）
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [isSeeking, setIsSeeking] = useState(false);
    const [isBuffering, setIsBuffering] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [mode, setMode] = useState(() => localStorage.getItem('studyMode') || 'dual');
    const [isLearned, setIsLearned] = useState(false);
    const [isFavorite, setIsFavorite] = useState(false);
    const [dictationStats, setDictationStats] = useState({ correct: 0, wrong: 0, skipped: 0 });
    const [dictationIndex, setDictationIndex] = useState(0);
    const [hasPlayedCurrent, setHasPlayedCurrent] = useState(false);

    // 检测移动端
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Ref for dictation state
    const dictationStateRef = useRef({ isPlaying: false, isSeeking: false, dictationIndex: 0 });
    useEffect(() => {
        dictationStateRef.current = { isPlaying, isSeeking, dictationIndex };
    }, [isPlaying, isSeeking, dictationIndex]);

    // Load learned status
    useEffect(() => {
        const loadLearnedStatus = async () => {
            const learnedIds = await progressService.loadLearnedVideoIds(user);
            setIsLearned(learnedIds.includes(Number(id)));
        };
        loadLearnedStatus();
    }, [id, user]);

    // Load favorite status
    useEffect(() => {
        const loadFavoriteStatus = async () => {
            const favoriteIds = await favoritesService.loadFavoriteVideoIds(user);
            setIsFavorite(favoriteIds.includes(Number(id)));
        };
        loadFavoriteStatus();
    }, [id, user]);

    // Fetch video data
    useEffect(() => {
        const fetchVideoData = async () => {
            const { data, error } = await supabase
                .from('videos')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                console.error('Error fetching video:', error);
            } else {
                setVideoData(data);
            }
        };
        fetchVideoData();
    }, [id]);

    // Fetch all videos for navigation
    useEffect(() => {
        const fetchAllVideos = async () => {
            const { data, error } = await supabase
                .from('videos')
                .select('id, episode')
                .order('episode', { ascending: false });

            if (!error) {
                setAllVideos(data || []);
            }
        };
        fetchAllVideos();
    }, []);

    // 移动端：监听滚动，判断是否显示"继续播放"小条
    useEffect(() => {
        if (!isMobile) return;

        const handleScroll = () => {
            if (!playerContainerRef.current) return;

            // 检测是否在页面顶部（用于标题区显示控制）
            setIsAtTop(window.scrollY <= 10);

            // 暂停状态下，用户滚动时才标记为"已滚动"
            // 使用本地变量立即反映新状态，避免 React 闭包问题
            let scrolledAfterPause = hasScrolledAfterPause;
            if (!isPlaying && !hasScrolledAfterPause) {
                setHasScrolledAfterPause(true);
                scrolledAfterPause = true;
            }

            const rect = playerContainerRef.current.getBoundingClientRect();
            const isPlayerHidden = rect.bottom < 60;

            // 只有"暂停 + 已滚动 + 播放器隐藏"才显示小窗口
            setShowMobileMiniBar(!isPlaying && scrolledAfterPause && isPlayerHidden);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        // 不要初始调用 handleScroll()，避免页面加载时错误触发滚动标记

        return () => window.removeEventListener('scroll', handleScroll);
    }, [isMobile, isPlaying, hasScrolledAfterPause]);

    // 首次加载后，一旦有交互就关闭 isInitialLoad
    useEffect(() => {
        if (!isInitialLoad) return;
        if (isPlaying || hasScrolledAfterPause || showMobileMiniBar) {
            setIsInitialLoad(false);
        }
    }, [isPlaying, hasScrolledAfterPause, showMobileMiniBar, isInitialLoad]);

    // Save mode to localStorage and handle dictation mode switch
    useEffect(() => {
        localStorage.setItem('studyMode', mode);

        if (mode === 'dictation' && videoData?.transcript) {
            const firstSentenceTime = videoData.transcript[0].start;
            setDictationIndex(0);
            setDictationStats({ correct: 0, wrong: 0, skipped: 0 });
            setHasPlayedCurrent(false);
            setIsSeeking(true);
            setIsPlaying(false);

            setTimeout(() => {
                if (playerRef.current) {
                    playerRef.current.currentTime = firstSentenceTime;
                    setCurrentTime(firstSentenceTime);
                }
            }, 50);

            setTimeout(() => {
                setIsPlaying(false);
                if (playerRef.current?.pause) {
                    playerRef.current.pause();
                }
                setTimeout(() => setIsSeeking(false), 200);
            }, 200);
        }
    }, [mode, videoData]);

    // Calculate and cache cloze pattern
    useEffect(() => {
        if (!videoData?.transcript || !videoData?.vocab) return;

        const vocabWords = videoData.vocab.map(v => v.word.toLowerCase());
        const cache = {};

        videoData.transcript.forEach((item, lineIndex) => {
            const words = item.text.split(' ');
            cache[lineIndex] = words.map((word) => {
                const cleanWord = word.replace(/[.,!?;:]/g, '');
                const wordLower = cleanWord.toLowerCase();
                if (vocabWords.includes(wordLower)) return true;
                if (cleanWord.length <= 3) return false;
                if (cleanWord.length > 4) return Math.random() < 0.2;
                return false;
            });
        });

        setClozeCache(cache);
    }, [videoData]);

    // Dictation mode timeupdate listener
    useEffect(() => {
        if (!videoData?.transcript || !playerRef.current) return;

        const player = playerRef.current;

        const handleTimeUpdate = () => {
            const { isPlaying: playing, isSeeking: seeking, dictationIndex: idx } = dictationStateRef.current;
            if (!playing || seeking) return;

            if (mode === 'dictation') {
                const currentVideoTime = player.currentTime;
                const nextSubtitle = videoData.transcript[idx + 1];
                const currentSubtitle = videoData.transcript[idx];

                if (nextSubtitle && currentVideoTime >= nextSubtitle.start - 0.3) {
                    player.pause();
                    setIsPlaying(false);
                }

                if (!nextSubtitle && currentSubtitle && currentVideoTime >= currentSubtitle.start + 5) {
                    player.pause();
                    setIsPlaying(false);
                }
            }
        };

        const handleWaiting = () => setIsBuffering(true);
        const handlePlaying = () => setIsBuffering(false);

        player.addEventListener('timeupdate', handleTimeUpdate);
        player.addEventListener('waiting', handleWaiting);
        player.addEventListener('playing', handlePlaying);

        return () => {
            player.removeEventListener('timeupdate', handleTimeUpdate);
            player.removeEventListener('waiting', handleWaiting);
            player.removeEventListener('playing', handlePlaying);
        };
    }, [mode, videoData]);

    // Handle video progress
    const handleProgress = useCallback((state) => {
        if (isSeeking) return;
        setCurrentTime(state.playedSeconds);

        if (!videoData?.transcript || mode === 'dictation') return;

        const newIndex = videoData.transcript.findIndex((item, idx) => {
            const nextItem = videoData.transcript[idx + 1];
            return state.playedSeconds >= item.start && (!nextItem || state.playedSeconds < nextItem.start);
        });

        if (newIndex !== -1 && newIndex !== activeIndex) {
            setActiveIndex(newIndex);

            if (isAutoScrollEnabled && transcriptRefs.current[newIndex]) {
                transcriptRefs.current[newIndex].scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        }

        // Single sentence loop
        if (isLooping && activeIndex >= 0) {
            const currentSub = videoData.transcript[activeIndex];
            const nextSub = videoData.transcript[activeIndex + 1];

            if (nextSub && state.playedSeconds >= nextSub.start - 0.3) {
                if (playerRef.current) {
                    playerRef.current.currentTime = currentSub.start;
                }
            }
        }
    }, [isSeeking, mode, videoData, activeIndex, isAutoScrollEnabled, isLooping]);

    // Handle seek
    const handleSeek = useCallback((time) => {
        setIsSeeking(true);
        setCurrentTime(time);

        if (playerRef.current) {
            playerRef.current.currentTime = time;
        }

        if (mode !== 'dictation') {
            setTimeout(() => {
                setIsPlaying(true);
                if (playerRef.current) playerRef.current.play();
                setTimeout(() => setIsSeeking(false), 200);
            }, 100);
        } else {
            setTimeout(() => setIsSeeking(false), 300);
        }
    }, [mode]);

    // Render cloze text
    const renderClozeText = useCallback((text, lineIndex) => {
        const words = text.split(' ');
        const clozePattern = clozeCache[lineIndex] || [];

        return (
            <span>
                {words.map((word, i) => {
                    if (clozePattern[i]) {
                        return (
                            <ClozeInput
                                key={i}
                                originalWord={word}
                                onFocus={() => setIsAutoScrollEnabled(false)}
                                onBlur={() => { }}
                            />
                        );
                    }
                    return <span key={i}>{word} </span>;
                })}
            </span>
        );
    }, [clozeCache]);

    // Dictation handlers
    const handleNextDictation = () => {
        if (!videoData?.transcript) return;
        const nextIndex = dictationIndex + 1;
        if (nextIndex < videoData.transcript.length) {
            setIsSeeking(true);
            setDictationIndex(nextIndex);
            setHasPlayedCurrent(false);
            const nextTime = videoData.transcript[nextIndex].start;
            setCurrentTime(nextTime);

            if (playerRef.current) {
                playerRef.current.currentTime = nextTime;
            }

            setIsPlaying(false);
            setTimeout(() => setIsSeeking(false), 300);
        }
    };

    const handleReplayDictation = () => {
        if (!videoData?.transcript) return;
        const currentSubtitle = videoData.transcript[dictationIndex];
        setIsSeeking(true);

        if (playerRef.current) {
            playerRef.current.currentTime = currentSubtitle.start;
        }

        setTimeout(() => {
            setIsSeeking(false);
            setIsPlaying(true);
            if (playerRef.current) playerRef.current.play();
            setHasPlayedCurrent(true);
        }, 100);
    };

    // Toggle handlers
    const handleToggleLearned = async () => {
        const newStatus = !isLearned;
        setIsLearned(newStatus);
        await progressService.toggleLearnedVideoId(user, Number(id), newStatus);
    };

    const handleToggleFavorite = async () => {
        const newStatus = !isFavorite;
        setIsFavorite(newStatus);
        await favoritesService.toggleFavoriteVideoId(user, Number(id), newStatus);
    };

    // 移动端：点击"继续播放"，滚动到播放器并继续播放
    const handleMobileResume = () => {
        setShowMobileMiniBar(false);
        setHasScrolledAfterPause(false); // 重置滚动标记
        // 滚动到播放器位置
        if (playerContainerRef.current) {
            playerContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        // 继续播放（从当前时间点）
        setTimeout(() => {
            setIsPlaying(true);
            if (playerRef.current) playerRef.current.play();
        }, 300);
    };

    // PC端：返回播放
    const handlePCReturnToPlay = () => {
        if (playerContainerRef.current) {
            playerContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        setTimeout(() => {
            setIsPlaying(true);
            if (playerRef.current) playerRef.current.play();
        }, 300);
    };

    // Toggle play/pause
    const handleTogglePlay = () => {
        if (isPlaying) {
            setIsPlaying(false);
            if (playerRef.current) playerRef.current.pause();
        } else {
            setIsPlaying(true);
            if (playerRef.current) playerRef.current.play();
        }
    };

    // Change speed
    const handleChangeSpeed = () => {
        const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
        const currentIndex = speeds.indexOf(playbackRate);
        const nextIndex = (currentIndex + 1) % speeds.length;
        const newRate = speeds[nextIndex];
        setPlaybackRate(newRate);
        if (playerRef.current) {
            playerRef.current.playbackRate = newRate;
        }
    };

    // Loading state
    if (!videoData) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-xl text-gray-600">视频加载中...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 md:h-screen md:flex md:flex-row">
            {/* ========== 移动端：顶部"继续播放"小条 ========== */}
            {showMobileMiniBar && (
                <div
                    className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 cursor-pointer shadow-lg md:hidden"
                    onClick={handleMobileResume}
                >
                    <div className="flex items-center justify-center gap-2 text-white">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">继续播放</span>
                    </div>
                </div>
            )}

            {/* 左侧：视频、标题、词汇 */}
            <div className="w-full md:w-3/5 md:flex md:flex-col md:overflow-y-auto">

                {/* 标题区：移动端仅在"顶部 + 未播放 + 非小窗口模式"时显示，PC端始终显示 */}
                {(!isMobile || (!isPlaying && !showMobileMiniBar)) && (
                    <div className="p-3 md:p-6 flex-shrink-0">
                        {/* 上一期/下一期导航 - 增加足够的顶部间距避开导航栏 */}
                        <div className="flex gap-3 mb-3 md:mb-4 pt-2 md:pt-0">
                            {allVideos.findIndex(v => v.id === parseInt(id)) > 0 && (
                                <Link
                                    to={`/video/${allVideos[allVideos.findIndex(v => v.id === parseInt(id)) - 1].id}`}
                                    className="inline-flex items-center px-3 md:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors text-sm md:text-base"
                                >
                                    <svg className="w-4 h-4 mr-1 md:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                    上一期
                                </Link>
                            )}
                            {allVideos.findIndex(v => v.id === parseInt(id)) < allVideos.length - 1 && (
                                <Link
                                    to={`/video/${allVideos[allVideos.findIndex(v => v.id === parseInt(id)) + 1].id}`}
                                    className="inline-flex items-center px-3 md:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors text-sm md:text-base"
                                >
                                    下一期
                                    <svg className="w-4 h-4 ml-1 md:ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </Link>
                            )}
                        </div>

                        {/* 标题区域 */}
                        <div className="flex items-start justify-between mb-2 md:mb-3">
                            <h1 className="text-xl md:text-3xl font-bold flex-1 mr-4">{videoData.title}</h1>
                            <div className="flex gap-2 shrink-0">
                                <button
                                    onClick={handleToggleFavorite}
                                    className={`p-2 rounded-full transition-colors ${isFavorite ? 'bg-yellow-100 text-yellow-500 hover:bg-yellow-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                    title={isFavorite ? "取消收藏" : "收藏视频"}
                                >
                                    {isFavorite ? (
                                        <svg className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                        </svg>
                                    )}
                                </button>
                                <button
                                    onClick={handleToggleLearned}
                                    className={`p-2 rounded-full transition-colors ${isLearned ? 'bg-green-100 text-green-500 hover:bg-green-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                    title={isLearned ? "标记未学" : "标记已学"}
                                >
                                    {isLearned ? (
                                        <svg className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* 元数据 */}
                        <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-gray-600 mb-4 md:mb-6">
                            <span className="flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                                {videoData.author}
                            </span>
                            <span className="flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                </svg>
                                {videoData.duration}
                            </span>
                            <span className="flex items-center">{videoData.level}</span>
                            <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                                {videoData.category}
                            </span>
                        </div>
                    </div>
                )}


                {/* 移动端继续播放模式下显示退出按钮 */}


                {/* 视频播放器区域 */}
                <div className="px-3 md:px-6">
                    {/* 移动端播放时的占位元素 */}
                    {isMobile && !isInitialLoad && (isPlaying || !hasScrolledAfterPause) && (
                        <div style={{ paddingTop: '56.25%' }} className="w-full" />
                    )}
                    {/* 视频播放器 - 移动端播放时 fixed */}
                    <div
                        ref={playerContainerRef}
                        className={`
                            bg-black rounded-xl overflow-hidden shadow-2xl transition-all duration-300
                            ${isMobile && !isInitialLoad && (isPlaying || !hasScrolledAfterPause) ? 'fixed top-0 left-3 right-3 z-[80] rounded-xl' : 'relative'}
                            ${!isMobile && isPlaying ? 'sticky top-0 z-40' : ''}
                        `}
                        style={isMobile && !isInitialLoad && (isPlaying || !hasScrolledAfterPause) ? { paddingTop: 'calc(56.25vw - 24px)' } : { paddingTop: '56.25%' }}
                    >
                        {isBuffering && (
                            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50">
                                <div className="text-white font-bold flex flex-col items-center">
                                    <svg className="animate-spin h-8 w-8 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>缓冲中...</span>
                                </div>
                            </div>
                        )}
                        <video
                            ref={playerRef}
                            src={videoData.video_url}
                            className="absolute top-0 left-0 w-full h-full"
                            controls
                            playsInline
                            webkit-playsinline="true"
                            x5-video-player-type="h5"
                            x5-playsinline="true"
                            preload="auto"
                            onPlay={() => {
                                setIsPlaying(true);
                                setHasScrolledAfterPause(false);
                            }}
                            onPause={() => setIsPlaying(false)}
                            onTimeUpdate={(e) => handleProgress({ playedSeconds: e.target.currentTime })}
                        />
                    </div>
                </div>

                {/* 重点词汇 - 只在电脑端且非迷你模式下显示 */}

                <div className="hidden md:block p-6 pt-6">
                    <div className="p-6 bg-white rounded-xl shadow-sm">
                        <h3 className="text-xl font-bold mb-4">重点词汇</h3>
                        <div className="grid grid-cols-3 gap-4">
                            {videoData.vocab?.map((item, index) => (
                                <div key={index} data-vocab-word={item.word} className="p-4 bg-indigo-50 rounded-lg border border-indigo-100 transition-all duration-200">
                                    <div className="flex items-end mb-2">
                                        <span className="text-lg font-bold text-indigo-700 mr-2">{item.word}</span>
                                        <span className="text-sm text-gray-500">{item.type}</span>
                                    </div>

                                    <div className="flex flex-col gap-1 mb-2">
                                        {item.ipa_us && (
                                            <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                                                <span className="text-gray-400 w-4">US</span>
                                                <span>/{item.ipa_us}/</span>
                                                <button onClick={() => speak(item.word, 'en-US')} className="p-1 hover:bg-indigo-100 rounded-full text-indigo-400 hover:text-indigo-600 transition-colors" title="美式发音">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        )}
                                        {item.ipa_uk && (
                                            <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                                                <span className="text-gray-400 w-4">UK</span>
                                                <span>/{item.ipa_uk}/</span>
                                                <button onClick={() => speak(item.word, 'en-GB')} className="p-1 hover:bg-indigo-100 rounded-full text-indigo-400 hover:text-indigo-600 transition-colors" title="英式发音">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <p className="text-gray-600 font-medium mb-3">{item.meaning}</p>

                                    {item.examples && item.examples.length > 0 && (
                                        <div className="mb-3 space-y-2">
                                            {item.examples.map((ex, i) => (
                                                <div key={i} className="text-sm">
                                                    <p className="text-gray-800">{ex.en}</p>
                                                    <p className="text-gray-500 text-xs">{ex.cn}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {item.collocations && item.collocations.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {item.collocations.map((col, i) => (
                                                <span key={i} className="px-2 py-1 bg-white text-indigo-600 text-xs rounded border border-indigo-100">
                                                    {col}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>

            {/* 字幕区域 - 独立滚动 */}
            <div className="flex-1 bg-white border-t md:border-t-0 md:border-l flex flex-col relative">
                <div className="sticky top-0 z-10 p-3 md:p-4 border-b bg-white flex items-center justify-between">
                    <h2 className="text-base md:text-lg font-bold flex items-center">📖 字幕</h2>

                    <div className="flex gap-1 md:gap-2 bg-gray-50 p-1 rounded-full">
                        {['dual', 'en', 'cn', 'cloze', 'dictation'].map((m) => (
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                className={`px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-medium transition-all duration-200 ${mode === m ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                {m === 'dual' ? '双语' : m === 'en' ? '英' : m === 'cn' ? '中' : m === 'cloze' ? '挖空' : '听写'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto pb-32 md:pb-24">
                    {mode === 'dictation' && (
                        <div className="mx-3 mt-3 md:mx-4 md:mt-4 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg shadow-sm">
                            <div className="flex justify-around">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-green-600">{dictationStats.correct}</div>
                                    <div className="text-xs text-gray-600">答对</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-red-600">{dictationStats.wrong}</div>
                                    <div className="text-xs text-gray-600">答错</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-gray-600">{dictationStats.skipped}</div>
                                    <div className="text-xs text-gray-600">跳过</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-blue-600">
                                        {dictationStats.correct + dictationStats.wrong + dictationStats.skipped > 0
                                            ? Math.round((dictationStats.correct / (dictationStats.correct + dictationStats.wrong + dictationStats.skipped)) * 100)
                                            : 0}%
                                    </div>
                                    <div className="text-xs text-gray-600">正确率</div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="p-3 md:p-4 space-y-2 md:space-y-3">
                        {mode === 'dictation' ? (
                            <div className="bg-blue-50 p-6 rounded-lg border-2 border-blue-200">
                                <DictationInput
                                    correctAnswer={videoData.transcript[dictationIndex]?.text || ''}
                                    currentIndex={dictationIndex}
                                    totalCount={videoData.transcript.length}
                                    onCorrect={() => {
                                        setDictationStats(prev => ({ ...prev, correct: prev.correct + 1 }));
                                        setTimeout(() => handleNextDictation(), 1500);
                                    }}
                                    onWrong={() => {
                                        setDictationStats(prev => ({ ...prev, wrong: prev.wrong + 1 }));
                                    }}
                                    onSkip={() => {
                                        setDictationStats(prev => ({ ...prev, skipped: prev.skipped + 1 }));
                                        handleNextDictation();
                                    }}
                                    onReplay={handleReplayDictation}
                                    hasPlayed={hasPlayedCurrent}
                                />
                                <details className="mt-4">
                                    <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800 font-medium">
                                        💡 显示中文翻译
                                    </summary>
                                    <p className="mt-2 text-gray-700 pl-4">{videoData.transcript[dictationIndex]?.cn}</p>
                                </details>
                            </div>
                        ) : (
                            videoData.transcript.map((item, index) => {
                                const isActive = index === activeIndex;
                                return (
                                    <div key={index} ref={(el) => transcriptRefs.current[index] = el}>
                                        <SubtitleItem
                                            item={item}
                                            index={index}
                                            isActive={isActive}
                                            mode={mode}
                                            clozePattern={clozeCache[index]}
                                            vocab={videoData.vocab}
                                            onSeek={handleSeek}
                                            playerRef={playerRef}
                                            renderClozeText={renderClozeText}
                                            onSetIsPlaying={setIsPlaying}
                                        />
                                    </div>
                                );
                            })
                        )}

                        {/* 重点词汇 - 只在手机端显示 */}
                        <div className="md:hidden mt-6 p-4 bg-indigo-50 rounded-lg">
                            <h3 className="text-lg font-bold mb-3 text-indigo-900">重点词汇</h3>
                            <div className="space-y-3">
                                {videoData.vocab?.map((item, index) => (
                                    <div key={index} data-vocab-word={item.word} className="p-3 bg-white rounded-lg border border-indigo-100 transition-all duration-200">
                                        <div className="flex items-end mb-1">
                                            <span className="text-base font-bold text-indigo-700 mr-2">{item.word}</span>
                                            <span className="text-sm text-gray-500">{item.type}</span>
                                        </div>

                                        <div className="flex flex-col gap-1 mb-1.5">
                                            {item.ipa_us && (
                                                <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                                                    <span className="text-gray-400 w-4">US</span>
                                                    <span>/{item.ipa_us}/</span>
                                                    <button onClick={() => speak(item.word, 'en-US')} className="p-0.5 hover:bg-indigo-100 rounded-full text-indigo-400 hover:text-indigo-600 transition-colors">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            )}
                                            {item.ipa_uk && (
                                                <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                                                    <span className="text-gray-400 w-4">UK</span>
                                                    <span>/{item.ipa_uk}/</span>
                                                    <button onClick={() => speak(item.word, 'en-GB')} className="p-0.5 hover:bg-indigo-100 rounded-full text-indigo-400 hover:text-indigo-600 transition-colors">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <p className="text-gray-600 font-medium mb-2 text-sm">{item.meaning}</p>

                                        {item.examples && item.examples.length > 0 && (
                                            <div className="mb-2 space-y-1">
                                                {item.examples.slice(0, 1).map((ex, i) => (
                                                    <div key={i} className="text-xs">
                                                        <p className="text-gray-800">{ex.en}</p>
                                                        <p className="text-gray-500 text-[10px]">{ex.cn}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {item.collocations && item.collocations.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {item.collocations.slice(0, 3).map((col, i) => (
                                                    <span key={i} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] rounded">
                                                        {col}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ========== PC端：返回播放按钮 ========== */}
                <div className="hidden md:block absolute bottom-8 left-1/2 -translate-x-1/2">
                    <button
                        onClick={handlePCReturnToPlay}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-full font-medium shadow-lg hover:bg-indigo-700 transition-all hover:scale-105 text-sm"
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                        返回播放
                    </button>
                </div>

                {/* 浮动控制按钮 */}
                <FloatingControls
                    isPlaying={isPlaying}
                    onTogglePlay={handleTogglePlay}
                    isLooping={isLooping}
                    onToggleLoop={() => setIsLooping(!isLooping)}
                    isFavorited={isFavorite}
                    onToggleFavorite={handleToggleFavorite}
                    isLearned={isLearned}
                    onToggleLearned={handleToggleLearned}
                    playbackRate={playbackRate}
                    onChangeSpeed={handleChangeSpeed}
                />
            </div>
        </div>
    );
};

export default VideoDetail;