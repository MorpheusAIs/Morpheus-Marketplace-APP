"use client";

import { useState } from "react";
import { useCognitoAuth } from "@/lib/auth/CognitoAuthContext";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

export function AgeVerificationGate() {
  const { verifyAge } = useCognitoAuth();
  const [checked, setChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!checked) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await verifyAge();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-2xl mx-4">
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
            <ShieldCheck className="h-6 w-6 text-green-500" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Age Verification Required</h2>
          <p className="text-sm text-muted-foreground text-center">
            Before accessing the platform, please confirm you meet the minimum age requirement.
          </p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer mb-6">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => {
              setChecked(e.target.checked);
              if (e.target.checked) setError(null);
            }}
            className="mt-0.5 h-4 w-4 shrink-0 accent-green-500 cursor-pointer"
          />
          <span className="text-sm text-muted-foreground leading-relaxed">
            <em>
              I certify that I am at least 18 years old and the minimum age required in my
              country to consent to use the Services.
            </em>
          </span>
        </label>

        {error && (
          <p className="mb-4 text-sm text-destructive text-center">{error}</p>
        )}

        <Button
          className="w-full bg-green-600 hover:bg-green-700 text-white"
          disabled={!checked || isSubmitting}
          onClick={handleConfirm}
        >
          {isSubmitting ? "Confirming…" : "Confirm & Continue"}
        </Button>
      </div>
    </div>
  );
}
