// Posição do menu flutuante da imagem/caixa: dentro da área, invertendo o lado
// perto da borda direita e indo para baixo quando não há espaço acima
import { describe, expect, it } from 'vitest'
import { placeObjectToolbar } from '../../src/react/floating/ObjectToolbar'

const area = { width: 900, height: 420 }
const menu = { width: 450, height: 30 }

describe('placeObjectToolbar', () => {
  it('normal: acima do objeto, a partir da borda esquerda dele', () => {
    const box = { top: 200, left: 100, right: 220, bottom: 320 }
    expect(placeObjectToolbar(box, menu, area)).toEqual({ top: 200 - 30 - 6, left: 100 })
  })

  it('perto da borda direita: alinha pela direita do objeto', () => {
    const box = { top: 200, left: 700, right: 820, bottom: 320 }
    expect(placeObjectToolbar(box, menu, area)).toEqual({ top: 164, left: 820 - 450 })
  })

  it('sem espaço acima: vai para baixo do objeto', () => {
    const box = { top: 8, left: 16, right: 136, bottom: 128 }
    expect(placeObjectToolbar(box, menu, area)).toEqual({ top: 128 + 6, left: 16 })
  })

  it('canto superior direito: inverte nos dois sentidos', () => {
    const box = { top: 0, left: 760, right: 880, bottom: 120 }
    expect(placeObjectToolbar(box, menu, area)).toEqual({ top: 126, left: 430 })
  })

  it('nunca passa das bordas laterais (objeto largo ou área estreita)', () => {
    const narrow = { width: 300, height: 420 }
    const box = { top: 200, left: 10, right: 290, bottom: 320 }
    const { left } = placeObjectToolbar(box, menu, narrow)
    expect(left).toBe(4)
  })
})
