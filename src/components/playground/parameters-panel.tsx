"use client";

import React, { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info, X } from "lucide-react";

export interface PlaygroundParams {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  stream: boolean;
  stopSequences: string[];
}

export const DEFAULT_PARAMS: PlaygroundParams = {
  temperature: 0.7,
  maxTokens: 2000,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stream: true,
  stopSequences: [],
};

interface ParametersPanelProps {
  params: PlaygroundParams;
  onChange: (params: PlaygroundParams) => void;
}

function ParamTooltip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="More info"
          className="inline-flex items-center justify-center text-muted-foreground/60 hover:text-foreground transition-colors cursor-help"
        >
          <Info className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        align="start"
        className="max-w-[260px] bg-card text-foreground border border-border px-3 py-2 text-xs leading-relaxed normal-case tracking-normal font-normal"
      >
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

function SliderRow({
  label,
  tooltip,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  tooltip: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium tracking-widest uppercase text-muted-foreground">
          {label}
          <ParamTooltip>{tooltip}</ParamTooltip>
        </span>
        <span className="text-xs font-mono text-foreground tabular-nums w-12 text-right">
          {value % 1 === 0 ? value : value.toFixed(step < 0.1 ? 2 : 1)}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        className="w-full"
      />
    </div>
  );
}

export function ParametersPanel({ params, onChange }: ParametersPanelProps) {
  const [stopInput, setStopInput] = useState("");

  const set = <K extends keyof PlaygroundParams>(key: K, value: PlaygroundParams[K]) =>
    onChange({ ...params, [key]: value });

  const addStop = () => {
    const trimmed = stopInput.trim();
    if (!trimmed || params.stopSequences.length >= 4) return;
    if (params.stopSequences.includes(trimmed)) {
      setStopInput("");
      return;
    }
    set("stopSequences", [...params.stopSequences, trimmed]);
    setStopInput("");
  };

  const removeStop = (i: number) => {
    set("stopSequences", params.stopSequences.filter((_, idx) => idx !== i));
  };

  return (
    <TooltipProvider>
      <aside className="flex flex-col gap-0 h-full overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">
            Parameters
          </span>
          <button
            onClick={() => onChange({ ...DEFAULT_PARAMS })}
            className="text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
          >
            Reset
          </button>
        </div>

        {/* Sliders */}
        <div className="flex flex-col gap-5 px-4 py-4">
          <SliderRow
            label="Temperature"
            tooltip={
              <>
                Controls randomness. Lower values (≈ 0.2) make output more
                focused and deterministic; higher values (≈ 1.0+) make it more
                creative and varied. <strong>0</strong> is near-deterministic.
              </>
            }
            value={params.temperature}
            min={0}
            max={2}
            step={0.1}
            onChange={(v) => set("temperature", v)}
          />
          <SliderRow
            label="Max Tokens"
            tooltip={
              <>
                Upper bound on tokens the model can generate in the response.
                One token ≈ 4 characters of English. Lower this to cap cost and
                latency; raise it if responses are getting cut off.
              </>
            }
            value={params.maxTokens}
            min={1000}
            max={32000}
            step={100}
            onChange={(v) => set("maxTokens", v)}
          />
          <SliderRow
            label="Top P"
            tooltip={
              <>
                Nucleus sampling. The model only considers tokens whose
                cumulative probability is within the top P. <strong>1.0</strong>
                {" "}disables filtering; <strong>0.9</strong> trims the
                long-tail. Usually tune either temperature or top P, not both.
              </>
            }
            value={params.topP}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => set("topP", v)}
          />
          <SliderRow
            label="Freq. Penalty"
            tooltip={
              <>
                Discourages tokens that have already appeared often in the
                output. Positive values reduce verbatim repetition; negative
                values encourage it. Range −2 to 2; <strong>0</strong> is off.
              </>
            }
            value={params.frequencyPenalty}
            min={-2}
            max={2}
            step={0.01}
            onChange={(v) => set("frequencyPenalty", v)}
          />
          <SliderRow
            label="Pres. Penalty"
            tooltip={
              <>
                Discourages tokens that have appeared at all (regardless of
                frequency). Positive values push the model to introduce new
                topics; negative values keep it on-topic. Range −2 to 2.
              </>
            }
            value={params.presencePenalty}
            min={-2}
            max={2}
            step={0.01}
            onChange={(v) => set("presencePenalty", v)}
          />
        </div>

        <Separator />

        {/* Stream toggle */}
        <div className="flex items-center justify-between px-4 py-4">
          <span className="flex items-center gap-1.5 text-xs font-medium tracking-widest uppercase text-muted-foreground">
            Stream Response
            <ParamTooltip>
              When on, tokens render as they arrive (lower time-to-first-token,
              feels snappier). When off, the response returns as one complete
              payload — easier to inspect raw JSON but slower to first byte.
            </ParamTooltip>
          </span>
          <Switch
            checked={params.stream}
            onCheckedChange={(v) => set("stream", v)}
          />
        </div>

        <Separator />

        {/* Stop sequences */}
        <div className="flex flex-col gap-3 px-4 py-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase text-muted-foreground">
            Stop Sequences
            <span className="font-normal normal-case text-muted-foreground/60">
              ({params.stopSequences.length}/4)
            </span>
            <ParamTooltip>
              Strings that, when generated, cause the model to stop immediately
              — the stop sequence itself is not included in the output. Useful
              for terminating on a label like <code>&quot;User:&quot;</code> or
              a delimiter like <code>&quot;\n\n&quot;</code>. Up to 4.
            </ParamTooltip>
          </span>

          {/* Chips */}
          {params.stopSequences.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {params.stopSequences.map((seq, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted text-xs font-mono text-foreground"
                >
                  {JSON.stringify(seq)}
                  <button
                    onClick={() => removeStop(i)}
                    className="text-muted-foreground hover:text-foreground transition-colors ml-0.5"
                    aria-label={`Remove stop sequence ${seq}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Input */}
          {params.stopSequences.length < 4 && (
            <div className="flex gap-2">
              <input
                type="text"
                value={stopInput}
                onChange={(e) => setStopInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addStop();
                  }
                }}
                placeholder='e.g. "\n\n"'
                className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono rounded bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-0 transition-colors"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={addStop}
                disabled={!stopInput.trim()}
                className="text-xs px-2.5 h-7 rounded shrink-0"
              >
                Add
              </Button>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
