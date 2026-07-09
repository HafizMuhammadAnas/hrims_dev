import { useCallback, useState } from 'react'

export type SortDirection = 'asc' | 'desc'

export type UseClientTableStateOptions<SortKey extends string> = {
  /**
   * Rows per page. Omit or set to `0` to disable slicing (all rows shown).
   */
  pageSize?: number
  initialPage?: number
  initialSearch?: string
  initialSortKey?: SortKey
  initialSortDir?: SortDirection
  initialFilters?: Record<string, string>
}

export type PaginatedSlice<T> = {
  pageRows: T[]
  totalPages: number
  totalItems: number
  effectivePage: number
}

/** Pure helper: slice `processed` for the current page, clamping page to valid range. */
export function derivePaginatedRows<T>(processed: T[], page: number, pageSize: number): PaginatedSlice<T> {
  const totalItems = processed.length
  if (!pageSize || pageSize <= 0) {
    return {
      pageRows: processed,
      totalPages: 1,
      totalItems,
      effectivePage: 1,
    }
  }
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const effectivePage = Math.min(Math.max(1, page), totalPages)
  const pageRows = processed.slice((effectivePage - 1) * pageSize, effectivePage * pageSize)
  return { pageRows, totalPages, totalItems, effectivePage }
}

/**
 * Shared client-side table UI state: search, string filters, sort, and page index.
 * Domain pages still own `useMemo` filter/sort of row arrays; this hook only holds controls + paging.
 */
export function useClientTableState<SortKey extends string>(
  options: UseClientTableStateOptions<SortKey> = {},
) {
  const {
    pageSize = 0,
    initialPage = 1,
    initialSearch = '',
    initialSortKey,
    initialSortDir = 'desc',
    initialFilters = {},
  } = options

  const [search, setSearchState] = useState(initialSearch)
  const [filters, setFiltersState] = useState<Record<string, string>>(initialFilters)
  const [sortState, setSortState] = useState<{ key?: SortKey; dir: SortDirection }>({
    key: initialSortKey,
    dir: initialSortDir,
  })
  const [page, setPage] = useState(initialPage)

  const sortKey = sortState.key
  const sortDir = sortState.dir

  const setSearch = useCallback((value: string) => {
    setSearchState(value)
    setPage(1)
  }, [])

  const setFilter = useCallback((key: string, value: string) => {
    setFiltersState((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }, [])

  const resetFilters = useCallback(() => {
    setFiltersState({})
    setPage(1)
  }, [])

  const toggleSort = useCallback((key: SortKey) => {
    setPage(1)
    setSortState((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'desc' },
    )
  }, [])

  const setSortKey = useCallback((key: SortKey | undefined) => {
    setSortState((prev) => ({ ...prev, key }))
  }, [])

  const setSortDir = useCallback((dir: SortDirection) => {
    setSortState((prev) => ({ ...prev, dir }))
  }, [])

  return {
    search,
    setSearch,
    filters,
    setFilter,
    setFilters: setFiltersState,
    resetFilters,
    sortKey,
    sortDir,
    setSortKey,
    setSortDir,
    toggleSort,
    page,
    setPage,
    pageSize,
  }
}
