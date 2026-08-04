import Checkbox from "@/components/ui/Checkbox";
import { FormBase, type FormControlFunc } from "@/components/ui/forms/FormBase";

export const FormCheckbox: FormControlFunc = (props) => {
  return (
    <FormBase {...props} horizontal controlFirst>
      {({ onChange, value, type, ...field }) => (
        <Checkbox {...field} checked={value} onCheckedChange={onChange} />
      )}
    </FormBase>
  );
};
