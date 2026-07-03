'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { productsApi } from '@/lib/api';
import type { Category, Product } from '@/types';

const variantSchema = z.object({
  name: z.string().optional(),
  sku: z.string().optional(),
  price: z.coerce.number().min(0),
  costPrice: z.coerce.number().min(0).optional(),
  stock: z.coerce.number().min(0).optional(),
  isDefault: z.boolean().optional(),
});

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required'),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  categoryId: z.string().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  variants: z.array(variantSchema).min(1, 'At least one variant is required'),
});

type FormData = z.infer<typeof schema>;

interface ProductFormProps {
  categories: Category[];
  product?: Product;
  onSuccess: () => void;
}

export default function ProductForm({ categories, product, onSuccess }: ProductFormProps) {
  const [loading, setLoading] = useState(false);
  const isEditing = !!product;

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      name: product?.name ?? '',
      slug: product?.slug ?? '',
      description: product?.description ?? '',
      shortDescription: '',
      categoryId: product?.categoryId ?? '',
      isActive: product?.isActive ?? true,
      isFeatured: product?.isFeatured ?? false,
      variants: product?.variants?.length
        ? product.variants.map((v) => ({
            name: v.name,
            sku: v.sku,
            price: v.price,
            stock: v.stock,
            isDefault: v.isDefault,
          }))
        : [{ name: 'Default', sku: '', price: 0, stock: 0, isDefault: true }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'variants' });

  const nameValue = watch('name');
  const autoSlug = () => {
    setValue('slug', nameValue.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
  };

  const onSubmit = async (data: unknown) => {
    setLoading(true);
    try {
      if (isEditing) {
        await productsApi.update(product.id, data as Record<string, unknown>);
      } else {
        await productsApi.create(data as Record<string, unknown>);
      }
      onSuccess();
    } catch {
      // Error handled by parent
    } finally {
      setLoading(false);
    }
  };

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Product Name"
          placeholder="e.g. Classic T-Shirt"
          error={errors.name?.message}
          {...register('name')}
          onBlur={!isEditing ? autoSlug : undefined}
        />
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Input
              label="Slug"
              placeholder="classic-t-shirt"
              error={errors.slug?.message}
              {...register('slug')}
            />
          </div>
          {!isEditing && (
            <Button type="button" variant="outline" size="md" onClick={autoSlug}>
              Auto
            </Button>
          )}
        </div>
      </div>

      <Textarea
        label="Short Description"
        placeholder="Brief product summary..."
        {...register('shortDescription')}
      />

      <Textarea
        label="Full Description"
        placeholder="Detailed product description..."
        {...register('description')}
      />

      <Select
        label="Category"
        options={categoryOptions}
        placeholder="Select a category"
        {...register('categoryId')}
      />

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="rounded" {...register('isActive')} />
          <span className="text-sm font-medium text-slate-700">Active</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="rounded" {...register('isFeatured')} />
          <span className="text-sm font-medium text-slate-700">Featured</span>
        </label>
      </div>

      {/* Variants */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Variants</h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => append({ name: '', sku: '', price: 0, stock: 0, isDefault: false })}
          >
            <Plus size={14} /> Add Variant
          </Button>
        </div>
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={field.id} className="rounded-lg border border-slate-200 p-4 bg-slate-50">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Variant {index + 1}</p>
                {fields.length > 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => remove(index)}
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Name" placeholder="e.g. Small / Red" {...register(`variants.${index}.name`)} />
                <Input label="SKU" placeholder="SKU-001" {...register(`variants.${index}.sku`)} />
                <Input label="Price" type="number" step="0.01" min="0" {...register(`variants.${index}.price`)} error={(errors.variants?.[index] as { price?: { message?: string } })?.price?.message} />
                <Input label="Stock" type="number" min="0" {...register(`variants.${index}.stock`)} />
                <Input label="Cost Price" type="number" step="0.01" min="0" {...register(`variants.${index}.costPrice`)} />
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded" {...register(`variants.${index}.isDefault`)} />
                    <span className="text-sm text-slate-700">Default</span>
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
        {errors.variants?.root && (
          <p className="mt-1 text-xs text-red-600">{errors.variants.root.message}</p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
        <Button type="submit" loading={loading}>
          {isEditing ? 'Save Changes' : 'Create Product'}
        </Button>
      </div>
    </form>
  );
}
