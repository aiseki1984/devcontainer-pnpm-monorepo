import type { ComponentProps } from "react";
import type { FieldError, UseFormRegisterReturn } from "react-hook-form";

const inputClass =
  "rounded-md border border-black/[.12] bg-transparent px-3 py-2 outline-none focus:border-black dark:border-white/[.2] dark:focus:border-white";

/**
 * ラベル + 入力 + フィールドエラーをまとめた共通フィールド。
 * RHF の register() の戻り値を registration に、対応する fieldError を error に渡す。
 */
export function TextField({
  label,
  registration,
  error,
  ...inputProps
}: {
  label: string;
  registration: UseFormRegisterReturn;
  error?: FieldError;
} & Omit<ComponentProps<"input">, "className">) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input {...inputProps} {...registration} className={inputClass} />
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400">
          {error.message}
        </span>
      )}
    </label>
  );
}
