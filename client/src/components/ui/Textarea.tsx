import { forwardRef } from "react";
import { cn } from "@/lib/common/utils";

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full bg-dark-800 text-white px-4 py-3 rounded-lg resize-y",
          "focus:outline-none focus:ring-2 focus:ring-primary-500",
          "placeholder:text-dark-500",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className,
        )}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";

export default Textarea;
