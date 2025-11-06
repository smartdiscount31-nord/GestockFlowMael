/**
 * Search Products Like List Utility
 * Search products with fuzzy matching
 */

import { supabase } from '../lib/supabase';

export interface StockInfo {
  stock_id: string;
  stock_name: string;
  quantity: number;
}

export interface ProductSearchResult {
  id: string;
  name: string;
  sku: string;
  serial_number?: string | null;
  parent_id?: string | null;
  product_type?: string | null;
  retail_price?: number | null;
  purchase_price_with_fees?: number | null;
  pro_price?: number | null;
  vat_type?: 'normal' | 'margin' | string | null;
  stock?: number | null;
  stocks?: StockInfo[];
}

/**
 * Search products with like/fuzzy matching
 * @param query Search query string
 * @param limit Maximum number of results to return
 * @returns Array of matching products
 */
export async function searchProductsLikeList(
  query: string,
  limit: number = 10
): Promise<ProductSearchResult[]> {
  console.log('[searchProductsLikeList] Searching for:', query, 'limit:', limit);

  if (!query || query.trim().length === 0) {
    return [];
  }

  try {
    const searchTerm = `%${query.trim()}%`;

    const { data, error } = await supabase
      .from('products')
      .select('id, name, sku, serial_number, parent_id, product_type, retail_price, pro_price, purchase_price_with_fees, vat_type')
      .or(`name.ilike.${searchTerm},sku.ilike.${searchTerm},serial_number.ilike.${searchTerm}`)
      .limit(limit);

    if (error) {
      console.error('[searchProductsLikeList] Error:', error);
      throw error;
    }

    console.log('[searchProductsLikeList] Found', data?.length || 0, 'products');

    // Enrichir chaque produit avec ses stocks par dépôt
    const enrichedProducts: ProductSearchResult[] = [];

    for (const product of data || []) {
      // Déterminer l'ID effectif (parent si c'est un enfant miroir)
      const effectiveId = (product.parent_id && !product.serial_number)
        ? product.parent_id
        : product.id;

      console.log('[searchProductsLikeList] Fetching stocks for product:', product.sku, 'effectiveId:', effectiveId);

      // Récupérer les stocks par dépôt
      const { data: stockData, error: stockError } = await supabase
        .from('stock_produit')
        .select(`
          quantite,
          stock_id,
          stocks:stocks(id, name)
        `)
        .eq('produit_id', effectiveId);

      if (stockError) {
        console.error('[searchProductsLikeList] Error fetching stocks:', stockError);
      }

      const stocks: StockInfo[] = (stockData || []).map((s: any) => ({
        stock_id: s.stock_id,
        stock_name: s.stocks?.name || 'Dépôt inconnu',
        quantity: Number(s.quantite || 0)
      }));

      const totalStock = stocks.reduce((sum, s) => sum + s.quantity, 0);

      console.log('[searchProductsLikeList] Product', product.sku, 'has', stocks.length, 'depot(s), total stock:', totalStock);

      enrichedProducts.push({
        ...product,
        stock: totalStock,
        stocks
      });
    }

    console.log('[searchProductsLikeList] Returning', enrichedProducts.length, 'enriched products');
    return enrichedProducts;
  } catch (error) {
    console.error('[searchProductsLikeList] Search failed:', error);
    return [];
  }
}

/**
 * Search products by SKU
 */
export async function searchProductsBySKU(sku: string): Promise<ProductSearchResult | null> {
  console.log('[searchProductsBySKU] Searching for SKU:', sku);

  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, sku, serial_number, parent_id, product_type, retail_price, pro_price, purchase_price_with_fees, vat_type')
      .eq('sku', sku)
      .maybeSingle();

    if (error) {
      console.error('[searchProductsBySKU] Error:', error);
      throw error;
    }

    console.log('[searchProductsBySKU] Result:', data ? 'found' : 'not found');
    return data;
  } catch (error) {
    console.error('[searchProductsBySKU] Search failed:', error);
    return null;
  }
}

/**
 * Search products by name
 */
export async function searchProductsByName(
  name: string,
  limit: number = 10
): Promise<ProductSearchResult[]> {
  console.log('[searchProductsByName] Searching for name:', name);

  try {
    const searchTerm = `%${name.trim()}%`;

    const { data, error } = await supabase
      .from('products')
      .select('id, name, sku, serial_number, parent_id, product_type, retail_price, pro_price, purchase_price_with_fees, vat_type')
      .ilike('name', searchTerm)
      .limit(limit);

    if (error) {
      console.error('[searchProductsByName] Error:', error);
      throw error;
    }

    console.log('[searchProductsByName] Found', data?.length || 0, 'results');
    return data || [];
  } catch (error) {
    console.error('[searchProductsByName] Search failed:', error);
    return [];
  }
}
