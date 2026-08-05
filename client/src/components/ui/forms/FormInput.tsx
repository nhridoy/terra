import { FormBase, type FormControlFunc } from "@/components/ui/forms/FormBase";
import Input from "@/components/ui/Input";

export const FormInput: FormControlFunc = (props) => {
  return <FormBase {...props}>{(field) => <Input {...field} />}</FormBase>;
};
