import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const dataDir = path.join(process.cwd(), 'src/data/years');
    const files = fs.readdirSync(dataDir);
    
    const years = files
      .filter(file => file.endsWith('.ts'))
      .map(file => file.replace('.ts', ''))
      .sort((a, b) => b.localeCompare(a));
    
    return NextResponse.json({ years });
  } catch (error) {
    console.error('Error fetching years:', error);
    return NextResponse.json({ error: 'Failed to fetch available years' }, { status: 500 });
  }
}