import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Monitor, Trash2 } from 'lucide-react';
import { devicesAPI } from '../services/api';

function DeviceManagement() {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [removing, setRemoving] = useState(null);
    const currentDeviceId = localStorage.getItem('deviceId');

    useEffect(() => {
        loadDevices();
    }, []);

    const loadDevices = async () => {
        try {
            const response = await devicesAPI.getList();
            if (response.success) {
                setDevices(response.data || []);
            }
        } catch (error) {
            console.error('Failed to load devices:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async (deviceId) => {
        if (!window.confirm('确定要移除该设备吗？')) return;

        setRemoving(deviceId);
        try {
            const response = await devicesAPI.remove(deviceId);
            if (response.success) {
                setDevices(devices.filter(d => d.id !== deviceId));
            } else {
                alert('移除失败：' + (response.error || '未知错误'));
            }
        } catch (error) {
            alert('移除失败：' + error.message);
        } finally {
            setRemoving(null);
        }
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '未知';
        const date = new Date(timestamp);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="max-w-3xl mx-auto">
            {/* 返回按钮和标题 */}
            <div className="mb-6">
                <Link
                    to="/settings/more"
                    className="inline-flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors mb-4"
                >
                    <ArrowLeft className="w-5 h-5" />
                    <span>返回</span>
                </Link>
                <h1 className="text-3xl font-bold text-gray-800 mb-2">设备管理</h1>
                <p className="text-gray-500">最多可登录3台设备</p>
            </div>

            {/* 设备列表 */}
            <div className="space-y-3">
                {loading ? (
                    <div className="text-center py-8 text-gray-500">加载中...</div>
                ) : devices.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">暂无登录设备</div>
                ) : (
                    devices.map((device) => {
                        const isCurrentDevice = device.device_id === currentDeviceId;
                        return (
                            <div
                                key={device.id}
                                className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                        <Monitor className="w-6 h-6 text-gray-600" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-gray-800">
                                                {device.device_name || '未知设备'}
                                            </h3>
                                            {isCurrentDevice && (
                                                <span className="px-2 py-0.5 bg-green-100 text-green-600 text-xs rounded-full">
                                                    当前设备
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500">
                                            最后登录：{formatTime(device.last_login_at)}
                                        </p>
                                    </div>
                                </div>
                                {!isCurrentDevice && (
                                    <button
                                        onClick={() => handleRemove(device.id)}
                                        disabled={removing === device.id}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                        title="移除设备"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

export default DeviceManagement;
