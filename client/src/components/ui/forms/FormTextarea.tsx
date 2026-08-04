import Textarea from "@/components/ui/Textarea";
import { FormBase, type FormControlFunc } from "@/components/ui/forms/FormBase";

export const FormTextarea: FormControlFunc = (props) => {
  return <FormBase {...props}>{(field) => <Textarea {...field} />}</FormBase>;
};
