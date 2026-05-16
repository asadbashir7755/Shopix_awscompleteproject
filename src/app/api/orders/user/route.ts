import { NextRequest, NextResponse } from "next/server";
import pool from "@/src/lib/db";
import { VerifyToken } from "@/src/utils/VerifyToken";

export async function GET(request: NextRequest) {
    try {
        const userId = VerifyToken(request);

        // Fetch orders where the current user is the buyer
        const [orders] = await pool.execute(
            `SELECT
                o.*,
                p.name as product_name,
                p.image as product_image,
                p.description as product_description,
                p.price as product_price,
                s.name as store_name,
                s.logo as store_logo
            FROM orders o
            JOIN products p ON o.product_id = p.id
            JOIN stores s ON o.store_id = s.id
            WHERE o.user_id = ?
            ORDER BY o.created_at DESC`,
            [userId]
        );

        return NextResponse.json({
            success: true,
            orders
        });

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
