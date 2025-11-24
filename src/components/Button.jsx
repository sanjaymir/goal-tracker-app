import React from 'react';

export function Button({ children, variant = 'primary', className = '', ...props }) {
    const baseStyles = "px-4 py-2 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
        primary: "bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 shadow-sm hover:shadow-md",
        secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-slate-500 shadow-sm",
        danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-sm",
        ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}
