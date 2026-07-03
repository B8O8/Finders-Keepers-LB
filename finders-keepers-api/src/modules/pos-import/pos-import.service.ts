import { BadRequestException, Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../../database/prisma.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

export interface PosImportRow {
  productCode: string;
  description: string;
  barcode: string;
  posProductId: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface PosImportResultRow {
  posProductId: string;
  productCode: string;
  description: string;
  barcode: string;
  qty: number;
  matched: boolean;
  matchedBy?: 'posProductId' | 'barcode';
  variantId?: string;
  variantName?: string;
  productName?: string;
  previousStock?: number;
  newStock?: number;
  skipped?: boolean;
  reason?: string;
}

export interface PosImportSummary {
  totalRows: number;
  matched: number;
  unmatched: number;
  totalQtyDeducted: number;
  results: PosImportResultRow[];
}

@Injectable()
export class PosImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogs: ActivityLogsService,
  ) {}

  /** Parse xlsx buffer → clean row array */
  parseXlsx(buffer: Buffer): PosImportRow[] {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

    const rows: PosImportRow[] = [];
    for (const row of raw) {
      // Column D (index 3) must be a number to be a data row
      const posId = row[3];
      const qty   = row[4];
      if (typeof posId !== 'number' || isNaN(posId)) continue;
      if (typeof qty   !== 'number' || isNaN(qty))   continue;

      rows.push({
        productCode:  String(row[0] ?? '').trim(),
        description:  String(row[1] ?? '').trim(),
        barcode:      String(row[2] ?? '').trim(),
        posProductId: String(Math.round(posId)),
        qty:          qty,
        unitPrice:    typeof row[5] === 'number' ? row[5] : 0,
        total:        typeof row[6] === 'number' ? row[6] : 0,
      });
    }

    if (rows.length === 0) {
      throw new BadRequestException('No valid data rows found in the Excel file. Check the file format.');
    }

    return rows;
  }

  /** Preview only — parse without touching DB */
  async preview(buffer: Buffer): Promise<{ rows: PosImportRow[]; totalRows: number }> {
    const rows = this.parseXlsx(buffer);
    return { rows, totalRows: rows.length };
  }

  /** Full import — deduct stock and log */
  async import(buffer: Buffer, adminId?: string): Promise<PosImportSummary> {
    const rows = this.parseXlsx(buffer);

    // Pre-load all relevant variants (by posProductId or barcode)
    const posIds   = rows.map(r => r.posProductId).filter(Boolean);
    const barcodes = rows.map(r => r.barcode).filter(b => b && b !== 'undefined');

    const variants = await this.prisma.productVariant.findMany({
      where: {
        OR: [
          { posProductId: { in: posIds } },
          { barcode:      { in: barcodes } },
        ],
      },
      include: {
        product: { select: { id: true, name: true } },
      },
    });

    // Build lookup maps
    const byPosId   = new Map(variants.filter(v => v.posProductId).map(v => [v.posProductId!, v]));
    const byBarcode = new Map(variants.filter(v => v.barcode).map(v => [v.barcode!, v]));

    const results: PosImportResultRow[] = [];
    let matched = 0;
    let totalQtyDeducted = 0;

    // Aggregate qty by variant (same variant may appear on multiple pages)
    const qtyMap = new Map<string, number>();
    const variantForRow = new Map<number, typeof variants[0] | null>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const v = byPosId.get(row.posProductId) ?? byBarcode.get(row.barcode) ?? null;
      variantForRow.set(i, v);
      if (v) {
        qtyMap.set(v.id, (qtyMap.get(v.id) ?? 0) + row.qty);
      }
    }

    // Apply stock deductions in a transaction
    const updates: { id: string; newStock: number; prevStock: number }[] = [];

    for (const [variantId, totalQty] of qtyMap.entries()) {
      const variant = variants.find(v => v.id === variantId)!;
      const prevStock = variant.stock;
      const newStock  = Math.max(0, prevStock - totalQty);
      updates.push({ id: variantId, newStock, prevStock });
    }

    if (updates.length > 0) {
      await this.prisma.$transaction(
        updates.map(u =>
          this.prisma.productVariant.update({
            where: { id: u.id },
            data:  { stock: u.newStock },
          }),
        ),
      );
    }

    // Build result rows
    for (let i = 0; i < rows.length; i++) {
      const row     = rows[i];
      const variant = variantForRow.get(i);
      const matchedBy: 'posProductId' | 'barcode' | undefined =
        variant
          ? byPosId.has(row.posProductId) ? 'posProductId' : 'barcode'
          : undefined;

      if (variant) {
        const upd = updates.find(u => u.id === variant.id)!;
        matched++;
        totalQtyDeducted += row.qty;
        results.push({
          posProductId: row.posProductId,
          productCode:  row.productCode,
          description:  row.description,
          barcode:      row.barcode,
          qty:          row.qty,
          matched:      true,
          matchedBy,
          variantId:    variant.id,
          variantName:  variant.name ?? undefined,
          productName:  variant.product?.name,
          previousStock: upd.prevStock,
          newStock:      upd.newStock,
        });
      } else {
        results.push({
          posProductId: row.posProductId,
          productCode:  row.productCode,
          description:  row.description,
          barcode:      row.barcode,
          qty:          row.qty,
          matched:      false,
          reason:       'No variant found with matching POS ID or barcode',
        });
      }
    }

    await this.activityLogs.create({
      adminId,
      action: 'POS_IMPORT',
      entity: 'ProductVariant',
      metadata: {
        totalRows: rows.length,
        matched,
        unmatched: rows.length - matched,
        totalQtyDeducted,
      },
    });

    return {
      totalRows: rows.length,
      matched,
      unmatched: rows.length - matched,
      totalQtyDeducted,
      results,
    };
  }
}
