import { client } from './client'
import type { CoinTransaction } from '../types'

export interface CoinInfo {
  balance: number
  transactions: CoinTransaction[]
}

export interface Referrer {
  name: string
  avatar: string
  color: string
}

export const coinsApi = {
  getMyCoins: async (): Promise<CoinInfo> => {
    const { data } = await client.get('/members/me/coins')
    return { balance: data.balance, transactions: data.transactions ?? [] }
  },

  getOrCreateReferralLink: async (): Promise<string> => {
    const { data } = await client.get('/members/me/referral-link')
    return data.token
  },

  getReferrer: async (token: string): Promise<Referrer> => {
    const { data } = await client.get(`/referral/${token}`)
    return data.referrer
  },
}
