import React from 'react'
import {brandLogoPath,brandName} from '../../lib/brand'

export default function BrandMark({size=32,decorative=false}:{size?:number;decorative?:boolean}){
    return <img src={brandLogoPath} width={size} height={size} alt={decorative?'':brandName} aria-hidden={decorative||undefined} style={{objectFit:'contain',flexShrink:0}}/>
}
