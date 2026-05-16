import { NextRequest, NextResponse } from "next/server";
import { VerifyToken } from "../../../../utils/VerifyToken";
import pool from "@/src/lib/db";

export async function GET(request: NextRequest) {
    try {
        const userId = VerifyToken(request);

        // Find the store belonging to this seller
        const [storeRows] = await pool.execute(
            `SELECT id FROM stores WHERE seller_id = ? LIMIT 1`,
            [userId]
        );
        if ((storeRows as any[]).length === 0) {
            return NextResponse.json({ success: false, error: "Store not found" }, { status: 404 });
        }
        const store = (storeRows as any[])[0];

        // Fetch completed orders for this store and product details
        const [orders] = await pool.execute(
            `SELECT o.id, o.quantity, o.return_status, o.total_amount,
                    p.id AS product_id, p.name AS product_name, p.image AS product_image
             FROM orders o
             LEFT JOIN products p ON o.product_id = p.id
             WHERE o.store_id = ? AND o.status = 'completed'`,
            [store.id]
        );

        // Aggregation logic
        const productSalesMap: Record<string, any> = {};
        let totalRevenue = 0;

        orders.forEach((order: any) => {
            if (!order.product_id) return; // Skip if product info missing

            const productId = String(order.product_id);
            
            // If returnStatus is successful, we deduct the amount from revenue
            const isReturned = order.return_status === "successful";
            const orderRevenue = isReturned ? 0 : Number(order.total_amount || 0);
            const orderQuantity = isReturned ? 0 : order.quantity; 

            if (!productSalesMap[productId]) {
                productSalesMap[productId] = {
                    productId,
                    name: order.product_name,
                    image: order.product_image,
                    totalQuantity: 0,
                    totalRevenue: 0,
                };
            }

            productSalesMap[productId].totalQuantity += orderQuantity;
            productSalesMap[productId].totalRevenue += orderRevenue;
            
            if (!isReturned) {
                totalRevenue += Number(order.total_amount || 0);
            }
        });

        // Requirement 2: Deduct returns from total revenue. 
        // My logic above already handles this by only adding non-returned amounts to totalRevenue.
        // Wait, the prompt says "If any product is returned, automatically deduct its price from total sales."
        // If totalRevenue was calculated by simply summing totalAmount of all completed orders, 
        // then I should subtract the returned ones. My current logic sums only non-returned ones, which is the same result.

        const productWiseSales = Object.values(productSalesMap).filter((p: any) => p.totalQuantity > 0 || p.totalRevenue > 0);

        return NextResponse.json({
            success: true,
            totalRevenue,
            productWiseSales
        });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
