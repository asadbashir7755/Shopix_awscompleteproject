import { NextRequest, NextResponse } from "next/server";
import pool from "@/src/lib/db";
import { VerifyToken } from "@/src/utils/VerifyToken";
import { sendOrderNotificationToSeller, sendOrderStatusUpdateToCustomer } from "@/src/services/orderEmail";

// POST: Create a new order (for buyers)
export async function POST(request: NextRequest) {
    try {
        const userId = VerifyToken(request);
        const reqBody = await request.json();

        const { productId, receiverName, mobileNumber, billingAddress, quantity, paymentMethod, stripePaymentId, paymentStatus } = reqBody;

        if (!productId || !receiverName || !mobileNumber || !billingAddress || !quantity || !paymentMethod) {
            return NextResponse.json({ error: "All fields are required" }, { status: 400 });
        }

        // Get product
        const [productRows] = await pool.execute(
            'SELECT * FROM products WHERE id = ?',
            [productId]
        );

        if ((productRows as any[]).length === 0) {
            return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }

        const product = (productRows as any[])[0];

        if (product.quantity < quantity) {
            return NextResponse.json({ error: `Not enough quantity available. Only ${product.quantity} left.` }, { status: 400 });
        }

        const totalAmount = product.price * quantity;

        // Create order
        const [result] = await pool.execute(
            `INSERT INTO orders (
                user_id, store_id, product_id, receiver_name, mobile_number,
                billing_address, quantity, payment_method, total_amount,
                payment_status, stripe_payment_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                product.store_id,
                productId,
                receiverName,
                mobileNumber,
                billingAddress,
                quantity,
                paymentMethod,
                totalAmount,
                paymentStatus || "Pending",
                stripePaymentId || null
            ]
        );

        const orderId = (result as any).insertId;

        // Update product inventory and sold count
        await pool.execute(
            'UPDATE products SET quantity = quantity - ?, sold = sold + ? WHERE id = ?',
            [quantity, quantity, productId]
        );

        // Send email notification to seller
        try {
            const [userRows] = await pool.execute(
                'SELECT id, name, email FROM users WHERE id = ?',
                [userId]
            );
            const customer = (userRows as any[])[0];

            const [storeRows] = await pool.execute(
                'SELECT id, seller_id, name FROM stores WHERE id = ?',
                [product.store_id]
            );
            const store = (storeRows as any[])[0];

            if (store) {
                const [sellerRows] = await pool.execute(
                    'SELECT name, email FROM users WHERE id = ?',
                    [store.seller_id]
                );
                const seller = (sellerRows as any[])[0];

                if (customer && seller) {
                    await sendOrderNotificationToSeller({
                        sellerEmail: seller.email,
                        sellerName: seller.name,
                        customerName: receiverName,
                        customerEmail: customer.email,
                        orderId: orderId.toString(),
                        items: [{
                            name: product.name,
                            quantity: quantity,
                            price: product.price
                        }],
                        totalAmount,
                        shippingAddress: billingAddress
                    });
                }
            }
        } catch (emailError) {
            console.error("Failed to send order notification email:", emailError);
        }

        // Create in-app notifications
        try {
            // Notify Buyer
            await pool.execute(
                'INSERT INTO notifications (user_id, message, type, link) VALUES (?, ?, ?, ?)',
                [userId, `Your order for ${product.name} has been placed successfully.`, 'order', '/products/my-orders']
            );

            // Notify Seller
            const [storeRows] = await pool.execute(
                'SELECT seller_id FROM stores WHERE id = ?',
                [product.store_id]
            );
            const store = (storeRows as any[])[0];

            if (store) {
                await pool.execute(
                    'INSERT INTO notifications (user_id, message, type, link) VALUES (?, ?, ?, ?)',
                    [store.seller_id, `New order received for ${product.name} (Qty: ${quantity}).`, 'order', '/store/track-orders']
                );
            }
        } catch (notifError) {
            console.error("Failed to create in-app notification:", notifError);
        }

        // Get the created order
        const [orderRows] = await pool.execute(
            'SELECT * FROM orders WHERE id = ?',
            [orderId]
        );
        const newOrder = (orderRows as any[])[0];

        return NextResponse.json({
            success: true,
            message: "Order placed successfully",
            order: newOrder
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// GET: Fetch orders for the seller's store
export async function GET(request: NextRequest) {
    try {
        const userId = VerifyToken(request);

        // Get seller's store
        const [storeRows] = await pool.execute(
            'SELECT id FROM stores WHERE seller_id = ?',
            [userId]
        );

        if ((storeRows as any[]).length === 0) {
            return NextResponse.json({ error: "Store not found" }, { status: 404 });
        }

        const store = (storeRows as any[])[0];

        // Get orders with product details
        const [orders] = await pool.execute(
            `SELECT
                o.*,
                u.name as user_name,
                u.email as user_email,
                p.name as product_name
            FROM orders o
            JOIN users u ON o.user_id = u.id
            JOIN products p ON o.product_id = p.id
            WHERE o.store_id = ?
            ORDER BY o.created_at DESC`,
            [store.id]
        );

        return NextResponse.json({
            success: true,
            orders
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH: Update order status (for sellers)
export async function PATCH(request: NextRequest) {
    try {
        const userId = VerifyToken(request);
        const reqBody = await request.json();
        const { orderId, status } = reqBody;

        if (!orderId || !status) {
            return NextResponse.json({ error: "Order ID and status are required" }, { status: 400 });
        }

        // Get order
        const [orderRows] = await pool.execute(
            'SELECT * FROM orders WHERE id = ?',
            [orderId]
        );

        if ((orderRows as any[]).length === 0) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        const order = (orderRows as any[])[0];

        // Check authorization
        const [storeRows] = await pool.execute(
            'SELECT id FROM stores WHERE seller_id = ?',
            [userId]
        );

        const userStore = (storeRows as any[])[0];
        if (!userStore || userStore.id !== order.store_id) {
            return NextResponse.json({ error: "Unauthorized access to order" }, { status: 403 });
        }

        // Update order status
        const deliveredAt = status === "completed" ? new Date() : null;
        await pool.execute(
            'UPDATE orders SET status = ?, delivered_at = ? WHERE id = ?',
            [status, deliveredAt, orderId]
        );

        // Send status update email
        try {
            const [userRows] = await pool.execute(
                'SELECT name, email FROM users WHERE id = ?',
                [order.user_id]
            );
            const customer = (userRows as any[])[0];

            const [productRows] = await pool.execute(
                'SELECT name FROM products WHERE id = ?',
                [order.product_id]
            );
            const product = (productRows as any[])[0];

            const normalizedStatus = status.toLowerCase();

            if (customer && product && ['shipped', 'completed', 'delivered'].includes(normalizedStatus)) {
                await sendOrderStatusUpdateToCustomer({
                    customerEmail: customer.email,
                    customerName: order.receiver_name || customer.name,
                    orderId: orderId,
                    status: normalizedStatus,
                    productName: product.name
                });
            }
        } catch (emailError) {
            console.error("Failed to send status update email:", emailError);
        }

        // Create in-app notification for buyer
        try {
            const [productRows] = await pool.execute(
                'SELECT name FROM products WHERE id = ?',
                [order.product_id]
            );
            const product = (productRows as any[])[0];

            await pool.execute(
                'INSERT INTO notifications (user_id, message, type, link) VALUES (?, ?, ?, ?)',
                [order.user_id, `Your order for ${product.name} status is now: ${status}.`, 'order', '/products/my-orders']
            );
        } catch (notifError) {
            console.error("Failed to create in-app notification:", notifError);
        }

        return NextResponse.json({
            success: true,
            message: "Order status updated successfully",
            order
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
