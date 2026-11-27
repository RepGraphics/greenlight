import {test} from 'node:test'
import assert from 'node:assert/strict'
import {sameController,controllerConfirmationValid} from '../../../desktop-v3/renderer/utils/controllerconfirmation'

const original={index:0,id:'Controller A'}
const other={index:1,id:'Controller B'}
const replacement={index:0,id:'Controller B'}
test('controller confirmation accepts a fresh snapshot of the original controller',()=>{
    assert.equal(sameController(original,{...original}),true)
    assert.equal(controllerConfirmationValid(original,{...original},[{...original},other],true),true)
})
test('disconnect or automatic fallback to another controller invalidates a result',()=>{
    assert.equal(controllerConfirmationValid(original,undefined,[],true),false)
    assert.equal(controllerConfirmationValid(original,other,[other],true),false)
    assert.equal(controllerConfirmationValid(original,original,[other],true),false)
})
test('a replacement at the same browser slot cannot confirm the old result',()=>{
    assert.equal(sameController(original,replacement),false)
    assert.equal(controllerConfirmationValid(original,replacement,[replacement],true),false)
})
test('selection changes and lost focus invalidate captured recommendations',()=>{
    assert.equal(controllerConfirmationValid(original,other,[original,other],true),false)
    assert.equal(controllerConfirmationValid(original,original,[original],false),false)
})
test('manual button index mappings do not depend on controller presence',()=>{
    assert.equal(controllerConfirmationValid(null,undefined,[],false),true)
})
