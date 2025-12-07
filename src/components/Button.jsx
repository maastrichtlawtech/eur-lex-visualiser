export const Button = ({ className = "", variant = "default", size = "default", ...props }) => (
  <button
    className={
      `inline-flex items-center justify-center gap-2 rounded-xl text-sm transition ` +
      (size === "sm" ? "px-2 py-1.5 text-xs " : "px-3 py-2 ") +
      (variant === "outline"
        ? "border border-gray-300 bg-white hover:bg-gray-50"
        : variant === "ghost"
        ? "bg-transparent hover:bg-gray-100"
        : "bg-black text-white hover:bg-gray-900") +
      " " +
      className
    }
    {...props}
  />
);

