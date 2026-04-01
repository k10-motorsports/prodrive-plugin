import { NextResponse } from 'next/server'
import { CAR_CLASSES } from '@/lib/car-models'

export async function GET() {
  return NextResponse.json({
    cars: CAR_CLASSES.map(c => ({
      class: c.class,
      name: c.name,
      description: c.description,
      model: c.source,
      license: c.license,
    })),
  })
}
