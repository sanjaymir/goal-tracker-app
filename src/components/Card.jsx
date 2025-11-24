import React from 'react';

export function Card({ children, className = '', ...props }) {
    return (
        <div
            className={`bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200 ${className}`}
            {...props}
        >
            {children}
        </div>
    );
}
