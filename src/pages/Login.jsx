import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Button } from '../components/Button';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login, user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            navigate('/');
        }
    }, [user, navigate]);

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        const result = login(email, password);
        if (!result.success) {
            setError(result.error);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">GoalTracker</h1>
                    <p className="text-slate-600 mt-2">Faça login para acessar suas metas</p>
                </div>

                <Card className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <Input
                            label="Email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="seu@email.com"
                            required
                        />
                        <Input
                            label="Senha"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••"
                            required
                        />

                        {error && (
                            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
                                {error}
                            </div>
                        )}

                        <Button type="submit" className="w-full justify-center">
                            Entrar
                        </Button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-slate-100 text-center text-sm text-slate-500">
                        <p>Credenciais de Teste:</p>
                        <div className="mt-2 space-y-1">
                            <p><span className="font-medium">Admin:</span> admin@empresa.com / admin</p>
                            <p><span className="font-medium">User:</span> joao@empresa.com / 123</p>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
