import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ATW_BASE = 'https://app.addtowallet.co'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { pass_id, name, phone, email } = body

  if (!pass_id || !phone || !name) {
    return NextResponse.json({ error: 'pass_id, phone et name sont requis' }, { status: 400 })
  }

  // 1. Load the pass template to get tenant info
  const { data: pass, error: passErr } = await supabase
    .from('passes')
    .select('*, tenants(*)')
    .eq('id', pass_id)
    .single()

  if (passErr || !pass) {
    return NextResponse.json({ error: 'Pass introuvable' }, { status: 404 })
  }

  const tenant = pass.tenants as { id: string; name: string; primary_color: string; logo_url?: string }

  // 2. Upsert client in Supabase
  const { data: existing } = await supabase
    .from('clients')
    .select('*')
    .eq('phone', phone.trim())
    .eq('tenant_id', tenant.id)
    .single()

  let clientId: string

  if (existing) {
    clientId = existing.id
    // Update name/email if provided
    await supabase.from('clients').update({
      name: name.trim(),
      email: email?.trim() || existing.email || null,
    }).eq('id', existing.id)
  } else {
    // Create new client
    const { data: newClient, error: clientErr } = await supabase
      .from('clients')
      .insert({
        phone: phone.trim(),
        name: name.trim(),
        email: email?.trim() || null,
        tenant_id: tenant.id,
        visits_count: 0,
      })
      .select()
      .single()

    if (clientErr || !newClient) {
      return NextResponse.json({ error: 'Erreur création client' }, { status: 500 })
    }
    clientId = newClient.id

    // Log client_created event
    await supabase.from('events').insert({
      type: 'client_created',
      tenant_id: tenant.id,
      entity_type: 'client',
      entity_id: clientId,
      payload: { phone: phone.trim(), name: name.trim(), email: email?.trim() || null },
    })
  }

  // 3. Create personalised pass on AddToWallet with client phone as barcode
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fidelity-up.vercel.app'

  const textModules = pass.reward_description
    ? [{ id: 'reward', header: `Récompense après ${pass.reward_threshold} visites`, body: pass.reward_description }]
    : []

  const atwPayload: Record<string, unknown> = {
    cardTitle: `${tenant.name} — Carte Fidélité`,
    header: tenant.name,
    hexBackgroundColor: tenant.primary_color || '#6366f1',
    appleFontColor: '#FFFFFF',
    barcodeType: 'QR_CODE',
    barcodeValue: phone.trim(),
  }
  if (tenant.logo_url) atwPayload.logoUrl = tenant.logo_url
  if (textModules.length) atwPayload.textModulesData = textModules

  const atwRes = await fetch(`${ATW_BASE}/api/card/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.ADDTOWALLET_API_KEY!,
    },
    body: JSON.stringify(atwPayload),
  })

  const atwData = await atwRes.json()

  if (!atwRes.ok || !atwData.cardId) {
    return NextResponse.json({ error: atwData.msg || 'Erreur AddToWallet' }, { status: 500 })
  }

  const walletPassId = atwData.cardId
  const installUrl = `${ATW_BASE}/passgenerator/${walletPassId}`

  // 4. Store wallet pass info on the client
  await supabase.from('clients').update({
    wallet_pass_id: walletPassId,
  }).eq('id', clientId)

  // 5. Log pass_install_link_generated event
  await supabase.from('events').insert({
    type: 'pass_install_link_generated',
    tenant_id: tenant.id,
    entity_type: 'client',
    entity_id: clientId,
    payload: { wallet_pass_id: walletPassId, install_url: installUrl },
  })

  return NextResponse.json({
    success: true,
    clientId,
    walletPassId,
    installUrl,
    phone: phone.trim(),
    name: name.trim(),
    isNewClient: !existing,
  })
}
