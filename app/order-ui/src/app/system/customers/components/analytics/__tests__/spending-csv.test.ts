import { describe, it, expect } from 'vitest'
import { buildSpendingCsv } from '../spending-csv'

const HEADERS = ['Khách hàng', 'Ngày ĐK', 'Tổng chi', 'Bank', 'Cash', 'Point', 'Credit']

const row = (customerName: string) => ({
  customerSlug: 'c1',
  customerName,
  customerRegisteredAt: '2026-07-01T08:30:00',
  totalAmount: 1000,
  totalAmountBank: 500,
  totalAmountCash: 300,
  totalAmountPoint: 150,
  totalAmountCreditCard: 50,
})

describe('buildSpendingCsv', () => {
  it('writes header then one line per row', () => {
    const csv = buildSpendingCsv([row('Nguyen Van An')], HEADERS)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('Khách hàng,Ngày ĐK,Tổng chi,Bank,Cash,Point,Credit')
    expect(lines[1]).toBe('Nguyen Van An,01/07/2026,1000,500,300,150,50')
  })

  it('quotes and escapes a name containing a comma', () => {
    const csv = buildSpendingCsv([row('An, Nguyen')], HEADERS)
    expect(csv.split('\n')[1]).toContain('"An, Nguyen"')
  })

  it('doubles embedded double quotes', () => {
    const csv = buildSpendingCsv([row('An "Bo" Nguyen')], HEADERS)
    expect(csv.split('\n')[1]).toContain('"An ""Bo"" Nguyen"')
  })

  it('quotes a name containing a newline', () => {
    const csv = buildSpendingCsv([row('An\nNguyen')], HEADERS)
    expect(csv).toContain('"An\nNguyen"')
  })

  it('returns only the header for an empty list', () => {
    expect(buildSpendingCsv([], HEADERS)).toBe(HEADERS.join(','))
  })

  it('prefixes a formula-triggering customerName with an apostrophe', () => {
    const triggers = ['=1+1', '+1', '-1', '@SUM(A1:A2)', '\tfoo']
    for (const name of triggers) {
      const csv = buildSpendingCsv([row(name)], HEADERS)
      const firstCell = csv.split('\n')[1].split(',')[0]
      expect(firstCell).toBe(`'${name}`)
    }
  })

  it('does not touch numeric columns when customerName carries a formula payload', () => {
    const csv = buildSpendingCsv([row('=HYPERLINK("http://evil.com")')], HEADERS)
    const lastLine = csv.split('\n')[1]
    expect(lastLine.endsWith(',1000,500,300,150,50')).toBe(true)
  })

  it('guards a leading carriage return with an apostrophe and still quotes the cell', () => {
    const csv = buildSpendingCsv([row('\rfoo')], HEADERS)
    const firstCell = csv.split('\n')[1].split(',')[0]
    expect(firstCell).toBe('"\'\rfoo"')
  })

  it('quotes a name containing a bare carriage return', () => {
    const csv = buildSpendingCsv([row('An\rNguyen')], HEADERS)
    expect(csv).toContain('"An\rNguyen"')
  })
})
