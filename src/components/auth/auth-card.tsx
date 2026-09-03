import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AuthCard({ title, description, children, footer }: { title: string; description?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <Card className="shadow-elevated">
      <CardHeader>
        <CardTitle className="text-2xl font-bold tracking-tight">{title}</CardTitle>
        {description ? <CardDescription className="text-base">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
      {footer ? <div className="border-t px-6 py-4 text-center text-sm text-muted-foreground">{footer}</div> : null}
    </Card>
  );
}
