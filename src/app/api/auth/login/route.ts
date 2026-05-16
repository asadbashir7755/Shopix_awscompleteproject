import pool from "@/src/lib/db";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { GenerateToken } from "@/src/utils/GenerateToken";
import { sendEmail } from "@/src/services/mailer";
import { sendLoginEmail } from "@/src/services/welcome";
// import { loginLimit, getIP } from "@/src/lib/ratelimit"; // REDIS COMMENTED OUT - UNCOMMENT IN PRODUCTION

export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json();
        // const ip = getIP(request); // REDIS COMMENTED OUT - UNCOMMENT IN PRODUCTION

        // Rate limiting commented out
        // REDIS COMMENTED OUT - UNCOMMENT IN PRODUCTION
        /*
        const identifier = `login:${ip}:${email}`;
        const { success, reset } = await loginLimit.limit(identifier);

        if (!success) {
            return NextResponse.json({
                message: "Too many attempts. Try again after 12 hours.",
                reset,
                success: false
            }, { status: 429 });
        }
        */

        // Find user
        const [rows] = await pool.execute(
            'SELECT id, name, email, password, is_verified, role FROM users WHERE email = ?',
            [email]
        );

        if ((rows as any[]).length === 0) {
            return NextResponse.json({ message: "User not found", success: false }, { status: 404 });
        }

        const user = (rows as any[])[0];

        // Validate password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return NextResponse.json({ message: "Incorrect password", success: false }, { status: 401 });
        }

        // Check for Admin Promotion
        const adminEmail = process.env["Admin-Email"];
        if (adminEmail && email === adminEmail && user.role !== "admin") {
            await pool.execute(
                'UPDATE users SET role = ? WHERE id = ?',
                ['admin', user.id]
            );
            user.role = 'admin';
        }

        // Check if verified
        if (!user.is_verified) {
            // Send verification email
            try {
                await sendEmail({
                    email,
                    emailType: "VERIFY",
                    userId: user.id.toString()
                });
            } catch (mailError) {
                console.error("Warning: Verification email failed:", mailError);
            }
            return NextResponse.json({ message: "Please verify your email first", success: false }, { status: 403 });
        }

        const { accessToken, refreshToken } = GenerateToken(user.id);

        // Send login notification email
        const userAgent = request.headers.get("user-agent") || "Unknown Device";
        const loginTime = new Date().toLocaleString("en-US", {
            dateStyle: "full",
            timeStyle: "long"
        });

        try {
            await sendLoginEmail({
                email: user.email,
                username: user.name,
                loginTime,
                deviceInfo: userAgent
            });
        } catch (mailError) {
            console.error("Warning: Login notification email failed:", mailError);
        }

        // Remove password from response
        const userWithoutPassword = {
            id: user.id,
            name: user.name,
            email: user.email,
            is_verified: user.is_verified,
            role: user.role,
        };

        const response = NextResponse.json({
            message: "Login successful",
            user: userWithoutPassword,
            success: true
        }, { status: 200 });

        const cookieOptions: any = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
        };

        response.cookies.set("Accesstoken", accessToken, {
            ...cookieOptions,
            maxAge: 60 * 30, // 30 minutes
        });

        response.cookies.set("RefreshToken", refreshToken, {
            ...cookieOptions,
            maxAge: 60 * 60 * 24 * 3, // 3 days
        });

        return response;
    } catch (error: any) {
        console.error("Login Error:", error);
        return NextResponse.json({ message: "Internal server error", success: false }, { status: 500 });
    }
}