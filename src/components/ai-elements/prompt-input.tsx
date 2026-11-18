"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CornerDownLeftIcon, Loader2Icon, SquareIcon, XIcon, Paperclip } from "lucide-react";
import type { ComponentProps, FormEvent } from "react";

export type PromptInputMessage = {
  text?: string;
  files?: File[];
};

export type PromptInputProps = Omit<
  ComponentProps<"form">,
  "onSubmit"
> & {
  onSubmit: (message: PromptInputMessage, event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  status?: "submitted" | "streaming" | "ready" | "error";
};

const PromptInputContext = React.createContext<{
  input: string;
  setInput: (value: string) => void;
  files: File[];
  setFiles: (value: File[]) => void;
} | null>(null);

export const PromptInput = ({
  className,
  onSubmit,
  status = "ready",
  children,
  ...props
}: PromptInputProps) => {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (input.trim() || files.length > 0) {
      onSubmit({ text: input, files }, e);
      setInput("");
      setFiles([]);
    }
  };

  return (
    <PromptInputContext.Provider value={{ input, setInput, files, setFiles }}>
      <form
        className={cn(
          "relative w-full rounded border border-border bg-card shadow-sm",
          className
        )}
        onSubmit={handleSubmit}
        {...props}
      >
        {children}
      </form>
    </PromptInputContext.Provider>
  );
};

export type PromptInputBodyProps = ComponentProps<"div">;

export const PromptInputBody = ({ className, ...props }: PromptInputBodyProps) => (
  <div className={cn("flex items-end gap-2 p-3", className)} {...props} />
);

export type PromptInputTextareaProps = ComponentProps<typeof Textarea>;

export const PromptInputTextarea = ({
  onChange,
  className,
  placeholder = "Ask me anything...",
  ...props
}: PromptInputTextareaProps) => {
  const context = React.useContext(PromptInputContext);
  const [isComposing, setIsComposing] = useState(false);

  if (!context) {
    throw new Error("PromptInputTextarea must be used within PromptInput");
  }

  const { input, setInput } = context;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter") {
      if (isComposing || e.nativeEvent.isComposing) {
        return;
      }
      if (e.shiftKey) {
        return;
      }
      e.preventDefault();

      const form = e.currentTarget.form;
      const submitButton = form?.querySelector(
        'button[type="submit"]'
      ) as HTMLButtonElement | null;
      if (submitButton?.disabled) {
        return;
      }

      form?.requestSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    onChange?.(e);
  };

  return (
    <Textarea
      className={cn(
        "flex-1 resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0",
        "field-sizing-content max-h-48 min-h-[60px]",
        className
      )}
      name="message"
      value={input}
      onCompositionEnd={() => setIsComposing(false)}
      onCompositionStart={() => setIsComposing(true)}
      onKeyDown={handleKeyDown}
      onChange={handleChange}
      placeholder={placeholder}
      {...props}
    />
  );
};

export type PromptInputFooterProps = ComponentProps<"div">;

export const PromptInputFooter = ({ className, ...props }: PromptInputFooterProps) => (
  <div className={cn("flex items-center justify-between gap-2 border-t border-border px-3 py-2", className)} {...props} />
);

export type PromptInputToolsProps = ComponentProps<"div">;

export const PromptInputTools = ({ className, ...props }: PromptInputToolsProps) => {
    const context = React.useContext(PromptInputContext);
    if (!context) {
        throw new Error("PromptInputTools must be used within PromptInput");
    }
    const { files, setFiles } = context;
    const [error, setError] = React.useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = React.useState<Record<string, number>>({});

    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'text/plain'];
    const maxFileSize = 5 * 1024 * 1024;
    const maxFiles = 5;
    const uploadFailureRate = 0.1;
    const ERROR_STATE = -1;

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const target = e.target;
        if (target.files) {
            try {
                const filesArray = Array.from(target.files);

                if (filesArray.length > maxFiles) {
                    setError(`Too many files. Maximum allowed: ${maxFiles}.`);
                    return;
                }

                const invalidTypeFiles = filesArray.filter(file => !allowedTypes.includes(file.type));
                const oversizedFiles = filesArray.filter(file => file.size > maxFileSize);

                let errorMessage = '';
                if (invalidTypeFiles.length > 0) {
                    errorMessage += `Invalid file type: ${invalidTypeFiles.map(f => f.name).join(', ')}. Allowed types: JPEG, PNG, PDF, TXT.`;
                }
                if (oversizedFiles.length > 0) {
                    if (errorMessage) errorMessage += ' ';
                    errorMessage += `File too large: ${oversizedFiles.map(f => f.name).join(', ')}. Maximum size: 5MB.`;
                }

                if (errorMessage) {
                    setError(errorMessage);
                } else {
                    setError(null);
                    const progressMap: Record<string, number> = {};
                    filesArray.forEach(file => {
                        progressMap[file.name] = 0;
                    });
                    setUploadProgress(progressMap);

                    filesArray.forEach((file, index) => {
                        setTimeout(() => {
                            if (Math.random() < uploadFailureRate) {
                                setUploadProgress(prev => ({
                                    ...prev,
                                    [file.name]: ERROR_STATE
                                }));
                                setError(`Failed to upload ${file.name}. Please try again.`);
                            } else {
                                setUploadProgress(prev => ({
                                    ...prev,
                                    [file.name]: 100
                                }));

                                if (index === filesArray.length - 1) {
                                    setTimeout(() => {
                                        setFiles(filesArray);
                                    }, 500);
                                }
                            }
                        }, index * 300);
                    });
                }
            } catch {
                setError('An unexpected error occurred while processing files. Please try again.');
                console.error('File upload error');
            }
        }
    };

    return (
        <div className={cn("flex flex-col items-center gap-1", className)} {...props}>
            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                        const fileInput = document.createElement("input");
                        fileInput.type = "file";
                        fileInput.multiple = true;
                        fileInput.onchange = (event) => {
                            void handleFileChange(event as unknown as React.ChangeEvent<HTMLInputElement>);
                        };
                        fileInput.click();
                    }}
                    aria-label="Attach files"
                >
                    <Paperclip className="size-4" aria-hidden="true" />
                    <span className="sr-only">Attach files</span>
                </Button>
                {error && (
                    <p
                        className="text-sm text-destructive"
                        role="alert"
                    >
                        {error}
                    </p>
                )}
            </div>

            {Object.keys(uploadProgress).length > 0 && (
                <div className="flex flex-col items-center gap-2 w-full">
                    {Object.keys(uploadProgress).map((fileName) => (
                        <div key={fileName} className="flex flex-col items-center gap-1 w-full">
                            <span className="text-xs truncate max-w-[100px]">{fileName}</span>
                            <div className="w-full bg-gray-200 rounded-full h-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadProgress[fileName] === ERROR_STATE ? 0 : uploadProgress[fileName]} aria-label={uploadProgress[fileName] === ERROR_STATE ? `${fileName} upload failed` : `${fileName} ${uploadProgress[fileName]}% complete`}>
                                {uploadProgress[fileName] === ERROR_STATE ? (
                                    <div className="bg-red-500 h-2 rounded-full transition-width duration-500" style={{ width: '100%' }}></div>
                                ) : (
                                    <div
                                        className="bg-blue-500 h-2 rounded-full transition-width duration-500"
                                        style={{ width: `${uploadProgress[fileName]}%` }}
                                    ></div>
                                )}
                            </div>
                            <span className="text-xs sr-only">
                                {uploadProgress[fileName] === ERROR_STATE ? 'Failed' : `${uploadProgress[fileName]}% complete`}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex items-center gap-1 w-full">
                {files.map((file, index) => (
                    <div key={index} className="flex items-center gap-1">
                        {file.type.startsWith('image/') ? (
                            <>
                                <img
                                    src={URL.createObjectURL(file)}
                                    alt={`${file.name} preview`}
                                    className="max-w-[100px] max-h-[100px] object-cover rounded border"
                                />
                                <button
                                    onClick={() => {
                                        URL.revokeObjectURL(URL.createObjectURL(file));
                                        const newFiles = [...files];
                                        newFiles.splice(index, 1);
                                        setFiles(newFiles);
                                    }}
                                    className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs"
                                    aria-label="Remove image"
                                >
                                    ✕
                                </button>
                            </>
                        ) : (
                            <>
                                <span className="text-xs truncate max-w-[100px]">{file.name}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Remove file"
                                    onClick={() => {
                                        const newFiles = [...files];
                                        newFiles.splice(index, 1);
                                        setFiles(newFiles);
                                    }}
                                >
                                    <XIcon className="size-3" />
                                    <span className="sr-only">Remove file</span>
                                </Button>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export type PromptInputButtonProps = ComponentProps<typeof Button>;

export const PromptInputButton = ({ className, ...props }: PromptInputButtonProps) => (
  <Button
    className={cn("h-8", className)}
    size="sm"
    type="button"
    variant="ghost"
    {...props}
  />
);

export type PromptInputSubmitProps = ComponentProps<typeof Button> & {
  status?: "submitted" | "streaming" | "ready" | "error";
};

export const PromptInputSubmit = ({
  className,
  variant = "default",
  size = "icon",
  status = "ready",
  children,
  ...props
}: PromptInputSubmitProps) => {
  const context = React.useContext(PromptInputContext);
  const input = context?.input || "";

  let Icon = <CornerDownLeftIcon className="size-4" />;

  if (status === "submitted") {
    Icon = <Loader2Icon className="size-4 animate-spin" />;
  } else if (status === "streaming") {
    Icon = <SquareIcon className="size-4" />;
  } else if (status === "error") {
    Icon = <XIcon className="size-4" />;
  }

  return (
    <Button
      aria-label="Submit"
      className={cn("shrink-0", className)}
      size={size}
      type="submit"
      variant={variant}
      disabled={!input.trim() || status === "streaming"}
      {...props}
    >
      {children ?? Icon}
    </Button>
  );
};

