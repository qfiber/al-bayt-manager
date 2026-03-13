import { useState, useMemo } from 'react';

const DEFAULT_PAGE_SIZE = 20;

interface UsePaginatedSearchOptions<T> {
  items: T[];
  searchFields: (keyof T)[];
  pageSize?: number;
}

export function usePaginatedSearch<T>({ items, searchFields, pageSize = DEFAULT_PAGE_SIZE }: UsePaginatedSearchOptions<T>) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(item =>
      searchFields.some(field => {
        const val = item[field];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [items, search, searchFields]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  return {
    search,
    setSearch: handleSearch,
    page: safePage,
    setPage,
    totalPages,
    totalFiltered: filtered.length,
    paginated,
    hasPrevious: safePage > 1,
    hasNext: safePage < totalPages,
    onPrevious: () => setPage(p => Math.max(1, p - 1)),
    onNext: () => setPage(p => Math.min(totalPages, p + 1)),
  };
}
