'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Tag, ChevronRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import MediaUploadField from '@/components/media/MediaUploadField';
import { categoriesApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { AdminRole, Category, FileAsset } from '@/types';
import { useForm } from 'react-hook-form';

function CategoryForm({
  categories,
  category,
  onSuccess,
}: {
  categories: Category[];
  category?: Category;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<FileAsset | null>(category?.image ?? null);
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      name: category?.name ?? '',
      slug: category?.slug ?? '',
      description: category?.description ?? '',
      parentId: category?.parentId ?? '',
      isActive: category?.isActive ?? true,
    },
  });

  const parentOptions = categories
    .filter((c) => c.id !== category?.id)
    .map((c) => ({ value: c.id, label: c.name }));

  const onSubmit = async (data: Record<string, unknown>) => {
    setLoading(true);
    try {
      // The image lives outside react-hook-form (it's uploaded, not typed), so
      // it's merged in here. `null` clears an existing image; the API's
      // emptyToUndefined transform would swallow an empty string.
      const payload = { ...data, imageId: image?.id ?? null };
      if (category) {
        await categoriesApi.update(category.id, payload);
      } else {
        await categoriesApi.create(payload);
      }
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit as never)} className="space-y-4">
      <Input label="Name" placeholder="e.g. Electronics" required {...register('name')} />
      <Input label="Slug" placeholder="electronics" {...register('slug')} />
      <Textarea label="Description" placeholder="Category description..." {...register('description')} />
      <MediaUploadField
        label="Category Image"
        value={image}
        onChange={setImage}
        entity="Category"
        entityId={category?.id}
        hint="Shown on category pages and in navigation."
      />
      <Select
        label="Parent Category"
        options={parentOptions}
        placeholder="None (top-level)"
        {...register('parentId')}
      />
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" className="rounded" defaultChecked {...register('isActive')} />
        <span className="text-sm text-slate-700">Active</span>
      </label>
      <div className="flex justify-end pt-2">
        <Button type="submit" loading={loading}>
          {category ? 'Save Changes' : 'Create Category'}
        </Button>
      </div>
    </form>
  );
}

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const admin = useAuthStore((s) => s.admin);
  const canEdit = admin?.role === AdminRole.SUPER_ADMIN || admin?.role === AdminRole.ADMIN;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: categoriesApi.findAll,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoriesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast('Category deleted', 'success');
      setDeleteId(null);
    },
    onError: () => toast('Failed to delete category', 'error'),
  });

  // Build display: group children under parents
  const topLevel = categories?.filter((c) => !c.parentId) ?? [];
  const childrenOf = (parentId: string) => categories?.filter((c) => c.parentId === parentId) ?? [];

  const renderCategory = (cat: Category, depth = 0) => (
    <div key={cat.id}>
      <div className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 ${depth > 0 ? 'pl-10' : ''}`}>
        {depth > 0 && <ChevronRight size={14} className="text-slate-400 -ml-4 shrink-0" />}
        {cat.image?.url ? (
          <img
            src={cat.image.url}
            alt={cat.image.altText ?? ''}
            className="h-8 w-8 shrink-0 rounded-lg object-cover bg-slate-100"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 shrink-0">
            <Tag size={14} className="text-indigo-600" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900">{cat.name}</p>
          <p className="text-xs text-slate-500 font-mono">/{cat.slug}</p>
        </div>
        {cat.description && (
          <p className="hidden md:block text-xs text-slate-400 max-w-xs truncate">{cat.description}</p>
        )}
        {cat._count && (
          <span className="text-xs text-slate-500">{cat._count.products} products</span>
        )}
        <Badge variant={cat.isActive ? 'success' : 'default'} className="shrink-0">
          {cat.isActive ? 'Active' : 'Inactive'}
        </Badge>
        {canEdit && (
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="ghost" onClick={() => setEditCategory(cat)}>
              <Edit size={14} />
            </Button>
            {admin?.role === AdminRole.SUPER_ADMIN && (
              <Button
                size="sm"
                variant="ghost"
                className="text-red-500 hover:text-red-700"
                onClick={() => setDeleteId(cat.id)}
              >
                <Trash2 size={14} />
              </Button>
            )}
          </div>
        )}
      </div>
      {childrenOf(cat.id).map((child) => renderCategory(child, depth + 1))}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <Header title="Categories" subtitle="Manage product categories" />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">{categories?.length ?? 0} categories</p>
          {canEdit && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus size={16} /> New Category
            </Button>
          )}
        </div>

        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
          {/* Header row */}
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div className="w-8 shrink-0" />
            <p className="flex-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Name</p>
            <p className="hidden md:block text-xs font-semibold uppercase tracking-wider text-slate-500 max-w-xs w-full">Description</p>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 w-20">Products</p>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 w-16">Status</p>
            <div className="w-16 shrink-0" />
          </div>

          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
                <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-200" />
                <div className="flex-1 h-4 animate-pulse rounded bg-slate-200" />
              </div>
            ))
          ) : topLevel.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-slate-400">No categories yet</p>
          ) : (
            topLevel.map((cat) => renderCategory(cat))
          )}
        </div>
      </div>

      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Category" size="md">
        <CategoryForm
          categories={categories ?? []}
          onSuccess={() => {
            setShowCreateModal(false);
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            toast('Category created', 'success');
          }}
        />
      </Modal>

      <Modal open={!!editCategory} onClose={() => setEditCategory(null)} title="Edit Category" size="md">
        {editCategory && (
          <CategoryForm
            categories={categories ?? []}
            category={editCategory}
            onSuccess={() => {
              setEditCategory(null);
              queryClient.invalidateQueries({ queryKey: ['categories'] });
              toast('Category updated', 'success');
            }}
          />
        )}
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Category" size="sm">
        <p className="text-sm text-slate-600">Delete this category? Products in this category will be uncategorized.</p>
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
