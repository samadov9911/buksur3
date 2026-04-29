import { NextRequest, NextResponse } from 'next/server';

// In-memory leaderboard (works on Vercel serverless — data persists while functions are warm)
interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  mission: string;
  rating: string;
  createdAt: string;
}

const entries: LeaderboardEntry[] = [];

// GET /api/leaderboard — top 20 entries
export async function GET() {
  try {
    const sorted = [...entries]
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
    return NextResponse.json(sorted);
  } catch {
    return NextResponse.json([]);
  }
}

// POST /api/leaderboard — add new entry
export async function POST(req: NextRequest) {
  try {
    const { name, score, mission, rating } = await req.json();
    if (!name || typeof score !== 'number' || !rating) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    const entry: LeaderboardEntry = {
      id: crypto.randomUUID(),
      name: String(name).slice(0, 20),
      score: Math.floor(score),
      mission: String(mission || '').slice(0, 50),
      rating: String(rating).slice(0, 1),
      createdAt: new Date().toISOString(),
    };
    entries.push(entry);
    return NextResponse.json(entry, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
