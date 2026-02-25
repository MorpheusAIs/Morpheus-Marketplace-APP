import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wrench } from 'lucide-react';

export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="flex items-center gap-3 mb-8">
        <Image
          src="/images/mor_mark_white.png"
          alt="Morpheus Logo"
          height={32}
          width={32}
          className="h-8 w-auto"
        />
        <span className="text-2xl font-semibold text-foreground">Morpheus Inference API</span>
      </div>

      <Card className="w-full max-w-[500px] mx-auto bg-card text-card-foreground rounded-lg shadow-lg">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-green-500/10 p-4">
              <Wrench className="h-12 w-12 text-green-500" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-card-foreground">
            Under Maintenance
          </CardTitle>
          <CardDescription className="text-muted-foreground text-base">
            We&apos;re performing some scheduled maintenance to improve your experience.
            The system will be back online shortly.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground text-center leading-relaxed">
            We apologize for the inconvenience. Please check back in a little while —
            we expect to be back up very soon.
          </div>

          <p className="text-xs text-muted-foreground text-center pt-2">
            Thank you for your patience.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
