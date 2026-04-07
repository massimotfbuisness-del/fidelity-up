export type TenantType = 'restaurant' | 'barber' | 'retail' | 'garage' | 'autre'
export type PassType = 'fidelite' | 'visite' | 'cadeau' | 'coupon'
export type NotificationType = 'visit' | 'dormant' | 'birthday' | 'reward' | 'referral'

export interface Tenant {
  id: string
  name: string
  logo_url?: string
  primary_color: string
  address?: string
  phone?: string
  email: string
  type: TenantType
  slug: string
  owner_id: string
  created_at: string
}

export interface Client {
  id: string
  phone: string
  name?: string
  birthday?: string
  last_visit?: string
  visits_count: number
  reward_level: number
  wallet_pass_id?: string
  tenant_id: string
  created_at: string
}

export interface Pass {
  id: string
  type: PassType
  name: string
  description?: string
  reward_threshold: number
  reward_description?: string
  addtowallet_pass_id?: string
  qr_url?: string
  install_url?: string
  tenant_id: string
  created_at: string
}

export interface Visit {
  id: string
  client_id: string
  tenant_id: string
  pass_id?: string
  created_at: string
}

export interface Reward {
  id: string
  client_id: string
  tenant_id: string
  type: string
  description?: string
  unlocked_at: string
  redeemed: boolean
  redeemed_at?: string
}

export interface TenantProfile {
  id: string
  tenant_id: string
  has_ubereats: boolean
  has_whatsapp_orders: boolean
  has_reservation_system: boolean
  has_loyalty_today: boolean
  staff_size?: number
  avg_daily_clients?: number
}

export interface DashboardStats {
  totalPasses: number
  totalClients: number
  totalVisits: number
  activeClients: number
  dormantClients: number
}
