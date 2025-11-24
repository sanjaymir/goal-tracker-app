import React from 'react';
import { GoalItem } from './GoalItem';

export function GoalList({ goals, onToggle, onDelete }) {
    if (goals.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                </div>
                <h3 className="text-lg font-medium text-slate-900">Nenhuma meta ainda</h3>
                <p className="text-slate-500 mt-1">Comece adicionando uma nova meta acima.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {goals.map(goal => (
                <GoalItem
                    key={goal.id}
                    goal={goal}
                    onToggle={onToggle}
                    onDelete={onDelete}
                />
            ))}
        </div>
    );
}
