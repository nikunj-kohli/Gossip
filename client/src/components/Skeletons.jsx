import React from 'react';

export const SkeletonBlock = ({ className = '' }) => (
  <div className={`animate-pulse rounded-xl bg-slate-200/80 ${className}`} />
);

export const SkeletonCard = ({
  className = '',
  avatar = false,
  media = false,
  lines = 3,
  footer = false,
}) => (
  <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
    <div className="flex gap-3">
      {avatar && <SkeletonBlock className="h-10 w-10 rounded-full" />}
      <div className="flex-1 space-y-3">
        <SkeletonBlock className="h-5 w-1/3" />
        {Array.from({ length: lines }).map((_, index) => (
          <SkeletonBlock
            key={index}
            className={`h-4 ${index === lines - 1 ? 'w-3/4' : 'w-full'}`}
          />
        ))}
      </div>
    </div>
    {media && <SkeletonBlock className="mt-4 h-48 w-full rounded-xl" />}
    {footer && (
      <div className="mt-4 flex gap-3">
        <SkeletonBlock className="h-8 w-20 rounded-full" />
        <SkeletonBlock className="h-8 w-24 rounded-full" />
      </div>
    )}
  </div>
);
