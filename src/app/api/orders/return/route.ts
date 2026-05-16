import pool from "@/src/lib/db";
import { sendReturnRequestToSeller, sendReturnOutcomeToCustomer } from "@/src/services/orderEmail";
import { VerifyToken } from "@/src/utils/VerifyToken";
import { NextRequest, NextResponse } from "next/server";
import { uploadToCloudinary } from "@/src/services/cloudinary";

export async function POST(request: NextRequest) {
    try {
        const userId = VerifyToken(request);
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized", success: false }, { status: 401 });
        }

        const formData = await request.formData();
        const orderId = formData.get("orderId") as string;
        const reason = formData.get("reason") as string;
        const photos = formData.getAll("photos") as File[];

        if (!orderId || !reason) {
            return NextResponse.json({ error: "Order ID and reason are mandatory.", success: false }, { status: 400 });
        }

        const [orderRows] = await pool.execute(
            `SELECT * FROM orders WHERE id = ? LIMIT 1`,
            [orderId]
        );
        if ((orderRows as any[]).length === 0) {
            return NextResponse.json({ error: "Order not found", success: false }, { status: 404 });
        }
        const order = (orderRows as any[])[0];

        if (String(order.user_id) !== String(userId)) {
            return NextResponse.json({ error: "Unauthorized access to order", success: false }, { status: 403 });
        }

        if (order.status !== "completed") {
            return NextResponse.json({ error: "Only delivered orders can be returned.", success: false }, { status: 400 });
        }

        if (order.return_status !== "none") {
            return NextResponse.json({ error: "Return request already submitted for this order.", success: false }, { status: 400 });
        }

        const returnPhotosUrls: string[] = [];
        if (photos && photos.length > 0) {
            for (const file of photos) {
                if (file instanceof File) {
                    const imageUrl = await uploadToCloudinary(file, "returns");
                    returnPhotosUrls.push(imageUrl);
                }
            }
        }

        await pool.execute(
            `UPDATE orders
             SET return_status = 'processing', return_reason = ?, return_photos = ?
             WHERE id = ?`,
            [reason, JSON.stringify(returnPhotosUrls), orderId]
        );

        // Send return request email to seller
        try {
            const [detailsRows] = await pool.execute(
                `SELECT o.id, o.store_id,
                        cu.name AS customer_name,
                        p.name AS product_name,
                        su.id AS seller_user_id, su.email AS seller_email, su.name AS seller_name
                 FROM orders o
                 LEFT JOIN users cu ON o.user_id = cu.id
                 LEFT JOIN products p ON o.product_id = p.id
                 LEFT JOIN stores s ON o.store_id = s.id
                 LEFT JOIN users su ON s.seller_id = su.id
                 WHERE o.id = ?
                 LIMIT 1`,
                [orderId]
            );
            const info = (detailsRows as any[])[0];

            if (info?.seller_email && info?.customer_name && info?.product_name) {
                await sendReturnRequestToSeller({
                    sellerEmail: info.seller_email,
                    sellerName: info.seller_name,
                    customerName: info.customer_name,
                    orderId: orderId,
                    productName: info.product_name,
                    reason: reason
                });

                // --- In-App Notification for Seller ---
                try {
                    if (info.seller_user_id) {
                        await pool.execute(
                            `INSERT INTO notifications (user_id, message, type, link, is_read)
                             VALUES (?, ?, 'return', '/store/return-orders', 0)`,
                            [info.seller_user_id, `New return request received for order #${orderId} (${info.product_name}).`]
                        );
                    }
                } catch (notifError) {
                    console.error("Failed to create in-app notification:", notifError);
                }
            }
        } catch (emailError) {
            console.error("Failed to send return request email:", emailError);
        }

        return NextResponse.json({ 
            success: true, 
            message: "Return request submitted successfully. Waiting for seller review.", 
            orderId 
        }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message, success: false }, { status: 500 });
    }
}

// GET: Fetch return requests for the seller's store
export async function GET(request: NextRequest) {
    try {
        const userId = VerifyToken(request);
        const { searchParams } = new URL(request.url);
        const storeId = searchParams.get("storeId");

        if (!storeId) {
            return NextResponse.json({ error: "storeId is required", success: false }, { status: 400 });
        }

        const [ownedStoreRows] = await pool.execute(
            `SELECT id FROM stores WHERE id = ? AND seller_id = ? LIMIT 1`,
            [storeId, userId]
        );
        if ((ownedStoreRows as any[]).length === 0) {
            return NextResponse.json({ error: "Unauthorized store access", success: false }, { status: 403 });
        }

        const [orders] = await pool.execute(
            `SELECT o.*, u.name AS customer_name, u.email AS customer_email,
                    o.mobile_number AS customer_mobile,
                    p.name AS product_name, p.image AS product_image
             FROM orders o
             LEFT JOIN users u ON o.user_id = u.id
             LEFT JOIN products p ON o.product_id = p.id
             WHERE o.store_id = ? AND o.return_status <> 'none'
             ORDER BY o.updated_at DESC`,
            [storeId]
        );

        return NextResponse.json({ success: true, orders }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message, success: false }, { status: 500 });
    }
}

// PATCH: Accept or Decline return (Seller side)
export async function PATCH(request: NextRequest) {
    try {
        const userId = VerifyToken(request);
        const reqBody = await request.json();
        const { orderId, decision } = reqBody; // decision: 'successful' or 'failed'

        if (!orderId || !decision) {
            return NextResponse.json({ error: "Missing order ID or decision.", success: false }, { status: 400 });
        }

        const [orderRows] = await pool.execute(
            `SELECT * FROM orders WHERE id = ? LIMIT 1`,
            [orderId]
        );
        if ((orderRows as any[]).length === 0) {
            return NextResponse.json({ error: "Order not found", success: false }, { status: 404 });
        }
        const order = (orderRows as any[])[0];

        // Ensure seller owns the store for this order
        const [storeRows] = await pool.execute(
            `SELECT id FROM stores WHERE id = ? AND seller_id = ? LIMIT 1`,
            [order.store_id, userId]
        );
        if ((storeRows as any[]).length === 0) {
            return NextResponse.json({ error: "Unauthorized action", success: false }, { status: 403 });
        }

        await pool.execute(
            `UPDATE orders SET return_status = ? WHERE id = ?`,
            [decision, orderId]
        );

        // Send return outcome email to customer
        try {
            const [detailsRows] = await pool.execute(
                `SELECT o.user_id, u.name AS customer_name, u.email AS customer_email, p.name AS product_name
                 FROM orders o
                 LEFT JOIN users u ON o.user_id = u.id
                 LEFT JOIN products p ON o.product_id = p.id
                 WHERE o.id = ?
                 LIMIT 1`,
                [orderId]
            );
            const info = (detailsRows as any[])[0];

            if (info?.customer_email && info?.customer_name && info?.product_name) {
                await sendReturnOutcomeToCustomer({
                    customerEmail: info.customer_email,
                    customerName: info.customer_name,
                    orderId: orderId,
                    productName: info.product_name,
                    outcome: decision as 'successful' | 'failed'
                });

                // --- In-App Notification for Buyer ---
                try {
                    await pool.execute(
                        `INSERT INTO notifications (user_id, message, type, link, is_read)
                         VALUES (?, ?, 'return', '/products/my-orders', 0)`,
                        [
                            info.user_id,
                            `The return request for your order #${orderId} (${info.product_name}) has been ${decision === "successful" ? "approved" : "rejected"}.`,
                        ]
                    );
                } catch (notifError) {
                    console.error("Failed to create in-app notification:", notifError);
                }
            }
        } catch (emailError) {
            console.error("Failed to send return outcome email:", emailError);
        }

        return NextResponse.json({ 
            success: true, 
            message: `Return request ${decision === "successful" ? "accepted" : "declined"}.`, 
            order 
        }, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({ error: error.message, success: false }, { status: 500 });
    }
}
