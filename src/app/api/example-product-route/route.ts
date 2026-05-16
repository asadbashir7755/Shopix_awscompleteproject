import { NextRequest, NextResponse } from "next/server";
import pool from "@/src/lib/db";

/**
 * GET /api/example-product-route
 * Fetches products with pagination and filtering
 */
export async function GET(request: NextRequest) {
    try {
        const page = request.nextUrl.searchParams.get("page") || "1";
        const limit = request.nextUrl.searchParams.get("limit") || "10";
        const category = request.nextUrl.searchParams.get("category");

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        const whereParts: string[] = ["quantity > 0"];
        const values: any[] = [];
        if (category && category !== "all") {
            whereParts.push("category = ?");
            values.push(category);
        }

        const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

        const [productsRows, totalRows] = await Promise.all([
            pool.execute(
                `SELECT id, name, price, image, category, rating, sold, quantity
                 FROM products
                 ${whereClause}
                 ORDER BY created_at DESC
                 LIMIT ? OFFSET ?`,
                [...values, limitNum, skip]
            ),
            pool.execute(
                `SELECT COUNT(*) AS total FROM products ${whereClause}`,
                values
            ),
        ]);

        const products = productsRows[0] as any[];
        const total = Number((totalRows[0] as any[])[0]?.total || 0);

        return NextResponse.json(
            {
                success: true,
                data: {
                    products,
                    pagination: {
                        total,
                        page: pageNum,
                        limit: limitNum,
                        pages: Math.ceil(total / limitNum),
                    },
                },
            },
            { status: 200 }
        );
    } catch (error: any) {
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch products",
                details: process.env.NODE_ENV === "development" ? error.message : undefined
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/example-product-route
 * Creates a new product
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, price, description, category, image, quantity, storeId, sellerId } =
            body;

        if (
            !name ||
            !price ||
            !description ||
            !category ||
            !image ||
            quantity === undefined ||
            !storeId ||
            !sellerId
        ) {
            return NextResponse.json(
                { success: false, error: "Missing required fields" },
                { status: 400 }
            );
        }

        const [insertResult] = await pool.execute(
            `INSERT INTO products
             (name, price, description, category, image, quantity, store_id, seller_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [name.trim(), price, description.trim(), category, image, quantity, storeId, sellerId]
        );

        const [rows] = await pool.execute(
            `SELECT * FROM products WHERE id = ? LIMIT 1`,
            [(insertResult as any).insertId]
        );

        return NextResponse.json(
            {
                success: true,
                data: (rows as any[])[0],
                message: "Product created successfully",
            },
            { status: 201 }
        );
    } catch (error: any) {
        return NextResponse.json(
            {
                success: false,
                error: "Failed to create product",
                details: process.env.NODE_ENV === "development" ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/example-product-route
 * Updates a product
 */
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, ...updateData } = body;

        if (!id) {
            return NextResponse.json(
                { success: false, error: "Product ID is required" },
                { status: 400 }
            );
        }

        const fields = Object.keys(updateData);
        if (fields.length === 0) {
            return NextResponse.json({ success: false, error: "No update fields provided" }, { status: 400 });
        }

        const setClause = fields.map((f) => `${f} = ?`).join(", ");
        const values = fields.map((f) => (updateData as any)[f]);
        values.push(id);

        await pool.execute(`UPDATE products SET ${setClause} WHERE id = ?`, values);

        const [rows] = await pool.execute(`SELECT * FROM products WHERE id = ? LIMIT 1`, [id]);
        if ((rows as any[]).length === 0) {
            return NextResponse.json(
                { success: false, error: "Product not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(
            {
                success: true,
                data: (rows as any[])[0],
                message: "Product updated successfully",
            },
            { status: 200 }
        );
    } catch (error: any) {
        return NextResponse.json(
            {
                success: false,
                error: "Failed to update product",
                details: process.env.NODE_ENV === "development" ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/example-product-route
 * Deletes a product
 */
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { success: false, error: "Product ID is required" },
                { status: 400 }
            );
        }

        const [rows] = await pool.execute(`SELECT id FROM products WHERE id = ? LIMIT 1`, [id]);
        if ((rows as any[]).length === 0) {
            return NextResponse.json(
                { success: false, error: "Product not found" },
                { status: 404 }
            );
        }

        await pool.execute(`DELETE FROM products WHERE id = ?`, [id]);

        return NextResponse.json(
            {
                success: true,
                message: "Product deleted successfully",
            },
            { status: 200 }
        );
    } catch (error: any) {
        return NextResponse.json(
            {
                success: false,
                error: "Failed to delete product",
                details: process.env.NODE_ENV === "development" ? error.message : undefined,
            },
            { status: 500 }
        );
    }
}
