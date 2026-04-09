import { NextRequest, NextResponse } from 'next/server'

const ATW_API = 'https://api.addtowallet.co'
const ATW_APP = 'https://app.addtowallet.co'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { cardTitle, header, hexBackgroundColor, logoUrl, barcodeType, barcodeValue, textModulesData } = body

  const templateData: Record<string, unknown> = {
    cardTitle: cardTitle || 'Carte Fidélité',
    header: header || '',
    hexBackgroundColor: hexBackgroundColor || '#6366f1',
    appleFontColor: '#FFFFFF',
    barcodeType: barcodeType || 'QR_CODE',
    barcodeValue: '{phone}',  // dynamic — replaced per client at signup
  }

  if (logoUrl) templateData.logoUrl = logoUrl
  if (textModulesData?.length) templateData.textModulesData = textModulesData

  const payload = {
    name: cardTitle || 'Carte Fidélité',
    description: `Programme de fidélité — ${header || cardTitle}`,
    templateData,
    dynamicFields: ['full_name', 'phone'],
  }

  const res = await fetch(`${ATW_API}/api/dynamicPass/template/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.ADDTOWALLET_API_KEY!,
    },
    body: JSON.stringify(payload),
  })

  const data = await res.json()

  if (!res.ok || !data.dynamicPassId) {
    return NextResponse.json({ error: data.msg || data.error || 'Erreur AddToWallet' }, { status: 400 })
  }

  return NextResponse.json({
    passId: data.dynamicPassId,
    groupId: data.groupId,
    installUrl: `${ATW_APP}/passgenerator/${data.dynamicPassId}`,
  })
}
