import React from 'react';

export function Input({ label, error, className = '', ...props }) {
    return (
        <div className="w-full">
            {label && (
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    {label}
                </label>
            )}
            <input
                className={`w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm shadow-sm placeholder-slate-400
        focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500
        disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200 disabled:shadow-none
        ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}
        ${className}`}
                {...props}
            />
            {error && (
                <p className="mt-1 text-sm text-red-600">{error}</p>
            )}
        </div>
    );
}
