import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type UserRole = 'employee' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  employeeId: string;
  department: string;
  designation: string;
  joiningDate?: string;
  createdAt?: string;
  phone?: string | null;
  address?: string | null;
  profilePhoto?: string | null;
  emergencyContact?: {
    name: string | null;
    phone: string | null;
    relationship: string | null;
  };
  bankDetails?: {
    accountNumber: string | null;
    ifscCode: string | null;
    bankName: string | null;
    accountHolderName: string | null;
  };
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  logout: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('attendx_user');
    return stored ? JSON.parse(stored) : null;
  });
  
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('attendx_token');
  });

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('attendx_theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // --- INITIAL CHECK ON STARTUP ---
  useEffect(() => {
    const checkSession = async () => {
      // If we have a user/token in storage, verify if the session is still active via refresh-token
      if (token) {
        try {
          const response = await fetch(`${API_URL}/auth/refresh-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
          });

          if (response.ok) {
            const data = await response.json();
            const newToken = data.token;
            setToken(newToken);
            localStorage.setItem('attendx_token', newToken);
            console.log('✅ Session restored successfully');
          } else {
            console.warn('❌ Session expired or invalid');
            logoutLocal();
          }
        } catch (error) {
          console.error('Session check failed:', error);
        }
      }
    };
    
    checkSession();
  }, []);

  const login = useCallback(async (email: string, password: string, rememberMe: boolean = false) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, rememberMe }),
        credentials: 'include', // CRITICAL: Allow backend to set refreshToken cookie
      });

      const data = await response.json();

      if (data.success && data.data) {
        const userData = data.data.user;
        const authToken = data.data.token;
        
        setUser(userData);
        setToken(authToken);
        
        localStorage.setItem('attendx_user', JSON.stringify(userData));
        localStorage.setItem('attendx_token', authToken);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }, []);

  const logoutLocal = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('attendx_user');
    localStorage.removeItem('attendx_token');
    window.location.href = '/login';
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include', // CRITICAL: Clear refresh cookie on server
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    logoutLocal();
  }, [token, logoutLocal]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('attendx_theme', next);
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated: !!user, 
      token,
      login, 
      logout, 
      theme, 
      toggleTheme 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
