import type { SelectOption } from "@/components/ui/Select";
import Select from "@/components/ui/Select";
import { FormBase, type FormControlFunc } from "@/components/ui/forms/FormBase";

export const FormSelect: FormControlFunc<{
  options: SelectOption[];
}> = ({ options, ...props }) => {
  return (
    <FormBase {...props}>
      {({ onChange, value, placeholder, ...field }) => (
        <Select
          {...field}
          value={value}
          onValueChange={onChange}
          options={options}
          placeholder={placeholder}
        />
      )}
    </FormBase>
  );
};
