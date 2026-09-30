import React from 'react';

interface NumaLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  variant?: 'full' | 'icon';
  theme?: 'dark' | 'light' | 'auto';
}

export const NumaLogo: React.FC<NumaLogoProps> = ({
  size = 'md',
  className = '',
  variant = 'full',
  theme = 'auto',
}) => {
  const sizeMap = {
    sm: { icon: 'w-8 h-8 rounded-xl', title: 'text-base' },
    md: { icon: 'w-10 h-10 sm:w-11 sm:h-11 rounded-2xl', title: 'text-xl sm:text-2xl' },
    lg: { icon: 'w-13 h-13 sm:w-14 sm:h-14 rounded-2xl', title: 'text-2xl sm:text-3xl' },
    xl: { icon: 'w-18 h-18 sm:w-20 sm:h-20 rounded-3xl', title: 'text-3xl sm:text-4xl' },
  };

  const s = sizeMap[size];

  const titleColor = theme === 'light' ? 'text-white' : theme === 'dark' ? 'text-[#0F1E1C]' : 'text-[#0F1E1C] dark:text-white';

  return (
    <div className={`inline-flex items-center gap-2.5 sm:gap-3 ${className}`}>
      {/* Playful Flat Squircle with Warm Yellow & Slate Accent */}
      <div className={`${s.icon} bg-[#FDC323] overflow-hidden shadow-xs border-2 border-[#0F1E1C] transform -rotate-2 hover:rotate-0 transition-transform duration-200 flex-shrink-0 flex items-center justify-center p-0.5`}>
        <img
          src="/logo.png"
          alt="Numa Space Logo"
          className="w-full h-full object-cover rounded-[10px]"
        />
      </div>

      {variant === 'full' && (
        <span className={`${s.title} font-black ${titleColor} tracking-tight`}>
          Numa<span className="text-[#00785D]">Space</span>
        </span>
      )}
    </div>
  );
};
