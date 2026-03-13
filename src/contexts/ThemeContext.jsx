import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

// 主题选项：'system' | 'light' | 'dark'
export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('bbEnglish_theme') || 'system';
    });

    // 实际应用的模式（解析 system 后的结果）
    const [resolvedDark, setResolvedDark] = useState(false);

    useEffect(() => {
        const applyTheme = (isDark) => {
            setResolvedDark(isDark);
            if (isDark) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        };

        if (theme === 'dark') {
            applyTheme(true);
        } else if (theme === 'light') {
            applyTheme(false);
        } else {
            // system: 跟随系统
            const mq = window.matchMedia('(prefers-color-scheme: dark)');
            applyTheme(mq.matches);
            const handler = (e) => applyTheme(e.matches);
            mq.addEventListener('change', handler);
            return () => mq.removeEventListener('change', handler);
        }
    }, [theme]);

    const setThemeAndSave = (newTheme) => {
        setTheme(newTheme);
        localStorage.setItem('bbEnglish_theme', newTheme);
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme: setThemeAndSave, isDark: resolvedDark }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
