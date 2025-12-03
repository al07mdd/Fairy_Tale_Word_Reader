import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'record' | 'disabled';
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', className = '', ...props }) => {
  let baseStyles = "px-6 py-3 rounded-full font-bold text-lg transition-all transform active:scale-95 shadow-lg border-2";
  
  const variants = {
    primary: "bg-green-500 hover:bg-green-400 text-white border-green-700 shadow-green-200",
    secondary: "bg-blue-400 hover:bg-blue-300 text-white border-blue-600 shadow-blue-200",
    record: "bg-red-500 hover:bg-red-400 text-white border-red-700 shadow-red-200 animate-pulse",
    disabled: "bg-gray-300 text-gray-500 border-gray-400 cursor-not-allowed shadow-none"
  };

  const chosenVariant = props.disabled ? variants.disabled : (variant === 'record' ? variants.record : variants[variant]);

  return (
    <button 
      className={`${baseStyles} ${chosenVariant} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
};
