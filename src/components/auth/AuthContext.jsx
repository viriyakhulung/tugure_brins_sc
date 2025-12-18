import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

// Simulated users for demo
const DEMO_USERS = {
  'admin@sample.com': { email: 'admin@sample.com', password: 'admin', role: 'ADMIN', full_name: 'Administrator' },
  'brins@sample.com': { email: 'brins@sample.com', password: 'brins', role: 'BRINS', full_name: 'BRINS User' },
  'tugure@sample.com': { email: 'tugure@sample.com', password: 'tugure', role: 'TUGURE', full_name: 'Tugure User' }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for saved session
    const savedUser = localStorage.getItem('crp_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const demoUser = DEMO_USERS[email];
    if (demoUser && demoUser.password === password) {
      const userData = {
        email: demoUser.email,
        role: demoUser.role,
        full_name: demoUser.full_name,
        last_login: new Date().toISOString()
      };
      setUser(userData);
      localStorage.setItem('crp_user', JSON.stringify(userData));
      return { success: true, user: userData };
    }
    return { success: false, error: 'Invalid credentials' };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('crp_user');
  };

  const hasAccess = (allowedRoles) => {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    return allowedRoles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, hasAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;