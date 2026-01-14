'use client';

import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'bordered';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({
  children,
  className = '',
  variant = 'default',
  padding = 'md',
}: CardProps) {
  const baseStyles = 'rounded-md transition-all duration-200 ease-in-out';
  
  const variantStyles = {
    default: 'bg-bg-4 comic-border-thick comic-shadow hover:shadow-xl hover:-translate-y-1',
    elevated: 'bg-bg-3 comic-border-thick comic-shadow-lg hover:shadow-2xl hover:-translate-y-1',
    bordered: 'bg-bg-3 border border-border-primary hover:border-border-secondary hover:shadow-lg',
  };

  const paddingStyles = {
    none: '',
    sm: 'p-4',
    md: 'p-6 md:p-8',
    lg: 'p-8 md:p-10',
  };

  return (
    <div className={`${baseStyles} ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}>
      {children}
    </div>
  );
}
