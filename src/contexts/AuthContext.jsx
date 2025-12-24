import { createContext, useContext, useEffect, useState } from 'react';
import { authAPI, setToken, clearToken } from '../services/api';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

// 获取或生成设备ID
const getDeviceId = () => {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
        deviceId = 'device-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
};

// 获取设备名称
const getDeviceName = () => {
    const ua = navigator.userAgent;
    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/iPad/i.test(ua)) return 'iPad';
    if (/Android/i.test(ua)) return 'Android';
    if (/Mac/i.test(ua)) return 'Mac';
    if (/Windows/i.test(ua)) return 'Windows PC';
    return 'Browser';
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 检查本地存储的 token，尝试获取用户信息
        const checkAuth = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const response = await authAPI.getMe();
                    if (response.success) {
                        setUser(response.data);
                    } else {
                        clearToken();
                    }
                } catch (error) {
                    console.error('Auth check failed:', error);
                    clearToken();
                }
            }
            setLoading(false);
        };

        checkAuth();
    }, []);

    const login = async (phone, password) => {
        const response = await authAPI.login({
            phone,
            password,
            deviceId: getDeviceId(),
            deviceName: getDeviceName()
        });
        if (response.success) {
            setToken(response.data.token);
            setUser(response.data.user);
        }
        return response;
    };

    const register = async (phone, password, nickname) => {
        const response = await authAPI.register(phone, password, nickname);
        if (response.success) {
            setToken(response.data.token);
            setUser(response.data.user);
        }
        return response;
    };

    const logout = () => {
        clearToken();
        setUser(null);
    };

    // 更新用户信息（用于资料编辑后更新）
    const updateUser = (userData) => {
        setUser(prev => ({ ...prev, ...userData }));
    };

    // 刷新用户信息（从服务器重新获取）
    const refreshUser = async () => {
        try {
            const response = await authAPI.getMe();
            if (response.success) {
                setUser(response.data);
            }
        } catch (error) {
            console.error('刷新用户信息失败:', error);
        }
    };

    const value = {
        user,
        loading,
        login,
        register,
        logout,
        updateUser,
        refreshUser,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
