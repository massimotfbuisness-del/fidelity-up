import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ATW_API = 'https://api.addtowallet.co'
const ATW_APP = 'https://app.addtowallet.co'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function getInstallUrlFromBatch(batchId: string): Promise<string | null> {
  for (let i = 0; i < 8; i++) {
    await new Promise(r => setTimeout(r, 1500))
    try {
      const res = await fetch(`${ATW_APP}/api/v2/batch/status/${batchId}`, {
        headers: { apikey: process.env.ADDTOWALLET_API_KEY! },
      })
      if (!res.ok) continue
      const data = await res.json()
      const successful = data.results?.successful
      if (Array.isArray(successful) && successful.length > 0 && successful[0].passId) {
        return `${ATW_APP}/passgenerator/${successful[0].passId}`
      }
    } catch {
      // continue polling
    }
  }
  return null
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { pass_id, name, phone, email } = body

  if (!pass_id || !phone || !name) {
    return NextResponse.json({ error: 'pass_id, phone et name sont requis' }, { status: 400 })
  }

  // 1. Load pass + tenant
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
    await supabase.from('clients').update({
      name: name.trim(),
      email: email?.trim() || existing.email || null,
    }).eq('id', existing.id)
  } else {
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

    await supabase.from('events').insert({
      type: 'client_created',
      tenant_id: tenant.id,
      entity_type: 'client',
      entity_id: clientId,
      payload: { phone: phone.trim(), name: name.trim(), email: email?.trim() || null },
    })
  }

  // 3. Add user to Dynamic Pass group on AddToWallet
  const dynamicPassId = pass.addtowallet_pass_id
  let installUrl: string | null = null
  let walletPassId: string | null = existing?.wallet_pass_id || null

  if (dynamicPassId) {
    const userData: Record<string, string> = {
      full_name: name.trim(),
      phone: phone.trim(),
    }
    if (email?.trim()) userData.email = email.trim()

    const addRes = await fetch(`${ATW_API}/api/dynamicPass/addUsers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: process.env.ADDTOWALLET_API_KEY!,
      },
      body: JSON.stringify({
        dynamicPassId,
        data: [userData],
      }),
    })

    if (addRes.ok) {
      const addData = await addRes.json()
      const batchId = addData.batchId

      if (batchId) {
        // Poll batch status to get the individual pass install URL
        installUrl = await getInstallUrlFromBatch(batchId)
      }

      // Fallback to template URL if individual pass not ready yet
      if (!installUrl) {
        installUrl = `${ATW_APP}/passgenerator/${dynamicPassId}`
      }
    }
  }

  // 4. Update client with wallet pass info
  if (installUrl) {
    await supabase.from('clients').update({
      wallet_pass_id: walletPassId,
    }).eq('id', clientId)
  }

  // 5. Log event
  await supabase.from('events').insert({
    type: 'pass_install_link_generated',
    tenant_id: tenant.id,
    entity_type: 'client',
    entity_id: clientId,
    payload: { dynamic_pass_id: dynamicPassId, install_url: installUrl },
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
