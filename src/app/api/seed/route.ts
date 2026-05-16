import { NextRequest, NextResponse } from 'next/server';
import { seedDatabase } from '../../../lib/seed';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const force = String(searchParams.get('force') || '').toLowerCase() === 'true';

    // Protect production seeding with a shared secret.
    if (process.env.NODE_ENV === 'production') {
      const provided = request.headers.get('x-seed-secret') || searchParams.get('secret');
      if (!process.env.SEED_SECRET || provided !== process.env.SEED_SECRET) {
        return NextResponse.json(
          {
            success: false,
            message: 'Unauthorized seed request'
          },
          { status: 401 }
        );
      }
    }

    await seedDatabase({ force });
    return NextResponse.json({
      success: true,
      message: force ? 'Database force-seeded successfully' : 'Database seeded successfully'
    });
  } catch (error: any) {
    console.error('Seed error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to seed database',
      error: error.message
    }, { status: 500 });
  }
}