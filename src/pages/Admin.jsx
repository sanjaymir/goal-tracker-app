import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Plus, UserPlus, Trash2 } from 'lucide-react';

export default function Admin() {
    const { getAllUsers, createUser, assignGoal, getGoalsByUser, deleteGoal } = useAuth();
    const users = getAllUsers();
    const [showUserForm, setShowUserForm] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);

    // Forms State
    const [newUser, setNewUser] = useState({ name: '', email: '', password: '' });
    const [newGoal, setNewGoal] = useState({ title: '', target: '', unit: '', frequency: 'WEEKLY' });

    const handleCreateUser = (e) => {
        e.preventDefault();
        createUser(newUser);
        setNewUser({ name: '', email: '', password: '' });
        setShowUserForm(false);
    };

    const handleAssignGoal = (e) => {
        e.preventDefault();
        if (!selectedUser) return;

        assignGoal({
            userId: selectedUser.id,
            ...newGoal,
            target: Number(newGoal.target)
        });

        setNewGoal({ title: '', target: '', unit: '', frequency: 'WEEKLY' });
        setSelectedUser(null);
    };

    const handleDeleteGoal = (goalId) => {
        if (window.confirm('Tem certeza que deseja excluir esta meta?')) {
            deleteGoal(goalId);
        }
    };

    return (
        <div className="space-y-8">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Painel Administrativo</h1>
                    <p className="text-slate-600">Gerencie usuários e atribua metas.</p>
                </div>
                <Button onClick={() => setShowUserForm(!showUserForm)}>
                    <UserPlus className="w-4 h-4 mr-2 inline" />
                    Novo Usuário
                </Button>
            </header>

            {showUserForm && (
                <Card className="p-6 bg-slate-50 border-primary-100">
                    <h3 className="font-semibold mb-4">Cadastrar Novo Usuário</h3>
                    <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <Input
                            label="Nome"
                            value={newUser.name}
                            onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                            required
                        />
                        <Input
                            label="Email"
                            type="email"
                            value={newUser.email}
                            onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                            required
                        />
                        <Input
                            label="Senha"
                            value={newUser.password}
                            onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                            required
                        />
                        <Button type="submit">Salvar Usuário</Button>
                    </form>
                </Card>
            )}

            <div className="grid grid-cols-1 gap-6">
                {users.map(user => (
                    <Card key={user.id} className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-4">
                                <img src={user.avatar} alt={user.name} className="w-12 h-12 rounded-full" />
                                <div>
                                    <h3 className="font-bold text-lg text-slate-900">{user.name}</h3>
                                    <p className="text-slate-500">{user.email}</p>
                                </div>
                            </div>
                            <Button
                                variant={selectedUser?.id === user.id ? 'secondary' : 'primary'}
                                onClick={() => setSelectedUser(selectedUser?.id === user.id ? null : user)}
                            >
                                <Plus className="w-4 h-4 mr-2 inline" />
                                Atribuir Meta
                            </Button>
                        </div>

                        {selectedUser?.id === user.id && (
                            <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 animate-fadeIn">
                                <h4 className="font-medium mb-3">Nova Meta para {user.name}</h4>
                                <form onSubmit={handleAssignGoal} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input
                                            label="Título da Meta"
                                            placeholder="Ex: Produzir Vídeos"
                                            value={newGoal.title}
                                            onChange={e => setNewGoal({ ...newGoal, title: e.target.value })}
                                            required
                                        />
                                        <div className="grid grid-cols-2 gap-4">
                                            <Input
                                                label="Meta (Qtd)"
                                                type="number"
                                                placeholder="10"
                                                value={newGoal.target}
                                                onChange={e => setNewGoal({ ...newGoal, target: e.target.value })}
                                                required
                                            />
                                            <Input
                                                label="Unidade"
                                                placeholder="vídeos"
                                                value={newGoal.unit}
                                                onChange={e => setNewGoal({ ...newGoal, unit: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Frequência</label>
                                        <select
                                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
                                            value={newGoal.frequency}
                                            onChange={e => setNewGoal({ ...newGoal, frequency: e.target.value })}
                                        >
                                            <option value="WEEKLY">Semanal</option>
                                            <option value="MONTHLY">Mensal</option>
                                        </select>
                                    </div>
                                    <div className="flex justify-end gap-3">
                                        <Button type="button" variant="ghost" onClick={() => setSelectedUser(null)}>Cancelar</Button>
                                        <Button type="submit">Confirmar Atribuição</Button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Display Assigned Goals */}
                        {(() => {
                            const userGoals = getGoalsByUser(user.id);
                            if (userGoals.length === 0) return null;

                            return (
                                <div className="mt-4 pt-4 border-t border-slate-200">
                                    <h4 className="font-medium text-sm text-slate-700 mb-3">Metas Atribuídas</h4>
                                    <div className="space-y-2">
                                        {userGoals.map(goal => (
                                            <div key={goal.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                                <div className="flex-1">
                                                    <p className="font-medium text-sm text-slate-900">{goal.title}</p>
                                                    <p className="text-xs text-slate-500">
                                                        Meta: {goal.target} {goal.unit} • {goal.frequency === 'WEEKLY' ? 'Semanal' : 'Mensal'}
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    className="text-red-600 hover:bg-red-50 px-2 py-1"
                                                    onClick={() => handleDeleteGoal(goal.id)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}
                    </Card>
                ))}
            </div>
        </div>
    );
}
