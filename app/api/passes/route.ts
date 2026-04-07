import { NextRequest, NextResponse } from 'next/server'

const ATW_BASE = 'https://app.addtowallet.co'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { cardTitle, header, hexBackgroundColor, logoUrl, barcodeType, barcodeValue, textModulesData } = body

  const payload: Record<string, unknown> = {
    cardTitle: cardTitle || 'Carte Fidélité',
    header: header || '',
    hexBackgroundColor: hexBackgroundColor || '#6366f1',
    appleFontColor: '#FFFFFF',
    barcodeType: barcodeType || 'QR_CODE',
  }

  if (logoUrl) payload.logoUrl = logoUrl
  if (barcodeValue) payload.barcodeValue = barcodeValue
  if (textModulesData?.length) payload.textModulesData = textModulesData

  const res = await fetch(`${ATW_BASE}/api/card/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.ADDTOWALLET_API_KEY!,
    },
    body: JSON.stringify(payload),
  })

  const data = await res.json()

  if (!res.ok || !data.cardId) {
    return NextResponse.json({ error: data.msg || data.error || 'Erreur AddToWallet' }, { status: 400 })
  }

  return NextResponse.json({
    passId: data.cardId,
    installUrl: data.shareableUrl,
  })
}
