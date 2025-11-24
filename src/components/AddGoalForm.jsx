import React, { useState } from 'react';
import { Card } from './Card';
import { Input } from './Input';
import { Button } from './Button';

export function AddGoalForm({ onAdd }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!title.trim()) return;

        onAdd({ title, description });
        setTitle('');
        setDescription('');
    };

    return (
        <Card className="p-6 mb-8 bg-gradient-to-br from-white to-slate-50">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Nova Meta</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    label="Título"
                    placeholder="Ex: Ler 10 páginas por dia"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                />
                <Input
                    label="Descrição (opcional)"
                    placeholder="Detalhes adicionais..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
                <div className="flex justify-end">
                    <Button type="submit" disabled={!title.trim()}>
                        Adicionar Meta
                    </Button>
                </div>
            </form>
        </Card>
    );
}
