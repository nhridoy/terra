import type { SelectOption } from "../Select";
import Select from "../Select";
import { FormBase, type FormControlFunc } from "./FormBase";

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
