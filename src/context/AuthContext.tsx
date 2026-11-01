import React, { createContext, useContext, useState } from 'react';
import { api } from '../services/api';

export type UserRole = 'STUDENT' | 'FACULTY' | 'TNP_HEAD' | 'FINANCE' | 'LIBRARIAN';

export interface AuthUser {
  id: number;
  userId?: number;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  codeOrRoll: string;
  programOrDesignation: string;
  semester?: number;
  year?: number;
  section?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  role: UserRole | null;
  login: (selectedRole: UserRole | 'STAFF', identifier: string, password?: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('college_erp_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const role = user ? user.role : null;

  const login = async (selectedRole: UserRole | 'STAFF', identifier: string, password?: string): Promise<boolean> => {
    const res = await api.login(identifier, password || '', selectedRole);
    if (res && res.success && res.user) {
      setUser(res.user);
      localStorage.setItem('college_erp_user', JSON.stringify(res.user));
      return true;
    }
    throw new Error(res?.message || 'Login failed. Invalid credentials.');
  };

  const logout = () => {
    api.logout();
    setUser(null);
    localStorage.removeItem('college_erp_user');
  };

  return (
    <AuthContext.Provider value={{ user, role, login, logout }}>
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

export default AuthContext;
