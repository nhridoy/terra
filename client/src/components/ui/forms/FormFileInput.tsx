import FileInput from "@/components/ui/FileInput";
import { FormBase, type FormControlFunc } from "@/components/ui/forms/FormBase";

export const FormFileInput: FormControlFunc<{
  accept?: Record<string, string[]>;
  maxSize?: number;
  description?: string;
}> = ({ accept, maxSize, description, ...props }) => {
  return (
    <FormBase {...props}>
      {({ onChange, value, type, ...field }) => (
        <FileInput
          {...field}
          value={value}
          onValueChange={onChange}
          accept={accept}
          maxSize={maxSize}
          description={description}
        />
      )}
    </FormBase>
  );
};
