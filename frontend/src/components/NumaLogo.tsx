import React from 'react';

interface NumaLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  variant?: 'full' | 'icon';
}

export const NumaLogo: React.FC<NumaLogoProps> = ({
  size = 'md',
  className = '',
  variant = 'full',
}) => {
  const sizeMap = {
    sm: { icon: 'w-8 h-8 rounded-xl', title: 'text-lg' },
    md: { icon: 'w-10 h-10 sm:w-12 sm:h-12 rounded-2xl', title: 'text-xl sm:text-2xl' },
    lg: { icon: 'w-14 h-14 sm:w-16 sm:h-16 rounded-3xl', title: 'text-2xl sm:text-3xl' },
    xl: { icon: 'w-20 h-20 sm:w-24 sm:h-24 rounded-3xl', title: 'text-4xl sm:text-5xl' },
  };

  const s = sizeMap[size];

  return (
    <div className={`inline-flex items-center gap-2.5 sm:gap-3 ${className}`}>
      {/* Rounded Square Card with User Photo */}
      <div className={`${s.icon} bg-amber-400 overflow-hidden shadow-lg border-2 border-amber-300 transform rotate-3 hover:rotate-0 transition-transform duration-200 flex-shrink-0 flex items-center justify-center`}>
        <img
          src="/logo.png"
          alt="Numa Space Logo"
          className="w-full h-full object-cover"
        />
      </div>

      {variant === 'full' && (
        <div className="flex items-center">
          <span className={`${s.title} font-black text-white tracking-tight`}>
            Numa Space
          </span>
        </div>
      )}

    </div>
  );
};
