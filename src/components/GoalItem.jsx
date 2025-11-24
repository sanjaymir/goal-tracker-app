import React from 'react';
import { Card } from './Card';
import { Button } from './Button';

export function GoalItem({ goal, onToggle, onDelete }) {
    return (
        <Card className="p-4 flex items-center justify-between group">
            <div className="flex items-center gap-3 flex-1">
                <button
                    onClick={() => onToggle(goal.id)}
                    className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors duration-200
            ${goal.completed
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-slate-300 hover:border-primary-500'
                        }`}
                >
                    {goal.completed && (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                    )}
                </button>
                <div className="flex-1">
                    <h3 className={`font-medium text-slate-900 transition-all duration-200 ${goal.completed ? 'line-through text-slate-400' : ''}`}>
                        {goal.title}
                    </h3>
                    {goal.description && (
                        <p className={`text-sm text-slate-500 mt-0.5 ${goal.completed ? 'line-through text-slate-300' : ''}`}>
                            {goal.description}
                        </p>
                    )}
                </div>
            </div>
            <Button
                variant="ghost"
                onClick={() => onDelete(goal.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-red-500 hover:bg-red-50 hover:text-red-600"
                aria-label="Delete goal"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </Button>
        </Card>
    );
}
