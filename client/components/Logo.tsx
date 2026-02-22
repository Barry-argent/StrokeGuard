import React from 'react';

interface LogoProps {
  className?: string;
  color?: string;
  size?: number | string;
}

export function Logo({ className = "", color = "currentColor", size = 28 }: LogoProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Ear pieces */}
      <circle cx="30" cy="25" r="5" stroke={color} strokeWidth="4"/>
      <circle cx="55" cy="25" r="5" stroke={color} strokeWidth="4"/>
      
      {/* Binaurals and Tubing */}
      <path d="M30 30C30 40 42.5 50 42.5 60" stroke={color} strokeWidth="4" strokeLinecap="round"/>
      <path d="M55 30C55 40 42.5 50 42.5 60" stroke={color} strokeWidth="4" strokeLinecap="round"/>
      <path d="M42.5 60V75" stroke={color} strokeWidth="4" strokeLinecap="round"/>
      
      {/* Pulse wave (ECG style) */}
      <path 
        d="M42.5 75H50L55 85L62 65L68 85L75 75" 
        stroke={color} 
        strokeWidth="4" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      
      {/* Stethoscope Head (Chest piece) */}
      <path d="M75 75V60" stroke={color} strokeWidth="4" strokeLinecap="round"/>
      <circle cx="75" cy="53" r="7" stroke={color} strokeWidth="4"/>
      <circle cx="75" cy="53" r="2" fill={color}/>
    </svg>
  );
}
