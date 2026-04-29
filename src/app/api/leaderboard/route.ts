import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/leaderboard — top 20 entries sorted by score descending
export async function GET() {
  try {
    const entries = await db.leaderboardEntry.findMany({
      orderBy: { score: 'desc' },
      take: 20,
    });
    return NextResponse.json(entries.map(e => ({
      id: e.id,
      name: e.name,
      score: e.score,
      mission: e.mission,
      rating: e.rating,
      mode: e.mode,
      createdAt: e.createdAt.toISOString(),
    })));
  } catch (err) {
    console.error('[Leaderboard GET]', err);
    return NextResponse.json([], { status: 500 });
  }
}

// POST /api/leaderboard — add new entry
export async function POST(req: NextRequest) {
  try {
    const { name, score, mission, rating, mode } = await req.json();

    if (!name || typeof score !== 'number' || !rating) {
      return NextResponse.json({ error: 'Missing fields: name, score, rating required' }, { status: 400 });
    }

    if (score < 0) {
      return NextResponse.json({ error: 'Score must be non-negative' }, { status: 400 });
    }

    const entry = await db.leaderboardEntry.create({
      data: {
        name: String(name).slice(0, 20),
        score: Math.floor(score),
        mission: String(mission || '').slice(0, 50),
        rating: String(rating).slice(0, 1),
        mode: String(mode || '').slice(0, 10),
      },
    });

    return NextResponse.json({
      id: entry.id,
      name: entry.name,
      score: entry.score,
      mission: entry.mission,
      rating: entry.rating,
      mode: entry.mode,
      createdAt: entry.createdAt.toISOString(),
    }, { status: 201 });
  } catch (err) {
    console.error('[Leaderboard POST]', err);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
