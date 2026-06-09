import React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  const variants = {
    primary: "bg-lime-400 text-black hover:bg-lime-500 font-bold",
    secondary: "bg-zinc-800 text-white hover:bg-zinc-700",
    outline: "border-2 border-lime-400 text-lime-400 hover:bg-lime-400 hover:text-black",
  };

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg w-full",
  };

  return (
    <button
      className={cn(
        "cursor-pointer transition-all active:scale-95 rounded-full inline-flex items-center justify-center text-center",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
