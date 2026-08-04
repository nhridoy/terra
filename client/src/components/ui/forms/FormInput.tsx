import Input from "@/components/ui/Input";
import { FormBase, type FormControlFunc } from "@/components/ui/forms/FormBase";

export const FormInput: FormControlFunc = (props) => {
  return <FormBase {...props}>{(field) => <Input {...field} />}</FormBase>;
};
