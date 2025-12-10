import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Plus, MessageSquare, ChevronRight, Edit2, X, Play, MoreHorizontal, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { notebookService } from '../services/notebookService';
import Modal from '../components/Modal';
import DropdownMenu from '../components/DropdownMenu';
import BottomSheet from '../components/BottomSheet';
import useLongPress from '../hooks/useLongPress';

function Notebooks() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const detailRef = useRef(null);

    // 从 URL 参数读取初始状态
    const urlNotebookId = searchParams.get('notebookId');
    const urlTab = searchParams.get('tab');
    const validTabs = ['sentence', 'vocab'];
    const initialTab = validTabs.includes(urlTab) ? urlTab : 'sentence';

    // 用于追踪需要自动选中的本子 ID（在本子列表加载完成后使用）
    const pendingNotebookIdRef = useRef(urlNotebookId);

    // 本子列表状态
    const [notebooks, setNotebooks] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);

    // 选中的本子
    const [selectedNotebook, setSelectedNotebook] = useState(null);
    const [notebookDetail, setNotebookDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Tab 状态（从 URL 初始化）
    const [activeTab, setActiveTab] = useState(initialTab);

    // 词汇复习统计（记忆曲线）
    const [vocabStats, setVocabStats] = useState({ dueCount: 0, totalVocabCount: 0 });
    const [vocabStatsLoading, setVocabStatsLoading] = useState(false);

    // 句子复习统计（记忆曲线）
    const [sentenceStats, setSentenceStats] = useState({ dueCount: 0, totalSentenceCount: 0 });
    const [sentenceStatsLoading, setSentenceStatsLoading] = useState(false);

    // 新建本子 Modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newNotebookName, setNewNotebookName] = useState('');
    const [creating, setCreating] = useState(false);

    // 删除确认 Modal
    const [deleteConfirm, setDeleteConfirm] = useState({
        isOpen: false,
        type: null, // 'notebook' | 'sentence' | 'vocab'
        data: null
    });

    // 底部操作栏状态 (Mobile)
    const [bottomSheet, setBottomSheet] = useState({
        isOpen: false,
        title: '',
        type: null, // 'notebook' | 'sentence' | 'vocab'
        data: null
    });

    // 移动端检测
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 自动滚动到详情区域 (Mobile)
    useEffect(() => {
        if (isMobile && selectedNotebook && detailRef.current) {
            detailRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
        }
    }, [selectedNotebook, isMobile]);

    // 长按处理 Wrapper
    const LongPressWrapper = ({ children, data, type, onClick, className }) => {
        const longPressProps = useLongPress({
            onLongPress: () => {
                if (!isMobile) return;
                // 震动反馈 (如果支持)
                if (navigator.vibrate) navigator.vibrate(50);

                let title = '';
                if (type === 'notebook') title = data.name;
                else if (type === 'sentence') title = data.en; // 或者截断
                else if (type === 'vocab') title = data.word;

                setBottomSheet({
                    isOpen: true,
                    title,
                    type,
                    data
                });
            },
            onClick: onClick
        });

        return (
            <div
                {...longPressProps}
                className={`${className} ${isMobile ? 'mobile-longpress-target' : ''}`}
                onContextMenu={isMobile ? (e) => e.preventDefault() : undefined}
            >
                {children}
            </div>
        );
    };

    // 更新 URL 参数（同步状态到 URL）
    const updateUrlParams = (notebookId, tab) => {
        const params = {};
        if (notebookId) params.notebookId = notebookId;
        if (tab) params.tab = tab;
        setSearchParams(params, { replace: true });
    };

    // Tab 切换处理：更新状态并同步 URL
    const handleTabChange = (tabKey) => {
        // 保存当前滚动位置
        sessionStorage.setItem(`notebooks_scroll_${activeTab}`, window.scrollY.toString());

        setActiveTab(tabKey);
        updateUrlParams(selectedNotebook?.id, tabKey);

        // 恢复目标 Tab 的滚动位置
        setTimeout(() => {
            const savedScroll = sessionStorage.getItem(`notebooks_scroll_${tabKey}`);
            if (savedScroll) {
                window.scrollTo(0, parseInt(savedScroll, 10));
            }
        }, 0);
    };

    // 加载本子列表
    useEffect(() => {
        if (user) {
            loadNotebookList();
        }
    }, [user]);

    const loadNotebookList = async () => {
        setLoading(true);
        const { notebooks: loadedNotebooks, summary } = await notebookService.loadNotebooks(user);
        setNotebooks(loadedNotebooks);
        setSummary(summary);
        console.log('[NotebooksPage] summary', summary);
        setLoading(false);

        // 如果 URL 中有 notebookId，自动选中该本子
        if (pendingNotebookIdRef.current && loadedNotebooks.length > 0) {
            const targetNotebook = loadedNotebooks.find(nb => nb.id === pendingNotebookIdRef.current);
            if (targetNotebook) {
                // 使用 setTimeout 确保状态更新后再选中
                setTimeout(() => {
                    handleSelectNotebook(targetNotebook, false); // false = 不更新 URL（因为已经在 URL 里了）
                }, 0);
            }
            pendingNotebookIdRef.current = null; // 清除，避免重复触发
        }
    };

    // 页面加载时恢复滚动位置
    useEffect(() => {
        const savedScroll = sessionStorage.getItem(`notebooks_scroll_${activeTab}`);
        if (savedScroll) {
            setTimeout(() => {
                window.scrollTo(0, parseInt(savedScroll, 10));
            }, 100);
        }
    }, []);

    // 监听 URL 参数变化（处理浏览器后退）
    useEffect(() => {
        // 只在本子列表已加载完成后处理
        if (loading || notebooks.length === 0) return;

        const currentUrlNotebookId = searchParams.get('notebookId');
        const currentUrlTab = searchParams.get('tab');

        // 如果 URL 中有 notebookId，但当前没有选中该本子，则自动选中
        if (currentUrlNotebookId && selectedNotebook?.id !== currentUrlNotebookId) {
            const targetNotebook = notebooks.find(nb => nb.id === currentUrlNotebookId);
            if (targetNotebook) {
                console.log('[Notebooks] Restoring notebook from URL:', currentUrlNotebookId);
                handleSelectNotebook(targetNotebook, false); // false = 不更新 URL
            }
        }

        // 如果 URL 中的 tab 与当前 activeTab 不同，同步 tab 状态
        if (currentUrlTab && validTabs.includes(currentUrlTab) && activeTab !== currentUrlTab) {
            console.log('[Notebooks] Restoring tab from URL:', currentUrlTab);
            setActiveTab(currentUrlTab);
        }
    }, [searchParams, notebooks, loading]);

    // 选中本子并切换 Tab（用于今日汇总的快捷跳转）
    const handleJumpToNotebook = (notebookId, tab) => {
        const notebook = notebooks.find(nb => nb.id === notebookId);
        if (notebook) {
            handleSelectNotebook(notebook);
            if (tab === 'vocab' || tab === 'sentence') {
                setActiveTab(tab);
                updateUrlParams(notebookId, tab);
            }
        }
    };

    // 渲染今日汇总
    const renderTodaySummary = (summary, notebooks) => {
        if (!summary) return null;

        const {
            totalNotebooks,
            totalVocabCount,
            totalSentenceCount,
            totalDueVocabCount,
            totalDueSentenceCount,
            firstDueNotebookId,
            firstDueNotebookTab,
        } = summary;

        const totalDue = totalDueVocabCount + totalDueSentenceCount;
        const totalItems = totalVocabCount + totalSentenceCount;

        // 没有任何本子或条目
        if (totalNotebooks === 0 || totalItems === 0) {
            return (
                <div className="flex flex-col gap-1">
                    <div>你还没有创建任何本子或添加内容。</div>
                    <div className="text-gray-500">
                        去视频页挑一些喜欢的句子和词汇，加到本子里再来复习吧。
                    </div>
                </div>
            );
        }

        // 有到期的任务
        if (totalDue > 0 && firstDueNotebookId) {
            const firstNotebook = notebooks.find(nb => nb.id === firstDueNotebookId);
            const firstName = firstNotebook?.name || '某个本子';

            return (
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                        <div>
                            今天待复习：<span className="font-semibold">{totalDueVocabCount}</span> 个词 ·{' '}
                            <span className="font-semibold">{totalDueSentenceCount}</span> 个句子
                            （分布在 <span className="font-semibold">{totalNotebooks}</span> 个本子里）
                        </div>
                        <div className="text-gray-500">
                            建议从《{firstName}》开始（优先跑有到期任务的 Tab）。
                        </div>
                    </div>
                    <button
                        type="button"
                        className="mt-2 inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 md:mt-0"
                        onClick={() => handleJumpToNotebook(firstDueNotebookId, firstDueNotebookTab)}
                    >
                        开始今天的复习
                    </button>
                </div>
            );
        }

        // 没有到期任务，但本子里有内容
        return (
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                    <div>
                        🎉 今天所有本子的复习任务都完成啦！
                    </div>
                    <div className="text-gray-500">
                        共 {totalVocabCount} 个词、{totalSentenceCount} 个句子。
                        你可以随便练一练，或者明天再来～
                    </div>
                </div>
                {!!notebooks.length && (
                    <button
                        type="button"
                        className="mt-2 inline-flex items-center justify-center rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 md:mt-0"
                        onClick={() => {
                            // 简单策略：跳到第一个有内容的本子（优先词汇）
                            const target = notebooks.find(
                                nb => (nb.vocabCount || 0) + (nb.sentenceCount || 0) > 0
                            );
                            if (target) {
                                const tab = (target.vocabCount || 0) > 0 ? 'vocab' : 'sentence';
                                handleJumpToNotebook(target.id, tab);
                            }
                        }}
                    >
                        随便练一练
                    </button>
                )}
            </div>
        );
    };

    // 加载本子详情
    const handleSelectNotebook = async (notebook, shouldUpdateUrl = true) => {
        setSelectedNotebook(notebook);
        setDetailLoading(true);
        setVocabStats({ dueCount: 0, totalVocabCount: 0 }); // 重置统计
        setSentenceStats({ dueCount: 0, totalSentenceCount: 0 }); // 重置统计

        // 更新 URL 参数（如果需要）
        if (shouldUpdateUrl) {
            updateUrlParams(notebook.id, activeTab);
        }

        const detail = await notebookService.loadNotebookDetail(user, notebook.id);
        setNotebookDetail(detail);
        setDetailLoading(false);

        // 异步加载复习统计（不阻塞详情加载）
        loadVocabStats(notebook.id);
        loadSentenceStats(notebook.id);
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

    // 加载句子复习统计
    const loadSentenceStats = async (notebookId) => {
        setSentenceStatsLoading(true);
        try {
            const data = await notebookService.loadNotebookSentencesForReview(user, notebookId);
            if (data) {
                const stats = {
                    dueCount: data.dueSentenceCount || 0,
                    totalSentenceCount: data.totalSentenceCount || 0,
                };
                setSentenceStats(stats);

                console.log('[SentenceNotebookHeader]', {
                    notebookId,
                    totalSentenceCount: stats.totalSentenceCount,
                    dueSentenceCount: stats.dueCount,
                });
            }
        } catch (err) {
            console.error('Error loading sentence stats:', err);
        }
        setSentenceStatsLoading(false);
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
    const handleDeleteNotebook = async (notebookId) => {
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

    // 执行删除
    const executeDelete = async () => {
        const { type, data } = deleteConfirm;
        if (!type || !data) return;

        if (type === 'notebook') {
            await handleDeleteNotebook(data.id);
        } else if (type === 'sentence') {
            await handleRemoveSentence(data.sentenceId);
        } else if (type === 'vocab') {
            await handleRemoveVocab(data.vocabId);
        }
        setDeleteConfirm({ isOpen: false, type: null, data: null });
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
        <div className="max-w-7xl mx-auto fade-in">
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

            {/* 今日复习总览 */}
            {summary && (
                <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-sm">
                    {renderTodaySummary(summary, notebooks)}
                </div>
            )}

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
                                <LongPressWrapper
                                    data={notebook}
                                    type="notebook"
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
                                            {notebook.sentenceCount} 句子 · {
                                                notebook.vocabCount === 0
                                                    ? '暂无词汇'
                                                    : notebook.dueVocabCount > 0
                                                        ? `今日待复习：${notebook.dueVocabCount} 词`
                                                        : '今日无待复习词'
                                            }
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0 ml-2">
                                        {!isMobile && (
                                            <DropdownMenu
                                                trigger={
                                                    <button className={`p-2 rounded-lg transition-colors ${selectedNotebook?.id === notebook.id
                                                        ? 'hover:bg-indigo-500 text-indigo-100'
                                                        : 'hover:bg-gray-200 text-gray-400'
                                                        }`}>
                                                        <MoreHorizontal className="w-5 h-5" />
                                                    </button>
                                                }
                                                items={[
                                                    {
                                                        label: '删除本子',
                                                        danger: true,
                                                        onClick: () => setDeleteConfirm({ isOpen: true, type: 'notebook', data: notebook })
                                                    }
                                                ]}
                                            />
                                        )}
                                        <ChevronRight className={`w-5 h-5 ${selectedNotebook?.id === notebook.id ? 'text-white' : 'text-gray-400'
                                            }`} />
                                    </div>
                                </LongPressWrapper>
                            ))}
                        </div>
                    )}
                </div>
                {/* 右侧：本子详情 */}
                <div className="flex-1 min-w-0" ref={detailRef}>
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
                                    onClick={() => handleTabChange('sentence')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'sentence'
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    <MessageSquare className="w-4 h-4" />
                                    句子 ({notebookDetail.sentences.length})
                                </button>
                                <button
                                    onClick={() => handleTabChange('vocab')}
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
                                    {/* 句子复习统计提示 */}
                                    {notebookDetail.sentences.length > 0 && (
                                        <div className="text-sm text-gray-500 mb-2">
                                            {sentenceStatsLoading ? (
                                                <span>加载中...</span>
                                            ) : !selectedNotebook.hasSentenceReviewState ? (
                                                // Case 2: 第一轮学习
                                                <div>这个本子里的 {notebookDetail.sentences.length} 个句子你还没刷过，先学一轮，我会帮你安排后面的复习节奏。</div>
                                            ) : sentenceStats.dueCount > 0 ? (
                                                // Case 3: 有到期任务
                                                <>今日待复习：<span className="font-medium text-indigo-600">{sentenceStats.dueCount}</span> / 共 {sentenceStats.totalSentenceCount} 个句子</>
                                            ) : (
                                                // Case 4: 无到期任务（随便练一练）
                                                <div className="flex flex-col gap-1">
                                                    <div>🎉 今天这个本子没有到期要复习的句子（共 {sentenceStats.totalSentenceCount} 个句子）</div>
                                                    <div className="text-xs text-gray-400">之后会按记忆节奏自动安排再来复习。</div>
                                                </div>
                                            )}
                                        </div>
                                    )}
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
                                            {!selectedNotebook.hasSentenceReviewState
                                                ? '开始第一轮学习'
                                                : sentenceStats.dueCount > 0
                                                    ? '开始句子复习'
                                                    : '随便练一练'
                                            }
                                        </button>
                                    </div>
                                    {notebookDetail.sentences.length > 0 ? (
                                        <div className="space-y-4">
                                            {notebookDetail.sentences.map((sentence) => (
                                                <LongPressWrapper
                                                    key={`${sentence.videoId}-${sentence.sentenceId}`}
                                                    data={sentence}
                                                    type="sentence"
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
                                                            {!isMobile && (
                                                                <DropdownMenu
                                                                    items={[
                                                                        {
                                                                            label: '删除句子',
                                                                            danger: true,
                                                                            onClick: () => setDeleteConfirm({ isOpen: true, type: 'sentence', data: sentence })
                                                                        }
                                                                    ]}
                                                                />
                                                            )}
                                                            <button
                                                                onClick={() => navigate(`/video/${sentence.videoId}?mode=intensive&sentenceId=${sentence.sentenceId}`)}
                                                                className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 font-medium transition-colors text-sm"
                                                            >
                                                                去学习
                                                            </button>
                                                        </div>
                                                    </div>
                                                </LongPressWrapper>
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
                                    {notebookDetail.vocabs.length > 0 && (
                                        <div className="text-sm text-gray-500 mb-2">
                                            {vocabStatsLoading ? (
                                                <span>加载中...</span>
                                            ) : !selectedNotebook.hasVocabReviewState ? (
                                                // Case 2: 第一轮学习
                                                <div>这个本子里的 {notebookDetail.vocabs.length} 个词你还没刷过，先学一轮，我会帮你安排后面的复习节奏。</div>
                                            ) : vocabStats.dueCount > 0 ? (
                                                // Case 3: 有到期任务
                                                <>今日待复习：<span className="font-medium text-indigo-600">{vocabStats.dueCount}</span> / 共 {vocabStats.totalVocabCount} 个词</>
                                            ) : (
                                                // Case 4: 无到期任务（随便练一练）
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
                                            {!selectedNotebook.hasVocabReviewState
                                                ? '开始第一轮学习'
                                                : vocabStats.dueCount > 0
                                                    ? '开始词汇复习'
                                                    : '随便练一练'
                                            }
                                        </button>
                                    </div>
                                    {notebookDetail.vocabs.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {notebookDetail.vocabs.map((vocab) => (
                                                <LongPressWrapper
                                                    key={`${vocab.videoId}-${vocab.vocabId}`}
                                                    data={vocab}
                                                    type="vocab"
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
                                                            {!isMobile && (
                                                                <DropdownMenu
                                                                    items={[
                                                                        {
                                                                            label: '删除单词',
                                                                            danger: true,
                                                                            onClick: () => setDeleteConfirm({ isOpen: true, type: 'vocab', data: vocab })
                                                                        }
                                                                    ]}
                                                                />
                                                            )}
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
                                                </LongPressWrapper>
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

            {/* 删除确认 Modal */}
            <Modal
                isOpen={deleteConfirm.isOpen}
                onClose={() => setDeleteConfirm({ ...deleteConfirm, isOpen: false })}
                title={
                    deleteConfirm.type === 'notebook' ? '删除本子' :
                        deleteConfirm.type === 'sentence' ? '删除句子' :
                            '删除单词'
                }
                footer={
                    <>
                        <button
                            onClick={() => setDeleteConfirm({ ...deleteConfirm, isOpen: false })}
                            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 font-medium transition-colors"
                        >
                            取消
                        </button>
                        <button
                            onClick={executeDelete}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
                        >
                            确认删除
                        </button>
                    </>
                }
            >
                <p className="text-gray-600">
                    {deleteConfirm.type === 'notebook' && '确定要删除这个本子吗？本子里的句子和单词也会一并移除，但你的学习记录会保留。'}
                    {deleteConfirm.type === 'sentence' && '确定要把这条句子从本子里删除吗？'}
                    {deleteConfirm.type === 'vocab' && '确定要把这个单词从本子里删除吗？'}
                </p>
            </Modal>

            {/* 底部操作栏 (Mobile) */}
            <BottomSheet
                isOpen={bottomSheet.isOpen}
                onClose={() => setBottomSheet(prev => ({ ...prev, isOpen: false }))}
                title={bottomSheet.title}
                actions={[
                    {
                        label: bottomSheet.type === 'notebook' ? '删除本子' :
                            bottomSheet.type === 'sentence' ? '删除句子' : '删除单词',
                        danger: true,
                        icon: Trash2,
                        onClick: () => {
                            // 关闭 BottomSheet，打开确认 Modal
                            setBottomSheet(prev => ({ ...prev, isOpen: false }));
                            setDeleteConfirm({
                                isOpen: true,
                                type: bottomSheet.type,
                                data: bottomSheet.data
                            });
                        }
                    }
                ]}
            />
        </div>
    );
}

export default Notebooks;
