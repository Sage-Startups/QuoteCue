"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resetDemoAction } from "@/app/demo/actions";

export function DemoResetButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={pending}
      onClick={() =>
        start(async () => {
          const result = await resetDemoAction();
          if (result.ok) {
            toast.success("Demo data reset");
            router.refresh();
          } else toast.error(result.error);
        })
      }
    >
      <RotateCcw /> Reset demo
    </Button>
  );
}
