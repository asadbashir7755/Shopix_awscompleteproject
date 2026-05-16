import pool from "@/src/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search") || "";
        const category = searchParams.get("category");
        const minPrice = Number(searchParams.get("minPrice")) || 0;
        const maxPrice = Number(searchParams.get("maxPrice")) || 1000000;
        const minRating = Number(searchParams.get("minRating")) || 0;
        const sort = searchParams.get("sort"); // 'price-asc', 'price-desc', 'newest', 'sold-desc'

        // Build WHERE conditions
        let whereConditions: string[] = [];
        let params: any[] = [];

        // Only show products from approved stores with quantity > 0
        whereConditions.push('s.status = ?');
        params.push('approved');

        whereConditions.push('p.quantity > ?');
        params.push(0);

        whereConditions.push('p.price >= ?');
        params.push(minPrice);

        whereConditions.push('p.price <= ?');
        params.push(maxPrice);

        whereConditions.push('p.rating >= ?');
        params.push(minRating);

        // Search functionality
        if (search) {
            whereConditions.push('(p.name LIKE ? OR p.description LIKE ? OR p.category LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        // Category filter
        if (category && category !== "null") {
            whereConditions.push('p.category = ?');
            params.push(category);
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // Build ORDER BY
        let orderBy = 'p.created_at DESC'; // Default: newest
        if (sort === "price-asc") orderBy = 'p.price ASC';
        else if (sort === "price-desc") orderBy = 'p.price DESC';
        else if (sort === "sold-desc") orderBy = 'p.sold DESC';
        else if (sort === "rating-desc") orderBy = 'p.rating DESC';

        // Query with JOIN to get store info
        const query = `
            SELECT
                p.id,
                p.*,
                s.name as store_name,
                s.logo as store_logo
            FROM products p
            JOIN stores s ON p.store_id = s.id
            ${whereClause}
            ORDER BY ${orderBy}
            LIMIT 50
        `;

        const [rows] = await pool.execute(query, params);

        // Cast numeric fields to numbers
        const sanitizedProducts = (rows as any[]).map(p => ({
            ...p,
            price: Number(p.price),
            rating: Number(p.rating),
            sold: Number(p.sold),
            quantity: Number(p.quantity)
        }));

        return NextResponse.json({
            success: true,
            products: sanitizedProducts,
            count: sanitizedProducts.length
        }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message, success: false }, { status: 500 });
    }
}
