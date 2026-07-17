'use client';

import { use, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Edit, Trash2, Star, Upload, CheckCircle, Tag } from 'lucide-react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Table from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';
import { productsApi, variantsApi, filesApi, categoriesApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { AdminRole, Product, ProductVariant, ProductImage, Category, FileAsset } from '@/types';
import { formatCurrency } from '@/lib/utils';
import MediaCard from '@/components/media/MediaCard';
import MediaMetaModal from '@/components/media/MediaMetaModal';
import ProductForm from '../ProductForm';

// ─── Variant Form ──────────────────────────────────────────────────────────────

function VariantForm({
  productId,
  variant,
  onSuccess,
}: {
  productId: string;
  variant?: ProductVariant;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit } = useForm({
    defaultValues: {
      name: variant?.name ?? '',
      sku: variant?.sku ?? '',
      plu: variant?.plu ?? '',
      barcode: variant?.barcode ?? '',
      posProductId: (variant as any)?.posProductId ?? '',
      price: variant?.price ?? 0,
      stock: variant?.stock ?? 0,
      costPrice: 0,
      isDefault: variant?.isDefault ?? false,
      isActive: variant?.isActive ?? true,
    },
  });

  const onSubmit = async (data: Record<string, unknown>) => {
    setLoading(true);
    try {
      if (variant) {
        await variantsApi.update(variant.id, data);
      } else {
        await variantsApi.create({ ...data, productId });
      }
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit as never)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Name" placeholder="e.g. Red" {...register('name')} />
        <Input label="SKU" placeholder="SKU-001" {...register('sku')} />
        <Input label="Price" type="number" step="0.01" min="0" {...register('price')} />
        <Input label="Stock" type="number" min="0" {...register('stock')} />
        <Input label="Cost Price" type="number" step="0.01" min="0" {...register('costPrice')} />
        <Input label="Barcode" placeholder="528500195338" {...register('barcode')} />
        <Input label="PLU" placeholder="FK-001" {...register('plu')} />
      </div>
      <div className="grid grid-cols-1 gap-4">
        <Input
          label="POS Product ID"
          placeholder="e.g. 1533"
          hint="From Omega Software — used for automatic stock sync when importing POS sales"
          {...register('posProductId')}
        />
      </div>
      <div className="flex gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="rounded" {...register('isDefault')} />
          <span className="text-sm text-slate-700">Set as Default</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="rounded" {...register('isActive')} />
          <span className="text-sm text-slate-700">Active</span>
        </label>
      </div>
      <div className="flex justify-end pt-2">
        <Button type="submit" loading={loading}>
          {variant ? 'Save Changes' : 'Add Variant'}
        </Button>
      </div>
    </form>
  );
}

// ─── Image Card ────────────────────────────────────────────────────────────────

function ImageCard({
  img,
  variants,
  canEdit,
  onSetPrimary,
  onRemove,
  onAssignVariant,
  onEditDetails,
}: {
  img: ProductImage;
  variants: ProductVariant[];
  canEdit: boolean;
  onSetPrimary: () => void;
  onRemove: () => void;
  onAssignVariant: (variantId: string | null) => void;
  onEditDetails: () => void;
}) {
  const assignedVariant = variants.find((v) => v.id === img.variantId);

  return (
    <MediaCard
      file={img.file}
      canEdit={canEdit}
      onEditDetails={onEditDetails}
      badges={
        <>
          {img.isPrimary && (
            <div className="absolute top-1.5 left-1.5 bg-indigo-600 rounded-full p-0.5">
              <Star size={10} className="text-white" fill="white" />
            </div>
          )}
          {img.variantId && (
            <div className="absolute top-1.5 right-1.5 bg-amber-500 rounded-full p-0.5">
              <Tag size={10} className="text-white" />
            </div>
          )}
        </>
      }
      actions={
        <>
          {!img.isPrimary && (
            <button
              type="button"
              onClick={onSetPrimary}
              className="text-[11px] text-white bg-indigo-600 rounded px-2 py-1 hover:bg-indigo-700 transition-colors"
            >
              Set Primary
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="text-[11px] text-white bg-red-600 rounded px-2 py-1 hover:bg-red-700 transition-colors"
          >
            Remove
          </button>
        </>
      }
      footer={
        canEdit && variants.length > 0 ? (
          <div className="p-2 border-t border-slate-200">
            <select
              className="w-full text-[11px] border border-slate-200 rounded px-1.5 py-1 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={img.variantId ?? ''}
              onChange={(e) => onAssignVariant(e.target.value || null)}
            >
              <option value="">All variants</option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name || 'Default'}
                </option>
              ))}
            </select>
            {assignedVariant && (
              <p className="mt-1 text-[10px] text-amber-600 font-medium truncate">
                Tagged: {assignedVariant.name || 'Default'}
              </p>
            )}
          </div>
        ) : null
      }
    />
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const admin = useAuthStore((s) => s.admin);
  const canEdit = admin?.role === AdminRole.SUPER_ADMIN || admin?.role === AdminRole.ADMIN;

  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddVariantModal, setShowAddVariantModal] = useState(false);
  const [editVariant, setEditVariant] = useState<ProductVariant | null>(null);
  const [deleteVariantId, setDeleteVariantId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [metaFile, setMetaFile] = useState<FileAsset | null>(null);

  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ['product', id],
    queryFn: () => productsApi.findOne(id),
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: categoriesApi.findAll,
  });

  const { data: variants, isLoading: variantsLoading } = useQuery<ProductVariant[]>({
    queryKey: ['variants', id],
    queryFn: () => variantsApi.findByProduct(id),
  });

  const setDefaultMutation = useMutation({
    mutationFn: (variantId: string) => variantsApi.setDefault(variantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variants', id] });
      toast('Default variant updated', 'success');
    },
  });

  const deleteVariantMutation = useMutation({
    mutationFn: (variantId: string) => variantsApi.delete(variantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variants', id] });
      toast('Variant deleted', 'success');
      setDeleteVariantId(null);
    },
    onError: () => toast('Failed to delete variant', 'error'),
  });

  const setPrimaryImageMutation = useMutation({
    mutationFn: (imageId: string) => productsApi.setPrimaryImage(id, imageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      toast('Primary image set', 'success');
    },
  });

  const removeImageMutation = useMutation({
    mutationFn: (imageId: string) => productsApi.removeImage(id, imageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      toast('Image removed', 'success');
    },
  });

  const assignVariantMutation = useMutation({
    mutationFn: ({ imageId, variantId }: { imageId: string; variantId: string | null }) =>
      productsApi.assignImageVariant(id, imageId, variantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      toast('Image variant updated', 'success');
    },
    onError: () => toast('Failed to assign variant', 'error'),
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await filesApi.upload(file);
      await productsApi.addImage(id, uploaded.id);
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      toast('Image uploaded', 'success');
    } catch {
      toast('Failed to upload image', 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Loading..." />
        <div className="flex-1 p-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  if (!product) return null;

  const allVariants = variants ?? [];

  return (
    <div className="flex flex-col h-full">
      <Header title={product.name} subtitle="Product details & management" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <Link
          href="/products"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft size={16} /> Back to Products
        </Link>

        {/* Info Card */}
        <div className="rounded-xl bg-white border border-slate-200 p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{product.name}</h2>
              <p className="text-sm text-slate-500 font-mono">/{product.slug}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={product.isActive ? 'success' : 'default'}>
                {product.isActive ? 'Active' : 'Inactive'}
              </Badge>
              {product.isFeatured && <Badge variant="info">Featured</Badge>}
              {canEdit && (
                <Button size="sm" variant="outline" onClick={() => setShowEditModal(true)}>
                  <Edit size={14} /> Edit
                </Button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Category: </span>
              <span className="font-medium">{product.category?.name ?? '—'}</span>
            </div>
            <div>
              <span className="text-slate-500">Images: </span>
              <span className="font-medium">{product.images?.length ?? 0}</span>
            </div>
            {product.description && (
              <div className="col-span-2">
                <p className="text-slate-500 mb-1">Description</p>
                <p className="text-slate-700">{product.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Images */}
        <div className="rounded-xl bg-white border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-slate-900">Product Images</h3>
            {canEdit && (
              <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                <input type="file" accept="image/*" className="sr-only" onChange={handleImageUpload} />
                <Upload size={14} />
                {uploading ? 'Uploading...' : 'Upload Image'}
              </label>
            )}
          </div>
          {allVariants.length > 0 && (
            <p className="text-xs text-slate-400 mb-4">
              Use the dropdown under each image to assign it to a specific variant (e.g. Red, Blue). Leave as "All variants" for shared images.
            </p>
          )}
          {!product.images?.length ? (
            <p className="text-sm text-slate-400 py-6 text-center">No images uploaded yet</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-3">
              {product.images.map((img) => (
                <ImageCard
                  key={img.id}
                  img={img}
                  variants={allVariants}
                  canEdit={canEdit}
                  onSetPrimary={() => setPrimaryImageMutation.mutate(img.id)}
                  onRemove={() => removeImageMutation.mutate(img.id)}
                  onAssignVariant={(variantId) =>
                    assignVariantMutation.mutate({ imageId: img.id, variantId })
                  }
                  onEditDetails={() => setMetaFile(img.file)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Variants */}
        <div className="rounded-xl bg-white border border-slate-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900">Variants</h3>
            {canEdit && (
              <Button size="sm" onClick={() => setShowAddVariantModal(true)}>
                <Plus size={14} /> Add Variant
              </Button>
            )}
          </div>
          <Table<ProductVariant>
            columns={[
              {
                key: 'name',
                header: 'Name',
                render: (v) => (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{v.name || 'Default'}</span>
                    {v.isDefault && <Badge variant="info" className="text-[10px]">Default</Badge>}
                  </div>
                ),
              },
              {
                key: 'sku',
                header: 'SKU',
                render: (v) => <span className="font-mono text-xs text-slate-600">{v.sku || '—'}</span>,
              },
              {
                key: 'price',
                header: 'Price',
                render: (v) => <span className="font-semibold">{formatCurrency(Number(v.price))}</span>,
              },
              {
                key: 'stock',
                header: 'Stock',
                render: (v) => (
                  <span className={v.stock <= 5 ? 'text-red-600 font-semibold' : ''}>
                    {v.stock}{v.stock <= 5 && v.stock > 0 ? ' ⚠' : v.stock === 0 ? ' ❌' : ''}
                  </span>
                ),
              },
              {
                key: 'images',
                header: 'Images',
                render: (v) => {
                  const count = product.images?.filter((img) => img.variantId === v.id).length ?? 0;
                  return (
                    <span className={count > 0 ? 'text-amber-600 font-medium' : 'text-slate-400'}>
                      {count > 0 ? `${count} tagged` : 'Shared'}
                    </span>
                  );
                },
              },
              {
                key: 'isActive',
                header: 'Status',
                render: (v) => (
                  <Badge variant={v.isActive ? 'success' : 'default'}>
                    {v.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                ),
              },
              {
                key: 'actions',
                header: '',
                className: 'w-28',
                render: (v) =>
                  canEdit ? (
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditVariant(v)}>
                        <Edit size={14} />
                      </Button>
                      {!v.isDefault && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-indigo-500 hover:text-indigo-700"
                          title="Set as Default"
                          onClick={() => setDefaultMutation.mutate(v.id)}
                        >
                          <CheckCircle size={14} />
                        </Button>
                      )}
                      {admin?.role === AdminRole.SUPER_ADMIN && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => setDeleteVariantId(v.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  ) : null,
              },
            ]}
            data={allVariants}
            keyExtractor={(v) => v.id}
            loading={variantsLoading}
            emptyMessage="No variants found"
          />
        </div>
      </div>

      {/* Image details (title / alt / caption) */}
      <MediaMetaModal
        file={metaFile}
        open={!!metaFile}
        onClose={() => setMetaFile(null)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['product', id] })}
      />

      {/* Edit Product */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Product" size="lg">
        <ProductForm
          categories={categories ?? []}
          product={product}
          onSuccess={() => {
            setShowEditModal(false);
            queryClient.invalidateQueries({ queryKey: ['product', id] });
            toast('Product updated', 'success');
          }}
        />
      </Modal>

      {/* Add / Edit Variant */}
      <Modal
        open={showAddVariantModal || !!editVariant}
        onClose={() => { setShowAddVariantModal(false); setEditVariant(null); }}
        title={editVariant ? 'Edit Variant' : 'Add Variant'}
        size="md"
      >
        <VariantForm
          productId={id}
          variant={editVariant ?? undefined}
          onSuccess={() => {
            setShowAddVariantModal(false);
            setEditVariant(null);
            queryClient.invalidateQueries({ queryKey: ['variants', id] });
            toast(editVariant ? 'Variant updated' : 'Variant added', 'success');
          }}
        />
      </Modal>

      {/* Delete Variant Confirm */}
      <Modal open={!!deleteVariantId} onClose={() => setDeleteVariantId(null)} title="Delete Variant" size="sm">
        <p className="text-sm text-slate-600">Delete this variant? This cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteVariantId(null)}>Cancel</Button>
          <Button
            variant="danger"
            loading={deleteVariantMutation.isPending}
            onClick={() => deleteVariantId && deleteVariantMutation.mutate(deleteVariantId)}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
