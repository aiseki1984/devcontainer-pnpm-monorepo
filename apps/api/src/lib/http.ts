/** Postgres の serial（int4）の最大値。これを超える id をクエリに渡すと範囲外エラーになる。 */
const PG_INT4_MAX = 2_147_483_647;

/**
 * path param の id を正の整数（int4 範囲内）として検証する。不正なら null。
 * 範囲外を許すと getXById 等のクエリで "value out of range for type integer" が
 * 投げられ、400/404 ではなく 500 になってしまう。
 */
export function parseId(raw: string | undefined): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id >= 1 && id <= PG_INT4_MAX ? id : null;
}

/**
 * ページネーション付き一覧のレスポンス本体を組み立てる。
 * 一覧エンドポイントで共通の { ok, data, pagination } 形と totalPages 計算を1か所に集約する。
 */
export function paginatedBody<T>(
  rows: T[],
  { page, perPage, total }: { page: number; perPage: number; total: number },
) {
  return {
    ok: true as const,
    data: rows,
    pagination: {
      page,
      perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
    },
  };
}
