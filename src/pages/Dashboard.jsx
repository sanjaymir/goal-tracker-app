import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { CheckCircle, Circle, TrendingUp, Calendar } from 'lucide-react';

export default function Dashboard() {
    const { user, getMyGoals, updateGoalProgress, getAllGoals, getAllUsers } = useAuth();
    const goals = user.role === 'ADMIN' ? getAllGoals() : getMyGoals();

    const handleIncrement = (goal) => {
        updateGoalProgress(goal.id, goal.current + 1);
    };

    const handleDecrement = (goal) => {
        if (goal.current > 0) {
            updateGoalProgress(goal.id, goal.current - 1);
        }
    };

    // Prepare data for charts
    const chartData = goals.map(g => ({
        name: g.title.length > 15 ? g.title.substring(0, 15) + '...' : g.title,
        Realizado: g.current,
        Meta: g.target,
        fullTitle: g.title
    }));

    return (
        <div className="space-y-8">
            <header>
                <h1 className="text-2xl font-bold text-slate-900">Olá, {user.name}</h1>
                <p className="text-slate-600">
                    {user.role === 'ADMIN' ? 'Visão geral de todas as metas do sistema.' : 'Acompanhe o progresso das suas metas.'}
                </p>
            </header>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-blue-50 rounded-full text-blue-600">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">Total de Metas</p>
                        <h3 className="text-2xl font-bold text-slate-900">{goals.length}</h3>
                    </div>
                </Card>
                <Card className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-green-50 rounded-full text-green-600">
                        <CheckCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">Concluídas</p>
                        <h3 className="text-2xl font-bold text-slate-900">
                            {goals.filter(g => g.current >= g.target).length}
                        </h3>
                    </div>
                </Card>
                <Card className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-orange-50 rounded-full text-orange-600">
                        <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">Em Andamento</p>
                        <h3 className="text-2xl font-bold text-slate-900">
                            {goals.filter(g => g.current < g.target).length}
                        </h3>
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Goals List & Updates */}
                <div className="space-y-6">
                    <h2 className="text-lg font-semibold text-slate-900">Suas Metas</h2>
                    {goals.map(goal => {
                        const progress = Math.min(100, Math.round((goal.current / goal.target) * 100));
                        const isCompleted = goal.current >= goal.target;

                        return (
                            <Card key={goal.id} className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-slate-900">{goal.title}</h3>
                                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${goal.frequency === 'WEEKLY' ? 'bg-purple-50 text-purple-700' : 'bg-indigo-50 text-indigo-700'
                                                }`}>
                                                {goal.frequency === 'WEEKLY' ? 'Semanal' : 'Mensal'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-500 mt-1">{goal.description}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-2xl font-bold text-slate-900">{goal.current}</span>
                                        <span className="text-sm text-slate-500"> / {goal.target} {goal.unit}</span>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="w-full bg-slate-100 rounded-full h-2 mb-6">
                                    <div
                                        className={`h-2 rounded-full transition-all duration-500 ${isCompleted ? 'bg-green-500' : 'bg-primary-600'}`}
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                </div>

                                {/* Controls */}
                                <div className="flex items-center justify-between">
                                    <div className="text-sm text-slate-500">
                                        {isCompleted ? (
                                            <span className="flex items-center gap-1 text-green-600 font-medium">
                                                <CheckCircle className="w-4 h-4" /> Meta Atingida!
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1">
                                                <Circle className="w-4 h-4" /> Em andamento
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Button
                                            variant="secondary"
                                            className="px-3 py-1"
                                            onClick={() => handleDecrement(goal)}
                                            disabled={goal.current === 0}
                                        >
                                            -
                                        </Button>
                                        <Button
                                            variant="primary"
                                            className="px-3 py-1"
                                            onClick={() => handleIncrement(goal)}
                                        >
                                            +
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>

                {/* Charts */}
                <div>
                    <h2 className="text-lg font-semibold text-slate-900 mb-6">Visão Geral</h2>
                    <Card className="p-6 h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={100} />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="Realizado" fill="#0ea5e9" radius={[0, 4, 4, 0]} barSize={20} />
                                <Bar dataKey="Meta" fill="#e2e8f0" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </Card>
                </div>
            </div>
        </div>
    );
}
