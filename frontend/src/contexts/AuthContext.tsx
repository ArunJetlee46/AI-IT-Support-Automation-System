import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api/client';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, user_type: 'internal' | 'external') => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const storedToken = localStorage.getItem('authToken');
      const storedUser = localStorage.getItem('user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));

        try {
          const { data } = await authAPI.getProfile();
          const updatedUser: User = {
            id: data.id,
            email: data.email,
            name: data.name,
            role: data.role,
            user_type: data.user_type,
          };
          setUser(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
        } catch {
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
        }
      }

      setLoading(false);
    };

    init();
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await authAPI.login({ email, password });
    setToken(data.token);
    const userData: User = {
      id: data.user_id,
      email: data.email,
      name: data.name,
      role: data.role,
      user_type: data.user_type,
    };
    setUser(userData);
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const register = async (email: string, password: string, name: string, user_type: 'internal' | 'external') => {
    const { data } = await authAPI.register({ email, password, name, user_type });
    setToken(data.token);
    const userData: User = {
      id: data.user_id,
      email: data.user.email,
      name: data.user.name,
      role: data.user.role,
      user_type: data.user.user_type,
    };
    setUser(userData);
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch {
      // Ignore logout API failure and clear client session anyway
    }

    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!token && !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
