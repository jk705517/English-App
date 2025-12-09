import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Plus, MessageSquare, ChevronRight, Trash2, Edit2, X, Play } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { notebookService } from '../services/notebookService';

function Notebooks() {
    const { user } = useAuth();
    const navigate = useNavigate();

    // 本子列表状态
    const [notebooks, setNotebooks] = useState([]);
    const [loading, setLoading] = useState(true);

    // 选中的本子
    const [selectedNotebook, setSelectedNotebook] = useState(null);
    const [notebookDetail, setNotebookDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Tab 状态
    const [activeTab, setActiveTab] = useState('sentence'); // 'sentence' | 'vocab'

    // 词汇复习统计（记忆曲线）
    const [vocabStats, setVocabStats] = useState({ dueCount: 0, totalVocabCount: 0 });
    const [vocabStatsLoading, setVocabStatsLoading] = useState(false);

    // 新建本子 Modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newNotebookName, setNewNotebookName] = useState('');
    const [creating, setCreating] = useState(false);

    // 加载本子列表
    useEffect(() => {
        if (user) {
            loadNotebookList();
        }
    }, [user]);

    const loadNotebookList = async () => {
        setLoading(true);
        const data = await notebookService.loadNotebooks(user);
        setNotebooks(data);
        setLoading(false);
    };

    // 加载本子详情
    const handleSelectNotebook = async (notebook) => {
        setSelectedNotebook(notebook);
        setDetailLoading(true);
        setVocabStats({ dueCount: 0, totalVocabCount: 0 }); // 重置统计
        const detail = await notebookService.loadNotebookDetail(user, notebook.id);
        setNotebookDetail(detail);
        setDetailLoading(false);

        // 异步加载词汇复习统计（不阻塞详情加载）
        loadVocabStats(notebook.id);
    };

    // 加载词汇复习统计
    const loadVocabStats = async (notebookId) => {
        setVocabStatsLoading(true);
        try {
            const data = await notebookService.loadNotebookVocabsForReview(user, notebookId);
            if (data) {
                setVocabStats({
                    dueCount: data.dueCount || 0,
                    totalVocabCount: data.totalVocabCount || 0,
                });
            }
        } catch (err) {
            console.error('Error loading vocab stats:', err);
        }
        setVocabStatsLoading(false);
    };

    // 创建新本子
    const handleCreateNotebook = async () => {
        if (!newNotebookName.trim()) return;

        setCreating(true);
        const newNotebook = await notebookService.createNotebook(user, {
            name: newNotebookName.trim()
        });

        if (newNotebook) {
            setNotebooks([newNotebook, ...notebooks]);
            setShowCreateModal(false);
            setNewNotebookName('');
        }
        setCreating(false);
    };

    // 删除本子
    const handleDeleteNotebook = async (notebookId, e) => {
        e.stopPropagation();
        if (!confirm('确定要删除这个本子吗？本子里的所有内容也会被删除。')) return;

        const success = await notebookService.deleteNotebook(user, notebookId);
        if (success) {
            setNotebooks(notebooks.filter(nb => nb.id !== notebookId));
            if (selectedNotebook?.id === notebookId) {
                setSelectedNotebook(null);
                setNotebookDetail(null);
            }
        }
    };

    // 移除单条句子
    const handleRemoveSentence = async (sentenceId) => {
        if (!confirm('确认从本子中移除这条句子吗？')) return;

        const success = await notebookService.removeItemFromNotebook(user, {
            notebookId: selectedNotebook.id,
            itemType: 'sentence',
            itemId: sentenceId
        });

        if (success) {
            // 更新本子详情中的句子列表
            setNotebookDetail(prev => ({
                ...prev,
                sentences: prev.sentences.filter(s => s.sentenceId !== sentenceId)
            }));
            // 更新左侧本子列表的计数
            setNotebooks(prev => prev.map(nb =>
                nb.id === selectedNotebook.id
                    ? { ...nb, sentenceCount: nb.sentenceCount - 1 }
                    : nb
            ));
            // 同步更新 selectedNotebook
            setSelectedNotebook(prev => ({
                ...prev,
                sentenceCount: prev.sentenceCount - 1
            }));
        }
    };

    // 移除单条词汇
    const handleRemoveVocab = async (vocabId) => {
        if (!confirm('确认从本子中移除这个词汇吗？')) return;

        const success = await notebookService.removeItemFromNotebook(user, {
            notebookId: selectedNotebook.id,
            itemType: 'vocab',
            itemId: vocabId
        });

        if (success) {
            // 更新本子详情中的词汇列表
            setNotebookDetail(prev => ({
                ...prev,
                vocabs: prev.vocabs.filter(v => v.vocabId !== vocabId)
            }));
            // 更新左侧本子列表的计数
            setNotebooks(prev => prev.map(nb =>
                nb.id === selectedNotebook.id
                    ? { ...nb, vocabCount: nb.vocabCount - 1 }
                    : nb
            ));
            // 同步更新 selectedNotebook
            setSelectedNotebook(prev => ({
                ...prev,
                vocabCount: prev.vocabCount - 1
            }));
        }
    };

    // 未登录提示
    if (!user) {
        return (
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center gap-3">
                        <BookOpen className="w-10 h-10 text-indigo-600" />
                        我的本子
                    </h1>
                </div>
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl shadow-sm">
                    <BookOpen className="w-24 h-24 text-gray-300 mb-4" />
                    <p className="text-xl text-gray-500 mb-2">本子功能需要登录后使用</p>
                    <p className="text-gray-400 mb-6">登录后可以创建主题本子，整理你的收藏</p>
                    <Link
                        to="/login"
                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
                    >
                        去登录
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto">
            {/* 页面标题 */}
            <div className="mb-6">
                <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center gap-3">
                    <BookOpen className="w-10 h-10 text-indigo-600" />
                    我的本子
                </h1>
                <p className="text-gray-600">
                    {loading ? '正在加载...' : `共 ${notebooks.length} 个本子`}
                </p>
            </div>

            {/* 主内容区：左右布局 */}
            <div className="flex flex-col md:flex-row gap-6">
                {/* 左侧：本子列表 */}
                <div className="w-full md:w-80 shrink-0">
                    {/* 新建本子按钮 */}
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        新建本子
                    </button>

                    {/* 本子列表 */}
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : notebooks.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-xl shadow-sm">
                            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">还没有本子</p>
                            <p className="text-gray-400 text-sm">点击上方按钮创建第一个本子</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {notebooks.map(notebook => (
                                <div
                                    key={notebook.id}
                                    onClick={() => handleSelectNotebook(notebook)}
                                    className={`group flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all ${selectedNotebook?.id === notebook.id
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'bg-white hover:bg-gray-50 shadow-sm'
                                        }`}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            {notebook.color && (
                                                <div
                                                    className="w-3 h-3 rounded-full shrink-0"
                                                    style={{ backgroundColor: notebook.color }}
                                                />
                                            )}
                                            <span className="font-medium truncate">{notebook.name}</span>
                                        </div>
                                        <div className={`text-sm mt-1 ${selectedNotebook?.id === notebook.id ? 'text-indigo-200' : 'text-gray-400'
                                            }`}>
                                            {notebook.sentenceCount} 句子 · {notebook.vocabCount} 词汇
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0 ml-2">
                                        <button
                                            onClick={(e) => handleDeleteNotebook(notebook.id, e)}
                                            className={`p-1.5 rounded-lg transition-colors ${selectedNotebook?.id === notebook.id
                                                ? 'hover:bg-indigo-500'
                                                : 'hover:bg-gray-200 opacity-0 group-hover:opacity-100'
                                                }`}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <ChevronRight className={`w-5 h-5 ${selectedNotebook?.id === notebook.id ? 'text-white' : 'text-gray-400'
                                            }`} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 右侧：本子详情 */}
                <div className="flex-1 min-w-0">
                    {!selectedNotebook ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl shadow-sm">
                            <BookOpen className="w-20 h-20 text-gray-300 mb-4" />
                            <p className="text-gray-500">选择一个本子查看内容</p>
                        </div>
                    ) : detailLoading ? (
                        <div className="flex items-center justify-center py-20 bg-white rounded-xl shadow-sm">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : notebookDetail ? (
                        <div className="bg-white rounded-xl shadow-sm p-6">
                            {/* 本子标题 */}
                            <div className="flex items-center gap-3 mb-6">
                                {notebookDetail.notebook.color && (
                                    <div
                                        className="w-4 h-4 rounded-full"
                                        style={{ backgroundColor: notebookDetail.notebook.color }}
                                    />
                                )}
                                <h2 className="text-2xl font-bold text-gray-800">
                                    {notebookDetail.notebook.name}
                                </h2>
                            </div>

                            {/* Tab 切换 */}
                            <div className="flex gap-2 mb-6">
                                <button
                                    onClick={() => setActiveTab('sentence')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'sentence'
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    <MessageSquare className="w-4 h-4" />
                                    句子 ({notebookDetail.sentences.length})
                                </button>
                                <button
                                    onClick={() => setActiveTab('vocab')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'vocab'
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    <BookOpen className="w-4 h-4" />
                                    词汇 ({notebookDetail.vocabs.length})
                                </button>
                            </div>

                            {/* 句子列表 */}
                            {activeTab === 'sentence' && (
                                <>
                                    {/* 开始句子复习按钮 */}
                                    <div className="mb-4">
                                        <button
                                            onClick={() => navigate(`/notebooks/${selectedNotebook.id}/review?type=sentence`)}
                                            disabled={notebookDetail.sentences.length === 0}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${notebookDetail.sentences.length > 0
                                                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                }`}
                                        >
                                            <Play className="w-4 h-4" />
                                            开始句子复习
                                        </button>
                                    </div>
                                    {notebookDetail.sentences.length > 0 ? (
                                        <div className="space-y-4">
                                            {notebookDetail.sentences.map((sentence) => (
                                                <div
                                                    key={`${sentence.videoId}-${sentence.sentenceId}`}
                                                    className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                                >
                                                    <div className="flex justify-between items-start gap-4">
                                                        <div className="flex-1">
                                                            <p className="text-lg text-gray-800 font-medium mb-2 leading-relaxed">
                                                                {sentence.en}
                                                            </p>
                                                            <p className="text-gray-500 mb-3">
                                                                {sentence.cn}
                                                            </p>
                                                            <p className="text-sm text-gray-400">
                                                                第 {sentence.episode} 期 · {sentence.title}
                                                            </p>
                                                        </div>
                                                        <div className="flex gap-2 shrink-0">
                                                            <button
                                                                onClick={() => handleRemoveSentence(sentence.sentenceId)}
                                                                className="px-3 py-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors text-sm"
                                                                title="从本子中移除"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
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
                                        <div className="text-center py-12">
                                            <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                                            <p className="text-gray-500">本子里还没有句子</p>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* 词汇列表 */}
                            {activeTab === 'vocab' && (
                                <>
                                    {/* 词汇复习统计提示 */}
                                    {vocabStats.totalVocabCount > 0 && (
                                        <div className="text-sm text-gray-500 mb-2">
                                            {vocabStatsLoading ? (
                                                <span>加载中...</span>
                                            ) : vocabStats.dueCount > 0 ? (
                                                <>今日待复习：<span className="font-medium text-indigo-600">{vocabStats.dueCount}</span> / 共 {vocabStats.totalVocabCount} 个词</>
                                            ) : (
                                                <div className="flex flex-col gap-1">
                                                    <div>🎉 今天这个本子没有到期要复习的词（共 {vocabStats.totalVocabCount} 个词）</div>
                                                    <div className="text-xs text-gray-400">之后会按记忆节奏自动安排再来复习。</div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {/* 开始词汇复习按钮 */}
                                    <div className="mb-4">
                                        <button
                                            onClick={() => navigate(`/notebooks/${selectedNotebook.id}/review?type=vocab`)}
                                            disabled={notebookDetail.vocabs.length === 0}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${notebookDetail.vocabs.length > 0
                                                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                }`}
                                        >
                                            <Play className="w-4 h-4" />
                                            {vocabStats.totalVocabCount > 0 && vocabStats.dueCount === 0 ? '随便练一练' : '开始词汇复习'}
                                        </button>
                                    </div>
                                    {notebookDetail.vocabs.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {notebookDetail.vocabs.map((vocab) => (
                                                <div
                                                    key={`${vocab.videoId}-${vocab.vocabId}`}
                                                    className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                                >
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div>
                                                            <span className="text-xl font-bold text-indigo-700">
                                                                {vocab.word}
                                                            </span>
                                                            {vocab.phonetic && (
                                                                <span className="ml-2 text-sm text-gray-400 font-mono">
                                                                    /{vocab.phonetic}/
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-1 shrink-0">
                                                            <button
                                                                onClick={() => handleRemoveVocab(vocab.vocabId)}
                                                                className="px-2 py-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="从本子中移除"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => navigate(`/video/${vocab.videoId}?mode=intensive&vocabId=${vocab.vocabId}`)}
                                                                className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 font-medium transition-colors text-sm"
                                                            >
                                                                去学习
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <p className="text-gray-600 mb-3">
                                                        {vocab.meaning}
                                                    </p>
                                                    <p className="text-sm text-gray-400">
                                                        第 {vocab.episode} 期 · {vocab.title}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12">
                                            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-3" />
                                            <p className="text-gray-500">本子里还没有词汇</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    ) : null}
                </div>
            </div>

            {/* 新建本子 Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-800">新建本子</h3>
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setNewNotebookName('');
                                }}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <input
                            type="text"
                            placeholder="输入本子名称，如：厨房场景本"
                            value={newNotebookName}
                            onChange={(e) => setNewNotebookName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateNotebook()}
                            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            autoFocus
                        />
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setNewNotebookName('');
                                }}
                                className="flex-1 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleCreateNotebook}
                                disabled={!newNotebookName.trim() || creating}
                                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {creating ? '创建中...' : '创建'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Notebooks;
