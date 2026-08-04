import { useId } from "react";
import { cn } from "@/lib/common/utils";

function Field({
  className,
  orientation,
  ...props
}: React.ComponentProps<"div"> & {
  orientation?: "horizontal";
}) {
  return (
    <div
      data-slot="field"
      className={cn(
        "flex gap-2",
        orientation === "horizontal" ? "flex-row items-center" : "flex-col",
        className,
      )}
      {...props}
    />
  );
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  );
}

function FieldLabel({ className, ...props }: React.ComponentProps<"label">) {
  const id = useId();
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: associated via htmlFor at form level
    <label
      data-slot="field-label"
      htmlFor={props.htmlFor || id}
      className={cn(
        "text-sm font-medium text-dark-300 leading-none",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      {...props}
    />
  );
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn("text-xs text-dark-500", className)}
      {...props}
    />
  );
}

function FieldError({
  className,
  errors,
  ...props
}: React.ComponentProps<"p"> & {
  errors?: Array<{ message?: string }>;
}) {
  const message = errors?.[0]?.message;
  if (!message) return null;

  return (
    <p
      data-slot="field-error"
      className={cn("text-xs text-red-400", className)}
      {...props}
    >
      {message}
    </p>
  );
}

export { Field, FieldContent, FieldDescription, FieldError, FieldLabel };
