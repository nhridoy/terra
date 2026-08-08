import { useMemo } from "react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { FormBase, type FormControlFunc } from "./FormBase";

type OTPExtraProps = { otpLength: number };

export const FormOTPInput: FormControlFunc<OTPExtraProps> = ({
  otpLength,
  ...props
}) => {
  const otpSlots = useMemo(
    () =>
      Array.from({ length: otpLength }, (_, i) => ({
        id: `otp-slot-${i}`,
        index: i,
      })),
    [otpLength],
  );

  return (
    <FormBase {...props}>
      {(field) => (
        <div className="flex items-center justify-center">
          <InputOTP
            name={field.name}
            value={field.value as string}
            onChange={(value) =>
              field.onChange(value.replace(/\D/g, "").slice(0, otpLength))
            }
            onBlur={field.onBlur}
            disabled={field.disabled}
            maxLength={otpLength}
          >
            {otpSlots.map(({ id, index }) => (
              <InputOTPGroup key={id}>
                <InputOTPSlot
                  index={index}
                  aria-invalid={field["aria-invalid"]}
                />
              </InputOTPGroup>
            ))}
          </InputOTP>
        </div>
      )}
    </FormBase>
  );
};
