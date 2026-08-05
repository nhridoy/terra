import { FormBase, type FormControlFunc } from "@/components/ui/forms/FormBase";
import Textarea from "@/components/ui/Textarea";

export const FormTextarea: FormControlFunc = (props) => {
  return <FormBase {...props}>{(field) => <Textarea {...field} />}</FormBase>;
};
