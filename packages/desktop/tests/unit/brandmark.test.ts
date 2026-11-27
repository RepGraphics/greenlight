import {test} from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import BrandMark from '../../renderer/components/ui/brandmark'
import {brandLogoPath,brandName,brandRepository} from '../../renderer/lib/brand'

test('StreamCloud logo exposes an accessible name when it stands alone',()=>{
    const html=renderToStaticMarkup(React.createElement(BrandMark,{size:48}))
    assert.ok(html.includes('alt="'+brandName+'"'))
    assert.ok(html.includes('src="'+brandLogoPath+'"'))
    assert.ok(html.includes('width="48"'))
})
test('decorative StreamCloud logo does not repeat adjacent text for assistive technology',()=>{
    const html=renderToStaticMarkup(React.createElement(BrandMark,{decorative:true}))
    assert.ok(html.includes('alt=""'))
    assert.ok(html.includes('aria-hidden="true"'))
})
test('display branding keeps the existing fork repository URL',()=>{
    assert.equal(brandName,'StreamCloud')
    assert.equal(brandRepository,'https://github.com/RepGraphics/greenlight')
})
