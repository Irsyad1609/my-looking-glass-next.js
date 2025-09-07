import { NextRequest, NextResponse } from 'next/server';

// Ganti dengan IP/hostname dan port lgproxy.py kamu
export async function POST(req: NextRequest) {
  const { command, endpoint } = await req.json();
  // endpoint: '/bird', '/bird6', '/traceroute', '/traceroute6'
  const url = `http://103.254.106.158:5000${endpoint}?q=${encodeURIComponent(command)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Secret': '#Network_121#',
    },
  });
  const text = await res.text();
  return NextResponse.json({ result: text });
}
