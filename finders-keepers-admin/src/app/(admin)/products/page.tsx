'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Package, Edit, Trash2, Image as ImageIcon, Filter } from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toast';
import { productsApi, categoriesApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { AdminRole, Product, Category, PaginatedResponse } from '@/types';
import ProductForm from './ProductForm';

const ACTIVE_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
];

const FEATURED_OPTIONS = [
  { value: '', label: 'All Products' },
  { value: 'true', label: 'Featured' },
  { value: 'false', label: 'Not Featured' },
];

const PAGE_LIMIT = 20;

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const admin = useAuthStore((s) => s.admin);
  const canEdit = admin?.role === AdminRole.SUPER_ADMIN || admin?.role === AdminRole.ADMIN;

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState('');
  const [isFeaturedFilter, setIsFeaturedFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const resetPage = useCallback(() => setPage(1), []);

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: categoriesApi.findAll,
  });

  const categoryOptions = [
    { value: '', label: 'All Categories' },
    ...(categories ?? []).map((c) => ({ value: c.id, label: c.name })),
  ];

  const params: Record<string, unknown> = { page, limit: PAGE_LIMIT };
  if (search) params.search = search;
  if (categoryId) params.categoryId = categoryId;
  if (isActiveFilter !== '') params.isActive = isActiveFilter === 'true';
  if (isFeaturedFilter !== '') params.isFeatured = isFeaturedFilter === 'true';

  const { data: response, isLoading } = useQuery<PaginatedResponse<Product>>({
    queryKey: ['products', search, categoryId, isActiveFilter, isFeaturedFilter, page],
    queryFn: () => productsApi.findAll(params),
  });

  const products = response?.data ?? [];
  const meta = response?.meta;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => productsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast('Product deleted', 'success');
      setDeleteId(null);
    },
    onError: () => toast('Failed to delete product', 'error'),
  });

  const activeFilters = [search, categoryId, isActiveFilter, isFeaturedFilter].filter(Boolean).length;

  return (
    <div className="flex flex-col h-full">
      <Header title="Products" subtitle="Manage your product catalogue" />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-48 max-w-sm">
            <Input
              placeholder="Search products, SKU, barcode..."
              leftIcon={<Search size={16} />}
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            />
          </div>
          <div className="w-44">
            <Select
              options={categoryOptions}
              value={categoryId}
              onChange={(e) => { setCategoryId(e.target.value); resetPage(); }}
            />
          </div>
          <div className="w-36">
            <Select
              options={ACTIVE_OPTIONS}
              value={isActiveFilter}
              onChange={(e) => { setIsActiveFilter(e.target.value); resetPage(); }}
            />
          </div>
          <div className="w-36">
            <Select
              options={FEATURED_OPTIONS}
              value={isFeaturedFilter}
              onChange={(e) => { setIsFeaturedFilter(e.target.value); resetPage(); }}
            />
          </div>
          {activeFilters > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSearch(''); setCategoryId(''); setIsActiveFilter(''); setIsFeaturedFilter(''); resetPage(); }}
              className="text-slate-500"
            >
              <Filter size={14} /> Clear ({activeFilters})
            </Button>
          )}
          {canEdit && (
            <Button onClick={() => setShowCreateModal(true)} className="ml-auto">
              <Plus size={16} /> New Product
            </Button>
          )}
        </div>

        {/* Table */}
        <Table<Product>
          columns={[
            {
              key: 'name',
              header: 'Product',
              render: (row) => (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden">
                    {row.images?.[0] ? (
                      <img src={row.images[0].file?.url} alt={row.name} className="h-full w-full object-cover" />
                    ) : (
                      <Package size={16} className="text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">{row.name}</p>
                    <p className="text-xs text-slate-500 truncate">{row.slug}</p>
                  </div>
                </div>
              ),
            },
            {
              key: 'category',
              header: 'Category',
              render: (row) => row.category?.name ?? <span className="text-slate-400">—</span>,
            },
            {
              key: 'variants',
              header: 'Variants',
              render: (row) => (
                <span className="text-slate-600">{row._count?.variants ?? row.variants?.length ?? 0}</span>
              ),
            },
            {
              key: 'images',
              header: 'Images',
              render: (row) => (
                <div className="flex items-center gap-1">
                  <ImageIcon size={14} className="text-slate-400" />
                  <span>{row.images?.length ?? 0}</span>
                </div>
              ),
            },
            {
              key: 'isActive',
              header: 'Status',
              render: (row) => (
                <Badge variant={row.isActive ? 'success' : 'default'}>
                  {row.isActive ? 'Active' : 'Inactive'}
                </Badge>
              ),
            },
            {
              key: 'isFeatured',
              header: 'Featured',
              render: (row) => row.isFeatured ? <Badge variant="info">Featured</Badge> : <span className="text-slate-400">—</span>,
            },
            {
              key: 'actions',
              header: '',
              className: 'w-20',
              render: (row) => (
                <div className="flex items-center gap-1">
                  <Link href={`/products/${row.id}`}>
                    <Button size="sm" variant="ghost">
                      <Edit size={14} />
                    </Button>
                  </Link>
                  {canEdit && admin?.role === AdminRole.SUPER_ADMIN && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={(e) => { e.stopPropagation(); setDeleteId(row.id); }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
          data={products}
          keyExtractor={(row) => row.id}
          loading={isLoading}
          emptyMessage="No products found"
          onRowClick={(row) => { if (canEdit) window.location.href = `/products/${row.id}`; }}
        />

        {meta && meta.totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={meta.totalPages}
            total={meta.total}
            limit={PAGE_LIMIT}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* Create Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Product" size="lg">
        <ProductForm
          categories={categories ?? []}
          onSuccess={() => {
            setShowCreateModal(false);
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast('Product created', 'success');
          }}
        />
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Product" size="sm">
        <p className="text-sm text-slate-600">Are you sure you want to delete this product? This action cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={() => deleteId && deleteMutation.mutate(deleteId)}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
