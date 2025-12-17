import { createContext, useContext, useEffect, useState } from 'react';
import { authAPI, setToken, clearToken } from '../services/api';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

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
        const response = await authAPI.login(phone, password);
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

    const value = {
        user,
        loading,
        login,
        register,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
