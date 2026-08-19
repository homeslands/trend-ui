import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProductVariantSelect from '../product-variant-select'
import { IProductVariant } from '@/types'

const variants = [
  { slug: 'v-m', price: 45000, size: { slug: 's-m', name: 'm' } },
  { slug: 'v-l', price: 55000, size: { slug: 's-l', name: 'l' } },
] as IProductVariant[]

describe('ProductVariantSelect', () => {
  it('hiển thị variant đang được chọn của dòng, không phải variant đầu tiên', () => {
    render(<ProductVariantSelect variants={variants} value="v-l" onChange={vi.fn()} />)
    expect(screen.getByText('Size L')).toBeInTheDocument()
  })

  it('không crash khi thiếu danh sách variant', () => {
    expect(() =>
      render(<ProductVariantSelect variants={undefined} value={undefined} onChange={vi.fn()} />),
    ).not.toThrow()
  })

  it('không crash khi danh sách variant rỗng', () => {
    expect(() =>
      render(<ProductVariantSelect variants={[]} value={undefined} onChange={vi.fn()} />),
    ).not.toThrow()
  })

  it('hiển thị size đã lưu khi món không còn danh sách variant', () => {
    render(<ProductVariantSelect variants={[]} value={undefined} fallbackLabel="m" onChange={vi.fn()} />)
    expect(screen.getByText('Size M')).toBeInTheDocument()
  })

  it('không hiển thị gì khi vừa thiếu variant vừa thiếu size đã lưu', () => {
    const { container } = render(<ProductVariantSelect variants={[]} value={undefined} onChange={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
