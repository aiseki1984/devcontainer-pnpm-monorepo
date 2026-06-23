export type ErrorBody = {
  error?: string;
  errors?: Record<string, string[]>;
};

/** api の {error} / {errors: fieldErrors} を 1 つの表示メッセージに整える。 */
export function toErrorMessage(
  data: ErrorBody | null,
  fallback: string,
): string {
  if (data?.error) return data.error;
  const first = data?.errors && Object.values(data.errors)[0]?.[0];
  return first ?? fallback;
}
