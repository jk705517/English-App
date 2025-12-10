import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import VideoCard from '../components/VideoCard';
import AddToNotebookDialog from '../components/AddToNotebookDialog';
import { Heart, BookOpen, MessageSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { progressService } from '../services/progressService';
import { favoritesService } from '../services/favoritesService';
import { supabase } from '../services/supabaseClient';

function Favorites() {
    const { user } = useAuth();
    const navigate = useNavigate();

    // Tab state
    const [activeTab, setActiveTab] = useState('video'); // 'video' | 'sentence' | 'vocab'

    // Video favorites state
    const [favoriteVideoIds, setFavoriteVideoIds] = useState([]);
    const [learnedVideoIds, setLearnedVideoIds] = useState([]);
    const [videos, setVideos] = useState([]);

    // Sentence favorites state
    const [favoriteSentences, setFavoriteSentences] = useState([]);
    const [sentencesLoaded, setSentencesLoaded] = useState(false);

    // Vocab favorites state
    const [favoriteVocabs, setFavoriteVocabs] = useState([]);
    const [vocabsLoaded, setVocabsLoaded] = useState(false);

    // Notebook dialog state
    const [notebookDialogOpen, setNotebookDialogOpen] = useState(false);
    const [notebookDialogItem, setNotebookDialogItem] = useState(null);

    // Loading/error state
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // 从 Supabase/localStorage 读取收藏和已学习的视频 ID 列表
    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                setError(null);

                // 并行获取收藏和已学习的视频ID
                const [storedFavoriteIds, loadedLearnedIds] = await Promise.all([
                    favoritesService.loadFavoriteVideoIds(user),
                    progressService.loadLearnedVideoIds(user)
                ]);

                setFavoriteVideoIds(storedFavoriteIds);
                setLearnedVideoIds(loadedLearnedIds);

                // 如果有收藏的视频，从 Supabase 获取视频详情
                if (storedFavoriteIds.length > 0) {
                    const { data, error: fetchError } = await supabase
                        .from('videos')
                        .select('*')
                        .in('id', storedFavoriteIds);

                    if (fetchError) {
                        console.error('Error fetching favorite videos:', fetchError);
                        setError('加载收藏视频失败，请重试');
                        setVideos([]);
                    } else {
                        // 按照 favoriteIds 的顺序排序视频（最近收藏的在前）
                        const sortedVideos = storedFavoriteIds
                            .map(id => data.find(video => video.id === id))
                            .filter(Boolean); // 过滤掉可能不存在的视频

                        setVideos(sortedVideos);
                    }
                } else {
                    setVideos([]);
                }
            } catch (err) {
                console.error('Error loading favorites:', err);
                setError('加载收藏失败，请重试');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [user]);

    // 懒加载句子收藏
    useEffect(() => {
        if (activeTab === 'sentence' && !sentencesLoaded && user) {
            setLoading(true);
            favoritesService.loadFavoriteSentenceItems(user).then(data => {
                setFavoriteSentences(data);
                setSentencesLoaded(true);
                setLoading(false);
            }).catch(err => {
                console.error('Error loading favorite sentences:', err);
                setLoading(false);
            });
        }
    }, [activeTab, user, sentencesLoaded]);

    // 懒加载词汇收藏
    useEffect(() => {
        if (activeTab === 'vocab' && !vocabsLoaded && user) {
            setLoading(true);
            favoritesService.loadFavoriteVocabItems(user).then(data => {
                setFavoriteVocabs(data);
                setVocabsLoaded(true);
                setLoading(false);
            }).catch(err => {
                console.error('Error loading favorite vocab:', err);
                setLoading(false);
            });
        }
    }, [activeTab, user, vocabsLoaded]);

    // 未登录用户提示
    if (!user) {
        return (
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center gap-3">
                        <Heart className="w-10 h-10 text-red-500 fill-current" />
                        我的收藏
                    </h1>
                </div>
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl shadow-sm">
                    <Heart className="w-24 h-24 text-gray-300 mb-4" />
                    <p className="text-xl text-gray-500 mb-2">收藏功能需要登录后使用</p>
                    <p className="text-gray-400 mb-6">登录后可以收藏视频、句子和词汇</p>
                    <Link
                        to="/auth"
                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
                    >
                        去登录
                    </Link>
                </div>
            </div>
        );
    }

    // 获取当前 Tab 的统计信息
    const getTabStats = () => {
        switch (activeTab) {
            case 'video':
                return loading ? '正在加载...' : videos.length > 0 ? `你已收藏 ${videos.length} 个视频` : '还没有收藏视频哦';
            case 'sentence':
                return loading ? '正在加载...' : favoriteSentences.length > 0 ? `你已收藏 ${favoriteSentences.length} 个句子` : '还没有收藏句子哦';
            case 'vocab':
                return loading ? '正在加载...' : favoriteVocabs.length > 0 ? `你已收藏 ${favoriteVocabs.length} 个词汇` : '还没有收藏词汇哦';
            default:
                return '';
        }
    };

    return (
        <div className="max-w-7xl mx-auto">
            {/* 页面标题 */}
            <div className="mb-6">
                <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center gap-3">
                    <Heart className="w-10 h-10 text-red-500 fill-current" />
                    我的收藏
                </h1>
                <p className="text-gray-600">{getTabStats()}</p>
            </div>

            {/* Tab 切换区域 */}
            <div className="flex gap-2 mb-6">
                {[
                    { key: 'video', label: '视频', icon: Heart },
                    { key: 'sentence', label: '句子', icon: MessageSquare },
                    { key: 'vocab', label: '词汇', icon: BookOpen }
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === tab.key
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* 错误状态 */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <p className="text-red-600">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-2 text-red-600 underline hover:text-red-700"
                    >
                        刷新页面重试
                    </button>
                </div>
            )}

            {/* 加载状态 */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                    <p className="text-gray-500">正在加载收藏...</p>
                </div>
            ) : (
                <>
                    {/* 视频 Tab 内容 */}
                    {activeTab === 'video' && (
                        videos.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {videos.map((video) => (
                                    <VideoCard
                                        key={video.id}
                                        video={{
                                            ...video,
                                            isLearned: learnedVideoIds.includes(video.id)
                                        }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20">
                                <Heart className="w-24 h-24 text-gray-300 mb-4" />
                                <p className="text-xl text-gray-500 mb-2">还没有收藏视频哦</p>
                                <p className="text-gray-400">在视频详情页点击 ⭐ 按钮即可收藏</p>
                            </div>
                        )
                    )}

                    {/* 句子 Tab 内容 */}
                    {activeTab === 'sentence' && (
                        favoriteSentences.length > 0 ? (
                            <div className="space-y-4">
                                {favoriteSentences.map((sentence) => (
                                    <div
                                        key={`${sentence.videoId}-${sentence.sentenceId}`}
                                        className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                                    >
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="flex-1">
                                                {/* 英文句子 */}
                                                <p className="text-lg text-gray-800 font-medium mb-2 leading-relaxed">
                                                    {sentence.en}
                                                </p>
                                                {/* 中文翻译 */}
                                                <p className="text-gray-500 mb-3">
                                                    {sentence.cn}
                                                </p>
                                                {/* 视频信息 */}
                                                <p className="text-sm text-gray-400">
                                                    第 {sentence.episode} 期 · {sentence.title}
                                                </p>
                                            </div>
                                            <div className="flex flex-col gap-2 shrink-0">
                                                {/* 加入本子按钮 */}
                                                <button
                                                    onClick={() => {
                                                        setNotebookDialogItem({
                                                            itemType: 'sentence',
                                                            itemId: sentence.sentenceId,
                                                            videoId: sentence.videoId
                                                        });
                                                        setNotebookDialogOpen(true);
                                                    }}
                                                    className="px-3 py-1 bg-gray-50 text-gray-500 rounded-lg hover:bg-indigo-50 hover:text-indigo-500 font-medium transition-colors text-sm flex items-center gap-1"
                                                    title="加入本子"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                    </svg>
                                                    加入本子
                                                </button>
                                                {/* 去学习按钮 */}
                                                <button
                                                    onClick={() => navigate(`/video/${sentence.videoId}?mode=intensive&sentenceId=${sentence.sentenceId}`)}
                                                    className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 font-medium transition-colors text-sm"
                                                >
                                                    去学习
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20">
                                <MessageSquare className="w-24 h-24 text-gray-300 mb-4" />
                                <p className="text-xl text-gray-500 mb-2">还没有收藏句子哦</p>
                                <p className="text-gray-400">在视频详情页点击字幕旁的 ⭐ 按钮即可收藏</p>
                            </div>
                        )
                    )}

                    {/* 词汇 Tab 内容 */}
                    {activeTab === 'vocab' && (
                        favoriteVocabs.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {favoriteVocabs.map((vocab) => (
                                    <div
                                        key={`${vocab.videoId}-${vocab.vocabId}`}
                                        className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                {/* 单词 */}
                                                <span className="text-xl font-bold text-indigo-700">
                                                    {vocab.word}
                                                </span>
                                                {/* 音标 */}
                                                {vocab.phonetic && (
                                                    <span className="ml-2 text-sm text-gray-400 font-mono">
                                                        /{vocab.phonetic}/
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex gap-1 shrink-0">
                                                {/* 加入本子按钮 */}
                                                <button
                                                    onClick={() => {
                                                        setNotebookDialogItem({
                                                            itemType: 'vocab',
                                                            itemId: vocab.vocabId,
                                                            videoId: vocab.videoId
                                                        });
                                                        setNotebookDialogOpen(true);
                                                    }}
                                                    className="px-2 py-1 bg-gray-50 text-gray-400 rounded-lg hover:bg-indigo-50 hover:text-indigo-500 transition-colors"
                                                    title="加入本子"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                    </svg>
                                                </button>
                                                {/* 去学习按钮 */}
                                                <button
                                                    onClick={() => navigate(`/video/${vocab.videoId}?mode=intensive&vocabId=${vocab.vocabId}`)}
                                                    className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 font-medium transition-colors text-sm"
                                                >
                                                    去学习
                                                </button>
                                            </div>
                                        </div>
                                        {/* 中文释义 */}
                                        <p className="text-gray-600 mb-3">
                                            {vocab.meaning}
                                        </p>
                                        {/* 视频信息 */}
                                        <p className="text-sm text-gray-400">
                                            第 {vocab.episode} 期 · {vocab.title}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20">
                                <BookOpen className="w-24 h-24 text-gray-300 mb-4" />
                                <p className="text-xl text-gray-500 mb-2">还没有收藏词汇哦</p>
                                <p className="text-gray-400">在视频详情页点击词汇卡片的 ⭐ 按钮即可收藏</p>
                            </div>
                        )
                    )}
                </>
            )}

            {/* Add to Notebook Dialog */}
            <AddToNotebookDialog
                isOpen={notebookDialogOpen}
                onClose={() => {
                    setNotebookDialogOpen(false);
                    setNotebookDialogItem(null);
                }}
                user={user}
                itemType={notebookDialogItem?.itemType}
                itemId={notebookDialogItem?.itemId}
                videoId={notebookDialogItem?.videoId}
                onSuccess={(notebookName) => {
                    console.log(`Added to notebook: ${notebookName}`);
                }}
            />
        </div>
    );
}

export default Favorites;
