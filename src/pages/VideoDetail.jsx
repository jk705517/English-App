import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useParams, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
// Note: ReactPlayer import removed - using native <video> element for custom controls
import { videoAPI, vocabOccurrencesAPI, notesAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { progressService } from '../services/progressService';
import { favoritesService } from '../services/favoritesService';
import HighlightedText from '../components/HighlightedText';
import SubtitleItem from '../components/SubtitleItem';
import DictationInput from '../components/DictationInput';
import ClozeInput from '../components/ClozeInput';
import IntensiveSentencePanel from '../components/IntensiveSentencePanel';
import IntensiveSentenceList from '../components/IntensiveSentenceList';
import AddToNotebookDialog from '../components/AddToNotebookDialog';
import { generateClozeData } from '../utils/clozeGenerator';
import * as demoStorage from '../services/demoStorage';
import { useTheme } from '../contexts/ThemeContext';

// TTS 发音函数 - 使用 Azure TTS API，失败时回退到浏览器原生语音合成
const speak = async (text, lang = 'en-US') => {
    try {
        // 将浏览器的 lang 参数转换为 API 的 accent 参数
        const accent = lang === 'en-GB' ? 'uk' : 'us';
        const url = `https://api.biubiuenglish.com/api/tts?text=${encodeURIComponent(text)}&accent=${accent}`;

        const audio = new Audio(url);

        // 添加错误处理：如果 API 失败，回退到浏览器原生语音合成
        audio.onerror = () => {
            console.warn('Azure TTS 失败，使用浏览器原生语音合成');
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = lang;
                utterance.rate = 0.9;
                window.speechSynthesis.speak(utterance);
            }
        };

        audio.play().catch(() => {
            // play() 返回 Promise，如果失败也回退
            console.warn('Azure TTS 播放失败，使用浏览器原生语音合成');
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = lang;
                utterance.rate = 0.9;
                window.speechSynthesis.speak(utterance);
            }
        });
    } catch (error) {
        console.error('TTS 播放失败:', error);
        // 最后的兜底：使用浏览器原生语音合成
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = lang;
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        }
    }
};

// 难度等级转换为星星显示
const renderLevel = (level) => {
    const num = parseInt(level) || 0;
    return '⭐'.repeat(Math.min(Math.max(num, 0), 5));
};

// 手机端字幕导航 - 5个固定Tab
function MobileSubtitleTabs({ mode, onSetMode, showPodcast, onPodcastClick, hasPodcast }) {
    // 字幕子模式循环顺序
    const subtitleCycle = ['dual', 'en', 'cn', 'cloze'];
    const subtitleNames = { dual: '双语', en: '英文', cn: '中文', cloze: '挖空' };
    const isSubtitleMode = subtitleCycle.includes(mode);
    const currentSubLabel = subtitleNames[isSubtitleMode ? mode : 'dual'];

    const handleSubtitleTabClick = () => {
        if (isSubtitleMode && !showPodcast) {
            // 已在字幕Tab：循环切换子模式
            const next = subtitleCycle[(subtitleCycle.indexOf(mode) + 1) % subtitleCycle.length];
            onSetMode(next);
        } else {
            // 从其他Tab切换到字幕Tab：恢复上次子模式或默认双语
            onSetMode(isSubtitleMode ? mode : 'dual');
        }
    };

    const tabClass = (active) =>
        `flex-1 rounded-full font-medium transition-all duration-200 whitespace-nowrap py-1 text-xs text-center ${active ? 'bg-violet-400 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`;

    return (
        <div className="flex items-center gap-1 w-full">
            <button onClick={handleSubtitleTabClick} className={tabClass(isSubtitleMode && !showPodcast)}>
                <span className="inline-flex items-center gap-0.5">
                    {isSubtitleMode && !showPodcast ? currentSubLabel : '字幕'}
                    <svg className="w-2.5 h-2.5 opacity-50 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4"/></svg>
                </span>
            </button>
            <button onClick={() => onSetMode('shadow')} className={tabClass(mode === 'shadow' && !showPodcast)}>跟读</button>
            <button onClick={() => onSetMode('dictation')} className={tabClass(mode === 'dictation' && !showPodcast)}>听写</button>
            <button onClick={() => onSetMode('vocab')} className={tabClass(mode === 'vocab' && !showPodcast)}>词卡</button>
            {hasPodcast && (
                <button onClick={onPodcastClick} className={tabClass(showPodcast)}>播客</button>
            )}
        </div>
    );
}

// PC端字幕导航组件
const SubtitleTabs = ({ mode, onSetMode, onPrint, onOpenSettings, showPodcast, onPodcastClick, hasPodcast, hideSubtitles, onToggleHideSubtitles, className = "" }) => (
    <div className={`flex items-center justify-end ${className}`}>
        <div className="flex items-center gap-1 md:gap-2">
            <div className="flex bg-gray-50 dark:bg-gray-800 p-1 rounded-full gap-1 md:gap-2 overflow-x-auto">
                {['dual', 'en', 'cn', 'intensive', 'dictation', 'cloze', 'vocab'].map((m) => (
                    <button
                        key={m}
                        onClick={() => onSetMode(m)}
                        className={`rounded-full font-medium transition-all duration-200 whitespace-nowrap px-2 md:px-3 py-1 text-xs md:text-sm ${mode === m ? 'bg-violet-400 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                    >
                        {m === 'dual' ? '双语' : m === 'en' ? '英' : m === 'cn' ? '中' : m === 'intensive' ? '精读' : m === 'dictation' ? '听写' : m === 'cloze' ? '挖空' : '词卡'}
                    </button>
                ))}
            </div>
            <div className="flex items-center gap-1">
                {hasPodcast && (
                    <>
                        <div className="h-6 w-px bg-gray-300 shrink-0 mx-1"></div>
                        <button
                            onClick={onPodcastClick}
                            className={`rounded-full transition-all duration-200 shrink-0 px-3 py-1 ${showPodcast ? 'bg-violet-500 text-white shadow-md' : 'text-violet-500 hover:bg-violet-50'}`}
                            title="AI播客"
                        >
                            <span className="flex items-center gap-1 text-sm font-medium whitespace-nowrap">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a4 4 0 014 4v6a4 4 0 11-8 0V6a4 4 0 014-4zm0 16.93A8.001 8.001 0 0120 13h-2a6 6 0 11-12 0H4a8.001 8.001 0 008 5.93V22h4v-2h-4v-1.07z" /></svg>
                                播客
                            </span>
                        </button>
                    </>
                )}
                <div className="h-6 w-px bg-gray-300 shrink-0 mx-1"></div>
                <button onClick={onPrint} className="rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0 p-2" title="下载字幕">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                </button>
                {onToggleHideSubtitles && (
                    <button
                        onClick={onToggleHideSubtitles}
                        className={`rounded-full transition-colors shrink-0 p-2 ${hideSubtitles ? 'text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/30' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                        title={hideSubtitles ? '显示字幕' : '隐藏字幕'}
                    >
                        {hideSubtitles ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                        )}
                    </button>
                )}
                {onOpenSettings && (
                    <button onClick={onOpenSettings} className="rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shrink-0 p-2" title="设置">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    </div>
);

// 跟读面板 — PC端和手机端共用
const ShadowPanel = React.memo(({
    currentSub,
    activeIndex,
    totalCount,
    vocab = [],
    shadowEnBlurred,
    shadowCnBlurred,
    onToggleShadowEn,
    onToggleShadowCn,
    isFavorite,
    onToggleFavorite,
    sentenceId,
    onAddToNotebook,
    onSwitchToDictation,
    onVocabNavigate,
}) => {
    if (!currentSub) return <div className="p-8 text-center text-gray-400">暂无字幕</div>;
    return (
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm min-h-0">
            {/* 顶部信息栏 */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-700 shrink-0">
                <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums font-medium shrink-0">
                        {activeIndex + 1} / {totalCount}
                    </span>
                    {/* 收藏按钮 */}
                    <button
                        onClick={() => onToggleFavorite && onToggleFavorite(sentenceId)}
                        className={`p-1 rounded-full transition-colors ${isFavorite ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-gray-300 dark:text-gray-600 hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                        title={isFavorite ? '取消收藏' : '收藏句子'}
                    >
                        <svg className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                    </button>
                    {/* 本子按钮 */}
                    <button
                        onClick={onAddToNotebook}
                        className="p-1 rounded-full text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="加入本子"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                    </button>
                    {/* 切换到听写 */}
                    <button
                        onClick={onSwitchToDictation}
                        className="text-xs text-violet-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                    >
                        切换到听写
                    </button>
                </div>
                <div />
            </div>
            {/* 主体字幕区 — flex-1 填满剩余高度，内容居中 */}
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10 gap-4 min-h-0">
                <div
                    onClick={onToggleShadowEn}
                    className="w-full cursor-pointer select-none transition-all font-medium leading-relaxed shadow-en-text"
                    style={{ fontSize: '22px', filter: shadowEnBlurred ? 'blur(6px)' : 'none' }}
                >
                    <HighlightedText
                        text={currentSub.text}
                        highlights={vocab}
                        onVocabNavigate={onVocabNavigate}
                    />
                </div>
                <div
                    onClick={onToggleShadowCn}
                    className="w-full cursor-pointer select-none transition-all text-base leading-relaxed subtitle-cn-text"
                    style={{ filter: shadowCnBlurred ? 'blur(6px)' : 'none' }}
                >
                    {currentSub.cn}
                </div>
            </div>
            <p className="text-center text-xs text-gray-400 dark:text-gray-500 pb-3 shrink-0">点击英文/中文可切换模糊隐藏</p>
        </div>
    );
});

const VideoDetail = ({ isDemo = false, demoEpisode = 29 }) => {
    const { episode: urlEpisode } = useParams();
    const episode = isDemo ? demoEpisode : urlEpisode;
    const location = useLocation();
    const navigate = useNavigate();
    const { user: authUser } = useAuth();
    const { theme: appTheme, setTheme: setAppTheme } = useTheme();
    // Demo 模式不需要真实用户，创建一个虚拟用户对象用于本地存储
    const user = isDemo ? { id: 'demo-user' } : authUser;

    // Parse query params for sentence/vocab navigation from Favorites page
    const searchParams = new URLSearchParams(location.search);
    const sentenceIdFromQuery = searchParams.get('sentenceId');
    const vocabIdFromQuery = searchParams.get('vocabId');
    const modeFromQuery = searchParams.get('mode');
    // New params for notebook navigation (index-based)
    const typeFromQuery = searchParams.get('type'); // 'sentence' | 'vocab'
    const indexFromQuery = searchParams.get('index');
    const playerRef = useRef(null);
    const playerContainerRef = useRef(null);
    const tabBarRef = useRef(null);
    const transcriptRefs = useRef([]);
    const [currentTime, setCurrentTime] = useState(0);
    const [videoData, setVideoData] = useState(null);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [prevVideo, setPrevVideo] = useState(null);
    const [nextVideo, setNextVideo] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    // 视频循环 - 整支视频播放完从头循环
    const [isVideoLooping, setIsVideoLooping] = useState(false);
    // 单句循环 - 当前字幕句循环（与右侧悬浮按钮共用同一状态）
    const [isSentenceLooping, setIsSentenceLooping] = useState(false);
    // 单句暂停 - 每句结束自动暂停，方便跟读练习
    const [isSentencePauseEnabled, setIsSentencePauseEnabled] = useState(false);
    // 词卡详情索引（null=列表, number=详情页）
    const [vocabDetailIndex, setVocabDetailIndex] = useState(null);
    // 词汇弹窗（点击高亮词汇弹出）
    const [vocabPopup, setVocabPopup] = useState(null); // { index, item }
    // 跟读模式 - 英文/中文模糊切换
    const [shadowEnBlurred, setShadowEnBlurred] = useState(false);
    const [shadowCnBlurred, setShadowCnBlurred] = useState(false);
    // 手机端更多设置面板状态
    const [showMobileSettings, setShowMobileSettings] = useState(false);
    const [showMobileSpeedPanel, setShowMobileSpeedPanel] = useState(false);
    const [isVideoHidden, setIsVideoHidden] = useState(false);
    const [visitedSet, setVisitedSet] = useState(new Set()); // Track visited sentences in intensive mode
    const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
    // 绉诲姩绔細鏄惁鏄剧ず椤堕儴"缁х画鎾斁"灏忔潯锛堟殏鍋?鎾斁鍣ㄨ婊氬姩闅愯棌鏃讹級
    // showMobileMiniBar removed (Task 0B)
    // 绉诲姩绔細鏆傚仠鍚庢槸鍚﹀凡婊氬姩锛堢敤浜庡欢杩熷垏鎹㈠皬绐楀彛妯″紡锛?
    // hasScrolledAfterPause removed (Task 0B)
    // 妫€娴嬫槸鍚︿负绉诲姩绔?
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1280);
    // 检测是否为手机端（< 768px，仅手机，用于固定播放器行为）
    const [isPhone, setIsPhone] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
    // 绉诲姩绔細鏄惁鍦ㄩ〉闈㈤《閮紙鐢ㄤ簬鏍囬鍖烘樉绀烘帶鍒讹級
    const [isAtTop, setIsAtTop] = useState(true);

    // 鎸栫┖妯″紡鐩稿叧鐘舵€?
    const [clozeData, setClozeData] = useState({});
    const [clozeResults, setClozeResults] = useState({}); // { `${lineIndex}-${clozeIndex}`: 'correct' | 'revealed' }
    const pausedByCloze = useRef(false);
    // 单句暂停：记录上次暂停的句子索引，避免同一句重复暂停
    const lastPausedSentenceIndex = useRef(-1);

    // 绉诲姩绔細鏄惁涓洪娆″姞杞斤紙淇濊瘉鍒濆杩涘叆椤甸潰鏃舵樉绀烘爣棰樺尯锛?
    // isInitialLoad removed (Task 0B)
    const [isSeeking, setIsSeeking] = useState(false);
    const [isBuffering, setIsBuffering] = useState(false);
    // 倍速 - 从 localStorage 读取，默认 1.0
    const [playbackRate, setPlaybackRate] = useState(() => {
        const saved = localStorage.getItem('bbEnglish_playbackRate');
        return saved ? parseFloat(saved) : 1.0;
    });
    // 音量控制
    const [volume, setVolume] = useState(() => {
        const saved = localStorage.getItem('bbEnglish_volume');
        return saved ? parseFloat(saved) : 1.0;
    });
    const [muted, setMuted] = useState(false);
    // 视频总时长
    const [duration, setDuration] = useState(0);
    // 全屏状态
    const [isFullscreen, setIsFullscreen] = useState(false);
    // 字幕叠加层开关
    const [showOverlaySubtitles, setShowOverlaySubtitles] = useState(false);
    // 控制条显示/隐藏
    const [showControls, setShowControls] = useState(true);
    const controlsTimeoutRef = useRef(null);
    // 倍速面板、音量面板的展开状态
    const [showSpeedPanel, setShowSpeedPanel] = useState(false);
    const [showVolumeSlider, setShowVolumeSlider] = useState(false);
    // Initialize mode: URL query param > localStorage > default 'dual'
    const [mode, setMode] = useState(() => {
        const stored = modeFromQuery || localStorage.getItem('studyMode') || 'dual';
        return stored === 'shadow' ? 'dual' : stored;
    });
    const [isLearned, setIsLearned] = useState(false);
    const [isFavorite, setIsFavorite] = useState(false);
    const [dictationStats, setDictationStats] = useState({ correct: 0, wrong: 0, skipped: 0 });
    const [dictationIndex, setDictationIndex] = useState(0);
    const [hasPlayedCurrent, setHasPlayedCurrent] = useState(false);

    // 句子和词汇收藏状态
    const [favoriteSentenceIds, setFavoriteSentenceIds] = useState([]);
    const [favoriteVocabIds, setFavoriteVocabIds] = useState([]);

    // 本子弹窗状态
    const [notebookDialogOpen, setNotebookDialogOpen] = useState(false);
    const [notebookDialogItem, setNotebookDialogItem] = useState(null); // { itemType, itemId, videoId }

    // 笔记状态
    const [notes, setNotes] = useState({}); // { subtitle_index: content }
    const [noteEditor, setNoteEditor] = useState(null); // null | { index, content }
    const [noteSaving, setNoteSaving] = useState(false);

    // 打印/下载弹窗状态
    const [showPrintDialog, setShowPrintDialog] = useState(false);
    // PC端设置面板
    const [showDesktopSettings, setShowDesktopSettings] = useState(false);
    // 字幕字体大小 - 12~20px，默认16px，存入localStorage
    const [subtitleFontSize, setSubtitleFontSize] = useState(() => {
        const saved = localStorage.getItem('bbEnglish_subtitleFontSize');
        return saved ? parseInt(saved) : 16;
    });

    // 播客模式状态
    const [showPodcast, setShowPodcast] = useState(false);
    const [podcastSpeed, setPodcastSpeed] = useState(1.0);
    const podcastAudioRef = useRef(null);

    // PC端键盘快捷键 - 播放器激活状态
    const [playerActive, setPlayerActive] = useState(false);

    // 词汇关联期数状态
    const [vocabOccurrences, setVocabOccurrences] = useState({});  // { word: { total, occurrences } }

    // 播放器容器实际高度（用于动态定位字幕导航栏）
    const [playerHeight, setPlayerHeight] = useState(0);
    // 字幕Tab栏实际高度（手机端fixed布局占位用）
    const [tabBarHeight, setTabBarHeight] = useState(46);

    // A/B点循环
    const [abMode, setAbMode] = useState(0); // 0=off, 1=A set, 2=A+B looping
    const [abPointA, setAbPointA] = useState(0);
    const [abPointB, setAbPointB] = useState(0);
    const [abIndexA, setAbIndexA] = useState(-1);
    const [abIndexB, setAbIndexB] = useState(-1);
    const [showLoopTimesPanel, setShowLoopTimesPanel] = useState(false);

    // 单句循环倒计时
    const [loopCountdown, setLoopCountdown] = useState(null);
    const loopCountdownRef = useRef(null);

    // 精听设置（手机端面板）
    const [showJingTingPanel, setShowJingTingPanel] = useState(false);
    const [jingTingSettings, setJingTingSettings] = useState(() => {
        try {
            const saved = localStorage.getItem('bbEnglish_jingTing');
            return saved ? JSON.parse(saved) : { hideSubtitles: false, pauseAfterLoop: false, intervalSec: 3, loopCount: 2 };
        } catch { return { hideSubtitles: false, pauseAfterLoop: false, intervalSec: 3, loopCount: 2 }; }
    });

    // 妫€娴嬬Щ鍔ㄧ
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 1280);
            setIsPhone(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // 任务1：进入视频页隐藏左侧导航栏，离开时恢复
    useEffect(() => {
        document.documentElement.classList.add('hide-sidebar');
        document.documentElement.classList.add('hide-mobile-nav');
        return () => {
            document.documentElement.classList.remove('hide-sidebar');
            document.documentElement.classList.remove('hide-mobile-nav');
        };
    }, []);

    // 根据模式设置单句循环的默认值
    useEffect(() => {
        // 双语、英、中模式不默认单句循环
        if (mode === 'dual' || mode === 'en' || mode === 'cn') {
            setIsSentenceLooping(false);
        }
        // 精读、挖空模式默认单句循环
        else if (mode === 'intensive' || mode === 'cloze') {
            setIsSentenceLooping(true);
        }
        // 听写模式(dictation)不在此处理，保持原有逻辑
    }, [mode]);

    // Ref for dictation state
    const dictationStateRef = useRef({ isPlaying: false, isSeeking: false, dictationIndex: 0 });
    useEffect(() => {
        dictationStateRef.current = { isPlaying, isSeeking, dictationIndex };
    }, [isPlaying, isSeeking, dictationIndex]);

    // 精听设置持久化
    useEffect(() => {
        localStorage.setItem('bbEnglish_jingTing', JSON.stringify(jingTingSettings));
    }, [jingTingSettings]);

    // 单句循环倒计时 - 清理
    useEffect(() => {
        return () => {
            if (loopCountdownRef.current) clearInterval(loopCountdownRef.current);
        };
    }, []);

    // 单句循环倒计时启动函数
    const startLoopCountdown = useCallback((intervalSec, onComplete) => {
        if (loopCountdownRef.current) clearInterval(loopCountdownRef.current);
        if (intervalSec <= 0) { onComplete(); return; }
        setLoopCountdown(intervalSec);
        let remaining = intervalSec;
        loopCountdownRef.current = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                clearInterval(loopCountdownRef.current);
                loopCountdownRef.current = null;
                setLoopCountdown(null);
                onComplete();
            } else {
                setLoopCountdown(remaining);
            }
        }, 1000);
    }, []);

    // 监听播放器容器高度变化（用于动态定位字幕导航栏）
    useEffect(() => {
        if (!playerContainerRef.current) return;

        const updateHeight = () => {
            if (playerContainerRef.current) {
                setPlayerHeight(playerContainerRef.current.offsetHeight);
            }
        };

        updateHeight();

        const resizeObserver = new ResizeObserver(updateHeight);
        resizeObserver.observe(playerContainerRef.current);

        return () => resizeObserver.disconnect();
    }, [videoData, isMobile, isPhone]);

    // 监听字幕Tab栏高度（手机端fixed布局，需要占位高度）
    useEffect(() => {
        if (!tabBarRef.current) return;
        const updateTabBarHeight = () => {
            if (tabBarRef.current) setTabBarHeight(tabBarRef.current.offsetHeight);
        };
        updateTabBarHeight();
        const observer = new ResizeObserver(updateTabBarHeight);
        observer.observe(tabBarRef.current);
        return () => observer.disconnect();
    }, [isMobile, isPhone]);

    // 防止浏览器在页面重新获得焦点时自动恢复播放（用于词汇查询等场景）
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                // 页面隐藏时，如果正在播放则暂停
                if (isPlaying && playerRef.current) {
                    playerRef.current.pause();
                    setIsPlaying(false);
                }
            }
            // 注意：页面恢复可见时不自动恢复播放
            // 用户必须手动点击播放按钮才能继续
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isPlaying]);

    // Load learned status
    useEffect(() => {
        if (!videoData?.id) return;
        const loadLearnedStatus = async () => {
            if (isDemo) {
                // Demo 模式：从 localStorage 读取
                setIsLearned(demoStorage.isDemoLearned(videoData.id));
            } else {
                const learnedIds = await progressService.loadLearnedVideoIds(user);
                setIsLearned(learnedIds.includes(String(videoData.id)));
            }
        };
        loadLearnedStatus();
    }, [videoData?.id, user, isDemo]);

    // Load favorite status
    useEffect(() => {
        if (!videoData?.id) return;
        const loadFavoriteStatus = async () => {
            if (isDemo) {
                // Demo 模式：从 localStorage 读取
                const favorites = demoStorage.getDemoFavorites();
                setIsFavorite(favorites.videos.includes(String(videoData.id)));
            } else {
                const favoriteIds = await favoritesService.loadFavoriteVideoIds(user);
                setIsFavorite(favoriteIds.includes(Number(videoData.id)));
            }
        };
        loadFavoriteStatus();
    }, [videoData?.id, user, isDemo]);

    // Load sentence favorites (filtered by current video)
    useEffect(() => {
        if (!videoData?.id) return;
        if (!isDemo && !user) {
            console.log('📋 VideoDetail: No user or video, skipping sentence favorites load');
            return;
        }
        const loadSentenceFavorites = async () => {
            if (isDemo) {
                // Demo 模式：从 localStorage 读取
                const favorites = demoStorage.getDemoFavorites();
                // 过滤出当前视频的句子收藏
                const sentenceIds = favorites.sentences
                    .filter(s => String(s.videoId) === String(videoData.id))
                    .map(s => s.itemId);
                setFavoriteSentenceIds(sentenceIds);
            } else {
                console.log('📋 VideoDetail: Loading sentence favorites for video:', videoData.id, 'user:', user.id);
                const ids = await favoritesService.loadFavoriteSentenceIds(user, Number(videoData.id));
                console.log('📋 VideoDetail: Loaded sentence favorite IDs:', ids);
                setFavoriteSentenceIds(ids);
            }
        };
        loadSentenceFavorites();
    }, [user, videoData?.id, isDemo]);

    // Load vocab favorites (filtered by current video)
    useEffect(() => {
        if (!videoData?.id) return;
        if (!isDemo && !user) {
            console.log('📋 VideoDetail: No user or video, skipping vocab favorites load');
            return;
        }
        const loadVocabFavorites = async () => {
            if (isDemo) {
                // Demo 模式：从 localStorage 读取
                const favorites = demoStorage.getDemoFavorites();
                // 过滤出当前视频的词汇收藏
                const vocabIds = favorites.vocabs
                    .filter(v => String(v.videoId) === String(videoData.id))
                    .map(v => v.itemId);
                setFavoriteVocabIds(vocabIds);
            } else {
                console.log('📋 VideoDetail: Loading vocab favorites for video:', videoData.id, 'user:', user.id);
                const ids = await favoritesService.loadFavoriteVocabIds(user, Number(videoData.id));
                console.log('📋 VideoDetail: Loaded vocab favorite IDs:', ids);
                setFavoriteVocabIds(ids);
            }
        };
        loadVocabFavorites();
    }, [user, videoData?.id, isDemo]);

    // 加载笔记
    useEffect(() => {
        if (!videoData || !user || isDemo) return;
        const loadNotes = async () => {
            try {
                const data = await notesAPI.getAll(videoData.id);
                const map = {};
                data.forEach(n => { map[n.subtitle_index] = n.content; });
                setNotes(map);
            } catch (err) {
                console.error('Failed to load notes:', err);
            }
        };
        loadNotes();
    }, [user?.id, videoData?.id, isDemo]);

    // 加载所有词汇的出现记录
    const loadAllVocabOccurrences = async (vocabList, currentVideoId) => {
        if (!vocabList || vocabList.length === 0) return;

        const results = {};
        for (const vocab of vocabList) {
            if (!vocab.word) continue;
            try {
                const result = await vocabOccurrencesAPI.get(vocab.word, currentVideoId);
                if (result.total > 0) {
                    results[vocab.word.toLowerCase()] = result;
                }
            } catch (error) {
                console.error('加载词汇关联失败:', vocab.word, error);
            }
        }
        setVocabOccurrences(results);
    };

    // 自动加载词汇关联期数
    useEffect(() => {
        if (videoData?.vocab && videoData.vocab.length > 0) {
            loadAllVocabOccurrences(videoData.vocab, videoData.id);
        }
    }, [videoData?.vocab, videoData?.id]);

    // Fetch video data
    useEffect(() => {
        const fetchVideoData = async () => {
            try {
                const response = await videoAPI.getByEpisode(episode);
                if (response.success && response.data) {
                    setVideoData(response.data);
                    setPrevVideo(response.data.prevVideo);
                    setNextVideo(response.data.nextVideo);
                } else {
                    console.error('Error fetching video: API returned success:false');
                }
            } catch (error) {
                console.error('Error fetching video:', error);
            }
        };
        fetchVideoData();
    }, [episode]);

    // Handle navigation from Favorites page - scroll to specific sentence or vocab
    useEffect(() => {
        if (!videoData) return;

        // New: Handle index-based navigation from Notebooks page
        if (typeFromQuery && indexFromQuery !== null) {
            const idx = parseInt(indexFromQuery, 10);
            if (!isNaN(idx)) {
                if (typeFromQuery === 'sentence' && videoData.transcript?.[idx]) {
                    // Navigate to sentence by index
                    setActiveIndex(idx);
                    setTimeout(() => {
                        if (transcriptRefs.current[idx]) {
                            transcriptRefs.current[idx].scrollIntoView({
                                behavior: 'smooth',
                                block: 'center'
                            });
                        }
                        // Seek video to sentence start time
                        const sentence = videoData.transcript[idx];
                        if (sentence && playerRef.current) {
                            playerRef.current.currentTime = sentence.start;
                        }
                    }, 300);
                    return; // Don't process other params
                } else if (typeFromQuery === 'vocab' && videoData.vocab?.[idx]) {
                    // Navigate to vocab by index
                    setTimeout(() => {
                        const vocabElement = document.querySelector(`[data-vocab-index="${idx}"]`);
                        if (vocabElement) {
                            vocabElement.scrollIntoView({
                                behavior: 'smooth',
                                block: 'center'
                            });
                            // Add highlight effect
                            vocabElement.classList.add('ring-2', 'ring-violet-400', 'ring-offset-2');
                            setTimeout(() => {
                                vocabElement.classList.remove('ring-2', 'ring-violet-400', 'ring-offset-2');
                            }, 3000);
                        }
                    }, 500);
                    return; // Don't process other params
                }
            }
        }

        // Handle sentence navigation (legacy - ID-based from Favorites)
        if (sentenceIdFromQuery) {
            const sentenceId = Number(sentenceIdFromQuery);
            const idx = videoData.transcript?.findIndex(s => s.id === sentenceId);
            if (idx >= 0) {
                // Set active index to highlight the sentence
                setActiveIndex(idx);
                // Scroll to the sentence after a short delay to ensure DOM is ready
                setTimeout(() => {
                    if (transcriptRefs.current[idx]) {
                        transcriptRefs.current[idx].scrollIntoView({
                            behavior: 'smooth',
                            block: 'center'
                        });
                    }
                    // Seek video to sentence start time
                    const sentence = videoData.transcript[idx];
                    if (sentence && playerRef.current) {
                        playerRef.current.currentTime = sentence.start;
                    }
                }, 300);
            }
        }

        // Handle vocab navigation (legacy - ID-based from Favorites)
        if (vocabIdFromQuery) {
            const vocabId = Number(vocabIdFromQuery);
            // Scroll to vocab card after a short delay
            setTimeout(() => {
                const vocabElement = document.querySelector(`[data-vocab-id="${vocabId}"]`);
                if (vocabElement) {
                    vocabElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                    // Add highlight effect
                    vocabElement.classList.add('ring-2', 'ring-violet-400', 'ring-offset-2');
                    setTimeout(() => {
                        vocabElement.classList.remove('ring-2', 'ring-violet-400', 'ring-offset-2');
                    }, 3000);
                }
            }, 500);
        }
    }, [videoData, sentenceIdFromQuery, vocabIdFromQuery, typeFromQuery, indexFromQuery]);

    // Handle scrollTo vocab navigation from other pages
    const [urlSearchParams] = useSearchParams();
    const scrollToParam = urlSearchParams.get('scrollTo');
    const vocabIndexParam = urlSearchParams.get('vocabIndex');

    useEffect(() => {
        if (scrollToParam === 'vocab' && vocabIndexParam !== null && videoData) {
            setTimeout(() => {
                const vocabElement = document.getElementById(`vocab-card-${vocabIndexParam}`);
                if (vocabElement) {
                    vocabElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    vocabElement.classList.add('ring-2', 'ring-violet-400');
                    setTimeout(() => {
                        vocabElement.classList.remove('ring-2', 'ring-violet-400');
                    }, 2000);
                }
            }, 500);
        }
    }, [scrollToParam, vocabIndexParam, videoData]);

    // Note: prevVideo and nextVideo are now fetched with the video data from the API

    // Mobile: track scroll position for isAtTop state
    useEffect(() => {
        if (!isMobile) return;
        const handleScroll = () => {
            setIsAtTop(window.scrollY <= 10);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [isMobile]);

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

        // 新增：挖空模式滚动到当前句子
        if (mode === 'cloze' && videoData?.transcript) {
            setTimeout(() => {
                const activeElement = document.querySelector('[data-subtitle-index="' + activeIndex + '"]');
                if (activeElement) {
                    activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        }
    }, [mode, videoData, activeIndex]);

    // Calculate cloze data
    useEffect(() => {
        if (!videoData?.transcript || !videoData?.vocab) return;
        const data = generateClozeData(videoData.transcript, videoData.vocab);
        setClozeData(data);
        setClozeResults({}); // Reset results on new video
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

        // Intensive Mode Loop Logic - High Priority (单句循环)
        if (mode === 'intensive' && isSentenceLooping && activeIndex >= 0) {
            const currentSub = videoData.transcript[activeIndex];
            const nextSub = videoData.transcript[activeIndex + 1];

            // 参考单句暂停的修复：使用 nextSub.start - 0.4 作为检测时机
            if (nextSub && state.playedSeconds >= nextSub.start - 0.4) {
                if (playerRef.current) {
                    playerRef.current.currentTime = currentSub.start;
                    playerRef.current.play();
                }
            }
            // 处理最后一句（没有 nextSub 的情况）
            if (!nextSub && currentSub && state.playedSeconds >= currentSub.end - 0.1) {
                if (playerRef.current) {
                    playerRef.current.currentTime = currentSub.start;
                    playerRef.current.play();
                }
            }

            // Always mark current sentence as visited when playing in intensive mode
            if (!visitedSet.has(activeIndex)) {
                setVisitedSet(prev => new Set(prev).add(activeIndex));
            }
            return;
        }

        // 单句暂停逻辑：参考单句循环，用 nextSub.start - 0.4 检测时机
        if ((isSentencePauseEnabled || mode === 'shadow') && !isSentenceLooping && activeIndex >= 0) {
            const currentSub = videoData.transcript[activeIndex];
            const nextSub = videoData.transcript[activeIndex + 1];

            // 与单句循环相同的检测条件：下一句开始前 0.3 秒
            if (nextSub &&
                state.playedSeconds >= nextSub.start - 0.4 &&
                lastPausedSentenceIndex.current !== activeIndex) {

                lastPausedSentenceIndex.current = activeIndex;

                if (playerRef.current) {
                    playerRef.current.pause();
                    playerRef.current.currentTime = nextSub.start;
                }
                setIsPlaying(false);
                setActiveIndex(activeIndex + 1);
                return;
            }

            // 处理最后一句（没有 nextSub 的情况）
            if (!nextSub && currentSub &&
                state.playedSeconds >= currentSub.end - 0.1 &&
                lastPausedSentenceIndex.current !== activeIndex) {

                lastPausedSentenceIndex.current = activeIndex;

                if (playerRef.current) {
                    playerRef.current.pause();
                }
                setIsPlaying(false);
                return;
            }
        }

        if (newIndex !== -1 && newIndex !== activeIndex) {


            setActiveIndex(newIndex);

            if (isAutoScrollEnabled && transcriptRefs.current[newIndex]) {
                transcriptRefs.current[newIndex].scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        }

        // Single sentence loop (单句循环 - 所有模式通用)
        if (isSentenceLooping && activeIndex >= 0) {
            const currentSub = videoData.transcript[activeIndex];
            const nextSub = videoData.transcript[activeIndex + 1];

            // 精读模式已在上面处理
            if (mode === 'intensive' && isSentenceLooping) {
                return;
            }

            const shouldLoop = (nextSub && state.playedSeconds >= nextSub.start - 0.4) ||
                (!nextSub && currentSub && state.playedSeconds >= currentSub.end - 0.1);

            if (shouldLoop && !loopCountdownRef.current) {
                if (jingTingSettings.intervalSec > 0) {
                    // 暂停并倒计时
                    if (playerRef.current) {
                        playerRef.current.pause();
                        setIsPlaying(false);
                    }
                    startLoopCountdown(jingTingSettings.intervalSec, () => {
                        if (playerRef.current) {
                            playerRef.current.currentTime = currentSub.start;
                            playerRef.current.play();
                            setIsPlaying(true);
                        }
                    });
                } else {
                    if (playerRef.current) {
                        playerRef.current.currentTime = currentSub.start;
                    }
                }
            }
        }
        // A/B点循环
        if (abMode === 3 && abPointB > abPointA) {
            if (state.playedSeconds >= abPointB) {
                if (playerRef.current) {
                    playerRef.current.currentTime = abPointA;
                }
            }
        }
    }, [isSeeking, mode, videoData, activeIndex, isAutoScrollEnabled, isSentenceLooping, isSentencePauseEnabled, abMode, abPointA, abPointB, jingTingSettings, startLoopCountdown]);

    // 跟读模式：切换到下一句时重置模糊状态
    useEffect(() => {
        if (mode === 'shadow') {
            setShadowEnBlurred(false);
            setShadowCnBlurred(false);
        }
    }, [activeIndex, mode]);

    // A/B点按钮处理
    const handleAbClick = (e) => {
        if (e) e.stopPropagation();
        if (abMode === 0) {
            // Activate: pause video, wait for A selection
            setAbMode(1);
            if (playerRef.current) {
                playerRef.current.pause();
            }
            setIsPlaying(false);
        } else {
            // Cancel: reset all
            setAbMode(0);
            setAbPointA(0);
            setAbPointB(0);
            setAbIndexA(-1);
            setAbIndexB(-1);
        }
    };

    // A/B点：点击字幕行设置点位
    const handleSetAbPoint = useCallback((time, index) => {
        if (abMode === 1) {
            setAbPointA(time);
            setAbIndexA(index);
            setAbMode(2);
        } else if (abMode === 2) {
            if (index !== abIndexA) {
                const bTime = time > abPointA ? time : abPointA + 0.1;
                setAbPointB(bTime);
                setAbIndexB(index);
                setAbMode(3);
                if (playerRef.current) {
                    playerRef.current.currentTime = abPointA;
                    playerRef.current.play();
                }
                setIsPlaying(true);
            }
        }
    }, [abMode, abIndexA, abPointA]);

    // Handle seek
    const handleSeek = useCallback((time) => {
        setIsSeeking(true);
        setCurrentTime(time);
        lastPausedSentenceIndex.current = -1; // 重置单句暂停标记，允许重新触发

        // 🔧 修复单句循环点击问题：当开启单句循环时，点击字幕行需要更新 activeIndex
        // 这样循环目标会切换到被点击的句子，而不是停留在原来的句子
        if (isSentenceLooping && videoData?.transcript) {
            const targetIndex = videoData.transcript.findIndex((item, idx) => {
                const nextItem = videoData.transcript[idx + 1];
                return time >= item.start && (!nextItem || time < nextItem.start);
            });
            if (targetIndex !== -1 && targetIndex !== activeIndex) {
                setActiveIndex(targetIndex);
            }
        }

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
    }, [mode, isSentenceLooping, videoData, activeIndex]);

    // 词汇收藏切换 (moved before renderClozeText to fix initialization order)
    const handleToggleVocabFavorite = async (vocabId) => {
        // 防止 vocabId 为 undefined 导致所有卡片一起变色
        if (vocabId === undefined || vocabId === null) {
            console.warn('⚠️ handleToggleVocabFavorite: vocabId is missing! Please run migration script to add IDs to vocab data.');
            return;
        }
        // 使用字符串比较，确保类型一致
        const shouldBeFavorite = !favoriteVocabIds.some(fid => String(fid) === String(vocabId));

        if (isDemo) {
            // Demo 模式：保存到 localStorage
            if (shouldBeFavorite) {
                demoStorage.addDemoFavorite('vocab', String(vocabId), videoData.id);
            } else {
                demoStorage.removeDemoFavorite('vocab', String(vocabId));
            }
        } else {
            await favoritesService.toggleFavoriteVocab(user, vocabId, shouldBeFavorite, Number(videoData.id));
        }

        setFavoriteVocabIds((prev) =>
            shouldBeFavorite
                ? [...prev, vocabId]
                : prev.filter(fid => String(fid) !== String(vocabId))
        );
    };

    // Render cloze text
    const renderClozeText = useCallback((text, lineIndex) => {
        const segments = clozeData[lineIndex];
        if (!segments) return <span>{text}</span>;

        return (
            <span>
                {segments.map((segment, i) => {
                    if (segment.type === 'cloze') {
                        const key = `${lineIndex}-${i}`;
                        // 使用 vocabIndex 生成与 HighlightedText 一致的 vocabId 格式
                        const vocabId = segment.vocabIndex !== undefined
                            ? `${videoData.id}-vocab-${segment.vocabIndex}`
                            : `${videoData.id}-vocab-${segment.vocabInfo?.word || i}`;
                        return (
                            <ClozeInput
                                key={i}
                                answer={segment.content}
                                vocabInfo={segment.vocabInfo}
                                isMobile={isMobile}
                                isLoggedIn={!!user}
                                videoId={Number(videoData.id)}
                                vocabId={vocabId}
                                isFavorite={favoriteVocabIds.some(fid => String(fid) === String(vocabId))}
                                onToggleFavorite={() => handleToggleVocabFavorite(vocabId)}
                                onAddToNotebook={() => {
                                    if (!user && !isDemo) {
                                        alert('登录后才能使用本子功能');
                                        return;
                                    }
                                    setNotebookDialogItem({
                                        itemType: 'vocab',
                                        itemId: vocabId,
                                        videoId: Number(videoData.id)
                                    });
                                    setNotebookDialogOpen(true);
                                }}
                                onStartAnswer={() => {
                                    if (isPlaying) {
                                        if (playerRef.current) playerRef.current.pause();
                                        setIsPlaying(false);
                                        pausedByCloze.current = true;
                                    }
                                }}
                                onDone={(status) => {
                                    setClozeResults(prev => ({ ...prev, [key]: status }));
                                    if (status === 'correct' && pausedByCloze.current) {
                                        if (playerRef.current) playerRef.current.play();
                                        setIsPlaying(true);
                                        pausedByCloze.current = false;
                                    }
                                }}
                            />
                        );
                    }
                    return <span key={i}>{segment.content}</span>;
                })}
            </span>
        );
    }, [clozeData, isPlaying, videoData, isMobile, user, isDemo, favoriteVocabIds, handleToggleVocabFavorite]);

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

    // Intensive mode handlers
    const handleIntensiveSelect = (index) => {
        if (!videoData?.transcript) return;
        const sentence = videoData.transcript[index];
        if (sentence) {
            // 1. Update activeIndex
            setActiveIndex(index);
            // 2. Set looping
            setIsSentenceLooping(true);
            // 3. Add to visited
            setVisitedSet(prev => new Set(prev).add(index));
            // 4. Seek and Play
            if (playerRef.current) {
                playerRef.current.currentTime = sentence.start + 0.05;
                playerRef.current.play();
            }
            setIsPlaying(true);
        }
    };

    const handleIntensivePlayCurrent = () => {
        const index = activeIndex >= 0 ? activeIndex : 0;
        if (videoData?.transcript[index]) {
            const sentence = videoData.transcript[index];
            // 濡傛灉 activeIndex 鏄? -1锛岄渶瑕佹洿鏂?
            if (activeIndex === -1) setActiveIndex(index);

            if (playerRef.current) {
                playerRef.current.currentTime = sentence.start + 0.05;
                playerRef.current.play();
            }
            setIsSentenceLooping(true);
            setIsPlaying(true);
        }
    };

    const handleIntensivePause = () => {
        setIsPlaying(false);
        if (playerRef.current) {
            playerRef.current.pause();
        }
        // 淇濇寔 isLooping = true锛岃繖鏍风敤鎴峰啀娆＄偣鍑绘挱鏀炬椂渚濈劧鏄惊鐜綋鍓嶅彞
    };

    const handleIntensivePrev = () => {
        const newIndex = Math.max(0, activeIndex - 1);
        handleIntensiveSelect(newIndex);
    };

    const handleIntensiveNext = () => {
        if (!videoData?.transcript) return;
        const newIndex = Math.min(videoData.transcript.length - 1, activeIndex + 1);
        handleIntensiveSelect(newIndex);
    };

    // 播客按钮点击处理
    const handlePodcastClick = () => {
        if (!showPodcast) {
            // 进入播客模式时，切换到 dual 模式以隐藏挖空/听写的统计UI
            setMode('dual');
        }
        setShowPodcast(!showPodcast);
    };

    // 播客倍速切换
    const handlePodcastSpeedChange = () => {
        const speeds = [1.0, 1.25, 1.5, 2.0];
        const currentIndex = speeds.indexOf(podcastSpeed);
        const nextIndex = (currentIndex + 1) % speeds.length;
        const newSpeed = speeds[nextIndex];
        setPodcastSpeed(newSpeed);
        if (podcastAudioRef.current) {
            podcastAudioRef.current.playbackRate = newSpeed;
        }
    };

    // 播客下载
    const handlePodcastDownload = () => {
        if (videoData?.podcast_url) {
            const link = document.createElement('a');
            link.href = videoData.podcast_url;
            link.download = `播客-第${videoData.episode}期.mp3`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    // 模式切换处理 - 关闭播客
    const handleModeChange = (newMode) => {
        setMode(newMode);
        setShowPodcast(false);
        if (newMode !== 'shadow') {
            setShadowEnBlurred(false);
            setShadowCnBlurred(false);
        }
        if (newMode !== 'vocab') {
            setVocabDetailIndex(null);
        }
    };

    // Toggle handlers
    const handleToggleLearned = async () => {
        const newStatus = !isLearned;
        setIsLearned(newStatus);
        if (isDemo) {
            // Demo 模式：保存到 localStorage
            if (newStatus) {
                demoStorage.addDemoProgress(videoData.id);
            }
            // 注意：Demo 模式暂不支持取消已学（简化处理）
        } else {
            await progressService.toggleLearnedVideoId(user, Number(videoData.id), newStatus);
        }
    };

    const handleToggleFavorite = async () => {
        const newStatus = !isFavorite;
        setIsFavorite(newStatus);
        if (isDemo) {
            // Demo 模式：保存到 localStorage
            if (newStatus) {
                demoStorage.addDemoFavorite('video', String(videoData.id), videoData.id);
            } else {
                demoStorage.removeDemoFavorite('video', String(videoData.id));
            }
        } else {
            await favoritesService.toggleFavoriteVideoId(user, Number(videoData.id), newStatus);
        }
    };

    // 打印字幕
    const handlePrint = () => {
        setShowPrintDialog(true);
    };

    // 执行下载字幕为txt文件
    const executeDownload = (format) => {
        setShowPrintDialog(false);

        if (!videoData?.transcript) return;

        const title = videoData.title || '字幕';
        const author = videoData.author || '';
        const episodeNum = videoData.episode || '';
        const formatLabel = format === 'dual' ? '双语' : format === 'en' ? '英文' : '中文';

        // 生成文件头部
        let content = `${title}\n`;
        if (author) content += `博主: ${author}\n`;
        if (episodeNum) content += `第${episodeNum}期\n`;
        content += `字幕格式: ${formatLabel}\n`;
        content += '='.repeat(40) + '\n\n';

        // 根据格式生成内容
        videoData.transcript.forEach((item, index) => {
            const lineNum = index + 1;
            if (format === 'dual') {
                content += `${lineNum}. ${item.text}\n   ${item.cn}\n\n`;
            } else if (format === 'en') {
                content += `${lineNum}. ${item.text}\n\n`;
            } else if (format === 'cn') {
                content += `${lineNum}. ${item.cn}\n\n`;
            }
        });

        // 下载txt文件
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_').substring(0, 50);
        a.download = `${safeTitle}_${formatLabel}字幕.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // 句子收藏切换
    const handleToggleSentenceFavorite = async (sentenceId) => {
        // 防止 sentenceId 为 undefined 导致问题
        if (sentenceId === undefined || sentenceId === null) {
            console.warn('⚠️ handleToggleSentenceFavorite: sentenceId is missing! Please run migration script to add IDs to transcript data.');
            return;
        }
        // 使用字符串比较，确保类型一致
        const shouldBeFavorite = !favoriteSentenceIds.some(fid => String(fid) === String(sentenceId));

        if (isDemo) {
            // Demo 模式：保存到 localStorage
            if (shouldBeFavorite) {
                demoStorage.addDemoFavorite('sentence', String(sentenceId), videoData.id);
            } else {
                demoStorage.removeDemoFavorite('sentence', String(sentenceId));
            }
        } else {
            await favoritesService.toggleFavoriteSentence(user, sentenceId, shouldBeFavorite, Number(videoData.id));
        }

        setFavoriteSentenceIds((prev) =>
            shouldBeFavorite
                ? [...prev, sentenceId]
                : prev.filter(fid => String(fid) !== String(sentenceId))
        );
    };



    // 绉诲姩绔細鐐瑰嚮"缁х画鎾斁"锛屾粴鍔ㄥ埌鎾斁鍣ㄥ苟缁х画鎾斁
;

    // PC绔細杩斿洖鎾斁


    // 笔记：打开编辑器
    const handleNoteClick = useCallback((index) => {
        if (!user) {
            alert('请先登录才能使用笔记功能');
            return;
        }
        setNoteEditor({ index, content: notes[index] || '' });
    }, [user, notes]);

    // 笔记：保存
    const handleNoteSave = async () => {
        if (!noteEditor || !videoData) return;
        const { index, content } = noteEditor;
        if (!content.trim()) return;
        setNoteSaving(true);
        try {
            await notesAPI.save(videoData.id, index, content.trim());
            setNotes(prev => ({ ...prev, [index]: content.trim() }));
            setNoteEditor(null);
        } catch (err) {
            console.error('Failed to save note:', err);
        } finally {
            setNoteSaving(false);
        }
    };

    // 笔记：删除
    const handleNoteDelete = async () => {
        if (!noteEditor || !videoData) return;
        const { index } = noteEditor;
        setNoteSaving(true);
        try {
            await notesAPI.delete(videoData.id, index);
            setNotes(prev => { const next = { ...prev }; delete next[index]; return next; });
            setNoteEditor(null);
        } catch (err) {
            console.error('Failed to delete note:', err);
        } finally {
            setNoteSaving(false);
        }
    };

    // 手机端：上一句 / 下一句
    const handleMobilePrevSentence = (e) => {
        if (e) e.stopPropagation();
        if (!videoData?.transcript || activeIndex <= 0) return;
        const sentence = videoData.transcript[activeIndex - 1];
        if (sentence) handleSeek(sentence.start);
    };

    const handleMobileNextSentence = (e) => {
        if (e) e.stopPropagation();
        if (!videoData?.transcript) return;
        if (activeIndex === -1 && videoData.transcript.length > 0) {
            handleSeek(videoData.transcript[0].start);
            return;
        }
        if (activeIndex >= videoData.transcript.length - 1) return;
        const sentence = videoData.transcript[activeIndex + 1];
        if (sentence) handleSeek(sentence.start);
    };

    // Toggle play/pause
    const handleTogglePlay = useCallback(() => {
        if (isPlaying) {
            setIsPlaying(false);
            if (playerRef.current) playerRef.current.pause();
        } else {
            setIsPlaying(true);
            if (playerRef.current) playerRef.current.play();
        }
    }, [isPlaying]);

    // PC端键盘快捷键 - 空格键控制播放/暂停
    useEffect(() => {
        const handleKeyDown = (e) => {
            // 只处理播放器激活状态下的空格键
            if (!playerActive) return;
            if (e.code !== 'Space' && e.key !== ' ') return;

            // 如果焦点在输入框内，不拦截空格
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) {
                return;
            }

            e.preventDefault();
            handleTogglePlay();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [playerActive, handleTogglePlay]);

    // Change speed (for FloatingControls - cycles through speeds)
    const handleChangeSpeed = () => {
        const speeds = [0.4, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
        const currentIndex = speeds.indexOf(playbackRate);
        const nextIndex = (currentIndex + 1) % speeds.length;
        const newRate = speeds[nextIndex];
        handleSetPlaybackRate(newRate);
    };

    // 设置倍速（保存到 localStorage）
    const handleSetPlaybackRate = (rate) => {
        setPlaybackRate(rate);
        localStorage.setItem('bbEnglish_playbackRate', rate.toString());
        if (playerRef.current) {
            playerRef.current.playbackRate = rate;
        }
        setShowSpeedPanel(false);
    };

    // 格式化时间 mm:ss
    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // 进度条点击跳转
    const handleProgressClick = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        const newTime = percent * duration;
        handleSeek(newTime);
    };

    // 音量变更
    const handleVolumeChange = (newVolume) => {
        setVolume(newVolume);
        setMuted(newVolume === 0);
        localStorage.setItem('bbEnglish_volume', newVolume.toString());
        if (playerRef.current) {
            playerRef.current.volume = newVolume;
            playerRef.current.muted = newVolume === 0;
        }
    };

    // 静音切换
    const handleToggleMute = () => {
        const newMuted = !muted;
        setMuted(newMuted);
        if (playerRef.current) {
            playerRef.current.muted = newMuted;
        }
    };

    // 全屏切换 - 兼容 iOS/Android
    const handleToggleFullscreen = async () => {
        const videoEl = playerRef.current;
        if (!videoEl) return;

        try {
            if (!isFullscreen) {
                // 进入全屏
                if (videoEl.requestFullscreen) {
                    await videoEl.requestFullscreen();
                } else if (videoEl.webkitEnterFullscreen) {
                    // iOS Safari
                    videoEl.webkitEnterFullscreen();
                } else if (videoEl.webkitRequestFullscreen) {
                    // Old Safari
                    videoEl.webkitRequestFullscreen();
                } else if (playerContainerRef.current?.requestFullscreen) {
                    // Fallback to container
                    await playerContainerRef.current.requestFullscreen();
                }
                setIsFullscreen(true);
            } else {
                // 退出全屏
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (videoEl.webkitExitFullscreen) {
                    videoEl.webkitExitFullscreen();
                }
                setIsFullscreen(false);
            }
        } catch (err) {
            console.warn('Fullscreen not supported:', err);
        }
    };

    // 监听全屏变化 - 兼容 webkit
    useEffect(() => {
        const handleFullscreenChange = () => {
            const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
            setIsFullscreen(isFS);
        };

        // 监听 video 元素的 webkitbeginfullscreen/webkitendfullscreen (iOS Safari)
        const videoEl = playerRef.current;
        const handleWebkitBeginFullscreen = () => setIsFullscreen(true);
        const handleWebkitEndFullscreen = () => setIsFullscreen(false);

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

        if (videoEl) {
            videoEl.addEventListener('webkitbeginfullscreen', handleWebkitBeginFullscreen);
            videoEl.addEventListener('webkitendfullscreen', handleWebkitEndFullscreen);
        }

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            if (videoEl) {
                videoEl.removeEventListener('webkitbeginfullscreen', handleWebkitBeginFullscreen);
                videoEl.removeEventListener('webkitendfullscreen', handleWebkitEndFullscreen);
            }
        };
    }, [videoData]); // 依赖 videoData 确保 playerRef.current 已挂载

    // 控制条自动隐藏逻辑
    const resetControlsTimeout = useCallback(() => {
        setShowControls(true);
        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        // 2.5秒后自动隐藏（如果正在播放）
        if (isPlaying) {
            controlsTimeoutRef.current = setTimeout(() => {
                setShowControls(false);
                setShowSpeedPanel(false);
                setShowVolumeSlider(false);
            }, 2500);
        }
    }, [isPlaying]);

    // 初始化音量和倍速到视频元素
    useEffect(() => {
        if (playerRef.current) {
            playerRef.current.volume = volume;
            playerRef.current.playbackRate = playbackRate;
        }
    }, [videoData]); // 当视频数据加载完成时初始化

    // 视频结束处理（整视频循环优先级低于单句循环）
    const handleVideoEnded = () => {
        if (isVideoLooping && !isSentenceLooping) {
            // 整视频循环：从头播放
            if (playerRef.current) {
                playerRef.current.currentTime = 0;
                playerRef.current.play();
            }
        } else {
            // 非循环：视频结束，显示覆盖按钮
            setIsPlaying(false);
            setShowControls(true);
        }
    };

    // 点击视频区域切换播放/暂停 + 显示控制条
    const handleVideoAreaClick = (e) => {
        // 避免点击控制条区域时触发
        if (e.target.closest('.custom-controls')) return;
        // 激活播放器（允许键盘快捷键）
        setPlayerActive(true);
        // 切换播放/暂停
        handleTogglePlay();
        // 显示控制条并重置隐藏计时器
        resetControlsTimeout();
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
        <div className="min-h-screen bg-[#f5f5f5] dark:bg-gray-900 xl:h-screen xl:flex xl:flex-col">
            {/* PC端统一顶部导航栏：← 返回 | 上一期/下一期 | 字幕Tab + 打印/设置 */}
            {!isMobile && (
                <div className="hidden xl:flex items-center gap-3 px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
                    {/* 左：首页 */}
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors font-medium shrink-0 mr-4"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        首页
                    </button>
                    {/* 分隔线 */}
                    <div className="h-5 w-px bg-gray-200 shrink-0" />
                    {/* 中：上一期/下一期 */}
                    <div className="flex items-center gap-2 shrink-0">
                        {prevVideo && !isDemo && (
                            <button
                                onClick={() => navigate(`/episode/${prevVideo.episode}`)}
                                className="flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                上一期
                            </button>
                        )}
                        {nextVideo && !isDemo && (
                            <button
                                onClick={() => navigate(`/episode/${nextVideo.episode}`)}
                                className="flex items-center gap-1 px-3 py-1 bg-violet-500 text-white rounded-full text-sm font-medium hover:bg-violet-600 transition-colors"
                            >
                                下一期
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        )}
                    </div>
                    {/* 右：字幕Tab + 图标（flex-1 推到右侧） */}
                    <div className="flex-1 flex justify-end min-w-0">
                        <SubtitleTabs
                            mode={mode}
                            onSetMode={handleModeChange}
                            onPrint={handlePrint}
                            onOpenSettings={() => setShowDesktopSettings(true)}
                            showPodcast={showPodcast}
                            onPodcastClick={handlePodcastClick}
                            hasPodcast={!!videoData.podcast_url}
                            hideSubtitles={jingTingSettings.hideSubtitles}
                            onToggleHideSubtitles={() => setJingTingSettings(s => ({ ...s, hideSubtitles: !s.hideSubtitles }))}
                        />
                    </div>
                </div>
            )}

            {/* 主内容区：左侧视频 + 右侧字幕 */}
            <div className="xl:flex-1 xl:flex xl:flex-row xl:overflow-hidden">
            {/* 左侧：视频 */}
            <div className="w-full xl:w-1/2 xl:flex xl:flex-col xl:overflow-y-auto">

                {/* 视频播放器区域 */}
                <div className={isPhone ? '' : 'px-3 md:px-6 xl:pt-4'}>
                    {/* 手机端：播放器fixed固定顶部，占位元素保持文档流高度 */}
                    {isPhone && (
                        <div className="w-full" style={{ paddingTop: '56.25%' }} />
                    )}
                    {/* 平板播放时的占位元素 */}
                    {!isPhone && isMobile && isPlaying && (
                        <div style={{ height: playerHeight + 50 }} className="w-full" />
                    )}
                    {/* 视频播放器 - 手机端fixed固定顶部，平板播放时fixed，PC端sticky */}
                    <div
                        ref={playerContainerRef}
                        className={`
                            overflow-hidden shadow-2xl transition-all duration-300
                            ${isPhone ? 'fixed top-0 left-0 right-0 z-[80] bg-black' : 'bg-white dark:bg-gray-800 rounded-xl'}
                            ${!isPhone && isMobile && isPlaying ? 'fixed top-0 left-1/2 -translate-x-1/2 w-[50%] max-w-md z-[80]' : ''}
                            ${!isMobile && isPlaying ? 'sticky top-0 z-40' : ''}
                        `}
                    >
                        <div
                            className="relative w-full"
                            style={{ paddingTop: '56.25%' }}
                            onClick={handleVideoAreaClick}
                            onMouseMove={resetControlsTimeout}
                            onTouchStart={resetControlsTimeout}
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

                            {showOverlaySubtitles && activeIndex >= 0 && videoData.transcript?.[activeIndex] && (
                                <div className={`absolute left-0 right-0 z-10 flex justify-center pointer-events-none px-4 ${isMobile ? (showControls ? 'bottom-12' : 'bottom-4') : 'bottom-8'}`}>
                                    <div className="max-w-[90%] md:max-w-[85%] text-center">
                                        {mode === 'cn' ? (
                                            <p className="text-white text-[14px] md:text-[20px] leading-relaxed md:leading-snug drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                                {videoData.transcript[activeIndex]?.cn}
                                            </p>
                                        ) : mode === 'en' ? (
                                            <p className="text-white text-[15px] md:text-[22px] leading-relaxed md:leading-snug drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                                {videoData.transcript[activeIndex]?.text}
                                            </p>
                                        ) : (
                                            <>
                                                <p className="text-white text-[15px] md:text-[22px] leading-relaxed md:leading-snug drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                                    {videoData.transcript[activeIndex]?.text}
                                                </p>
                                                <p className="text-white/90 text-[13px] md:text-[18px] leading-relaxed md:leading-snug mt-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                                    {videoData.transcript[activeIndex]?.cn}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* 视频覆盖按钮（PC和手机端统一：暂停/结束时显示，播放时隐藏） */}
                            <div className={`absolute inset-0 z-10 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                                {/* 左上角：上一期/下一期（横排） */}
                                {!isDemo && (
                                    <div className="absolute left-2 top-2 flex flex-row gap-1.5">
                                        {prevVideo && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); navigate(`/episode/${prevVideo.episode}`); }}
                                                className="w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                                                title="上一期"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                                                </svg>
                                            </button>
                                        )}
                                        {nextVideo && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); navigate(`/episode/${nextVideo.episode}`); }}
                                                className="w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                                                title="下一期"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                )}
                                {/* 右上角：收藏★、已学✓、更多…（横排） */}
                                <div className="absolute right-2 top-2 flex flex-row gap-1.5">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleToggleFavorite(); }}
                                        className={`w-9 h-9 rounded-full bg-black/50 flex items-center justify-center transition-colors hover:bg-black/70 ${isFavorite ? 'text-yellow-400' : 'text-white'}`}
                                        title={isFavorite ? "取消收藏" : "收藏"}
                                    >
                                        <svg className="w-4 h-4" fill={isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleToggleLearned(); }}
                                        className={`w-9 h-9 rounded-full bg-black/50 flex items-center justify-center transition-colors hover:bg-black/70 ${isLearned ? 'text-green-400' : 'text-white'}`}
                                        title={isLearned ? "标记未学" : "标记已学"}
                                    >
                                        <svg className="w-4 h-4" fill={isLearned ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowMobileSettings(true); }}
                                        className="w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                                        title="更多"
                                    >
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                            <circle cx="5" cy="12" r="2" />
                                            <circle cx="12" cy="12" r="2" />
                                            <circle cx="19" cy="12" r="2" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* 手机端更多设置面板 - 底部弹窗 */}
                            {showMobileSettings && (
                                <>
                                    <div
                                        className="md:hidden fixed inset-0 bg-black/50 z-[100]"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowMobileSettings(false);
                                        }}
                                    />
                                    <div className="md:hidden fixed bottom-0 left-0 right-0 z-[101] bg-gray-900 rounded-t-2xl py-4 px-4 max-h-[70vh] overflow-y-auto">
                                        <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-4" />

                                        {/* 字幕模式 */}
                                        <div className="mb-4" onClick={(e) => e.stopPropagation()}>
                                            <div className="text-white/70 text-sm mb-2">字幕模式</div>
                                            <div className="flex gap-2">
                                                {[['dual','双语'],['en','英文'],['cn','中文'],['cloze','挖空']].map(([m, label]) => (
                                                    <button
                                                        key={m}
                                                        onClick={(e) => { e.stopPropagation(); handleModeChange(m); }}
                                                        className={`flex-1 py-2 rounded-lg text-sm transition-colors ${mode === m && !showPodcast ? 'bg-violet-400 text-white font-medium' : 'bg-white/10 text-white hover:bg-white/20'}`}
                                                    >
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* 视频循环开关 */}
                                        <div className="flex items-center justify-between py-3 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
                                            <span className="text-white text-sm">视频循环</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsVideoLooping(!isVideoLooping);
                                                }}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isVideoLooping ? 'bg-violet-400' : 'bg-neutral-500/70'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${isVideoLooping ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>

                                        

                                        {/* 单句循环开关 */}
                                        <div className="flex items-center justify-between py-3 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
                                            <span className="text-white text-sm">单句循环</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsSentenceLooping(!isSentenceLooping);
                                                }}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isSentenceLooping ? 'bg-violet-400' : 'bg-neutral-500/70'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${isSentenceLooping ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>

                                        {/* 单句暂停开关 */}
                                        <div className="flex items-center justify-between py-3 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
                                            <div>
                                                <span className="text-white text-sm block">逐句暂停</span>
                                                <span className="text-white/40 text-[10px]">每句结束自动暂停</span>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsSentencePauseEnabled(!isSentencePauseEnabled);
                                                }}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isSentencePauseEnabled ? 'bg-violet-400' : 'bg-neutral-500/70'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${isSentencePauseEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>

                                        {/* 全屏 */}
                                        {document.fullscreenEnabled && (
                                            <div className="flex items-center justify-between py-3 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
                                                <span className="text-white text-sm">全屏播放</span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleToggleFullscreen();
                                                        setShowMobileSettings(false);
                                                    }}
                                                    className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
                                                >
                                                    {isFullscreen ? '退出全屏' : '进入全屏'}
                                                </button>
                                            </div>
                                        )}

                                        {/* 画面字幕开关 */}
                                        <div className="flex items-center justify-between py-3 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
                                            <span className="text-white text-sm">画面字幕</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowOverlaySubtitles(!showOverlaySubtitles);
                                                }}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showOverlaySubtitles ? 'bg-violet-400' : 'bg-neutral-500/70'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${showOverlaySubtitles ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>

                                        {/* 字幕字体大小 */}
                                        <div className="py-3 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-white text-sm">字幕字体大小</span>
                                                <span className="text-white/60 text-sm">{subtitleFontSize}px</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="12"
                                                max="20"
                                                step="1"
                                                value={subtitleFontSize}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    setSubtitleFontSize(val);
                                                    localStorage.setItem('bbEnglish_subtitleFontSize', val.toString());
                                                }}
                                                className="w-full accent-violet-400"
                                            />
                                            <div className="flex justify-between text-white/40 text-xs mt-1">
                                                <span>12px</span><span>20px</span>
                                            </div>
                                        </div>

                                        {/* 主题 */}
                                        <div className="py-3 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
                                            <div className="text-white/70 text-sm mb-2">外观</div>
                                            <div className="flex gap-2">
                                                {[['system','跟随系统'],['light','浅色'],['dark','深色']].map(([val, label]) => (
                                                    <button
                                                        key={val}
                                                        onClick={(e) => { e.stopPropagation(); setAppTheme(val); }}
                                                        className={`flex-1 py-1.5 rounded-lg text-sm transition-colors ${appTheme === val ? 'bg-violet-400 text-white font-medium' : 'bg-white/10 text-white hover:bg-white/20'}`}
                                                    >
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* 下载字幕 */}
                                        <div className="flex items-center justify-between py-3 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
                                            <span className="text-white text-sm">下载字幕</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowMobileSettings(false);
                                                    handlePrint();
                                                }}
                                                className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
                                            >
                                                下载
                                            </button>
                                        </div>

                                        {/* 视频信息：创作者、YouTube链接、音频下载 */}
                                        <div className="py-3 border-t border-white/10">
                                            <div className="text-white/70 text-xs mb-2">视频信息</div>
                                            <div className="flex flex-wrap items-center gap-3">
                                                {videoData.author && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setShowMobileSettings(false); navigate(`/?author=${encodeURIComponent(videoData.author)}`); }}
                                                        className="flex items-center gap-1 text-white/80 text-sm hover:text-white transition-colors"
                                                    >
                                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                                        </svg>
                                                        {videoData.author}
                                                    </button>
                                                )}
                                                {videoData.youtube_url && (
                                                    <a
                                                        href={videoData.youtube_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="flex items-center gap-1 text-red-400 hover:text-red-300 text-sm transition-colors"
                                                    >
                                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                                                        </svg>
                                                        YouTube
                                                    </a>
                                                )}
                                                {videoData.audio_url && (
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            setShowMobileSettings(false);
                                                            try {
                                                                const response = await fetch(videoData.audio_url);
                                                                const blob = await response.blob();
                                                                const url = window.URL.createObjectURL(blob);
                                                                const a = document.createElement('a');
                                                                a.href = url;
                                                                a.download = `BiuBiu英语_第${videoData.episode}期.mp3`;
                                                                document.body.appendChild(a);
                                                                a.click();
                                                                document.body.removeChild(a);
                                                                window.URL.revokeObjectURL(url);
                                                            } catch (error) {
                                                                window.open(videoData.audio_url, '_blank');
                                                            }
                                                        }}
                                                        className="flex items-center gap-1 text-white/80 hover:text-white text-sm transition-colors"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                        </svg>
                                                        下载音频
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            <video
                                ref={playerRef}
                                src={videoData.video_url}
                                className={`absolute top-0 left-0 w-full h-full bg-black ${isVideoHidden ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
                                playsInline
                                webkit-playsinline="true"
                                x5-video-player-type="h5"
                                x5-playsinline="true"
                                preload="auto"
                                onContextMenu={(e) => e.preventDefault()}
                                onLoadedMetadata={(e) => setDuration(e.target.duration)}
                                onPlay={() => {
                                    setIsPlaying(true);
                                    resetControlsTimeout();
                                }}
                                onPause={() => {
                                    setIsPlaying(false);
                                    setShowControls(true);
                                }}
                                onEnded={handleVideoEnded}
                                onTimeUpdate={(e) => handleProgress({ playedSeconds: e.target.currentTime })}
                            />

                        </div>
                    </div>

                    {/* PC端控制条 - 视频下方独立一行（仅xl+） */}
                    {!isMobile && (
                        <div className="hidden xl:flex flex-col bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-b-xl px-4 pt-1.5 pb-2 shadow-xl -mt-1">
                            {/* 进度条 */}
                            <div
                                className="relative w-full h-1 bg-gray-200 rounded cursor-pointer mb-2 group"
                                onClick={handleProgressClick}
                            >
                                <div
                                    className="h-full bg-violet-400 rounded relative"
                                    style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                                >
                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <span className="absolute right-0 -top-5 text-gray-500 text-[10px] tabular-nums">
                                    {formatTime(currentTime)} / {formatTime(duration)}
                                </span>
                            </div>
                            {/* 按钮行：左组 | 中组 | 右组 */}
                            <div className="flex items-center justify-center gap-10">
                                {/* 左组：倍速 / 隐藏 / 全屏 */}
                                <div className="flex items-center gap-3">
                                    {/* 倍速 */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowSpeedPanel(p => !p)}
                                            className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors min-w-[48px]"
                                        >
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44zm-9.79 6.84a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z"/></svg>
                                            <span className="text-xs leading-none">{playbackRate === 1 ? '倍速' : `${playbackRate}x`}</span>
                                        </button>
                                        {showSpeedPanel && (
                                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-800 rounded-xl shadow-xl p-2 z-10 w-[200px]">
                                                <div className="grid grid-cols-4 gap-1">
                                                    {[0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 1.0, 1.25, 1.5, 1.75, 2.0].map(rate => (
                                                        <button
                                                            key={rate}
                                                            onClick={() => { handleSetPlaybackRate(rate); setShowSpeedPanel(false); }}
                                                            className={`aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${playbackRate === rate ? 'bg-violet-500 text-white' : 'text-white hover:bg-white/15'}`}
                                                        >
                                                            {rate === 1 ? '正常' : `${rate}x`}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {/* 隐藏视频 */}
                                    <button
                                        onClick={() => setIsVideoHidden(v => !v)}
                                        className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-[48px] ${isVideoHidden ? 'text-violet-500 bg-gray-200' : 'text-gray-600 hover:bg-gray-200'}`}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isVideoHidden ? "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" : "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"} /></svg>
                                        <span className="text-xs leading-none">{isVideoHidden ? '显示' : '隐藏'}</span>
                                    </button>
                                    {/* 全屏 */}
                                    {document.fullscreenEnabled && (
                                        <button
                                            onClick={handleToggleFullscreen}
                                            className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors min-w-[48px]"
                                        >
                                            {isFullscreen ? (
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
                                            ) : (
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
                                            )}
                                            <span className="text-xs leading-none">{isFullscreen ? '退出' : '全屏'}</span>
                                        </button>
                                    )}
                                </div>
                                {/* 分隔线 */}
                                <div className="h-8 w-px bg-gray-200" />
                                {/* 中组：上一句 / ▶播放 / 下一句 */}
                                <div className="flex items-center gap-5">
                                    <button onClick={handleMobilePrevSentence} className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors">
                                        <span className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/></svg>
                                        </span>
                                        <span className="text-xs leading-none">上一句</span>
                                    </button>
                                    <button onClick={handleTogglePlay} className="flex flex-col items-center gap-0.5">
                                        <span className="w-11 h-11 rounded-full bg-violet-500 flex items-center justify-center shadow-lg">
                                            {isPlaying ? (
                                                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
                                            ) : (
                                                <svg className="w-5 h-5 ml-0.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                            )}
                                        </span>
                                        <span className="text-xs leading-none text-gray-600">{isPlaying ? '暂停' : '播放'}</span>
                                    </button>
                                    <button onClick={handleMobileNextSentence} className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors">
                                        <span className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>
                                        </span>
                                        <span className="text-xs leading-none">下一句</span>
                                    </button>
                                </div>
                                {/* 分隔线 */}
                                <div className="h-8 w-px bg-gray-200" />
                                {/* 右组：A/B点 / 单句循环 / 间隔Xs / 单句暂停 */}
                                <div className="flex items-center gap-3">
                                    {/* A/B点 */}
                                    <button
                                        onClick={handleAbClick}
                                        className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-[48px] ${abMode === 0 ? 'text-gray-600 hover:bg-gray-200' : abMode === 1 ? 'text-yellow-500 bg-yellow-50' : abMode === 2 ? 'text-orange-500 bg-orange-50' : 'text-green-500 bg-green-50'}`}
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
                                        <span className="text-xs leading-none font-medium">
                                            {abMode === 0 ? 'A/B点' : abMode === 1 ? 'A?' : abMode === 2 ? 'A●' : 'A↔B'}
                                        </span>
                                    </button>
                                    {/* 单句循环 + 次数选择浮层 */}
                                    <div className="relative">
                                        <button
                                            onClick={() => {
                                                if (!isSentenceLooping) setIsSentenceLooping(true);
                                                setShowLoopTimesPanel(p => !p);
                                            }}
                                            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-[48px] ${isSentenceLooping ? 'text-violet-500 bg-gray-100 dark:bg-gray-700' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                                        >
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/></svg>
                                            <span className="text-xs leading-none">
                                                {isSentenceLooping
                                                    ? (jingTingSettings.loopCount === null ? '循环 ∞' : `循环 ${jingTingSettings.loopCount}×`)
                                                    : '单句循环'}
                                            </span>
                                        </button>
                                        {showLoopTimesPanel && (
                                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-800 rounded-xl shadow-xl p-2 z-[200] w-[200px]">
                                                <div className="grid grid-cols-4 gap-1 mb-1">
                                                    {[1, 2, 3, 5, 10, 50, 100, null].map(count => (
                                                        <button
                                                            key={String(count)}
                                                            onClick={() => {
                                                                setJingTingSettings(s => ({ ...s, loopCount: count }));
                                                                setIsSentenceLooping(true);
                                                                setShowLoopTimesPanel(false);
                                                            }}
                                                            className={`aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${jingTingSettings.loopCount === count && isSentenceLooping ? 'bg-violet-500 text-white' : 'text-white hover:bg-white/15'}`}
                                                        >
                                                            {count === null ? '∞' : `${count}×`}
                                                        </button>
                                                    ))}
                                                </div>
                                                <button
                                                    onClick={() => { setIsSentenceLooping(false); setShowLoopTimesPanel(false); }}
                                                    className="w-full text-center text-xs text-white/50 hover:text-white/80 py-1 transition-colors"
                                                >
                                                    关闭循环
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    {/* 间隔Xs - only when sentence looping is on */}
                                    {isSentenceLooping && (
                                        <div className="flex flex-col items-center gap-0.5 px-1 py-1">
                                            <div className="flex items-center gap-0.5">
                                                <button onClick={() => setJingTingSettings(s => ({ ...s, intervalSec: Math.max(0, s.intervalSec - 1) }))} className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-500">-</button>
                                                <span className="text-gray-600 dark:text-gray-300 text-xs font-medium w-8 text-center">{jingTingSettings.intervalSec}s</span>
                                                <button onClick={() => setJingTingSettings(s => ({ ...s, intervalSec: Math.min(10, s.intervalSec + 1) }))} className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-500">+</button>
                                            </div>
                                            <span className="text-xs text-gray-500 dark:text-gray-400 leading-none">间隔</span>
                                        </div>
                                    )}
                                    {/* 单句暂停 */}
                                    <button
                                        onClick={() => setIsSentencePauseEnabled(v => !v)}
                                        className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-[48px] ${isSentencePauseEnabled ? 'text-violet-500 bg-gray-100 dark:bg-gray-700' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                                    >
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="4" height="16" rx="1"/><rect x="13" y="4" width="4" height="16" rx="1"/><circle cx="20" cy="6" r="3"/></svg>
                                        <span className="text-xs leading-none">逐句暂停</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* PC端跟读面板 — 播放器控制条正下方，始终显示 */}
                {!isMobile && (() => {
                    const shadowSub = videoData.transcript?.[activeIndex] || videoData.transcript?.[0];
                    const shadowSentenceId = shadowSub?.id !== undefined && shadowSub?.id !== null
                        ? shadowSub.id
                        : `${videoData.id}-${activeIndex}`;
                    const shadowIsFav = favoriteSentenceIds.some(fid => String(fid) === String(shadowSentenceId));
                    return (
                        <div className="flex-1 flex flex-col px-3 md:px-4 pb-3 pt-2 min-h-0">
                            <ShadowPanel
                                currentSub={shadowSub}
                                activeIndex={activeIndex >= 0 ? activeIndex : 0}
                                totalCount={videoData.transcript?.length || 0}
                                vocab={videoData.vocab || []}
                                shadowEnBlurred={shadowEnBlurred}
                                shadowCnBlurred={shadowCnBlurred}
                                onToggleShadowEn={() => setShadowEnBlurred(v => !v)}
                                onToggleShadowCn={() => setShadowCnBlurred(v => !v)}
                                isFavorite={shadowIsFav}
                                onToggleFavorite={handleToggleSentenceFavorite}
                                sentenceId={shadowSentenceId}
                                onAddToNotebook={() => {
                                    if (!user && !isDemo) { alert('登录后才能使用本子功能'); return; }
                                    setNotebookDialogItem({ itemType: 'sentence', itemId: shadowSentenceId, videoId: Number(videoData.id) });
                                    setNotebookDialogOpen(true);
                                }}
                                onSwitchToDictation={() => handleModeChange('dictation')}
                                onVocabNavigate={(vocabIndex) => {
                                    const vItem = (videoData.vocab || [])[vocabIndex];
                                    if (vItem) setVocabPopup({ index: vocabIndex, item: vItem });
                                }}
                            />
                        </div>
                    );
                })()}

                {/* 移动端：字幕导航条（手机端fixed紧贴播放器下方，平板sticky） */}
                {isMobile && (
                    <>
                        <div
                            ref={tabBarRef}
                            className={`bg-white dark:bg-gray-800 border-b border-t border-gray-200 dark:border-gray-700 px-2 pt-3 pb-2 z-[79] shadow-sm ${
                                isPhone ? 'fixed left-0 right-0' : 'sticky'
                            }`}
                            style={{ top: playerHeight }}
                        >
                            <MobileSubtitleTabs
                                mode={mode}
                                onSetMode={handleModeChange}
                                showPodcast={showPodcast}
                                onPodcastClick={handlePodcastClick}
                                hasPodcast={!!videoData.podcast_url}
                            />
                        </div>
                        {/* 手机端：Tab栏fixed脱离文档流，占位保持布局高度 */}
                        {isPhone && <div style={{ height: tabBarHeight }} />}
                    </>
                )}


            </div>

            {/* Right Side Container Start */}
            <div className="flex-1 bg-[#f5f5f5] dark:bg-gray-800 border-t xl:border-t-0 xl:border-l border-gray-200 dark:border-gray-700 flex flex-col relative" onClick={() => setPlayerActive(false)}>
                <div className="flex-1 overflow-y-auto pb-32 md:pb-24">
                    {/* A/B点引导提示条 */}
                    {(abMode === 1 || abMode === 2) && (
                        <div className="sticky top-0 z-10 bg-violet-50 border-b border-violet-200 px-4 py-2 flex items-center gap-2 text-sm text-violet-700">
                            <svg className="w-4 h-4 shrink-0 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {abMode === 1
                                ? <span>请点击字幕行设置 <strong>A 点</strong>（循环起点）</span>
                                : <span>A 点已设置，请点击字幕行设置 <strong>B 点</strong>（循环终点）</span>
                            }
                        </div>
                    )}
                    {mode === 'cloze' && (
                        <div className="sticky top-0 z-10 bg-violet-50 border-b px-4 py-2 flex items-center justify-between text-sm text-violet-500">
                            <div className="flex items-center gap-4">
                                <span>
                                    <strong>进度：</strong>
                                    {Object.keys(clozeResults).length} / {Object.values(clozeData).flat().filter(s => s.type === 'cloze').length} 空
                                </span>
                                <span>
                                    <strong>正确率：</strong>
                                    {(() => {
                                        const results = Object.values(clozeResults);
                                        if (results.length === 0) return '0%';
                                        const correct = results.filter(r => r === 'correct').length;
                                        return Math.round((correct / results.length) * 100) + '%';
                                    })()}
                                </span>
                            </div>
                        </div>
                    )}
                    {mode === 'dictation' && (
                        <div className="mx-3 mt-3 md:mx-4 md:mt-4 bg-gradient-to-r from-violet-50 to-violet-50 p-4 rounded-lg shadow-sm">
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
                                    <div className="text-2xl font-bold text-violet-500">
                                        {dictationStats.correct + dictationStats.wrong + dictationStats.skipped > 0
                                            ? Math.round((dictationStats.correct / (dictationStats.correct + dictationStats.wrong + dictationStats.skipped)) * 100)
                                            : 0}%
                                    </div>
                                    <div className="text-xs text-gray-600">正确率</div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="relative">
                        <div className={jingTingSettings.hideSubtitles ? 'blur-sm pointer-events-none select-none' : ''}>
                    <div className="p-3 md:p-4 space-y-2 md:space-y-3">
                        {showPodcast ? (
                            <div className="flex flex-col items-center justify-center p-8 bg-violet-50 dark:bg-violet-900/20 rounded-lg mx-4 my-8">
                                <div className="text-4xl mb-4">🎙️</div>
                                <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-2">播客</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center">
                                    两位主播带你轻松回顾本期内容
                                </p>
                                <audio
                                    ref={podcastAudioRef}
                                    controls
                                    src={videoData.podcast_url}
                                    className="w-full max-w-md"
                                />
                                {/* 手机端额外功能按钮：倍速 + 下载 */}
                                <div className="flex items-center gap-4 mt-4">
                                    <button
                                        onClick={handlePodcastSpeedChange}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-700 border border-violet-200 dark:border-violet-700 rounded-full text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors text-sm font-medium"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        {podcastSpeed}x
                                    </button>
                                    <button
                                        onClick={handlePodcastDownload}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-700 border border-violet-200 dark:border-violet-700 rounded-full text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors text-sm font-medium"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        下载音频
                                    </button>
                                </div>
                                <button
                                    onClick={() => setShowPodcast(false)}
                                    className="mt-6 text-sm text-violet-600 hover:text-violet-800"
                                >
                                    返回字幕
                                </button>
                            </div>
                        ) : mode === 'dictation' ? (
                            <div className="bg-violet-50 p-6 rounded-lg border-2 border-violet-200">
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
                        ) : mode === 'shadow' ? (
                            (() => {
                                const mobileShadowSub = videoData.transcript?.[activeIndex] || videoData.transcript?.[0];
                                const mobileShadowId = mobileShadowSub?.id !== undefined && mobileShadowSub?.id !== null
                                    ? mobileShadowSub.id : `${videoData.id}-${activeIndex}`;
                                const mobileShadowIsFav = favoriteSentenceIds.some(fid => String(fid) === String(mobileShadowId));
                                return (
                                    <div className="pt-3">
                                        <ShadowPanel
                                            currentSub={mobileShadowSub}
                                            activeIndex={activeIndex >= 0 ? activeIndex : 0}
                                            totalCount={videoData.transcript?.length || 0}
                                            vocab={videoData.vocab || []}
                                            shadowEnBlurred={shadowEnBlurred}
                                            shadowCnBlurred={shadowCnBlurred}
                                            onToggleShadowEn={() => setShadowEnBlurred(v => !v)}
                                            onToggleShadowCn={() => setShadowCnBlurred(v => !v)}
                                            isFavorite={mobileShadowIsFav}
                                            onToggleFavorite={handleToggleSentenceFavorite}
                                            sentenceId={mobileShadowId}
                                            onAddToNotebook={() => {
                                                if (!user && !isDemo) { alert('登录后才能使用本子功能'); return; }
                                                setNotebookDialogItem({ itemType: 'sentence', itemId: mobileShadowId, videoId: Number(videoData.id) });
                                                setNotebookDialogOpen(true);
                                            }}
                                            onSwitchToDictation={() => handleModeChange('dictation')}
                                            onVocabNavigate={(vocabIndex) => {
                                                const vItem = (videoData.vocab || [])[vocabIndex];
                                                if (vItem) setVocabPopup({ index: vocabIndex, item: vItem });
                                            }}
                                        />
                                    </div>
                                );
                            })()
                        ) : mode === 'vocab' ? (
                            (() => {
                                const vocab = videoData.vocab || [];
                                if (vocab.length === 0) return (
                                    <div className="p-8 text-center text-gray-400">暂无词卡内容</div>
                                );

                                // ── 词条详情页 ──
                                if (vocabDetailIndex !== null) {
                                    const item = vocab[vocabDetailIndex];
                                    if (!item) return null;
                                    const vocabId = item.id !== undefined && item.id !== null ? item.id : `${videoData.id}-vocab-${vocabDetailIndex}`;
                                    const isFav = favoriteVocabIds.some(fid => String(fid) === String(vocabId));
                                    const occData = vocabOccurrences[item.word?.toLowerCase()];
                                    const hasOcc = occData?.total > 0 && occData?.occurrences?.length > 0;

                                    // 触摸滑动
                                    let touchStartX = null;
                                    const onTouchStart = (e) => { touchStartX = e.touches[0].clientX; };
                                    const onTouchEnd = (e) => {
                                        if (touchStartX === null) return;
                                        const dx = e.changedTouches[0].clientX - touchStartX;
                                        touchStartX = null;
                                        if (dx > 60 && vocabDetailIndex > 0) setVocabDetailIndex(v => v - 1);
                                        else if (dx < -60 && vocabDetailIndex < vocab.length - 1) setVocabDetailIndex(v => v + 1);
                                    };

                                    return (
                                        <div className="flex flex-col h-full" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
                                            {/* 顶部导航栏 */}
                                            <div className="flex items-center gap-1 px-2 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-10" style={{minHeight:'52px'}}>
                                                <button onClick={() => setVocabDetailIndex(null)} className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors shrink-0">
                                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
                                                </button>
                                                <div className="flex-1" />
                                                <button disabled={vocabDetailIndex === 0} onClick={() => setVocabDetailIndex(v => v - 1)} className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 disabled:opacity-30 transition-colors">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7"/></svg>
                                                </button>
                                                <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums px-1">{vocabDetailIndex + 1}/{vocab.length}</span>
                                                <button disabled={vocabDetailIndex === vocab.length - 1} onClick={() => setVocabDetailIndex(v => v + 1)} className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 disabled:opacity-30 transition-colors">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/></svg>
                                                </button>
                                                <button
                                                    onClick={() => { if (!user && !isDemo) { alert('登录后才能使用本子功能'); return; } setNotebookDialogItem({ itemType: 'vocab', itemId: vocabId, videoId: Number(videoData.id) }); setNotebookDialogOpen(true); }}
                                                    className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-violet-500 dark:hover:text-violet-400 transition-colors shrink-0"
                                                    title="加入本子"
                                                >
                                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                                                </button>
                                                <button onClick={() => handleToggleVocabFavorite(vocabId)} className={`w-11 h-11 flex items-center justify-center rounded-lg transition-colors shrink-0 ${isFav ? 'text-yellow-500 hover:bg-yellow-50' : 'text-gray-300 hover:text-gray-400 hover:bg-gray-100'}`} title={isFav ? '取消收藏' : '收藏'}>
                                                    <svg className="w-6 h-6" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>
                                                </button>
                                            </div>

                                            {/* 详情内容 */}
                                            <div className="flex-1 overflow-y-auto">
                                                {/* 单词标题区 — 彩色背景 */}
                                                {(() => {
                                                    const DETAIL_COLORS = [
                                                        { bg: '#E8D5FF', text: '#7C3AED' },
                                                        { bg: '#FFE0CC', text: '#C2500A' },
                                                        { bg: '#C8F0E0', text: '#0D7A4E' },
                                                        { bg: '#CCE8FF', text: '#1A5FA8' },
                                                    ];
                                                    const dc = DETAIL_COLORS[vocabDetailIndex % DETAIL_COLORS.length];
                                                    return (
                                                        <div className="px-4 pt-4 pb-4" style={{ backgroundColor: dc.bg, borderRadius: '12px 12px 0 0' }}>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <h2 className="text-2xl font-bold" style={{ color: dc.text }}>{item.word}</h2>
                                                                {item.type && <span className="px-2 py-0.5 text-xs font-medium rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.1)', color: dc.text }}>{item.type}</span>}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            <div className="p-4 space-y-4">
                                                {/* 发音 */}
                                                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                                                    <div className="space-y-1">
                                                        {item.ipa_us && (
                                                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                                                <span className="text-gray-400 text-xs w-5">US</span>
                                                                <span className="font-mono">/{item.ipa_us}/</span>
                                                                <button onClick={() => speak(item.word, 'en-US')} className="p-1 hover:bg-violet-100 rounded-full text-violet-400 hover:text-violet-500 transition-colors">
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>
                                                                </button>
                                                            </div>
                                                        )}
                                                        {item.ipa_uk && (
                                                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                                                <span className="text-gray-400 text-xs w-5">UK</span>
                                                                <span className="font-mono">/{item.ipa_uk}/</span>
                                                                <button onClick={() => speak(item.word, 'en-GB')} className="p-1 hover:bg-violet-100 rounded-full text-violet-400 hover:text-violet-500 transition-colors">
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* 中文释义 */}
                                                {item.meaning && (
                                                    <div>
                                                        <div className="text-xs text-gray-400 dark:text-gray-500 font-medium mb-1 uppercase tracking-wide">释义</div>
                                                        <p className="text-gray-800 dark:text-gray-200 text-base font-medium">{item.meaning}</p>
                                                    </div>
                                                )}

                                                {/* 例句 */}
                                                {item.examples && item.examples.length > 0 && (
                                                    <div>
                                                        <div className="text-xs text-gray-400 dark:text-gray-500 font-medium mb-2 uppercase tracking-wide">例句</div>
                                                        <div className="space-y-3">
                                                            {item.examples.map((ex, i) => (
                                                                <div key={i} className="border-l-2 border-violet-200 dark:border-violet-700 pl-3">
                                                                    <p className="text-gray-800 dark:text-gray-200 leading-relaxed">{ex.en}</p>
                                                                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{ex.cn}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* 跨期出现次数 */}
                                                {hasOcc && (
                                                    <details className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                                                        <summary className="px-4 py-3 cursor-pointer text-sm text-gray-600 dark:text-gray-300 font-medium bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors list-none flex items-center justify-between">
                                                            <span>在 {occData.occurrences.length} 期中出现了 {occData.total} 次</span>
                                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                                                        </summary>
                                                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                                            {occData.occurrences.map((occ, idx) => (
                                                                <a key={idx} href={`/episode/${occ.episode}?scrollTo=vocab&vocabIndex=${occ.vocab_index || 0}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors text-sm">
                                                                    <span className="text-gray-700 dark:text-gray-300">第 {occ.episode} 期</span>
                                                                    <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                                                                </a>
                                                            ))}
                                                        </div>
                                                    </details>
                                                )}

                                                {/* 词典链接 */}
                                                <div className="flex gap-2 pt-1">
                                                    <a
                                                        href={`https://translate.google.com/?sl=en&tl=zh-CN&text=${encodeURIComponent(item.word)}&op=translate`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                                    >
                                                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>
                                                        Google 翻译
                                                    </a>
                                                    <a
                                                        href={`https://dict.youdao.com/result?word=${encodeURIComponent(item.word)}&lang=en`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                                    >
                                                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                                                        有道词典
                                                    </a>
                                                </div>
                                            </div>
                                            </div>
                                        </div>
                                    );
                                }

                                // ── 词条列表页 ──
                                return (
                                    <div>
                                        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">重点单词 & 地道表达 <span className="text-violet-500 font-bold">{vocab.length}</span> 条</span>
                                        </div>
                                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                            {vocab.map((item, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() => setVocabDetailIndex(index)}
                                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                                                >
                                                    <span className="text-xs text-gray-400 dark:text-gray-500 w-5 shrink-0 text-right">{index + 1}</span>
                                                    <span className="flex-1 font-medium text-gray-900 dark:text-gray-100">{item.word}</span>
                                                    <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{item.type}</span>
                                                    <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()
                        ) : mode === 'intensive' ? (
                            <>
                                <IntensiveSentenceList
                                    videoId={Number(videoData.id)}
                                    transcript={videoData.transcript}
                                    currentIndex={activeIndex}
                                    visitedSet={visitedSet}
                                    onSelectSentence={handleIntensiveSelect}
                                    favoriteSentenceIds={favoriteSentenceIds}
                                    onToggleFavorite={handleToggleSentenceFavorite}
                                    onAddToNotebook={(sentenceId) => {
                                        if (!user && !isDemo) {
                                            alert('登录后才能使用本子功能');
                                            return;
                                        }
                                        setNotebookDialogItem({
                                            itemType: 'sentence',
                                            itemId: sentenceId,
                                            videoId: Number(videoData.id)
                                        });
                                        setNotebookDialogOpen(true);
                                    }}
                                />
                            </>
                        ) : (
                            videoData.transcript.map((item, index) => {
                                const isActive = index === activeIndex;
                                // Generate stable sentence ID (use existing or fallback)
                                const sentenceId = item.id !== undefined && item.id !== null
                                    ? item.id
                                    : `${videoData.id}-${index}`;
                                return (
                                    <div key={index} ref={(el) => transcriptRefs.current[index] = el}>
                                        <SubtitleItem
                                            item={item}
                                            index={index}
                                            isActive={isActive}
                                            mode={mode}
                                            clozePattern={null}
                                            vocab={videoData.vocab}
                                            onSeek={handleSeek}
                                            playerRef={playerRef}
                                            renderClozeText={renderClozeText}
                                            onSetIsPlaying={setIsPlaying}
                                            isFavorite={favoriteSentenceIds.some(fid => String(fid) === String(sentenceId))}
                                            onToggleFavorite={handleToggleSentenceFavorite}
                                            videoId={Number(videoData.id)}
                                            subtitleFontSize={subtitleFontSize}
                                            onVocabNavigate={(vocabIndex) => {
                                                const vList = videoData.vocab || [];
                                                const vItem = vList[vocabIndex];
                                                if (vItem) setVocabPopup({ index: vocabIndex, item: vItem });
                                            }}
                                            abMode={abMode}
                                            onSetAbPoint={handleSetAbPoint}
                                            isAbPointA={index === abIndexA}
                                            isAbPointB={index === abIndexB}
                                            loopCountdown={isActive ? loopCountdown : null}
                                            note={!isDemo ? (notes[index] || null) : null}
                                            onNoteClick={!isDemo ? handleNoteClick : null}
                                        />
                                    </div>
                                );
                            })
                        )}

                        {/* 重点词汇 - 只在词卡Tab列表页显示 */}
                        <div className={`xl:hidden mt-6 p-4 bg-violet-50 rounded-lg ${mode !== 'vocab' || vocabDetailIndex !== null ? 'hidden' : ''}`}>
                            <h3 className="text-lg font-bold mb-3 text-violet-500">重点词汇</h3>
                            <div className="space-y-3">
                                {videoData.vocab?.map((item, index) => {
                                    // Generate stable vocab ID (use existing or fallback)
                                    const vocabId = item.id !== undefined && item.id !== null
                                        ? item.id
                                        : `${videoData.id}-vocab-${index}`;
                                    return (
                                        <div key={vocabId} id={`vocab-card-${index}`} data-vocab-id={vocabId} data-vocab-index={index} data-vocab-word={item.word} className="relative p-3 bg-white dark:bg-gray-700 rounded-lg border border-violet-100 dark:border-violet-900/50 transition-all duration-200">
                                            {/* 收藏按钮（右上角）*/}
                                            <button
                                                onClick={() => handleToggleVocabFavorite(vocabId)}
                                                className={`absolute top-2 right-2 p-1 rounded-full transition-colors ${favoriteVocabIds.some(fid => String(fid) === String(vocabId))
                                                    ? 'text-yellow-500 hover:bg-yellow-100'
                                                    : 'text-gray-300 hover:text-gray-400 hover:bg-gray-100'
                                                    }`}
                                                title={favoriteVocabIds.some(fid => String(fid) === String(vocabId)) ? "取消收藏" : "收藏词汇"}
                                            >
                                                <svg className="w-4 h-4" fill={favoriteVocabIds.some(fid => String(fid) === String(vocabId)) ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                                </svg>
                                            </button>
                                            {/* 加入本子按钮 */}
                                            <button
                                                onClick={() => {
                                                    if (!user && !isDemo) {
                                                        alert('登录后才能使用本子功能');
                                                        return;
                                                    }
                                                    setNotebookDialogItem({
                                                        itemType: 'vocab',
                                                        itemId: vocabId,
                                                        videoId: Number(videoData.id)
                                                    });
                                                    setNotebookDialogOpen(true);
                                                }}
                                                className="absolute top-2 right-8 p-1 rounded-full transition-colors text-gray-300 hover:text-violet-500 hover:bg-violet-50"
                                                title="加入本子"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                </svg>
                                            </button>
                                            <div className="flex items-end mb-1">
                                                <span className="text-base font-bold text-violet-500 mr-2">{item.word}</span>
                                                <span className="text-sm text-gray-500">{item.type}</span>
                                            </div>

                                            <div className="flex flex-col gap-1 mb-1.5">
                                                {item.ipa_us && (
                                                    <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                                                        <span className="text-gray-400 w-4">US</span>
                                                        <span>/{item.ipa_us}/</span>
                                                        <button onClick={() => speak(item.word, 'en-US')} className="p-0.5 hover:bg-violet-100 rounded-full text-violet-400 hover:text-violet-500 transition-colors">
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
                                                        <button onClick={() => speak(item.word, 'en-GB')} className="p-0.5 hover:bg-violet-100 rounded-full text-violet-400 hover:text-violet-500 transition-colors">
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
                                                        <div key={i} className="text-[15px]">
                                                            <p className="text-gray-800 leading-snug">{ex.en}</p>
                                                            <p className="text-gray-500 text-[14px] mt-0.5">{ex.cn}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {item.collocations && item.collocations.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {item.collocations.slice(0, 3).map((col, i) => (
                                                        <span key={i} className="px-2 py-1 bg-violet-50 text-violet-500 text-[13px] rounded border border-violet-100">
                                                            {col}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {/* 词汇关联期数 - 直接显示 */}
                                            {vocabOccurrences[item.word?.toLowerCase()]?.total > 0 && (
                                                <div className="mt-2 pt-2 border-t border-gray-100">
                                                    <div className="text-xs flex flex-wrap items-center gap-1.5">
                                                        <span className="text-gray-500">📍 还出现在：</span>
                                                        {vocabOccurrences[item.word.toLowerCase()].occurrences.map((occ, idx) => (
                                                            <a
                                                                key={idx}
                                                                href={`/episode/${occ.episode}?scrollTo=vocab&vocabIndex=${occ.vocab_index || 0}`}
                                                                className="text-violet-500 hover:text-violet-500 hover:underline"
                                                            >
                                                                第{occ.episode}期
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>{/* closes p-3 md:p-4 */}
                        </div>{/* closes blur wrapper */}
                    </div>{/* closes relative wrapper */}
                </div>{/* closes overflow-y-auto */}

                {/* 隐藏字幕 overlay - fixed在视口中央，pointer-events-none不遮挡其他交互 */}
                {jingTingSettings.hideSubtitles && (
                    <div className="absolute inset-0 z-[45] flex items-center justify-center pointer-events-none">
                        <button
                            className="pointer-events-auto inline-flex items-center gap-2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-gray-200 dark:border-gray-700 px-6 py-4 rounded-2xl text-gray-700 dark:text-gray-200 font-medium shadow-lg"
                            style={{ fontSize: '16px' }}
                            onClick={() => setJingTingSettings(s => ({ ...s, hideSubtitles: false }))}
                        >
                            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            字幕已隐藏，点击显示
                        </button>
                    </div>
                )}

            </div>
            </div>{/* closes xl:flex-row wrapper */}

            {/* 词汇弹窗 */}
            {vocabPopup && (() => {
                const POPUP_COLORS = [
                    { bg: '#E8D5FF', text: '#7C3AED' },
                    { bg: '#FFE0CC', text: '#C2500A' },
                    { bg: '#C8F0E0', text: '#0D7A4E' },
                    { bg: '#CCE8FF', text: '#1A5FA8' },
                ];
                const pc = POPUP_COLORS[vocabPopup.index % POPUP_COLORS.length];
                return (
                    <div
                        className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
                        onClick={() => setVocabPopup(null)}
                    >
                        {/* 半透明遮罩 */}
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                        {/* 弹窗卡片 */}
                        <div
                            className="relative w-full sm:max-w-[400px] bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* 彩色标题区 */}
                            <div className="relative px-5 pt-4 pb-4" style={{ backgroundColor: pc.bg }}>
                                {/* 拖拽条（手机端） */}
                                <div className="sm:hidden flex justify-center mb-3 -mt-1">
                                    <div className="w-9 h-1 rounded-full opacity-40" style={{ backgroundColor: pc.text }} />
                                </div>
                                {/* 关闭按钮 */}
                                <button
                                    onClick={() => setVocabPopup(null)}
                                    className="absolute right-3 top-3 w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                                    style={{ color: pc.text, backgroundColor: 'transparent' }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.08)'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                                </button>
                                {/* 单词标题 + 类型标签 */}
                                <div className="flex items-center gap-2 flex-wrap pr-8">
                                    <h3 className="text-2xl font-bold" style={{ color: pc.text }}>{vocabPopup.item.word}</h3>
                                    {vocabPopup.item.type && (
                                        <span className="px-2 py-0.5 text-xs font-medium rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.1)', color: pc.text }}>{vocabPopup.item.type}</span>
                                    )}
                                </div>
                            </div>

                            {/* 正文内容 */}
                            <div className="px-5 pt-4 pb-5">
                                {/* 音标 + 发音按钮 */}
                                {(vocabPopup.item.ipa_us || vocabPopup.item.ipa_uk) && (
                                    <div className="flex flex-wrap gap-3 mb-4">
                                        {vocabPopup.item.ipa_us && (
                                            <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                                                <span className="text-gray-400 dark:text-gray-500 text-xs">US</span>
                                                <span className="font-mono">/{vocabPopup.item.ipa_us}/</span>
                                                <button onClick={() => speak(vocabPopup.item.word, 'en-US')} className="p-1 hover:bg-violet-100 dark:hover:bg-violet-900/40 rounded-full text-violet-400 hover:text-violet-500 transition-colors">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>
                                                </button>
                                            </div>
                                        )}
                                        {vocabPopup.item.ipa_uk && (
                                            <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                                                <span className="text-gray-400 dark:text-gray-500 text-xs">UK</span>
                                                <span className="font-mono">/{vocabPopup.item.ipa_uk}/</span>
                                                <button onClick={() => speak(vocabPopup.item.word, 'en-GB')} className="p-1 hover:bg-violet-100 dark:hover:bg-violet-900/40 rounded-full text-violet-400 hover:text-violet-500 transition-colors">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 中文释义 */}
                                {vocabPopup.item.meaning && (
                                    <p className="text-gray-800 dark:text-gray-200 mb-4" style={{ fontSize: '15px', lineHeight: '1.6' }}>{vocabPopup.item.meaning}</p>
                                )}

                                {/* 例句 */}
                                {vocabPopup.item.examples && vocabPopup.item.examples.length > 0 && (
                                    <div className="space-y-3 mb-4">
                                        {vocabPopup.item.examples.slice(0, 2).map((ex, i) => (
                                            <div key={i} className="border-l-2 pl-3" style={{ borderColor: pc.bg }}>
                                                <p className="text-gray-700 dark:text-gray-300" style={{ fontSize: '14px', lineHeight: '1.6' }}>{ex.en}</p>
                                                <p className="text-gray-400 dark:text-gray-500 mt-0.5" style={{ fontSize: '14px', lineHeight: '1.6' }}>{ex.cn}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* 词典按钮 */}
                                <div className="flex gap-2 pt-1">
                                    <a
                                        href={`https://translate.google.com/?sl=en&tl=zh-CN&text=${encodeURIComponent(vocabPopup.item.word)}&op=translate`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>
                                        Google 翻译
                                    </a>
                                    <a
                                        href={`https://dict.youdao.com/result?word=${encodeURIComponent(vocabPopup.item.word)}&lang=en`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                                        有道词典
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Add to Notebook Dialog */}
            <AddToNotebookDialog
                isOpen={notebookDialogOpen}
                onClose={() => {
                    setNotebookDialogOpen(false);
                    setNotebookDialogItem(null);
                }}
                user={user}
                isDemo={isDemo}
                itemType={notebookDialogItem?.itemType}
                itemId={notebookDialogItem?.itemId}
                videoId={notebookDialogItem?.videoId}
                onSuccess={(notebookName) => {
                    console.log(`Added to notebook: ${notebookName}`);
                }}
            />

            {/* PC端设置面板 */}
            {showDesktopSettings && (
                <>
                    <div
                        className="fixed inset-0 bg-black/50 z-[100]"
                        onClick={() => setShowDesktopSettings(false)}
                    />
                    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] bg-gray-900 rounded-2xl py-5 px-5 w-[420px] max-w-[95vw] max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-semibold text-base">设置</h3>
                            <button onClick={() => setShowDesktopSettings(false)} className="text-white/50 hover:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* 字幕模式 */}
                        <div className="mb-4">
                            <div className="text-white/70 text-sm mb-2">字幕模式</div>
                            <div className="flex gap-2">
                                {[['dual','双语'],['en','英文'],['cn','中文'],['cloze','挖空']].map(([m, label]) => (
                                    <button
                                        key={m}
                                        onClick={() => handleModeChange(m)}
                                        className={`flex-1 py-2 rounded-lg text-sm transition-colors ${mode === m && !showPodcast ? 'bg-violet-400 text-white font-medium' : 'bg-white/10 text-white hover:bg-white/20'}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 视频循环 */}
                        <div className="flex items-center justify-between py-3 border-t border-white/10">
                            <span className="text-white text-sm">视频循环</span>
                            <button
                                onClick={() => setIsVideoLooping(!isVideoLooping)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isVideoLooping ? 'bg-violet-400' : 'bg-neutral-500/70'}`}
                            >
                                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${isVideoLooping ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {/* 单句循环 */}
                        <div className="flex items-center justify-between py-3 border-t border-white/10">
                            <span className="text-white text-sm">单句循环</span>
                            <button
                                onClick={() => setIsSentenceLooping(!isSentenceLooping)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isSentenceLooping ? 'bg-violet-400' : 'bg-neutral-500/70'}`}
                            >
                                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${isSentenceLooping ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {/* 逐句暂停 */}
                        <div className="flex items-center justify-between py-3 border-t border-white/10">
                            <div>
                                <span className="text-white text-sm block">逐句暂停</span>
                                <span className="text-white/40 text-[10px]">每句结束自动暂停</span>
                            </div>
                            <button
                                onClick={() => setIsSentencePauseEnabled(!isSentencePauseEnabled)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isSentencePauseEnabled ? 'bg-violet-400' : 'bg-neutral-500/70'}`}
                            >
                                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${isSentencePauseEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {/* 全屏 */}
                        {document.fullscreenEnabled && (
                            <div className="flex items-center justify-between py-3 border-t border-white/10">
                                <span className="text-white text-sm">全屏播放</span>
                                <button
                                    onClick={() => { handleToggleFullscreen(); setShowDesktopSettings(false); }}
                                    className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
                                >
                                    {isFullscreen ? '退出全屏' : '进入全屏'}
                                </button>
                            </div>
                        )}

                        {/* 画面字幕 */}
                        <div className="flex items-center justify-between py-3 border-t border-white/10">
                            <span className="text-white text-sm">画面字幕</span>
                            <button
                                onClick={() => setShowOverlaySubtitles(!showOverlaySubtitles)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showOverlaySubtitles ? 'bg-violet-400' : 'bg-neutral-500/70'}`}
                            >
                                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${showOverlaySubtitles ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {/* 字幕字体大小 */}
                        <div className="py-3 border-t border-white/10">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-white text-sm">字幕字体大小</span>
                                <span className="text-white/60 text-sm">{subtitleFontSize}px</span>
                            </div>
                            <input
                                type="range"
                                min="12"
                                max="20"
                                step="1"
                                value={subtitleFontSize}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    setSubtitleFontSize(val);
                                    localStorage.setItem('bbEnglish_subtitleFontSize', val.toString());
                                }}
                                className="w-full accent-violet-400"
                            />
                            <div className="flex justify-between text-white/40 text-xs mt-1">
                                <span>12px</span><span>20px</span>
                            </div>
                        </div>

                        {/* 外观 */}
                        <div className="py-3 border-t border-white/10">
                            <div className="text-white/70 text-sm mb-2">外观</div>
                            <div className="flex gap-2">
                                {[['system','跟随系统'],['light','浅色'],['dark','深色']].map(([val, label]) => (
                                    <button
                                        key={val}
                                        onClick={() => setAppTheme(val)}
                                        className={`flex-1 py-1.5 rounded-lg text-sm transition-colors ${appTheme === val ? 'bg-violet-400 text-white font-medium' : 'bg-white/10 text-white hover:bg-white/20'}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 下载字幕 */}
                        <div className="flex items-center justify-between py-3 border-t border-white/10">
                            <span className="text-white text-sm">下载字幕</span>
                            <button
                                onClick={() => { setShowDesktopSettings(false); handlePrint(); }}
                                className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
                            >
                                下载
                            </button>
                        </div>

                        {/* 视频信息 */}
                        {videoData && (
                            <div className="py-3 border-t border-white/10">
                                <div className="text-white/70 text-xs mb-2">视频信息</div>
                                <div className="flex flex-wrap items-center gap-3">
                                    {videoData.author && (
                                        <button
                                            onClick={() => { setShowDesktopSettings(false); navigate(`/?author=${encodeURIComponent(videoData.author)}`); }}
                                            className="flex items-center gap-1 text-white/80 text-sm hover:text-white transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                                            {videoData.author}
                                        </button>
                                    )}
                                    {videoData.youtube_url && (
                                        <a
                                            href={videoData.youtube_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-red-400 hover:text-red-300 text-sm transition-colors"
                                        >
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
                                            YouTube
                                        </a>
                                    )}
                                    {videoData.audio_url && (
                                        <button
                                            onClick={async () => {
                                                setShowDesktopSettings(false);
                                                try {
                                                    const response = await fetch(videoData.audio_url);
                                                    const blob = await response.blob();
                                                    const url = window.URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    a.download = `BiuBiu英语_第${videoData.episode}期.mp3`;
                                                    document.body.appendChild(a);
                                                    a.click();
                                                    document.body.removeChild(a);
                                                    window.URL.revokeObjectURL(url);
                                                } catch {
                                                    window.open(videoData.audio_url, '_blank');
                                                }
                                            }}
                                            className="flex items-center gap-1 text-white/80 hover:text-white text-sm transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                            下载音频
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Print Dialog */}
            {
                showPrintDialog && (
                    <>
                        {/* 遮罩层 */}
                        <div
                            className="fixed inset-0 bg-black/50 z-[200]"
                            onClick={() => setShowPrintDialog(false)}
                        />
                        {/* 弹窗 */}
                        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-[90%] max-w-sm">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 text-center">选择下载格式</h3>
                            <div className="space-y-3">
                                <button
                                    onClick={() => executeDownload('dual')}
                                    className="w-full py-3 px-4 bg-violet-50 dark:bg-violet-900/30 hover:bg-violet-100 dark:hover:bg-violet-900/50 text-violet-500 rounded-lg font-medium transition-colors text-left"
                                >
                                    <div className="font-medium">双语字幕</div>
                                    <div className="text-sm text-violet-500 mt-0.5">英文 + 中文翻译</div>
                                </button>
                                <button
                                    onClick={() => executeDownload('en')}
                                    className="w-full py-3 px-4 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-colors text-left"
                                >
                                    <div className="font-medium">纯英文</div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">仅英文原文</div>
                                </button>
                                <button
                                    onClick={() => executeDownload('cn')}
                                    className="w-full py-3 px-4 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-colors text-left"
                                >
                                    <div className="font-medium">纯中文</div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">仅中文翻译</div>
                                </button>
                            </div>
                            <button
                                onClick={() => setShowPrintDialog(false)}
                                className="w-full mt-4 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm transition-colors"
                            >
                                取消
                            </button>
                        </div>
                    </>
                )
            }
            {/* 手机端底部控制条（替换底部导航栏） */}
            {isMobile && (
                <div className="md:hidden fixed bottom-0 left-0 right-0 z-[51] bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                    {/* 进度条 */}
                    <div
                        className="relative w-full h-1 bg-gray-200 cursor-pointer"
                        onClick={handleProgressClick}
                    >
                        <div
                            className="h-full bg-violet-400"
                            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                        />
                    </div>
                    {/* 控制按钮 */}
                    <div className="flex items-center px-2 py-1.5">
                        {/* 左组：倍速 / 隐藏 */}
                        <div className="flex items-center gap-1 w-20">
                            <button
                                onClick={() => setShowMobileSpeedPanel(true)}
                                className={`flex flex-col items-center gap-0.5 px-1.5 py-0.5 rounded-lg min-w-[40px] transition-colors ${playbackRate !== 1 ? 'text-violet-500' : 'text-gray-600 dark:text-gray-400'}`}
                            >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44zm-9.79 6.84a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z"/></svg>
                                <span className="text-[10px] leading-none">{playbackRate === 1 ? '倍速' : `${playbackRate}x`}</span>
                            </button>
                            <button
                                onClick={() => setIsVideoHidden(v => !v)}
                                className={`flex flex-col items-center gap-0.5 px-1.5 py-0.5 rounded-lg min-w-[40px] transition-colors ${isVideoHidden ? 'text-violet-500' : 'text-gray-600 dark:text-gray-400'}`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isVideoHidden ? "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" : "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"} /></svg>
                                <span className="text-[10px] leading-none">{isVideoHidden ? '显示' : '隐藏'}</span>
                            </button>
                        </div>
                        {/* 中组：上一句 / ▶播放 / 下一句 */}
                        <div className="flex-1 flex items-center justify-center gap-5">
                            <button onClick={handleMobilePrevSentence} className="flex flex-col items-center gap-0.5">
                                <span className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-300">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/></svg>
                                </span>
                                <span className="text-gray-500 dark:text-gray-400 text-[9px] leading-none mt-0.5">上一句</span>
                            </button>
                            <button onClick={handleTogglePlay}>
                                <span className="w-10 h-10 rounded-full bg-violet-500 flex items-center justify-center shadow-lg">
                                    {isPlaying ? (
                                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
                                    ) : (
                                        <svg className="w-5 h-5 ml-0.5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                    )}
                                </span>
                            </button>
                            <button onClick={handleMobileNextSentence} className="flex flex-col items-center gap-0.5">
                                <span className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-300">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>
                                </span>
                                <span className="text-gray-500 dark:text-gray-400 text-[9px] leading-none mt-0.5">下一句</span>
                            </button>
                        </div>
                        {/* 右组：A/B点 / 精听 */}
                        <div className="flex items-center gap-1 w-20 justify-end">
                            <button
                                onClick={handleAbClick}
                                className={`flex flex-col items-center gap-0.5 px-1.5 py-0.5 rounded-lg min-w-[40px] transition-colors ${abMode === 0 ? 'text-gray-600' : abMode === 1 ? 'text-yellow-500' : 'text-green-500'}`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
                                <span className="text-[10px] leading-none font-medium">{abMode === 0 ? 'A/B点' : abMode === 1 ? 'A●' : 'A↔B'}</span>
                            </button>
                            <button
                                onClick={() => setShowJingTingPanel(true)}
                                className={`flex flex-col items-center gap-0.5 px-1.5 py-0.5 rounded-lg min-w-[40px] transition-colors ${(isSentenceLooping || isSentencePauseEnabled) ? 'text-violet-500' : 'text-gray-600'}`}
                            >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd"/></svg>
                                <span className="text-[10px] leading-none">精听</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 手机端倍速选择面板 - 仅显示倍速选项，方格网格 */}
            {isMobile && showMobileSpeedPanel && (
                <>
                    <div
                        className="fixed inset-0 bg-black/50 z-[100]"
                        onClick={() => setShowMobileSpeedPanel(false)}
                    />
                    <div className="fixed bottom-0 left-0 right-0 z-[101] bg-white dark:bg-gray-800 rounded-t-2xl px-4 pt-4 pb-8 animate-slide-up">
                        <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-4" />
                        <div className="text-gray-700 dark:text-gray-200 text-sm font-medium mb-3">播放速度</div>
                        <div className="grid grid-cols-4 gap-2">
                            {[0.4, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((rate) => (
                                <button
                                    key={rate}
                                    onClick={() => {
                                        handleSetPlaybackRate(rate);
                                        setShowMobileSpeedPanel(false);
                                    }}
                                    className={`aspect-square flex items-center justify-center rounded-xl text-sm font-medium transition-colors ${
                                        playbackRate === rate
                                            ? 'bg-violet-500 text-white shadow-md'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    {rate === 1 ? '正常' : `${rate}x`}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* 精听设置面板 - 手机端底部弹窗 */}
            {isMobile && showJingTingPanel && (
                <>
                    <div
                        className="fixed inset-0 bg-black/50 z-[60]"
                        onClick={() => setShowJingTingPanel(false)}
                    />
                    <div
                        className="fixed bottom-0 left-0 right-0 w-full z-[61] bg-gray-900 rounded-t-2xl pl-4 pt-4 pb-8 animate-slide-up"
                        style={{ paddingRight: '24px', boxSizing: 'border-box' }}
                    >
                        <div className="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-4" />
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-white font-semibold text-base">精听设置</h3>
                            <button
                                onClick={() => setJingTingSettings({ hideSubtitles: false, pauseAfterLoop: false, intervalSec: 3, loopCount: 2 })}
                                className="text-white/50 text-xs hover:text-white/80 transition-colors"
                            >
                                恢复默认值
                            </button>
                        </div>
                        {/* 单句循环 */}
                        <div className="flex items-center justify-between py-3 border-b border-white/10">
                            <span className="text-white/80 text-sm flex-1 min-w-0 mr-3">单句循环</span>
                            <button
                                onClick={() => setIsSentenceLooping(v => !v)}
                                className={`w-11 h-6 rounded-full shrink-0 transition-colors relative ${isSentenceLooping ? 'bg-violet-500' : 'bg-gray-600'}`}
                            >
                                <span className={`absolute left-0 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isSentenceLooping ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </button>
                        </div>
                        {/* 隐藏字幕 */}
                        <div className="flex items-center justify-between py-3 border-b border-white/10">
                            <span className="text-white/80 text-sm flex-1 min-w-0 mr-3">隐藏字幕</span>
                            <button
                                onClick={() => setJingTingSettings(s => ({ ...s, hideSubtitles: !s.hideSubtitles }))}
                                className={`w-11 h-6 rounded-full shrink-0 transition-colors relative ${jingTingSettings.hideSubtitles ? 'bg-violet-500' : 'bg-gray-600'}`}
                            >
                                <span className={`absolute left-0 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${jingTingSettings.hideSubtitles ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </button>
                        </div>
                        {/* 逐句暂停 */}
                        <div className="flex items-center justify-between py-3 border-b border-white/10">
                            <span className="text-white/80 text-sm flex-1 min-w-0 mr-3">逐句暂停</span>
                            <button
                                onClick={() => setIsSentencePauseEnabled(v => !v)}
                                className={`w-11 h-6 rounded-full shrink-0 transition-colors relative ${isSentencePauseEnabled ? 'bg-violet-500' : 'bg-gray-600'}`}
                            >
                                <span className={`absolute left-0 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isSentencePauseEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </button>
                        </div>
                        {/* 循环间隔 */}
                        <div className="flex items-center justify-between py-3 border-b border-white/10">
                            <span className="text-white/80 text-sm">循环间隔（秒）</span>
                            <div className="flex items-center gap-3">
                                <button onClick={() => setJingTingSettings(s => ({ ...s, intervalSec: Math.max(0, s.intervalSec - 1) }))} className="w-7 h-7 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 text-lg leading-none">-</button>
                                <span className="text-white font-medium w-6 text-center">{jingTingSettings.intervalSec}</span>
                                <button onClick={() => setJingTingSettings(s => ({ ...s, intervalSec: Math.min(10, s.intervalSec + 1) }))} className="w-7 h-7 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 text-lg leading-none">+</button>
                            </div>
                        </div>
                        {/* 循环次数 */}
                        <div className="flex items-center justify-between py-3">
                            <span className="text-white/80 text-sm">循环次数</span>
                            <div className="flex items-center gap-3">
                                <button onClick={() => setJingTingSettings(s => ({ ...s, loopCount: s.loopCount === null ? 10 : Math.max(1, s.loopCount - 1) }))} className="w-7 h-7 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 text-lg leading-none">-</button>
                                <span className="text-white font-medium w-6 text-center">{jingTingSettings.loopCount === null ? '∞' : jingTingSettings.loopCount}</span>
                                <button onClick={() => setJingTingSettings(s => ({ ...s, loopCount: s.loopCount !== null && s.loopCount >= 10 ? null : s.loopCount === null ? null : s.loopCount + 1 }))} className="w-7 h-7 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 text-lg leading-none">+</button>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowJingTingPanel(false)}
                            className="w-full mt-2 py-3 bg-violet-500 text-white rounded-xl font-medium hover:bg-violet-600 transition-colors"
                        >
                            完成
                        </button>
                    </div>
                </>
            )}
            {/* 笔记编辑面板 */}
            {noteEditor !== null && (
                <>
                    {/* 背景遮罩 */}
                    <div className="fixed inset-0 bg-black/50 z-[200]" onClick={() => setNoteEditor(null)} />

                    {isMobile ? (
                        /* 手机端：底部弹出面板 */
                        <div className="fixed bottom-0 left-0 right-0 z-[201] bg-white dark:bg-gray-800 rounded-t-2xl">
                            <div className="flex justify-center pt-3 pb-1 cursor-pointer" onClick={() => setNoteEditor(null)}>
                                <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
                            </div>
                            {/* 字幕预览 */}
                            {videoData?.transcript?.[noteEditor.index] && (
                                <div className="px-4 pt-2 pb-3 border-b border-gray-100 dark:border-gray-700">
                                    <p className="text-sm text-gray-800 dark:text-gray-100 leading-relaxed">
                                        {videoData.transcript[noteEditor.index].text}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {videoData.transcript[noteEditor.index].cn}
                                    </p>
                                </div>
                            )}
                            {/* 输入框 */}
                            <div className="px-4 pt-3 pb-2">
                                <textarea
                                    className="w-full min-h-[120px] text-sm text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-3 resize-none outline-none focus:ring-2 focus:ring-violet-400 dark:focus:ring-violet-500"
                                    placeholder="写下你的笔记..."
                                    value={noteEditor.content}
                                    onChange={e => setNoteEditor(prev => ({ ...prev, content: e.target.value }))}
                                    autoFocus
                                />
                            </div>
                            {/* 按钮 */}
                            <div className="flex gap-2 px-4 pb-8 pt-1">
                                {notes[noteEditor.index] && (
                                    <button
                                        onClick={handleNoteDelete}
                                        disabled={noteSaving}
                                        className="px-4 py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
                                    >删除</button>
                                )}
                                <button
                                    onClick={() => setNoteEditor(null)}
                                    className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                >取消</button>
                                <button
                                    onClick={handleNoteSave}
                                    disabled={noteSaving || !noteEditor.content.trim()}
                                    className="flex-1 py-2.5 bg-violet-500 text-white rounded-xl text-sm font-medium hover:bg-violet-600 transition-colors disabled:opacity-50"
                                >保存</button>
                            </div>
                        </div>
                    ) : (
                        /* PC端：居中弹窗 */
                        <div className="fixed inset-0 z-[201] flex items-center justify-center p-4" onClick={() => setNoteEditor(null)}>
                            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
                                {/* 标题栏 */}
                                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                                    <h3 className="font-semibold text-gray-800 dark:text-gray-100">字幕笔记</h3>
                                    <button
                                        onClick={() => setNoteEditor(null)}
                                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                {/* 字幕预览 */}
                                {videoData?.transcript?.[noteEditor.index] && (
                                    <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                                        <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
                                            {videoData.transcript[noteEditor.index].text}
                                        </p>
                                        <p className="text-xs text-gray-400 dark:text-gray-400 mt-1">
                                            {videoData.transcript[noteEditor.index].cn}
                                        </p>
                                    </div>
                                )}
                                {/* 输入框 */}
                                <div className="px-6 py-4">
                                    <textarea
                                        className="w-full min-h-[120px] text-sm text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-3 resize-none outline-none focus:ring-2 focus:ring-violet-400 dark:focus:ring-violet-500"
                                        placeholder="写下你的笔记..."
                                        value={noteEditor.content}
                                        onChange={e => setNoteEditor(prev => ({ ...prev, content: e.target.value }))}
                                        autoFocus
                                    />
                                </div>
                                {/* 底部按钮 */}
                                <div className="flex items-center gap-2 px-6 pb-5">
                                    {notes[noteEditor.index] && (
                                        <button
                                            onClick={handleNoteDelete}
                                            disabled={noteSaving}
                                            className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
                                        >删除</button>
                                    )}
                                    <div className="flex-1" />
                                    <button
                                        onClick={() => setNoteEditor(null)}
                                        className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm transition-colors"
                                    >取消</button>
                                    <button
                                        onClick={handleNoteSave}
                                        disabled={noteSaving || !noteEditor.content.trim()}
                                        className="px-4 py-2 bg-violet-500 text-white rounded-lg text-sm font-medium hover:bg-violet-600 transition-colors disabled:opacity-50"
                                    >保存</button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div >
    );
};

export default VideoDetail;
