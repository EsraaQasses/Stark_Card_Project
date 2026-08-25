import React from 'react';

const Header = ({ category, title }) => (
  <div className="mb-8 text-start">
    {/* Category */}
    <div className="flex items-center gap-2 mb-2">
      <span className="w-2 h-2 rounded-full bg-violet-600" />

      <p className="text-sm md:text-base font-semibold text-violet-600 dark:text-violet-400">
        {category}
      </p>
    </div>

    {/* Title */}
    <h1 className="text-2xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
      {title}
    </h1>

    {/* Accent line */}
    <div className="mt-3 h-1 w-16 rounded-full bg-gradient-to-r from-violet-600 via-indigo-500 to-cyan-400" />
  </div>
);

export default Header;