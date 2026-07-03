import React from 'react';

export default function SpotifyHeart({ size = 16, active = false, className = '', ...props }) {
  return (
    <svg
      role="img"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', ...props.style }}
      {...props}
    >
      {active ? (
        <path d="M15.724 4.22A4.313 4.313 0 0 0 12.192.814a4.269 4.269 0 0 0-3.622 1.13.837.837 0 0 1-1.14 0 4.272 4.272 0 0 0-6.21 5.855l5.916 5.874a1.11 1.11 0 0 0 1.564 0l5.916-5.874a4.316 4.316 0 0 0 1.108-3.579z" />
      ) : (
        <path d="M15.724 4.22A4.313 4.313 0 0 0 12.192.814a4.269 4.269 0 0 0-3.622 1.13.837.837 0 0 1-1.14 0 4.272 4.272 0 0 0-6.21 5.855l5.916 5.874a1.11 1.11 0 0 0 1.564 0l5.916-5.874a4.316 4.316 0 0 0 1.108-3.579zM8 12.511L2.57 7.108a3.13 3.13 0 0 1 0-4.426 3.111 3.111 0 0 1 4.4 0l.53.526a.707.707 0 0 0 1 0l.53-.526a3.11 3.11 0 0 1 4.4 0 3.13 3.13 0 0 1 0 4.426L8 12.51z" />
      )}
    </svg>
  );
}
