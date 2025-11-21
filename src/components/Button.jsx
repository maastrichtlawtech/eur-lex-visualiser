export const Button = ({ className = "", variant = "default", ...props }) => (
  <button
    className={
      `inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm transition ` +
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

