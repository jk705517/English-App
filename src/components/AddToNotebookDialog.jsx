import React, { useState, useEffect } from 'react';
import { X, Plus, BookOpen, Check } from 'lucide-react';
import { notebookService } from '../services/notebookService';

/**
 * 加入本子弹窗组件
 * @param {boolean} isOpen - 是否显示弹窗
 * @param {function} onClose - 关闭弹窗回调
 * @param {object} user - 当前登录用户
 * @param {string} itemType - 'sentence' | 'vocab'
 * @param {number} itemId - 句子/词汇 ID
 * @param {number} videoId - 所属视频 ID
 * @param {function} onSuccess - 成功添加后的回调 (notebookName) => void
 */
const AddToNotebookDialog = ({
    isOpen,
    onClose,
    user,
    itemType,
    itemId,
    videoId,
    onSuccess
}) => {
    const [notebooks, setNotebooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newNotebookName, setNewNotebookName] = useState('');
    const [creating, setCreating] = useState(false);
    const [adding, setAdding] = useState(null); // notebookId being added to
    const [message, setMessage] = useState(null); // { type: 'success' | 'info', text: string }

    // 加载本子列表
    useEffect(() => {
        if (isOpen && user) {
            loadNotebooks();
        }
    }, [isOpen, user]);

    const loadNotebooks = async () => {
        setLoading(true);
        try {
            const result = await notebookService.loadNotebooks(user);
            // loadNotebooks returns { notebooks: [], summary: {} }, extract the notebooks array
            setNotebooks(result?.notebooks || []);
        } catch (error) {
            console.error('Error loading notebooks:', error);
            setMessage({ type: 'error', text: '加载本子列表失败，请重试' });
            setNotebooks([]);
        } finally {
            setLoading(false);
        }
    };

    // 添加到现有本子
    const handleAddToNotebook = async (notebook) => {
        if (adding) return;
        setAdding(notebook.id);
        setMessage(null);

        try {
            const success = await notebookService.addItemToNotebook(user, {
                notebookId: notebook.id,
                itemType,
                itemId,
                videoId
            });

            if (success) {
                setMessage({ type: 'success', text: `已加入本子：${notebook.name}` });
                if (onSuccess) onSuccess(notebook.name);

                // 短暂显示成功消息后关闭
                setTimeout(() => {
                    onClose();
                    setMessage(null);
                }, 1000);
            } else {
                setMessage({ type: 'error', text: '添加失败，请重试' });
            }
        } catch (error) {
            console.error('Error adding to notebook:', error);
            setMessage({ type: 'error', text: '添加失败，请重试' });
        } finally {
            setAdding(null);
        }
    };

    // 创建新本子并添加
    const handleCreateAndAdd = async () => {
        if (!newNotebookName.trim() || creating) return;
        setCreating(true);
        setMessage(null);

        try {
            // 1. 创建本子
            const newNotebook = await notebookService.createNotebook(user, {
                name: newNotebookName.trim()
            });

            if (!newNotebook) {
                setMessage({ type: 'error', text: '创建本子失败，请重试' });
                return;
            }

            // 2. 添加当前条目到新本子
            const addSuccess = await notebookService.addItemToNotebook(user, {
                notebookId: newNotebook.id,
                itemType,
                itemId,
                videoId
            });

            if (!addSuccess) {
                setMessage({ type: 'error', text: '本子已创建但添加条目失败，请重试' });
                loadNotebooks(); // 刷新列表以显示新本子
                return;
            }

            setNewNotebookName('');
            setMessage({ type: 'success', text: `已创建并加入本子：${newNotebook.name}` });
            if (onSuccess) onSuccess(newNotebook.name);

            // 刷新列表
            loadNotebooks();

            // 短暂显示成功消息后关闭
            setTimeout(() => {
                onClose();
                setMessage(null);
            }, 1000);
        } catch (error) {
            console.error('Error creating notebook:', error);
            setMessage({ type: 'error', text: '创建本子失败，请重试' });
        } finally {
            setCreating(false);
        }
    };

    if (!isOpen) return null;

    const itemTypeLabel = itemType === 'sentence' ? '句子' : '词汇';

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
            <div className="bg-white rounded-xl w-full max-w-md shadow-xl max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b shrink-0">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-violet-500" />
                        加入本子
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* 新建本子区域 */}
                <div className="p-4 border-b shrink-0">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder={`新建本子并添加此${itemTypeLabel}`}
                            value={newNotebookName}
                            onChange={(e) => setNewNotebookName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateAndAdd()}
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent text-sm"
                        />
                        <button
                            onClick={handleCreateAndAdd}
                            disabled={!newNotebookName.trim() || creating}
                            className="px-4 py-2 bg-violet-400 text-white rounded-lg hover:bg-violet-400 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-1"
                        >
                            <Plus className="w-4 h-4" />
                            {creating ? '创建中...' : '新建'}
                        </button>
                    </div>
                </div>

                {/* 本子列表 */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-400"></div>
                        </div>
                    ) : notebooks.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <BookOpen className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                            <p>还没有本子</p>
                            <p className="text-sm text-gray-400">在上方输入名称创建第一个本子</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-sm text-gray-500 mb-3">选择一个本子：</p>
                            {notebooks.map(notebook => (
                                <button
                                    key={notebook.id}
                                    onClick={() => handleAddToNotebook(notebook)}
                                    disabled={adding === notebook.id}
                                    className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-all text-left disabled:opacity-50"
                                >
                                    <div className="flex items-center gap-2">
                                        <div>
                                            <span className="font-medium text-gray-800">{notebook.name}</span>
                                            <span className="text-xs text-gray-400 ml-2">
                                                {notebook.sentenceCount} 句子 · {notebook.vocabCount} 词汇
                                            </span>
                                        </div>
                                    </div>
                                    {adding === notebook.id ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-violet-400"></div>
                                    ) : (
                                        <Plus className="w-4 h-4 text-gray-400" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* 消息提示 */}
                {message && (
                    <div className={`p-3 border-t shrink-0 flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' :
                        message.type === 'error' ? 'bg-red-50 text-red-700' :
                            'bg-violet-50 text-violet-500'
                        }`}>
                        {message.type === 'success' && <Check className="w-4 h-4" />}
                        <span className="text-sm font-medium">{message.text}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AddToNotebookDialog;
