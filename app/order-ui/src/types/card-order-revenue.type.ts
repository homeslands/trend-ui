import { IBase } from './base.type'

export interface CardOrderRevenue extends IBase {
  date: Date;

  totalCardOrders: number;

  totalRevenue: number;

  bankRevenue: number;

  cashRevenue: number;

  cardCount: number;

  selfTopupOrderCount: number;

  giftTopupOrderCount: number;

  cardPurchaseOrderCount: number;

  minOrderSequence: number;

  maxOrderSequence: number;

  totalCardOrdersByBank: number;

  totalCardOrdersByCash: number;
}


export interface ICardOrderRevenueQuery {
  fromDate?: string
  toDate?: string
  type?: string
}