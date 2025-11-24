import React, { createContext, useContext, useState, useEffect } from 'react';
import { INITIAL_USERS, INITIAL_GOALS } from '../data/mockData';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('auth_user');
        return saved ? JSON.parse(saved) : null;
    });

    // Simulating a database in localStorage
    const [dbUsers, setDbUsers] = useState(() => {
        const saved = localStorage.getItem('db_users');
        return saved ? JSON.parse(saved) : INITIAL_USERS;
    });

    const [dbGoals, setDbGoals] = useState(() => {
        const saved = localStorage.getItem('db_goals');
        return saved ? JSON.parse(saved) : INITIAL_GOALS;
    });

    useEffect(() => {
        localStorage.setItem('db_users', JSON.stringify(dbUsers));
    }, [dbUsers]);

    useEffect(() => {
        localStorage.setItem('db_goals', JSON.stringify(dbGoals));
    }, [dbGoals]);

    const login = (email, password) => {
        const foundUser = dbUsers.find(u => u.email === email && u.password === password);
        if (foundUser) {
            // Don't store password in session
            const { password, ...safeUser } = foundUser;
            setUser(safeUser);
            localStorage.setItem('auth_user', JSON.stringify(safeUser));
            return { success: true };
        }
        return { success: false, error: 'Credenciais inválidas' };
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('auth_user');
    };

    // Data Access Methods (Simulating API)
    const getMyGoals = () => {
        if (!user) return [];
        return dbGoals.filter(g => g.userId === user.id);
    };

    const updateGoalProgress = (goalId, newCurrent) => {
        setDbGoals(goals => goals.map(g =>
            g.id === goalId ? { ...g, current: Number(newCurrent) } : g
        ));
    };

    const deleteGoal = (goalId) => {
        setDbGoals(goals => goals.filter(g => g.id !== goalId));
    };

    // Admin Methods
    const getAllUsers = () => dbUsers.filter(u => u.role !== 'ADMIN');

    const getAllGoals = () => dbGoals;

    const getGoalsByUser = (userId) => dbGoals.filter(g => g.userId === userId);

    const createUser = (userData) => {
        const newUser = {
            id: crypto.randomUUID(),
            role: 'USER',
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=random`,
            ...userData
        };
        setDbUsers([...dbUsers, newUser]);
        return newUser;
    };

    const assignGoal = (goalData) => {
        const newGoal = {
            id: crypto.randomUUID(),
            current: 0,
            ...goalData
        };
        setDbGoals([...dbGoals, newGoal]);
    };

    return (
        <AuthContext.Provider value={{
            user,
            login,
            logout,
            getMyGoals,
            updateGoalProgress,
            deleteGoal,
            getAllUsers,
            getAllGoals,
            getGoalsByUser,
            createUser,
            assignGoal
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
