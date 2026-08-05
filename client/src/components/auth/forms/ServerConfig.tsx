import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { FormInput } from "@/components/ui/forms/FormInput";
import { setApiUrl } from "@/lib/api/auth";
import {
  type ServerUrlSchema,
  serverUrlDefaultValues,
  serverUrlSchema,
} from "@/lib/schema/auth/serverUrlSchema";

export default function ServerConfig() {
  const [isOpen, setIsOpen] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { isValid },
  } = useForm<ServerUrlSchema>({
    defaultValues: serverUrlDefaultValues,
    resolver: zodResolver(serverUrlSchema),
  });

  return (
    <>
      <div className="mt-4 text-center">
        <Button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          variant="ghost"
          className="text-dark-500 hover:text-dark-300 text-xs"
        >
          {isOpen ? "Hide server settings" : "Connect to custom server"}
        </Button>
      </div>

      {isOpen && (
        <div className="mt-4 p-3 bg-dark-800 rounded-lg">
          <form
            onSubmit={handleSubmit(async (data) => {
              await setApiUrl(data.serverUrl || "http://localhost:8080");
            })}
            className="space-y-2"
          >
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <FormInput
                  control={control}
                  name="serverUrl"
                  label="Server URL"
                  placeholder="http://localhost:8080"
                />
              </div>
              <Button
                type="submit"
                disabled={!isValid}
                variant="default"
                size="sm"
                className="h-12"
              >
                Save
              </Button>
            </div>
            <p className="text-dark-500 text-xs">
              Leave empty for default server. Changes take effect on next login.
            </p>
          </form>
        </div>
      )}
    </>
  );
}
