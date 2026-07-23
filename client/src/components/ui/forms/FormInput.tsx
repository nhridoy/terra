import Input from "../Input";
import { FormBase, type FormControlFunc } from "./FormBase";

export const FormInput: FormControlFunc = (props) => {
  return <FormBase {...props}>{(field) => <Input {...field} />}</FormBase>;
};
