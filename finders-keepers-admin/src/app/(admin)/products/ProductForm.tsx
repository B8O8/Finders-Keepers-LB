'use client';

import { useMemo, useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import MultiSelect from '@/components/ui/MultiSelect';
import { productsApi } from '@/lib/api';
import type { Category, Product } from '@/types';

/**
 * Variant schema.
 *
 * Deliberately mirrors every field the variant EDIT screen exposes, so a
 * product can be fully configured while being created instead of created and
 * then immediately edited. Shared by both create and edit modes.
 */
const variantSchema = z.object({
  name: z.string().optional(),
  sku: z.string().optional(),
  plu: z.string().optional(),
  barcode: z.string().optional(),
  posProductId: z.string().optional(),
  price: z.coerce.number().min(0, 'Price cannot be negative'),
  compareAtPrice: z.coerce.number().min(0).optional().or(z.literal('')),
  costPrice: z.coerce.number().min(0).optional().or(z.literal('')),
  weight: z.coerce.number().min(0).optional().or(z.literal('')),
  stock: z.coerce.number().int().min(0).optional(),
  allowBackorder: z.boolean().optional(),
  backorderMessage: z.string().optional(),
  availabilityDate: z.string().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const schema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    slug: z.string().min(1, 'Slug is required'),
    description: z.string().optional(),
    shortDescription: z.string().optional(),
    categoryIds: z.array(z.string()),
    primaryCategoryId: z.string().optional(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    isActive: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    variants: z.array(variantSchema).min(1, 'At least one variant is required'),
  })
  .superRefine((data, ctx) => {
    // Exactly one default variant.
    const defaults = data.variants.filter((v) => v.isDefault);
    if (defaults.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['variants'],
        message: 'Only one variant can be the default',
      });
    }

    // Duplicate SKUs (client-side; the API enforces this globally too).
    const skus = data.variants
      .map((v) => v.sku?.trim())
      .filter((s): s is string => !!s);
    const dupes = skus.filter((s, i) => skus.indexOf(s) !== i);
    if (dupes.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['variants'],
        message: `Duplicate SKU: ${Array.from(new Set(dupes)).join(', ')}`,
      });
    }

    // The primary category must be one of the selected categories.
    if (data.primaryCategoryId && !data.categoryIds.includes(data.primaryCategoryId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['primaryCategoryId'],
        message: 'Primary category must be one of the selected categories',
      });
    }
  });

type FormData = z.infer<typeof schema>;

interface ProductFormProps {
  categories: Category[];
  product?: Product;
  onSuccess: () => void;
}

/** Strips empty strings so optional numbers/dates are omitted, not sent as ''. */
function clean<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === '' || v === undefined || v === null) continue;
    out[k] = v;
  }
  return out;
}

const emptyVariant = {
  name: '',
  sku: '',
  plu: '',
  barcode: '',
  posProductId: '',
  price: 0,
  compareAtPrice: '' as const,
  costPrice: '' as const,
  weight: '' as const,
  stock: 0,
  allowBackorder: false,
  backorderMessage: '',
  availabilityDate: '',
  isDefault: false,
  isActive: true,
};

export default function ProductForm({ categories, product, onSuccess }: ProductFormProps) {
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isEditing = !!product;

  // Existing links first, falling back to the deprecated single category so
  // products created before the multi-category change still load correctly.
  const initialCategoryIds =
    product?.productCategories?.map((pc) => pc.categoryId) ??
    (product?.categoryId ? [product.categoryId] : []);

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
      shortDescription: product?.shortDescription ?? '',
      categoryIds: initialCategoryIds,
      primaryCategoryId: product?.primaryCategoryId ?? initialCategoryIds[0] ?? '',
      seoTitle: product?.seoTitle ?? '',
      seoDescription: product?.seoDescription ?? '',
      isActive: product?.isActive ?? true,
      isFeatured: product?.isFeatured ?? false,
      variants: product?.variants?.length
        ? product.variants.map((v) => ({
            name: v.name ?? '',
            sku: v.sku ?? '',
            plu: v.plu ?? '',
            barcode: v.barcode ?? '',
            posProductId: v.posProductId ?? '',
            price: v.price,
            compareAtPrice: v.compareAtPrice ?? '',
            costPrice: v.costPrice ?? '',
            weight: v.weight ?? '',
            stock: v.stock,
            allowBackorder: v.allowBackorder ?? false,
            backorderMessage: v.backorderMessage ?? '',
            availabilityDate: v.availabilityDate ? v.availabilityDate.slice(0, 10) : '',
            isDefault: v.isDefault,
            isActive: v.isActive,
          }))
        : [{ ...emptyVariant, name: 'Default', isDefault: true }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'variants' });

  const nameValue = watch('name');
  const selectedCategoryIds = watch('categoryIds');
  const variants = watch('variants');

  const autoSlug = () => {
    setValue(
      'slug',
      (nameValue || '')
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, ''),
    );
  };

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories],
  );

  // Primary category can only be one the product actually belongs to.
  const primaryOptions = useMemo(
    () =>
      categories
        .filter((c) => selectedCategoryIds?.includes(c.id))
        .map((c) => ({ value: c.id, label: c.name })),
    [categories, selectedCategoryIds],
  );

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setSubmitError(null);

    const payload = {
      name: data.name,
      slug: data.slug,
      shortDescription: data.shortDescription || undefined,
      description: data.description || undefined,
      categoryIds: data.categoryIds,
      primaryCategoryId: data.primaryCategoryId || undefined,
      seoTitle: data.seoTitle || undefined,
      seoDescription: data.seoDescription || undefined,
      isActive: data.isActive,
      isFeatured: data.isFeatured,
      variants: data.variants.map((v) =>
        clean({
          ...v,
          availabilityDate: v.availabilityDate
            ? new Date(v.availabilityDate).toISOString()
            : undefined,
          // Booleans must survive `clean`, which drops falsy-empty values only.
          allowBackorder: !!v.allowBackorder,
          isDefault: !!v.isDefault,
          isActive: v.isActive !== false,
        }),
      ),
    };

    try {
      if (isEditing) {
        await productsApi.update(product.id, payload as Record<string, unknown>);
      } else {
        await productsApi.create(payload as Record<string, unknown>);
      }
      onSuccess();
    } catch (err: unknown) {
      // Keep the user's input and surface the server's reason.
      const message =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data
          ?.message ?? 'Could not save the product. Please try again.';
      setSubmitError(Array.isArray(message) ? message.join(', ') : String(message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit as never)} className="space-y-5">
      {submitError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600" />
          <p className="text-sm text-red-700">{submitError}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Product Name"
          placeholder="e.g. Classic T-Shirt"
          error={errors.name?.message}
          {...register('name')}
          onBlur={!isEditing ? autoSlug : undefined}
        />
        <div className="flex items-end gap-2">
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

      <Textarea label="Short Description" placeholder="Brief product summary..." {...register('shortDescription')} />
      <Textarea label="Full Description" placeholder="Detailed product description..." {...register('description')} />

      {/* Categories - a product may belong to several */}
      <div className="grid grid-cols-2 gap-4">
        <Controller
          control={control}
          name="categoryIds"
          render={({ field }) => (
            <MultiSelect
              label="Categories"
              options={categoryOptions}
              value={field.value ?? []}
              onChange={(next) => {
                field.onChange(next);
                // Keep the primary valid when its category is removed.
                const primary = watch('primaryCategoryId');
                if (primary && !next.includes(primary)) {
                  setValue('primaryCategoryId', next[0] ?? '');
                }
                if (!primary && next.length) setValue('primaryCategoryId', next[0]);
              }}
              placeholder="Search categories..."
              error={errors.categoryIds?.message as string | undefined}
            />
          )}
        />

        <Select
          label="Primary Category"
          options={primaryOptions}
          placeholder={selectedCategoryIds?.length ? 'Select primary' : 'Pick categories first'}
          error={errors.primaryCategoryId?.message}
          {...register('primaryCategoryId')}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input label="SEO Title" placeholder="Optional" {...register('seoTitle')} />
        <Input label="SEO Description" placeholder="Optional" {...register('seoDescription')} />
      </div>

      <div className="flex items-center gap-6">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" className="rounded" {...register('isActive')} />
          <span className="text-sm font-medium text-slate-700">Active</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" className="rounded" {...register('isFeatured')} />
          <span className="text-sm font-medium text-slate-700">Featured</span>
        </label>
      </div>

      {/* Variants */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            Variants <span className="font-normal text-slate-400">({fields.length})</span>
          </h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => append({ ...emptyVariant })}
          >
            <Plus size={14} /> Add Variant
          </Button>
        </div>

        <div className="space-y-3">
          {fields.map((field, index) => {
            const backorderOn = variants?.[index]?.allowBackorder;

            return (
              <div key={field.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Variant {index + 1}
                  </p>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => remove(index)}
                      aria-label={`Remove variant ${index + 1}`}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Input label="Name" placeholder="e.g. Small / Red" {...register(`variants.${index}.name`)} />
                  <Input label="SKU" placeholder="SKU-001" {...register(`variants.${index}.sku`)} />
                  <Input label="Barcode" placeholder="Optional" {...register(`variants.${index}.barcode`)} />

                  <Input label="PLU" placeholder="Optional" {...register(`variants.${index}.plu`)} />
                  <Input label="POS Product ID" placeholder="Optional" {...register(`variants.${index}.posProductId`)} />
                  <Input label="Weight (kg)" type="number" step="0.01" min="0" {...register(`variants.${index}.weight`)} />

                  <Input
                    label="Price"
                    type="number"
                    step="0.01"
                    min="0"
                    error={(errors.variants?.[index] as { price?: { message?: string } })?.price?.message}
                    {...register(`variants.${index}.price`)}
                  />
                  <Input label="Compare-at Price" type="number" step="0.01" min="0" {...register(`variants.${index}.compareAtPrice`)} />
                  <Input label="Cost Price" type="number" step="0.01" min="0" {...register(`variants.${index}.costPrice`)} />

                  <Input label="Stock" type="number" min="0" {...register(`variants.${index}.stock`)} />

                  <div className="flex items-end pb-2">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input type="checkbox" className="rounded" {...register(`variants.${index}.isDefault`)} />
                      <span className="text-sm text-slate-700">Default</span>
                    </label>
                  </div>

                  <div className="flex items-end pb-2">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input type="checkbox" className="rounded" {...register(`variants.${index}.isActive`)} />
                      <span className="text-sm text-slate-700">Active</span>
                    </label>
                  </div>
                </div>

                {/* Backorder */}
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" className="rounded" {...register(`variants.${index}.allowBackorder`)} />
                    <span className="text-sm font-medium text-slate-700">
                      Allow backorder when out of stock
                    </span>
                  </label>

                  <p className="mt-1 text-xs text-slate-500">
                    Customers can order this variant at zero stock. It stays visible either way.
                  </p>

                  {backorderOn && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <Input
                        label="Backorder Message"
                        placeholder="e.g. Available on order - ships in 2 weeks"
                        {...register(`variants.${index}.backorderMessage`)}
                      />
                      <Input
                        label="Estimated Availability"
                        type="date"
                        {...register(`variants.${index}.availabilityDate`)}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {errors.variants?.root && (
          <p className="mt-1 text-xs text-red-600">{errors.variants.root.message}</p>
        )}
        {typeof errors.variants?.message === 'string' && (
          <p className="mt-1 text-xs text-red-600">{errors.variants.message}</p>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-200 pt-2">
        <Button type="submit" loading={loading}>
          {isEditing ? 'Save Changes' : 'Create Product'}
        </Button>
      </div>
    </form>
  );
}
